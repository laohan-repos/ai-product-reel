import { joinBinaryParts } from '@/lib/binary';
import { getDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1)
    return new Response('素材编号不正确', { status: 400 });
  const db = getDatabase();
  const item = await db
    .prepare('SELECT name, mime_type, file_size FROM draft_assets WHERE id = ?')
    .bind(id)
    .first<{ file_size: number; mime_type: string; name: string }>();
  if (!item) return new Response('未找到素材', { status: 404 });
  const chunks = await db
    .prepare(
      'SELECT file_data FROM draft_asset_chunks WHERE asset_id = ? ORDER BY part_index',
    )
    .bind(id)
    .all<{ file_data: unknown }>();
  const bytes = joinBinaryParts(chunks.results.map((chunk) => chunk.file_data));
  if (bytes.byteLength !== item.file_size)
    return new Response('素材文件不完整', { status: 500 });

  const headers = {
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600',
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(item.name)}`,
    'content-type': item.mime_type,
  };
  const range = request.headers.get('range');
  if (!range)
    return new Response(bytes, {
      headers: { ...headers, 'content-length': String(bytes.byteLength) },
    });
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match)
    return new Response(null, {
      status: 416,
      headers: {
        ...headers,
        'content-range': `bytes */${bytes.byteLength}`,
      },
    });
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, bytes.byteLength - Number(match[2] || 0));
  const end = match[2]
    ? Math.min(Number(match[2]), bytes.byteLength - 1)
    : bytes.byteLength - 1;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start > end ||
    start >= bytes.byteLength
  )
    return new Response(null, {
      status: 416,
      headers: {
        ...headers,
        'content-range': `bytes */${bytes.byteLength}`,
      },
    });
  const segment = bytes.slice(start, end + 1);
  return new Response(segment, {
    status: 206,
    headers: {
      ...headers,
      'content-length': String(segment.byteLength),
      'content-range': `bytes ${start}-${end}/${bytes.byteLength}`,
    },
  });
}
