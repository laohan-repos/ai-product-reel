import { getDatabase, type Database } from '@/lib/database';
import {
  createModelConfigsTable,
  createProductKeyframeTables,
  createProductOverviewTables,
  createProductVideoPlanTables,
  createProductVideoTables,
  createReferenceOverviewTables,
} from '@/db/schema';
import { buildVideoGenerationPrompt } from '@/lib/video-generation-prompt';
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

function toBase64(bytes: Uint8Array) {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    text += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(text);
}

function videoTaskUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (!/\/contents\/generations\/tasks\/?$/.test(url.pathname))
    url.pathname = `${url.pathname.replace(/\/$/, '')}/contents/generations/tasks`;
  return url.toString().replace(/\/$/, '');
}

async function initialize() {
  const db = database();
  for (const source of [
    createModelConfigsTable,
    createReferenceOverviewTables,
    createProductOverviewTables,
    createProductVideoPlanTables,
    createProductKeyframeTables,
    createProductVideoTables,
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

function generationDuration(section: string) {
  const value = Number(section.match(/- 生成时长：\s*(\d+)/)?.[1]);
  return Number.isFinite(value) ? Math.max(5, Math.min(12, value)) : 5;
}

async function keyframeDataUrl(db: Database, id: number) {
  const item = await db
    .prepare('SELECT mime_type FROM product_keyframes WHERE id = ?')
    .bind(id)
    .first<{ mime_type: string }>();
  if (!item) return null;
  const chunks = await db
    .prepare(
      'SELECT file_data FROM product_keyframe_chunks WHERE keyframe_id = ? ORDER BY part_index',
    )
    .bind(id)
    .all<{ file_data: unknown }>();
  const blob = new Blob(
    chunks.results.map((chunk) => binaryPart(chunk.file_data)),
    { type: item.mime_type },
  );
  return `data:${item.mime_type};base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`;
}

function resultVideoUrl(payload: Record<string, unknown>) {
  const content = payload.content as
    | { video_url?: string | { url?: string } }
    | undefined;
  const value = content?.video_url;
  if (typeof value === 'string') return value;
  if (value && typeof value.url === 'string') return value.url;
  const direct = payload.video_url;
  return typeof direct === 'string' ? direct : '';
}

export async function GET(request: Request) {
  const db = await initialize();
  const workflowId =
    Number(new URL(request.url).searchParams.get('workflow_id')) || 1;
  const result = await db
    .prepare(
      'SELECT id, plan_id, generation_key, keyframe_id, prompt, duration, task_id, status, video_url, mime_type, file_size, is_selected, error_message, created_at, updated_at FROM product_videos WHERE workflow_id = ? ORDER BY id DESC',
    )
    .bind(workflowId)
    .all();
  return Response.json({ videos: result.results });
}

export async function POST(request: Request) {
  const input = (await request.json()) as {
    plan_id?: unknown;
    generation_key?: unknown;
    keyframe_id?: unknown;
    prompt?: unknown;
  };
  if (
    typeof input.plan_id !== 'number' ||
    typeof input.keyframe_id !== 'number' ||
    typeof input.generation_key !== 'string' ||
    !/^Generation \d+$/i.test(input.generation_key.trim())
  )
    return Response.json({ error: '分镜视频生成信息不正确' }, { status: 400 });
  if (input.prompt !== undefined && typeof input.prompt !== 'string')
    return Response.json({ error: '视频提示词格式不正确' }, { status: 400 });

  const db = await initialize();
  const plan = await db
    .prepare(
      'SELECT workflow_id, content FROM product_video_plans WHERE id = ?',
    )
    .bind(input.plan_id)
    .first<{ workflow_id: number; content: string }>();
  if (!plan)
    return Response.json({ error: '产品视频方案不存在' }, { status: 404 });
  const key = input.generation_key.trim().replace(/^generation/i, 'Generation');
  const section = generationSection(plan.content, key);
  if (!section)
    return Response.json({ error: `方案中没有找到 ${key}` }, { status: 404 });
  const keyframe = await db
    .prepare(
      'SELECT id FROM product_keyframes WHERE id = ? AND plan_id = ? AND generation_key = ?',
    )
    .bind(input.keyframe_id, input.plan_id, key)
    .first();
  if (!keyframe)
    return Response.json(
      { error: '所选关键帧与生成段不匹配' },
      { status: 400 },
    );
  const firstFrame = await keyframeDataUrl(db, input.keyframe_id);
  if (!firstFrame)
    return Response.json({ error: '所选关键帧不存在' }, { status: 404 });
  const prompt =
    typeof input.prompt === 'string' && input.prompt.trim()
      ? input.prompt.trim().slice(0, 8000)
      : buildVideoGenerationPrompt(section);
  const duration = generationDuration(section);
  const config = await db
    .prepare(
      "SELECT model_id, base_url, api_key FROM model_configs WHERE model_type = 'video'",
    )
    .first<{ model_id: string; base_url: string; api_key: string }>();
  if (!config?.model_id || !config.base_url || !config.api_key)
    return Response.json(
      { error: '请先完成视频生成模型连接配置' },
      { status: 400 },
    );

  let response: Response;
  try {
    response = await fetch(videoTaskUrl(config.base_url), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.api_key}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        model: config.model_id,
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: firstFrame },
            role: 'first_frame',
          },
        ],
        ratio: '9:16',
        duration,
        resolution: '480p',
        watermark: false,
        generate_audio: true,
      }),
    });
  } catch {
    return Response.json(
      { error: '无法连接视频生成模型，请检查网络与接口地址' },
      { status: 502 },
    );
  }
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.id)
    return Response.json(
      {
        error:
          payload.error?.message ?? `视频生成接口返回 HTTP ${response.status}`,
      },
      { status: 502 },
    );
  const result = await db
    .prepare(
      'INSERT INTO product_videos (workflow_id, plan_id, generation_key, keyframe_id, prompt, duration, task_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      plan.workflow_id,
      input.plan_id,
      key,
      input.keyframe_id,
      prompt,
      duration,
      payload.id,
      payload.status || 'queued',
    )
    .run();
  return Response.json({
    id: result.meta.last_row_id,
    task_id: payload.id,
    status: payload.status || 'queued',
  });
}

export async function PATCH(request: Request) {
  const input = (await request.json()) as { id?: unknown; action?: unknown };
  if (
    typeof input.id !== 'number' ||
    !['refresh', 'select'].includes(String(input.action))
  )
    return Response.json({ error: '视频操作信息不正确' }, { status: 400 });
  const db = await initialize();
  const item = await db
    .prepare(
      'SELECT id, plan_id, generation_key, task_id, status FROM product_videos WHERE id = ?',
    )
    .bind(input.id)
    .first<{
      id: number;
      plan_id: number;
      generation_key: string;
      task_id: string;
      status: string;
    }>();
  if (!item) return Response.json({ error: '分镜视频不存在' }, { status: 404 });

  if (input.action === 'select') {
    if (item.status !== 'succeeded')
      return Response.json({ error: '只能选择已完成的视频' }, { status: 400 });
    await db.batch([
      db
        .prepare(
          'UPDATE product_videos SET is_selected = 0 WHERE plan_id = ? AND generation_key = ?',
        )
        .bind(item.plan_id, item.generation_key),
      db
        .prepare('UPDATE product_videos SET is_selected = 1 WHERE id = ?')
        .bind(item.id),
    ]);
    return Response.json({ ok: true });
  }

  if (['succeeded', 'failed'].includes(item.status))
    return Response.json({ status: item.status });
  const config = await db
    .prepare(
      "SELECT base_url, api_key FROM model_configs WHERE model_type = 'video'",
    )
    .first<{ base_url: string; api_key: string }>();
  if (!config?.base_url || !config.api_key)
    return Response.json({ error: '视频模型配置已失效' }, { status: 400 });
  let response: Response;
  try {
    response = await fetch(`${videoTaskUrl(config.base_url)}/${item.task_id}`, {
      headers: { authorization: `Bearer ${config.api_key}` },
    });
  } catch {
    return Response.json({ error: '视频任务状态查询失败' }, { status: 502 });
  }
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  > & {
    status?: string;
    error?: { message?: string; code?: string };
  };
  if (!response.ok)
    return Response.json(
      {
        error: payload.error?.message ?? `状态接口返回 HTTP ${response.status}`,
      },
      { status: 502 },
    );
  const status = payload.status || 'running';
  if (status === 'failed') {
    const message =
      payload.error?.message || payload.error?.code || '视频生成任务失败';
    await db
      .prepare(
        "UPDATE product_videos SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .bind(message, item.id)
      .run();
    return Response.json({ status, error: message });
  }
  if (status !== 'succeeded') {
    await db
      .prepare(
        'UPDATE product_videos SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      )
      .bind(status, item.id)
      .run();
    return Response.json({ status });
  }

  const url = resultVideoUrl(payload);
  if (!url)
    return Response.json(
      { error: '任务成功但没有返回视频地址' },
      { status: 502 },
    );
  const videoResponse = await fetch(url);
  if (!videoResponse.ok)
    return Response.json({ error: '生成视频下载失败' }, { status: 502 });
  const mimeType = videoResponse.headers.get('content-type') || 'video/mp4';
  const bytes = new Uint8Array(await videoResponse.arrayBuffer());
  await db
    .prepare(
      'UPDATE product_videos SET is_selected = 0 WHERE plan_id = ? AND generation_key = ?',
    )
    .bind(item.plan_id, item.generation_key)
    .run();
  await db
    .prepare(
      "UPDATE product_videos SET status = 'succeeded', video_url = ?, mime_type = ?, file_size = ?, is_selected = 1, error_message = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(url, mimeType, bytes.byteLength, item.id)
    .run();
  const chunkSize = 512 * 1024;
  for (
    let offset = 0, partIndex = 0;
    offset < bytes.length;
    offset += chunkSize, partIndex += 1
  )
    await db
      .prepare(
        'INSERT INTO product_video_chunks (video_id, part_index, file_data) VALUES (?, ?, ?) ON CONFLICT(video_id, part_index) DO UPDATE SET file_data = excluded.file_data',
      )
      .bind(item.id, partIndex, bytes.slice(offset, offset + chunkSize))
      .run();
  return Response.json({ status, video_url: url });
}

export async function DELETE(request: Request) {
  const input = (await request.json()) as { id?: unknown };
  if (typeof input.id !== 'number')
    return Response.json({ error: '视频信息不正确' }, { status: 400 });
  const db = await initialize();
  const item = await db
    .prepare(
      'SELECT plan_id, generation_key, is_selected FROM product_videos WHERE id = ?',
    )
    .bind(input.id)
    .first<{
      plan_id: number;
      generation_key: string;
      is_selected: number;
    }>();
  if (!item) return Response.json({ error: '分镜视频不存在' }, { status: 404 });
  await db.batch([
    db
      .prepare('DELETE FROM product_video_chunks WHERE video_id = ?')
      .bind(input.id),
    db.prepare('DELETE FROM product_videos WHERE id = ?').bind(input.id),
  ]);
  if (item.is_selected === 1) {
    const replacement = await db
      .prepare(
        "SELECT id FROM product_videos WHERE plan_id = ? AND generation_key = ? AND status = 'succeeded' ORDER BY id DESC LIMIT 1",
      )
      .bind(item.plan_id, item.generation_key)
      .first<{ id: number }>();
    if (replacement)
      await db
        .prepare('UPDATE product_videos SET is_selected = 1 WHERE id = ?')
        .bind(replacement.id)
        .run();
  }
  return Response.json({ ok: true });
}
