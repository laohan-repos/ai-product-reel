import { getDatabase } from '@/lib/database';

const database = getDatabase;

function binaryPart(value: unknown): Uint8Array<ArrayBuffer> {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  if (typeof value === 'string' && /^\d+(,\d+)*$/.test(value))
    return Uint8Array.from(value.split(',').map(Number));
  return new Uint8Array();
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const videoId = Number(id);
  const db = database();
  const item = await db
    .prepare('SELECT mime_type FROM final_videos WHERE id = ?')
    .bind(videoId)
    .first<{ mime_type: string }>();
  if (!item) return new Response('未找到合成视频', { status: 404 });
  const extension = item.mime_type === 'video/mp4' ? 'mp4' : 'webm';
  const chunks = await db
    .prepare(
      'SELECT file_data FROM final_video_chunks WHERE final_video_id = ? ORDER BY part_index',
    )
    .bind(videoId)
    .all<{ file_data: unknown }>();
  return new Response(
    new Blob(
      chunks.results.map((chunk) => binaryPart(chunk.file_data)),
      {
        type: item.mime_type,
      },
    ),
    {
      headers: {
        'content-type': item.mime_type,
        'content-disposition': `inline; filename="final-product-video-${videoId}.${extension}"`,
        'cache-control': 'no-store',
      },
    },
  );
}
