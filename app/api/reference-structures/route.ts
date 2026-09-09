import { getDatabase } from '@/lib/database';
import {
  createModelConfigsTable,
  createReferenceOverviewTables,
  createReferenceStructureTables,
} from '@/db/schema';
import { DEFAULT_REFERENCE_ANALYSIS_PROMPT } from '@/lib/reference-analysis-prompt';

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
    createReferenceStructureTables,
  ])
    for (const statement of source
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
  return db;
}
export async function GET() {
  const db = await initialize();
  const result = await db
    .prepare(
      'SELECT id, overview_id, name, content, created_at FROM reference_structures ORDER BY id DESC',
    )
    .all();
  return Response.json({ structures: result.results });
}

export async function POST(request: Request) {
  const input = (await request.json()) as {
    overview_id?: unknown;
    prompt?: unknown;
  };
  if (typeof input.overview_id !== 'number')
    return Response.json(
      { error: '请选择要分析的总览图版本' },
      { status: 400 },
    );
  if (input.prompt !== undefined && typeof input.prompt !== 'string')
    return Response.json({ error: '提示词格式不正确' }, { status: 400 });
  const prompt =
    typeof input.prompt === 'string' && input.prompt.trim()
      ? input.prompt.trim().slice(0, 4000)
      : DEFAULT_REFERENCE_ANALYSIS_PROMPT;
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
  const overview = await db
    .prepare('SELECT mime_type FROM reference_overviews WHERE id = ?')
    .bind(input.overview_id)
    .first<{ mime_type: string }>();
  if (!overview)
    return Response.json({ error: '总览图版本不存在' }, { status: 404 });
  const chunks = await db
    .prepare(
      'SELECT file_data FROM reference_overview_chunks WHERE overview_id = ? ORDER BY part_index',
    )
    .bind(input.overview_id)
    .all<{ file_data: unknown }>();
  const image = new Blob(
    chunks.results.map((chunk) => binaryPart(chunk.file_data)),
    { type: overview.mime_type },
  );
  const dataUrl = `data:${overview.mime_type};base64,${toBase64(new Uint8Array(await image.arrayBuffer()))}`;
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
              {
                type: 'text',
                text: prompt,
              },
              { type: 'image_url', image_url: { url: dataUrl } },
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
      { error: '模型没有返回有效的镜头结构' },
      { status: 502 },
    );
  const result = await db
    .prepare(
      'INSERT INTO reference_structures (overview_id, content) VALUES (?, ?)',
    )
    .bind(input.overview_id, content)
    .run();
  return Response.json({ id: result.meta.last_row_id, content });
}

export async function DELETE(request: Request) {
  const input = (await request.json()) as { id?: unknown };
  if (typeof input.id !== 'number')
    return Response.json({ error: '结构分析信息不正确' }, { status: 400 });
  const db = await initialize();
  await db
    .prepare('DELETE FROM reference_structures WHERE id = ?')
    .bind(input.id)
    .run();
  return Response.json({ ok: true });
}
