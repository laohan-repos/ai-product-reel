import { getDatabase } from '@/lib/database';
import {
  createGenerationPlanTables,
  createModelConfigsTable,
  createReferenceOverviewTables,
  createReferenceStructureTables,
} from '@/db/schema';
import { DEFAULT_GENERATION_PLAN_PROMPT } from '@/lib/generation-plan-prompt';

const database = getDatabase;

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
    createGenerationPlanTables,
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
      'SELECT id, structure_id, name, content, created_at FROM generation_plans ORDER BY id DESC',
    )
    .all();
  return Response.json({ plans: result.results });
}

export async function POST(request: Request) {
  const input = (await request.json()) as { structure_id?: unknown };
  if (typeof input.structure_id !== 'number')
    return Response.json(
      { error: '请选择要规划的镜头结构版本' },
      { status: 400 },
    );

  const db = await initialize();
  const structure = await db
    .prepare('SELECT content FROM reference_structures WHERE id = ?')
    .bind(input.structure_id)
    .first<{ content: string }>();
  if (!structure)
    return Response.json({ error: '镜头结构版本不存在' }, { status: 404 });

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
            content: `${DEFAULT_GENERATION_PLAN_PROMPT}\n\n以下是需要重新规划的镜头结构：\n\n${structure.content}`,
          },
        ],
      }),
    });
  } catch {
    return Response.json(
      { error: '无法连接模型，请检查网络与接口地址' },
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
      { error: '模型没有返回有效的生成段规划' },
      { status: 502 },
    );

  const result = await db
    .prepare(
      'INSERT INTO generation_plans (structure_id, content) VALUES (?, ?)',
    )
    .bind(input.structure_id, content)
    .run();
  return Response.json({ id: result.meta.last_row_id, content });
}

export async function DELETE(request: Request) {
  const input = (await request.json()) as { id?: unknown };
  if (typeof input.id !== 'number')
    return Response.json({ error: '生成段规划信息不正确' }, { status: 400 });
  const db = await initialize();
  await db
    .prepare('DELETE FROM generation_plans WHERE id = ?')
    .bind(input.id)
    .run();
  return Response.json({ ok: true });
}
