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

export async function POST(request: Request) {
  const form = await request.formData();
  const groupId = Number(form.get('group_id'));
  const file = form.get('file');
  const partIndex = Number(form.get('part_index'));
  const totalParts = Number(form.get('total_parts'));
  const existingItemId = Number(form.get('item_id'));
  const fullSize = Number(form.get('file_size'));
  if (!Number.isInteger(groupId) || !(file instanceof File))
    return Response.json({ error: '请指定分组并选择文件' }, { status: 400 });
  if (
    !Number.isInteger(partIndex) ||
    partIndex < 0 ||
    !Number.isInteger(totalParts) ||
    totalParts < 1 ||
    partIndex >= totalParts
  )
    return Response.json({ error: '上传分片信息不正确' }, { status: 400 });
  if (!Number.isFinite(fullSize) || fullSize > 100 * 1024 * 1024)
    return Response.json({ error: '单个文件不能超过 100 MB' }, { status: 400 });
  const db = await initialize();
  const group = await db
    .prepare('SELECT id, asset_type FROM asset_groups WHERE id = ?')
    .bind(groupId)
    .first<{ id: number; asset_type: string }>();
  if (!group) return Response.json({ error: '分组不存在' }, { status: 404 });
  const expectsVideo = group.asset_type === 'video';
  if (
    (expectsVideo && !file.type.startsWith('video/')) ||
    (!expectsVideo && !file.type.startsWith('image/'))
  )
    return Response.json(
      { error: expectsVideo ? '该分组只能上传视频' : '该分组只能上传图片' },
      { status: 400 },
    );
  let itemId = existingItemId;
  if (!Number.isInteger(itemId) || itemId < 1) {
    if (partIndex !== 0)
      return Response.json(
        { error: '上传必须从第一个分片开始' },
        { status: 400 },
      );
    if (expectsVideo) {
      const existingVideo = await db
        .prepare('SELECT id FROM asset_items WHERE group_id = ? LIMIT 1')
        .bind(groupId)
        .first();
      if (existingVideo)
        return Response.json(
          { error: '每个同款素材组只能上传一个参考视频' },
          { status: 400 },
        );
    }
    const result = await db
      .prepare(
        'INSERT INTO asset_items (group_id, name, mime_type, file_size, file_data) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(groupId, file.name, file.type, fullSize, new Uint8Array())
      .run();
    itemId = Number(result.meta.last_row_id);
  }
  await db
    .prepare(
      'INSERT INTO asset_item_chunks (item_id, part_index, file_data) VALUES (?, ?, ?) ON CONFLICT(item_id, part_index) DO UPDATE SET file_data = excluded.file_data',
    )
    .bind(itemId, partIndex, await file.arrayBuffer())
    .run();
  return Response.json({
    id: itemId,
    uploaded_parts: partIndex + 1,
    total_parts: totalParts,
  });
}

export async function PATCH(request: Request) {
  const input = (await request.json()) as { id?: unknown; name?: unknown };
  if (
    typeof input.id !== 'number' ||
    typeof input.name !== 'string' ||
    !input.name.trim()
  )
    return Response.json({ error: '素材信息不正确' }, { status: 400 });
  const db = await initialize();
  await db
    .prepare(
      'UPDATE asset_items SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    )
    .bind(input.name.trim(), input.id)
    .run();
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const input = (await request.json()) as { id?: unknown };
  if (typeof input.id !== 'number')
    return Response.json({ error: '素材信息不正确' }, { status: 400 });
  const db = await initialize();
  await db
    .prepare('DELETE FROM asset_item_chunks WHERE item_id = ?')
    .bind(input.id)
    .run();
  await db.prepare('DELETE FROM asset_items WHERE id = ?').bind(input.id).run();
  return Response.json({ ok: true });
}
