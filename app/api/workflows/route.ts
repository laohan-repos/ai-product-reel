import { getDatabase } from '@/lib/database';
import {
  createGenerationPlanTables,
  createModelConfigsTable,
  createProductKeyframeTables,
  createProductOverviewTables,
  createProductVideoPlanTables,
  createProductVideoTables,
  createReferenceOverviewTables,
  createReferenceStructureTables,
} from '@/db/schema';
import { ensureWorkflowData } from '@/lib/workflow-db';

const database = getDatabase;

async function initialize() {
  const db = database();
  for (const source of [
    createModelConfigsTable,
    createReferenceOverviewTables,
    createProductOverviewTables,
    createReferenceStructureTables,
    createGenerationPlanTables,
    createProductVideoPlanTables,
    createProductKeyframeTables,
    createProductVideoTables,
  ])
    for (const statement of source
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
  await ensureWorkflowData(db);
  return db;
}

export async function GET() {
  const db = await initialize();
  const result = await db
    .prepare(
      `SELECT w.id, w.name,
        CASE WHEN EXISTS (SELECT 1 FROM product_videos x0 WHERE x0.workflow_id = w.id AND x0.status = 'succeeded' AND x0.is_selected = 1) THEN 'completed' ELSE w.status END AS status,
        CASE
          WHEN EXISTS (SELECT 1 FROM product_videos x1 WHERE x1.workflow_id = w.id AND x1.status = 'succeeded' AND x1.is_selected = 1) THEN 5
          WHEN EXISTS (SELECT 1 FROM product_keyframes k1 WHERE k1.workflow_id = w.id AND k1.is_selected = 1) THEN 4
          WHEN EXISTS (SELECT 1 FROM product_video_plans v1 WHERE v1.workflow_id = w.id) THEN 3
          WHEN EXISTS (SELECT 1 FROM product_overviews p1 WHERE p1.workflow_id = w.id) THEN 2
          WHEN EXISTS (SELECT 1 FROM reference_overviews r1 WHERE r1.workflow_id = w.id) THEN 1
          ELSE 1
        END AS current_step,
        (SELECT p0.group_id FROM product_overviews p0 WHERE p0.workflow_id = w.id ORDER BY p0.id DESC LIMIT 1) AS product_group_id,
        w.created_at, w.updated_at,
        (SELECT COUNT(*) FROM reference_overviews r WHERE r.workflow_id = w.id) AS reference_overview_count,
        (SELECT COUNT(*) FROM product_overviews p WHERE p.workflow_id = w.id) AS product_overview_count,
        (SELECT COUNT(*) FROM product_video_plans v WHERE v.workflow_id = w.id) AS plan_count,
        (SELECT COUNT(*) FROM product_keyframes k WHERE k.workflow_id = w.id AND k.is_selected = 1) AS keyframe_count,
        (SELECT COUNT(*) FROM product_videos x WHERE x.workflow_id = w.id AND x.status = 'succeeded' AND x.is_selected = 1) AS video_count
       FROM workflow_runs w ORDER BY w.updated_at DESC, w.id DESC`,
    )
    .all();
  return Response.json({ workflows: result.results });
}

export async function POST(request: Request) {
  const input = (await request.json()) as { name?: unknown };
  if (typeof input.name !== 'string' || !input.name.trim())
    return Response.json({ error: '请填写工作流名称' }, { status: 400 });
  const db = await initialize();
  const result = await db
    .prepare('INSERT INTO workflow_runs (name) VALUES (?)')
    .bind(input.name.trim().slice(0, 80))
    .run();
  return Response.json({ id: result.meta.last_row_id });
}

export async function PATCH(request: Request) {
  const input = (await request.json()) as {
    id?: unknown;
    name?: unknown;
    status?: unknown;
    current_step?: unknown;
  };
  if (typeof input.id !== 'number')
    return Response.json({ error: '工作流信息不正确' }, { status: 400 });
  const db = await initialize();
  if (typeof input.name === 'string' && input.name.trim())
    await db
      .prepare(
        'UPDATE workflow_runs SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      )
      .bind(input.name.trim().slice(0, 80), input.id)
      .run();
  if (
    typeof input.status === 'string' ||
    typeof input.current_step === 'number'
  )
    await db
      .prepare(
        'UPDATE workflow_runs SET status = COALESCE(?, status), current_step = COALESCE(?, current_step), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      )
      .bind(
        typeof input.status === 'string' ? input.status : null,
        typeof input.current_step === 'number' ? input.current_step : null,
        input.id,
      )
      .run();
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const input = (await request.json()) as { id?: unknown };
  if (typeof input.id !== 'number')
    return Response.json({ error: '工作流信息不正确' }, { status: 400 });
  const db = await initialize();
  await db.batch([
    db
      .prepare(
        'DELETE FROM product_video_chunks WHERE video_id IN (SELECT id FROM product_videos WHERE workflow_id = ?)',
      )
      .bind(input.id),
    db
      .prepare('DELETE FROM product_videos WHERE workflow_id = ?')
      .bind(input.id),
    db
      .prepare(
        'DELETE FROM product_keyframe_chunks WHERE keyframe_id IN (SELECT id FROM product_keyframes WHERE workflow_id = ?)',
      )
      .bind(input.id),
    db
      .prepare('DELETE FROM product_keyframes WHERE workflow_id = ?')
      .bind(input.id),
    db
      .prepare('DELETE FROM product_video_plans WHERE workflow_id = ?')
      .bind(input.id),
    db
      .prepare(
        'DELETE FROM product_overview_chunks WHERE overview_id IN (SELECT id FROM product_overviews WHERE workflow_id = ?)',
      )
      .bind(input.id),
    db
      .prepare('DELETE FROM product_overviews WHERE workflow_id = ?')
      .bind(input.id),
    db
      .prepare(
        'DELETE FROM reference_structures WHERE overview_id IN (SELECT id FROM reference_overviews WHERE workflow_id = ?)',
      )
      .bind(input.id),
    db
      .prepare(
        'DELETE FROM reference_overview_chunks WHERE overview_id IN (SELECT id FROM reference_overviews WHERE workflow_id = ?)',
      )
      .bind(input.id),
    db
      .prepare('DELETE FROM reference_overviews WHERE workflow_id = ?')
      .bind(input.id),
    db.prepare('DELETE FROM workflow_runs WHERE id = ?').bind(input.id),
  ]);
  return Response.json({ ok: true });
}
