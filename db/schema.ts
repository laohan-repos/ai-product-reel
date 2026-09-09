export const createModelConfigsTable = `
  CREATE TABLE IF NOT EXISTS model_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_type TEXT NOT NULL UNIQUE,
    model_id TEXT NOT NULL DEFAULT '',
    base_url TEXT NOT NULL DEFAULT '',
    api_key TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (model_type IN ('multimodal', 'image', 'video'))
  )
`;

export const modelConfigDefaults = [
  { model_type: 'multimodal', model_id: '', base_url: '', api_key: '' },
  { model_type: 'image', model_id: 'gpt-image-2', base_url: '', api_key: '' },
  { model_type: 'video', model_id: '', base_url: '', api_key: '' },
] as const;

export const createAssetLibraryTables = `
  CREATE TABLE IF NOT EXISTS asset_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('video', 'product')),
    reference_group_id INTEGER,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reference_group_id) REFERENCES asset_groups(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS asset_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES asset_groups(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS asset_item_chunks (
    item_id INTEGER NOT NULL,
    part_index INTEGER NOT NULL,
    file_data BLOB NOT NULL,
    PRIMARY KEY (item_id, part_index),
    FOREIGN KEY (item_id) REFERENCES asset_items(id) ON DELETE CASCADE
  );
`;

export const createReferenceOverviewTables = `
  CREATE TABLE IF NOT EXISTS reference_overviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS reference_overview_chunks (
    overview_id INTEGER NOT NULL,
    part_index INTEGER NOT NULL,
    file_data BLOB NOT NULL,
    PRIMARY KEY (overview_id, part_index),
    FOREIGN KEY (overview_id) REFERENCES reference_overviews(id) ON DELETE CASCADE
  );
`;

export const createProductOverviewTables = `
  CREATE TABLE IF NOT EXISTS product_overviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS product_overview_chunks (
    overview_id INTEGER NOT NULL,
    part_index INTEGER NOT NULL,
    file_data BLOB NOT NULL,
    PRIMARY KEY (overview_id, part_index),
    FOREIGN KEY (overview_id) REFERENCES product_overviews(id) ON DELETE CASCADE
  );
`;

export const createReferenceStructureTables = `
  CREATE TABLE IF NOT EXISTS reference_structures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    overview_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'reference-structure.md',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (overview_id) REFERENCES reference_overviews(id) ON DELETE CASCADE
  );
`;

export const createGenerationPlanTables = `
  CREATE TABLE IF NOT EXISTS generation_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    structure_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'generation-plan.md',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (structure_id) REFERENCES reference_structures(id) ON DELETE CASCADE
  );
`;

export const createProductVideoPlanTables = `
  CREATE TABLE IF NOT EXISTS product_video_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_overview_id INTEGER NOT NULL,
    product_overview_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'product-video-plan.md',
    prompt TEXT NOT NULL,
    product_brief TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reference_overview_id) REFERENCES reference_overviews(id) ON DELETE CASCADE,
    FOREIGN KEY (product_overview_id) REFERENCES product_overviews(id) ON DELETE CASCADE
  );
`;

export const createProductKeyframeTables = `
  CREATE TABLE IF NOT EXISTS product_keyframes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    generation_key TEXT NOT NULL,
    prompt TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    is_selected INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES product_video_plans(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS product_keyframe_chunks (
    keyframe_id INTEGER NOT NULL,
    part_index INTEGER NOT NULL,
    file_data BLOB NOT NULL,
    PRIMARY KEY (keyframe_id, part_index),
    FOREIGN KEY (keyframe_id) REFERENCES product_keyframes(id) ON DELETE CASCADE
  );
`;

export const createProductVideoTables = `
  CREATE TABLE IF NOT EXISTS product_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    generation_key TEXT NOT NULL,
    keyframe_id INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    duration INTEGER NOT NULL,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    video_url TEXT NOT NULL DEFAULT '',
    mime_type TEXT NOT NULL DEFAULT 'video/mp4',
    file_size INTEGER NOT NULL DEFAULT 0,
    is_selected INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES product_video_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (keyframe_id) REFERENCES product_keyframes(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS product_video_chunks (
    video_id INTEGER NOT NULL,
    part_index INTEGER NOT NULL,
    file_data BLOB NOT NULL,
    PRIMARY KEY (video_id, part_index),
    FOREIGN KEY (video_id) REFERENCES product_videos(id) ON DELETE CASCADE
  );
`;

export const createFinalVideoTables = `
  CREATE TABLE IF NOT EXISTS final_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES product_video_plans(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS final_video_chunks (
    final_video_id INTEGER NOT NULL,
    part_index INTEGER NOT NULL,
    file_data BLOB NOT NULL,
    PRIMARY KEY (final_video_id, part_index),
    FOREIGN KEY (final_video_id) REFERENCES final_videos(id) ON DELETE CASCADE
  );
`;

export const createDraftAssetTables = `
  CREATE TABLE IF NOT EXISTS draft_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER,
    name TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('video', 'audio', 'image')),
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS draft_asset_chunks (
    asset_id INTEGER NOT NULL,
    part_index INTEGER NOT NULL,
    file_data BLOB NOT NULL,
    PRIMARY KEY (asset_id, part_index),
    FOREIGN KEY (asset_id) REFERENCES draft_assets(id) ON DELETE CASCADE
  );
`;

export const createCapcutDraftTables = `
  CREATE TABLE IF NOT EXISTS capcut_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    draft_url TEXT NOT NULL DEFAULT '',
    tip_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'creating',
    error_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES product_video_plans(id) ON DELETE CASCADE
  );
`;

export const createWorkflowTables = `
  CREATE TABLE IF NOT EXISTS workflow_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    current_step INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;
