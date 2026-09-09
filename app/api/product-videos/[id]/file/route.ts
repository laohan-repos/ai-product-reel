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
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = database();
  const item = await db
    .prepare(
      "SELECT mime_type FROM product_videos WHERE id = ? AND status = 'succeeded'",
    )
    .bind(Number(id))
    .first<{ mime_type: string }>();
  if (!item) return new Response('未找到已完成的视频', { status: 404 });
  const chunks = await db
    .prepare(
      'SELECT file_data FROM product_video_chunks WHERE video_id = ? ORDER BY part_index',
    )
    .bind(Number(id))
    .all<{ file_data: unknown }>();
  const blob = new Blob(
    chunks.results.map((chunk) => binaryPart(chunk.file_data)),
    { type: item.mime_type },
  );
  const headers = {
    'content-type': item.mime_type,
    'accept-ranges': 'bytes',
    'content-disposition': `inline; filename="product-video-${Number(id)}.mp4"`,
    'cache-control': 'private, max-age=3600',
  };
  const range = request.headers.get('range');
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2]
        ? Math.min(Number(match[2]), blob.size - 1)
        : blob.size - 1;
      if (start <= end && start < blob.size)
        return new Response(blob.slice(start, end + 1), {
          status: 206,
          headers: {
            ...headers,
            'content-length': String(end - start + 1),
            'content-range': `bytes ${start}-${end}/${blob.size}`,
          },
        });
    }
    return new Response(null, {
      status: 416,
      headers: { ...headers, 'content-range': `bytes */${blob.size}` },
    });
  }
  return new Response(blob, {
    headers: { ...headers, 'content-length': String(blob.size) },
  });
}
