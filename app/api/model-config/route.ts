import { getDatabase } from '@/lib/database';
import { createModelConfigsTable, modelConfigDefaults } from '@/db/schema';

export const dynamic = 'force-dynamic';

type ModelType = 'multimodal' | 'image' | 'video';
type ModelConfigInput = {
  model_type: ModelType;
  model_id: string;
  base_url: string;
  api_key: string;
};

const modelTypes = new Set<ModelType>(['multimodal', 'image', 'video']);

function database() {
  return getDatabase();
}

async function initialize() {
  const db = database();
  await db.prepare(createModelConfigsTable).run();
  await db.batch(
    modelConfigDefaults.map((item) =>
      db
        .prepare(`
    INSERT INTO model_configs (model_type, model_id, base_url, api_key)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(model_type) DO NOTHING
  `)
        .bind(item.model_type, item.model_id, item.base_url, item.api_key),
    ),
  );
  return db;
}

export async function GET() {
  const db = await initialize();
  const result = await db
    .prepare(`
    SELECT model_type, model_id, base_url, api_key, updated_at
    FROM model_configs
    ORDER BY CASE model_type
      WHEN 'multimodal' THEN 1
      WHEN 'image' THEN 2
      WHEN 'video' THEN 3
    END
  `)
    .all();
  return Response.json({ configs: result.results });
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as { configs?: unknown };
  if (!Array.isArray(payload.configs) || payload.configs.length !== 3) {
    return Response.json({ error: '必须提交三组模型配置' }, { status: 400 });
  }

  const configs: ModelConfigInput[] = [];
  for (const item of payload.configs) {
    if (!item || typeof item !== 'object') {
      return Response.json({ error: '模型配置格式不正确' }, { status: 400 });
    }
    const input = item as Record<string, unknown>;
    if (!modelTypes.has(input.model_type as ModelType)) {
      return Response.json({ error: '模型类型不正确' }, { status: 400 });
    }
    for (const field of ['model_id', 'base_url', 'api_key'] as const) {
      if (typeof input[field] !== 'string') {
        return Response.json(
          { error: `${field} 必须为字符串` },
          { status: 400 },
        );
      }
    }
    const modelId = input.model_id as string;
    const baseUrl = input.base_url as string;
    const apiKey = input.api_key as string;
    configs.push({
      model_type: input.model_type as ModelType,
      model_id: modelId.trim(),
      base_url: baseUrl.trim(),
      api_key: apiKey,
    });
  }

  if (new Set(configs.map((item) => item.model_type)).size !== 3) {
    return Response.json(
      { error: '三种模型类型必须各配置一次' },
      { status: 400 },
    );
  }

  const db = await initialize();
  await db.batch(
    configs.map((item) =>
      db
        .prepare(`
    INSERT INTO model_configs (model_type, model_id, base_url, api_key, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(model_type) DO UPDATE SET
      model_id = excluded.model_id,
      base_url = excluded.base_url,
      api_key = excluded.api_key,
      updated_at = CURRENT_TIMESTAMP
  `)
        .bind(item.model_type, item.model_id, item.base_url, item.api_key),
    ),
  );
  await db.prepare('PRAGMA optimize').run();

  return Response.json({ ok: true });
}
