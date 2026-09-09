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
  const db = database();
  const item = await db
    .prepare('SELECT name, mime_type FROM product_overviews WHERE id = ?')
    .bind(Number(id))
    .first<{ name: string; mime_type: string }>();
  if (!item) return new Response('未找到产品预览图', { status: 404 });
  const chunks = await db
    .prepare(
      'SELECT file_data FROM product_overview_chunks WHERE overview_id = ? ORDER BY part_index',
    )
    .bind(Number(id))
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
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(item.name)}`,
        'cache-control': 'private, max-age=3600',
      },
    },
  );
}
