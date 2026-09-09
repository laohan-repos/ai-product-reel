import { getDatabase } from '@/lib/database';
import { createProductOverviewTables } from '@/db/schema';
import { ensureWorkflowData } from '@/lib/workflow-db';

const database = getDatabase;

async function initialize() {
  const db = database();
  for (const statement of createProductOverviewTables
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
  await ensureWorkflowData(db);
  return db;
}

export async function GET(request: Request) {
  const db = await initialize();
  const workflowId =
    Number(new URL(request.url).searchParams.get('workflow_id')) || 1;
  const result = await db
    .prepare(
      'SELECT id, group_id, name, mime_type, file_size, created_at FROM product_overviews WHERE workflow_id = ? ORDER BY id DESC LIMIT 1',
    )
    .bind(workflowId)
    .all();
  return Response.json({ overviews: result.results });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get('file');
  const partIndex = Number(form.get('part_index'));
  const totalParts = Number(form.get('total_parts'));
  const overviewId = Number(form.get('overview_id'));
  const groupId = Number(form.get('group_id'));
  const fullSize = Number(form.get('file_size'));
  const workflowId = Number(form.get('workflow_id')) || 1;
  if (
    !(file instanceof File) ||
    !Number.isInteger(partIndex) ||
    partIndex < 0 ||
    !Number.isInteger(totalParts) ||
    totalParts < 1 ||
    partIndex >= totalParts ||
    !Number.isInteger(groupId) ||
    groupId < 1 ||
    !Number.isFinite(fullSize)
  )
    return Response.json(
      { error: '产品预览图上传信息不正确' },
      { status: 400 },
    );

  const db = await initialize();
  let id = overviewId;
  if (!Number.isInteger(id) || id < 1) {
    if (partIndex !== 0)
      return Response.json(
        { error: '上传必须从第一个分片开始' },
        { status: 400 },
      );
    const existing = await db
      .prepare(
        'SELECT id FROM product_overviews WHERE workflow_id = ? ORDER BY id DESC LIMIT 1',
      )
      .bind(workflowId)
      .first<{ id: number }>();
    if (existing) {
      id = existing.id;
      await db.batch([
        db
          .prepare(
            'UPDATE product_overviews SET group_id = ?, name = ?, mime_type = ?, file_size = ? WHERE id = ?',
          )
          .bind(
            groupId,
            form.get('name') || 'product-overview.jpg',
            file.type || 'image/jpeg',
            fullSize,
            id,
          ),
        db
          .prepare('DELETE FROM product_overview_chunks WHERE overview_id = ?')
          .bind(id),
      ]);
    } else {
      const result = await db
        .prepare(
          'INSERT INTO product_overviews (workflow_id, group_id, name, mime_type, file_size) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(
          workflowId,
          groupId,
          form.get('name') || 'product-overview.jpg',
          file.type || 'image/jpeg',
          fullSize,
        )
        .run();
      id = Number(result.meta.last_row_id);
    }
  }
  await db
    .prepare(
      'INSERT INTO product_overview_chunks (overview_id, part_index, file_data) VALUES (?, ?, ?) ON CONFLICT(overview_id, part_index) DO UPDATE SET file_data = excluded.file_data',
    )
    .bind(id, partIndex, await file.arrayBuffer())
    .run();
  return Response.json({
    id,
    uploaded_parts: partIndex + 1,
    total_parts: totalParts,
  });
}

export async function DELETE(request: Request) {
  const input = (await request.json()) as { id?: unknown };
  if (typeof input.id !== 'number')
    return Response.json({ error: '产品预览图信息不正确' }, { status: 400 });
  const db = await initialize();
  await db.batch([
    db
      .prepare('DELETE FROM product_overview_chunks WHERE overview_id = ?')
      .bind(input.id),
    db.prepare('DELETE FROM product_overviews WHERE id = ?').bind(input.id),
  ]);
  return Response.json({ ok: true });
}
