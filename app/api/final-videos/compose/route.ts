import { createFinalVideoTables } from '@/db/schema';
import { getDatabase } from '@/lib/database';
import { composeVideoClips } from '@/lib/ffmpeg';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function binaryPart(value: unknown): Uint8Array<ArrayBuffer> {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  if (typeof value === 'string' && /^\d+(,\d+)*$/.test(value))
    return Uint8Array.from(value.split(',').map(Number));
  return new Uint8Array();
}

function joinBinaryParts(values: unknown[]) {
  const parts = values.map(binaryPart);
  const bytes = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
}

async function initialize() {
  const db = getDatabase();
  for (const statement of createFinalVideoTables
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
  return db;
}

export async function POST(request: Request) {
  const input = (await request.json().catch(() => ({}))) as {
    clip_ids?: unknown;
    plan_id?: unknown;
    workflow_id?: unknown;
  };
  if (
    typeof input.workflow_id !== 'number' ||
    typeof input.plan_id !== 'number' ||
    !Array.isArray(input.clip_ids) ||
    input.clip_ids.length === 0 ||
    input.clip_ids.length > 50 ||
    !input.clip_ids.every(
      (id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
    )
  )
    return Response.json({ error: '合成视频信息不正确' }, { status: 400 });

  const db = await initialize();
  const clips = [];
  for (const id of input.clip_ids as number[]) {
    const item = await db
      .prepare(
        "SELECT id, workflow_id, plan_id, generation_key, duration, mime_type FROM product_videos WHERE id = ? AND status = 'succeeded' AND is_selected = 1",
      )
      .bind(id)
      .first<{
        duration: number;
        generation_key: string;
        id: number;
        mime_type: string;
        plan_id: number;
        workflow_id: number;
      }>();
    if (
      !item ||
      item.workflow_id !== input.workflow_id ||
      item.plan_id !== input.plan_id
    )
      return Response.json(
        { error: `分镜视频 ${id} 不存在、未完成或未选中` },
        { status: 400 },
      );
    const chunks = await db
      .prepare(
        'SELECT file_data FROM product_video_chunks WHERE video_id = ? ORDER BY part_index',
      )
      .bind(id)
      .all<{ file_data: unknown }>();
    const bytes = joinBinaryParts(
      chunks.results.map((chunk) => chunk.file_data),
    );
    if (bytes.length === 0)
      return Response.json(
        { error: `${item.generation_key} 视频文件为空` },
        { status: 400 },
      );
    clips.push({
      bytes,
      duration: item.duration,
      mimeType: item.mime_type,
    });
  }

  let bytes: Uint8Array;
  try {
    bytes = await composeVideoClips(clips);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'FFmpeg 合成失败' },
      { status: 500 },
    );
  }

  const result = await db
    .prepare(
      'INSERT INTO final_videos (workflow_id, plan_id, mime_type, file_size) VALUES (?, ?, ?, ?)',
    )
    .bind(input.workflow_id, input.plan_id, 'video/mp4', bytes.byteLength)
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
    file_size: bytes.byteLength,
    mime_type: 'video/mp4',
  });
}
