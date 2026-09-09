import { getDatabase } from '@/lib/database';
import { createFinalVideoTables } from '@/db/schema';

const database = getDatabase;

async function initialize() {
  const db = database();
  for (const statement of createFinalVideoTables
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
  return db;
}

export async function GET(request: Request) {
  const db = await initialize();
  const workflowId =
    Number(new URL(request.url).searchParams.get('workflow_id')) || 1;
  const videos = await db
    .prepare(
      'SELECT id, workflow_id, plan_id, mime_type, file_size, created_at FROM final_videos WHERE workflow_id = ? ORDER BY id DESC',
    )
    .bind(workflowId)
    .all();
  return Response.json({
    videos: videos.results,
    video: videos.results[0] ?? null,
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get('file');
  const workflowId = Number(form.get('workflow_id'));
  const planId = Number(form.get('plan_id'));
  if (!(file instanceof File) || !workflowId || !planId)
    return Response.json({ error: '合成视频信息不正确' }, { status: 400 });
  if (!file.type.startsWith('video/'))
    return Response.json({ error: '请上传视频文件' }, { status: 400 });

  const db = await initialize();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await db
    .prepare(
      'INSERT INTO final_videos (workflow_id, plan_id, mime_type, file_size) VALUES (?, ?, ?, ?)',
    )
    .bind(workflowId, planId, file.type, bytes.byteLength)
    .run();
  const id = Number(result.meta.last_row_id);
  const chunkSize = 512 * 1024;
  for (
    let offset = 0, partIndex = 0;
    offset < bytes.length;
    offset += chunkSize, partIndex += 1
  )
    await db
      .prepare(
        'INSERT INTO final_video_chunks (final_video_id, part_index, file_data) VALUES (?, ?, ?)',
      )
      .bind(id, partIndex, bytes.slice(offset, offset + chunkSize))
      .run();
  return Response.json({
    id,
    mime_type: file.type,
    file_size: bytes.byteLength,
  });
}

export async function DELETE(request: Request) {
  const input = (await request.json().catch(() => ({}))) as { id?: unknown };
  if (
    typeof input.id !== 'number' ||
    !Number.isSafeInteger(input.id) ||
    input.id < 1
  )
    return Response.json({ error: '成片信息不正确' }, { status: 400 });

  const db = await initialize();
  const video = await db
    .prepare('SELECT id FROM final_videos WHERE id = ?')
    .bind(input.id)
    .first();
  if (!video) return Response.json({ error: '成片不存在' }, { status: 404 });

  await db.batch([
    db
      .prepare('DELETE FROM final_video_chunks WHERE final_video_id = ?')
      .bind(input.id),
    db.prepare('DELETE FROM final_videos WHERE id = ?').bind(input.id),
  ]);
  return Response.json({ ok: true });
}
