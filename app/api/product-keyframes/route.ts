import { getDatabase, type Database } from '@/lib/database';
import {
  createModelConfigsTable,
  createProductKeyframeTables,
  createProductOverviewTables,
  createProductVideoPlanTables,
  createReferenceOverviewTables,
} from '@/db/schema';
import { buildKeyframePrompt } from '@/lib/keyframe-prompt';
import { ensureWorkflowData } from '@/lib/workflow-db';

const database = getDatabase;

function binaryPart(value: unknown): Uint8Array<ArrayBuffer> {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  if (typeof value === 'string' && /^\d+(,\d+)*$/.test(value))
    return Uint8Array.from(value.split(',').map(Number));
  return new Uint8Array();
}

function imageEditUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (!/\/images\/edits\/?$/.test(url.pathname))
    url.pathname = `${url.pathname.replace(/\/$/, '')}/images/edits`;
  return url.toString();
}

async function initialize() {
  const db = database();
  for (const source of [
    createModelConfigsTable,
    createReferenceOverviewTables,
    createProductOverviewTables,
    createProductVideoPlanTables,
    createProductKeyframeTables,
  ])
    for (const statement of source
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
  await ensureWorkflowData(db);
  return db;
}

function generationSection(content: string, generationKey: string) {
  const escaped = generationKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(
    new RegExp(`(^|\\n)## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## Generation|$)`),
  );
  return match ? `## ${generationKey}\n${match[2].trim()}` : '';
}

async function productOverviewFile(db: Database, overviewId: number) {
  const overview = await db
    .prepare('SELECT name, mime_type FROM product_overviews WHERE id = ?')
    .bind(overviewId)
    .first<{ name: string; mime_type: string }>();
  if (!overview) return null;
  const chunks = await db
    .prepare(
      'SELECT file_data FROM product_overview_chunks WHERE overview_id = ? ORDER BY part_index',
    )
    .bind(overviewId)
    .all<{ file_data: unknown }>();
  const blob = new Blob(
    chunks.results.map((item) => binaryPart(item.file_data)),
    { type: overview.mime_type },
  );
  return new File([blob], overview.name, { type: overview.mime_type });
}

async function productKeyframeFile(db: Database, keyframeId: number) {
  const keyframe = await db
    .prepare('SELECT mime_type FROM product_keyframes WHERE id = ?')
    .bind(keyframeId)
    .first<{ mime_type: string }>();
  if (!keyframe) return null;
  const chunks = await db
    .prepare(
      'SELECT file_data FROM product_keyframe_chunks WHERE keyframe_id = ? ORDER BY part_index',
    )
    .bind(keyframeId)
    .all<{ file_data: unknown }>();
  const blob = new Blob(
    chunks.results.map((item) => binaryPart(item.file_data)),
    { type: keyframe.mime_type },
  );
  return new File([blob], `product-keyframe-${keyframeId}.png`, {
    type: keyframe.mime_type,
  });
}

export async function GET(request: Request) {
  const db = await initialize();
  const workflowId =
    Number(new URL(request.url).searchParams.get('workflow_id')) || 1;
  const result = await db
    .prepare(
      'SELECT id, plan_id, generation_key, prompt, mime_type, file_size, is_selected, created_at FROM product_keyframes WHERE workflow_id = ? ORDER BY id DESC',
    )
    .bind(workflowId)
    .all();
  return Response.json({ keyframes: result.results });
}

export async function POST(request: Request) {
  const input = (await request.json()) as {
    plan_id?: unknown;
    generation_key?: unknown;
    prompt?: unknown;
    source_keyframe_id?: unknown;
    edit_keyframe_id?: unknown;
  };
  if (
    typeof input.plan_id !== 'number' ||
    typeof input.generation_key !== 'string' ||
    !/^Generation \d+$/i.test(input.generation_key.trim())
  )
    return Response.json({ error: '关键帧生成信息不正确' }, { status: 400 });
  if (input.prompt !== undefined && typeof input.prompt !== 'string')
    return Response.json({ error: '关键帧提示词格式不正确' }, { status: 400 });
  if (
    input.source_keyframe_id !== undefined &&
    typeof input.source_keyframe_id !== 'number'
  )
    return Response.json({ error: '图生图来源格式不正确' }, { status: 400 });
  if (
    input.edit_keyframe_id !== undefined &&
    typeof input.edit_keyframe_id !== 'number'
  )
    return Response.json(
      { error: '图生图编辑目标格式不正确' },
      { status: 400 },
    );
  const isEditing = typeof input.edit_keyframe_id === 'number';

  const db = await initialize();
  const plan = await db
    .prepare(
      'SELECT workflow_id, product_overview_id, content FROM product_video_plans WHERE id = ?',
    )
    .bind(input.plan_id)
    .first<{
      workflow_id: number;
      product_overview_id: number;
      content: string;
    }>();
  if (!plan)
    return Response.json({ error: '产品视频方案不存在' }, { status: 404 });
  const key = input.generation_key.trim().replace(/^generation/i, 'Generation');
  const section = generationSection(plan.content, key);
  if (!section)
    return Response.json({ error: `方案中没有找到 ${key}` }, { status: 404 });
  const prompt = isEditing
    ? typeof input.prompt === 'string'
      ? input.prompt.trim().slice(0, 8000)
      : ''
    : typeof input.prompt === 'string' && input.prompt.trim()
      ? input.prompt.trim().slice(0, 8000)
      : buildKeyframePrompt(section);
  if (isEditing && !prompt)
    return Response.json({ error: '请填写图片修改要求' }, { status: 400 });

  const config = await db
    .prepare(
      "SELECT model_id, base_url, api_key FROM model_configs WHERE model_type = 'image'",
    )
    .first<{ model_id: string; base_url: string; api_key: string }>();
  if (!config?.model_id || !config.base_url || !config.api_key)
    return Response.json(
      { error: '请先完成生图模型连接配置' },
      { status: 400 },
    );
  let source: File | null;
  const sourceKeyframeId =
    typeof input.edit_keyframe_id === 'number'
      ? input.edit_keyframe_id
      : input.source_keyframe_id;
  if (typeof sourceKeyframeId === 'number') {
    const sourceKeyframe = await db
      .prepare(
        'SELECT id FROM product_keyframes WHERE id = ? AND plan_id = ? AND generation_key = ?',
      )
      .bind(sourceKeyframeId, input.plan_id, key)
      .first<{ id: number }>();
    if (!sourceKeyframe)
      return Response.json(
        { error: '图生图来源关键帧不存在' },
        { status: 404 },
      );
    source = await productKeyframeFile(db, sourceKeyframe.id);
  } else {
    source = await productOverviewFile(db, plan.product_overview_id);
  }
  if (!source)
    return Response.json({ error: '图生图来源图片不存在' }, { status: 404 });

  const form = new FormData();
  form.set('model', config.model_id);
  form.set('prompt', prompt);
  form.append('image[]', source, source.name);
  form.set('size', '1024x1536');
  form.set('quality', 'high');
  form.set('n', '1');

  let response: Response;
  try {
    response = await fetch(imageEditUrl(config.base_url), {
      method: 'POST',
      headers: { authorization: `Bearer ${config.api_key}` },
      body: form,
    });
  } catch {
    return Response.json(
      { error: '无法连接生图模型，请检查网络与接口地址' },
      { status: 502 },
    );
  }
  const payload = (await response.json().catch(() => ({}))) as {
    data?: Array<{ b64_json?: string; url?: string }>;
    error?: { message?: string };
  };
  if (!response.ok)
    return Response.json(
      {
        error: payload.error?.message ?? `生图接口返回 HTTP ${response.status}`,
      },
      { status: 502 },
    );

  const resultImage = payload.data?.[0];
  let bytes: Uint8Array;
  let mimeType = 'image/png';
  if (resultImage?.b64_json) {
    const binary = atob(resultImage.b64_json);
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } else if (resultImage?.url) {
    const imageResponse = await fetch(resultImage.url);
    if (!imageResponse.ok)
      return Response.json({ error: '生成图片下载失败' }, { status: 502 });
    mimeType = imageResponse.headers.get('content-type') || 'image/png';
    bytes = new Uint8Array(await imageResponse.arrayBuffer());
  } else {
    return Response.json(
      { error: '生图模型没有返回有效图片' },
      { status: 502 },
    );
  }

  let keyframeId: number;
  if (isEditing) {
    keyframeId = input.edit_keyframe_id!;
    await db.batch([
      db
        .prepare(
          'UPDATE product_keyframes SET is_selected = 0 WHERE plan_id = ? AND generation_key = ?',
        )
        .bind(input.plan_id, key),
      db
        .prepare(
          'UPDATE product_keyframes SET prompt = ?, mime_type = ?, file_size = ?, is_selected = 1 WHERE id = ?',
        )
        .bind(prompt, mimeType, bytes.byteLength, keyframeId),
      db
        .prepare('DELETE FROM product_keyframe_chunks WHERE keyframe_id = ?')
        .bind(keyframeId),
    ]);
  } else {
    await db
      .prepare(
        'UPDATE product_keyframes SET is_selected = 0 WHERE plan_id = ? AND generation_key = ?',
      )
      .bind(input.plan_id, key)
      .run();
    const result = await db
      .prepare(
        'INSERT INTO product_keyframes (workflow_id, plan_id, generation_key, prompt, mime_type, file_size, is_selected) VALUES (?, ?, ?, ?, ?, ?, 1)',
      )
      .bind(
        plan.workflow_id,
        input.plan_id,
        key,
        prompt,
        mimeType,
        bytes.byteLength,
      )
      .run();
    keyframeId = Number(result.meta.last_row_id);
  }
  const chunkSize = 512 * 1024;
  for (
    let offset = 0, partIndex = 0;
    offset < bytes.length;
    offset += chunkSize, partIndex += 1
  )
    await db
      .prepare(
        'INSERT INTO product_keyframe_chunks (keyframe_id, part_index, file_data) VALUES (?, ?, ?)',
      )
      .bind(keyframeId, partIndex, bytes.slice(offset, offset + chunkSize))
      .run();
  return Response.json({ id: keyframeId, generation_key: key, prompt });
}

export async function PATCH(request: Request) {
  const input = (await request.json()) as { id?: unknown };
  if (typeof input.id !== 'number')
    return Response.json({ error: '关键帧信息不正确' }, { status: 400 });
  const db = await initialize();
  const item = await db
    .prepare(
      'SELECT plan_id, generation_key FROM product_keyframes WHERE id = ?',
    )
    .bind(input.id)
    .first<{ plan_id: number; generation_key: string }>();
  if (!item) return Response.json({ error: '关键帧不存在' }, { status: 404 });
  await db.batch([
    db
      .prepare(
        'UPDATE product_keyframes SET is_selected = 0 WHERE plan_id = ? AND generation_key = ?',
      )
      .bind(item.plan_id, item.generation_key),
    db
      .prepare('UPDATE product_keyframes SET is_selected = 1 WHERE id = ?')
      .bind(input.id),
  ]);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const input = (await request.json()) as { id?: unknown };
  if (typeof input.id !== 'number')
    return Response.json({ error: '关键帧信息不正确' }, { status: 400 });
  const db = await initialize();
  const item = await db
    .prepare(
      'SELECT plan_id, generation_key, is_selected FROM product_keyframes WHERE id = ?',
    )
    .bind(input.id)
    .first<{
      plan_id: number;
      generation_key: string;
      is_selected: number;
    }>();
  if (!item) return Response.json({ error: '关键帧不存在' }, { status: 404 });
  await db.batch([
    db
      .prepare('DELETE FROM product_keyframe_chunks WHERE keyframe_id = ?')
      .bind(input.id),
    db.prepare('DELETE FROM product_keyframes WHERE id = ?').bind(input.id),
  ]);
  if (item.is_selected === 1) {
    const replacement = await db
      .prepare(
        'SELECT id FROM product_keyframes WHERE plan_id = ? AND generation_key = ? ORDER BY id DESC LIMIT 1',
      )
      .bind(item.plan_id, item.generation_key)
      .first<{ id: number }>();
    if (replacement)
      await db
        .prepare('UPDATE product_keyframes SET is_selected = 1 WHERE id = ?')
        .bind(replacement.id)
        .run();
  }
  return Response.json({ ok: true });
}
