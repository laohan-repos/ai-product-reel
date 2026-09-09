import { getDatabase, type Database } from '@/lib/database';
import {
  createModelConfigsTable,
  createProductOverviewTables,
  createProductVideoPlanTables,
  createReferenceOverviewTables,
} from '@/db/schema';
import { DEFAULT_PRODUCT_VIDEO_PLAN_PROMPT } from '@/lib/product-video-plan-prompt';
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

function completionUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (!/\/chat\/completions\/?$/.test(url.pathname))
    url.pathname = `${url.pathname.replace(/\/$/, '')}/chat/completions`;
  return url.toString();
}

async function initialize() {
  const db = database();
  for (const source of [
    createModelConfigsTable,
    createReferenceOverviewTables,
    createProductOverviewTables,
    createProductVideoPlanTables,
  ])
    for (const statement of source
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
  await ensureWorkflowData(db);
  return db;
}

async function overviewDataUrl(
  db: Database,
  table: 'reference' | 'product',
  id: number,
) {
  const overviewTable =
    table === 'reference' ? 'reference_overviews' : 'product_overviews';
  const chunkTable =
    table === 'reference'
      ? 'reference_overview_chunks'
      : 'product_overview_chunks';
  const idColumn = table === 'reference' ? 'overview_id' : 'overview_id';
  const overview = await db
    .prepare(`SELECT mime_type FROM ${overviewTable} WHERE id = ?`)
    .bind(id)
    .first<{ mime_type: string }>();
  if (!overview) return null;
  const chunks = await db
    .prepare(
      `SELECT file_data FROM ${chunkTable} WHERE ${idColumn} = ? ORDER BY part_index`,
    )
    .bind(id)
    .all<{ file_data: unknown }>();
  const bytes = new Uint8Array(
    await new Blob(
      chunks.results.map((item) => binaryPart(item.file_data)),
    ).arrayBuffer(),
  );
  return `data:${overview.mime_type};base64,${toBase64(bytes)}`;
}

export async function GET(request: Request) {
  const db = await initialize();
  const workflowId =
    Number(new URL(request.url).searchParams.get('workflow_id')) || 1;
  const result = await db
    .prepare(
      'SELECT id, reference_overview_id, product_overview_id, name, product_brief, content, created_at FROM product_video_plans WHERE workflow_id = ? ORDER BY id DESC LIMIT 1',
    )
    .bind(workflowId)
    .all();
  return Response.json({ plans: result.results });
}

export async function POST(request: Request) {
  const input = (await request.json()) as {
    reference_overview_id?: unknown;
    product_overview_id?: unknown;
    workflow_id?: unknown;
    prompt?: unknown;
    product_brief?: unknown;
  };
  if (
    typeof input.reference_overview_id !== 'number' ||
    typeof input.product_overview_id !== 'number' ||
    typeof input.workflow_id !== 'number'
  )
    return Response.json(
      { error: '请选择参考视频预览图和产品预览图' },
      { status: 400 },
    );
  if (input.prompt !== undefined && typeof input.prompt !== 'string')
    return Response.json({ error: '提示词格式不正确' }, { status: 400 });
  if (
    input.product_brief !== undefined &&
    typeof input.product_brief !== 'string'
  )
    return Response.json({ error: '产品信息格式不正确' }, { status: 400 });

  const prompt =
    typeof input.prompt === 'string' && input.prompt.trim()
      ? input.prompt.trim().slice(0, 8000)
      : DEFAULT_PRODUCT_VIDEO_PLAN_PROMPT;
  const productBrief =
    typeof input.product_brief === 'string'
      ? input.product_brief.trim().slice(0, 2000)
      : '';
  const db = await initialize();
  const config = await db
    .prepare(
      "SELECT model_id, base_url, api_key FROM model_configs WHERE model_type = 'multimodal'",
    )
    .first<{ model_id: string; base_url: string; api_key: string }>();
  if (!config?.model_id || !config.base_url || !config.api_key)
    return Response.json(
      { error: '请先完成多模态模型连接配置' },
      { status: 400 },
    );

  const [referenceImage, productImage] = await Promise.all([
    overviewDataUrl(db, 'reference', input.reference_overview_id),
    overviewDataUrl(db, 'product', input.product_overview_id),
  ]);
  if (!referenceImage || !productImage)
    return Response.json({ error: '所选预览图版本不存在' }, { status: 404 });

  const requestText = productBrief
    ? `${prompt}\n\n用户补充的产品信息：\n${productBrief}`
    : `${prompt}\n\n用户没有补充产品文字信息，请只依据产品预览图中的可见内容进行客观描述。`;
  let response: Response;
  try {
    response = await fetch(completionUrl(config.base_url), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.api_key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model_id,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: requestText },
              { type: 'text', text: '第一张：参考视频预览图' },
              { type: 'image_url', image_url: { url: referenceImage } },
              { type: 'text', text: '第二张：我的产品预览图' },
              { type: 'image_url', image_url: { url: productImage } },
            ],
          },
        ],
      }),
    });
  } catch {
    return Response.json(
      { error: '无法连接多模态模型，请检查网络与接口地址' },
      { status: 502 },
    );
  }

  const payload = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!response.ok)
    return Response.json(
      {
        error: payload.error?.message ?? `模型接口返回 HTTP ${response.status}`,
      },
      { status: 502 },
    );
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content)
    return Response.json(
      { error: '模型没有返回有效的产品视频方案' },
      { status: 502 },
    );

  const existing = await db
    .prepare(
      'SELECT id FROM product_video_plans WHERE workflow_id = ? ORDER BY id DESC LIMIT 1',
    )
    .bind(input.workflow_id)
    .first<{ id: number }>();
  if (existing) {
    await db
      .prepare(
        'UPDATE product_video_plans SET reference_overview_id = ?, product_overview_id = ?, prompt = ?, product_brief = ?, content = ? WHERE id = ?',
      )
      .bind(
        input.reference_overview_id,
        input.product_overview_id,
        prompt,
        productBrief,
        content,
        existing.id,
      )
      .run();
    return Response.json({ id: existing.id, content });
  }
  const result = await db
    .prepare(
      'INSERT INTO product_video_plans (workflow_id, reference_overview_id, product_overview_id, prompt, product_brief, content) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(
      input.workflow_id,
      input.reference_overview_id,
      input.product_overview_id,
      prompt,
      productBrief,
      content,
    )
    .run();
  return Response.json({ id: result.meta.last_row_id, content });
}

export async function DELETE(request: Request) {
  const input = (await request.json()) as { id?: unknown };
  if (typeof input.id !== 'number')
    return Response.json({ error: '产品视频方案信息不正确' }, { status: 400 });
  const db = await initialize();
  await db
    .prepare('DELETE FROM product_video_plans WHERE id = ?')
    .bind(input.id)
    .run();
  return Response.json({ ok: true });
}
