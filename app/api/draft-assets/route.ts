import { createDraftAssetTables } from '@/db/schema';
import { getDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_SIZE = 200 * 1024 * 1024;
const CHUNK_SIZE = 512 * 1024;

function mediaType(mimeType: string) {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('image/')) return 'image';
  return null;
}

async function initialize() {
  const db = getDatabase();
  for (const statement of createDraftAssetTables
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
  return db;
}

export async function GET(request: Request) {
  const workflowId = Number(new URL(request.url).searchParams.get('workflow_id'));
  const db = await initialize();
  const result = Number.isSafeInteger(workflowId) && workflowId > 0
    ? await db
        .prepare(
          'SELECT id, workflow_id, name, media_type, mime_type, file_size, created_at FROM draft_assets WHERE workflow_id = ? ORDER BY id DESC',
        )
        .bind(workflowId)
        .all()
    : await db
        .prepare(
          'SELECT id, workflow_id, name, media_type, mime_type, file_size, created_at FROM draft_assets ORDER BY id DESC',
        )
        .all();
  return Response.json({ assets: result.results });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get('file');
  const workflowValue = form.get('workflow_id');
  const workflowId = workflowValue === null ? null : Number(workflowValue);
  if (!(file instanceof File) || file.size === 0)
    return Response.json({ error: '请选择要上传的素材' }, { status: 400 });
  if (file.size > MAX_FILE_SIZE)
    return Response.json({ error: '单个素材不能超过 200 MB' }, { status: 400 });
  if (
    workflowId !== null &&
    (!Number.isSafeInteger(workflowId) || workflowId < 1)
  )
    return Response.json({ error: '工作流信息不正确' }, { status: 400 });
  const type = mediaType(file.type);
  if (!type)
    return Response.json(
      { error: '只支持视频、音频和图片素材' },
      { status: 400 },
    );

  const bytes = new Uint8Array(await file.arrayBuffer());
  const db = await initialize();
  if (workflowId !== null) {
    const workflow = await db
      .prepare('SELECT id FROM workflow_runs WHERE id = ?')
      .bind(workflowId)
      .first();
    if (!workflow)
      return Response.json({ error: '工作流不存在' }, { status: 404 });
  }
  const result = await db
    .prepare(
      'INSERT INTO draft_assets (workflow_id, name, media_type, mime_type, file_size) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(workflowId, file.name.slice(0, 255), type, file.type, file.size)
    .run();
  const id = Number(result.meta.last_row_id);
  try {
    for (
      let offset = 0, partIndex = 0;
      offset < bytes.length;
      offset += CHUNK_SIZE, partIndex += 1
    )
      await db
        .prepare(
          'INSERT INTO draft_asset_chunks (asset_id, part_index, file_data) VALUES (?, ?, ?)',
        )
        .bind(id, partIndex, bytes.slice(offset, offset + CHUNK_SIZE))
        .run();
  } catch (error) {
    await db.prepare('DELETE FROM draft_assets WHERE id = ?').bind(id).run();
    throw error;
  }
  const url = new URL(`/api/draft-assets/${id}/file`, request.url).toString();
  return Response.json(
    {
      id,
      workflow_id: workflowId,
      name: file.name,
      media_type: type,
      mime_type: file.type,
      file_size: file.size,
      url,
    },
    { status: 201 },
  );
}
