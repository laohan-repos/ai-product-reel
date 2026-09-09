import { getDatabase } from '@/lib/database';
import { createAssetLibraryTables } from '@/db/schema';

const database = getDatabase;

async function initialize() {
  const db = database();
  for (const statement of createAssetLibraryTables
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
  try {
    await db
      .prepare('ALTER TABLE asset_groups ADD COLUMN reference_group_id INTEGER')
      .run();
  } catch {
    // Existing databases already have the relationship column.
  }
  return db;
}

export async function GET() {
  const db = await initialize();
  const [groups, items] = await Promise.all([
    db
      .prepare(
        'SELECT id, asset_type, reference_group_id, name, created_at FROM asset_groups ORDER BY updated_at DESC, id DESC',
      )
      .all(),
    db
      .prepare(
        'SELECT id, group_id, name, mime_type, file_size, created_at FROM asset_items ORDER BY updated_at DESC, id DESC',
      )
      .all(),
  ]);
  return Response.json({ groups: groups.results, items: items.results });
}

export async function POST(request: Request) {
  const input = (await request.json()) as {
    name?: unknown;
  };
  if (typeof input.name !== 'string' || !input.name.trim())
    return Response.json({ error: '请填写素材组名称' }, { status: 400 });
  const db = await initialize();
  const reference = await db
    .prepare('INSERT INTO asset_groups (asset_type, name) VALUES (?, ?)')
    .bind('video', input.name.trim())
    .run();
  const referenceGroupId = Number(reference.meta.last_row_id);
  const product = await db
    .prepare(
      'INSERT INTO asset_groups (asset_type, reference_group_id, name) VALUES (?, ?, ?)',
    )
    .bind('product', referenceGroupId, input.name.trim())
    .run();
  return Response.json({
    id: referenceGroupId,
    product_group_id: product.meta.last_row_id,
  });
}

export async function PATCH(request: Request) {
  const input = (await request.json()) as { id?: unknown; name?: unknown };
  if (
    typeof input.id !== 'number' ||
    typeof input.name !== 'string' ||
    !input.name.trim()
  )
    return Response.json({ error: '分组信息不正确' }, { status: 400 });
  const db = await initialize();
  await db
    .prepare(
      'UPDATE asset_groups SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR reference_group_id = ?',
    )
    .bind(input.name.trim(), input.id, input.id)
    .run();
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const input = (await request.json()) as { id?: unknown };
  if (typeof input.id !== 'number')
    return Response.json({ error: '分组信息不正确' }, { status: 400 });
  const db = await initialize();
  await db.batch([
    db
      .prepare(
        'DELETE FROM asset_item_chunks WHERE item_id IN (SELECT id FROM asset_items WHERE group_id = ? OR group_id IN (SELECT id FROM asset_groups WHERE reference_group_id = ?))',
      )
      .bind(input.id, input.id),
    db
      .prepare(
        'DELETE FROM asset_items WHERE group_id = ? OR group_id IN (SELECT id FROM asset_groups WHERE reference_group_id = ?)',
      )
      .bind(input.id, input.id),
    db
      .prepare(
        'DELETE FROM asset_groups WHERE id = ? OR reference_group_id = ?',
      )
      .bind(input.id, input.id),
  ]);
  return Response.json({ ok: true });
}
