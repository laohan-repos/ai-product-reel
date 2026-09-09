import { getDatabase } from '@/lib/database';

const database = getDatabase;

function binaryPart(value: unknown): Uint8Array<ArrayBuffer> {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  // 本地 D1 运行时会把 BLOB 序列化为数字数组；恢复为原始字节，不能直接交给 Blob。
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
    .prepare('SELECT file_data, mime_type, name FROM asset_items WHERE id = ?')
    .bind(Number(id))
    .first<{ file_data: unknown; mime_type: string; name: string }>();
  if (!item) return new Response('未找到素材', { status: 404 });
  const chunks = await db
    .prepare(
      'SELECT file_data FROM asset_item_chunks WHERE item_id = ? ORDER BY part_index',
    )
    .bind(Number(id))
    .all<{ file_data: unknown }>();
  const file = chunks.results.length
    ? new Blob(
        chunks.results.map((chunk) => binaryPart(chunk.file_data)),
        { type: item.mime_type },
      )
    : new Blob([binaryPart(item.file_data)], { type: item.mime_type });
  const baseHeaders = {
    'content-type': item.mime_type,
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(item.name)}`,
    'cache-control': 'private, max-age=3600',
    'accept-ranges': 'bytes',
  };
  const range = request.headers.get('range');
  if (!range)
    return new Response(file, {
      headers: { ...baseHeaders, 'content-length': String(file.size) },
    });

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match)
    return new Response(null, {
      status: 416,
      headers: { ...baseHeaders, 'content-range': `bytes */${file.size}` },
    });
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, file.size - Number(match[2] || 0));
  const end = match[2]
    ? Math.min(Number(match[2]), file.size - 1)
    : file.size - 1;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start > end ||
    start >= file.size
  ) {
    return new Response(null, {
      status: 416,
      headers: { ...baseHeaders, 'content-range': `bytes */${file.size}` },
    });
  }
  const segment = file.slice(start, end + 1, item.mime_type);
  return new Response(segment, {
    status: 206,
    headers: {
      ...baseHeaders,
      'content-length': String(segment.size),
      'content-range': `bytes ${start}-${end}/${file.size}`,
    },
  });
}
