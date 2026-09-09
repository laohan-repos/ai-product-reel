import { createWorkflowTables } from '@/db/schema';
import type { Database } from '@/lib/database';

export async function ensureWorkflowData(db: Database) {
  for (const statement of createWorkflowTables
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
  for (const table of [
    'reference_overviews',
    'product_overviews',
    'product_video_plans',
    'product_keyframes',
    'product_videos',
  ]) {
    try {
      await db
        .prepare(
          `ALTER TABLE ${table} ADD COLUMN workflow_id INTEGER NOT NULL DEFAULT 1`,
        )
        .run();
    } catch {
      // The column already exists on subsequent requests.
    }
  }
}
