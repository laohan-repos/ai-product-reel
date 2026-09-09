import { createCapcutDraftTables } from '@/db/schema';
import { joinBinaryParts } from '@/lib/binary';
import { DEFAULT_CAPCUT_DRAFT_PROMPT } from '@/lib/capcut-draft-prompt';
import { timedCaptionItems } from '@/lib/capcut-captions';
import { getDatabase, type Database } from '@/lib/database';
import { probeMediaDuration } from '@/lib/ffmpeg';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ClipRecord = {
  duration: number;
  generation_key: string;
  id: number;
  mime_type: string;
  plan_id: number;
  workflow_id: number;
};

type GenerationCopy = {
  generationKey: string;
  subtitle: string;
};

const DEFAULT_API_BASE = 'https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1';

async function initialize() {
  const db = getDatabase();
  for (const statement of createCapcutDraftTables
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
  return db;
}

function generationNumber(value: string) {
  return Number(value.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
}

function generationCopies(content: string): GenerationCopy[] {
  return Array.from(
    content.matchAll(
      /(?:^|\n)## (Generation\s+\d+)\s*\n([\s\S]*?)(?=\n## Generation|$)/gi,
    ),
  ).map((match) => ({
    generationKey: match[1].replace(/^generation/i, 'Generation'),
    subtitle: match[2].match(/^- 配音：\s*(.+)$/m)?.[1]?.trim() ?? '',
  }));
}

function apiBase() {
  return (process.env.CAPCUT_MATE_BASE_URL?.trim() || DEFAULT_API_BASE).replace(
    /\/$/,
    '',
  );
}

async function callCapcut(action: string, body: Record<string, unknown>) {
  const apiKey = process.env.CAPCUT_MATE_API_KEY?.trim();
  let response: Response;
  try {
    response = await fetch(`${apiBase()}/${action}`, {
      method: 'POST',
      headers: {
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `${action} 无法连接：${error.message}`
        : `${action} 无法连接`,
    );
  }
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    const detail = payload.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : typeof payload.error === 'string'
          ? payload.error
          : `${action} 返回 HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function videoBytes(db: Database, id: number) {
  const chunks = await db
    .prepare(
      'SELECT file_data FROM product_video_chunks WHERE video_id = ? ORDER BY part_index',
    )
    .bind(id)
    .all<{ file_data: unknown }>();
  return joinBinaryParts(chunks.results.map((chunk) => chunk.file_data));
}

function materialBaseUrl(request: Request) {
  const value =
    process.env.DRAFT_ASSET_BASE_URL?.trim() || new URL(request.url).origin;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('DRAFT_ASSET_BASE_URL 必须是 HTTP 或 HTTPS 地址');
  return url.toString().replace(/\/$/, '');
}

export async function GET(request: Request) {
  const workflowId = Number(
    new URL(request.url).searchParams.get('workflow_id'),
  );
  const db = await initialize();
  const result =
    Number.isSafeInteger(workflowId) && workflowId > 0
      ? await db
          .prepare(
            'SELECT id, workflow_id, plan_id, name, prompt, draft_url, tip_url, status, error_message, created_at, updated_at FROM capcut_drafts WHERE workflow_id = ? ORDER BY id DESC',
          )
          .bind(workflowId)
          .all()
      : await db
          .prepare(
            'SELECT id, workflow_id, plan_id, name, prompt, draft_url, tip_url, status, error_message, created_at, updated_at FROM capcut_drafts ORDER BY id DESC',
          )
          .all();
  return Response.json({ drafts: result.results });
}

export async function POST(request: Request) {
  const input = (await request.json().catch(() => ({}))) as {
    clip_ids?: unknown;
    name?: unknown;
    plan_id?: unknown;
    prompt?: unknown;
    workflow_id?: unknown;
  };
  if (
    typeof input.workflow_id !== 'number' ||
    !Number.isSafeInteger(input.workflow_id) ||
    input.workflow_id < 1 ||
    typeof input.plan_id !== 'number' ||
    !Number.isSafeInteger(input.plan_id) ||
    input.plan_id < 1 ||
    !Array.isArray(input.clip_ids) ||
    input.clip_ids.length === 0 ||
    input.clip_ids.length > 50 ||
    !input.clip_ids.every(
      (id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
    )
  )
    return Response.json({ error: '草稿生成信息不正确' }, { status: 400 });
  if (
    input.name !== undefined &&
    (typeof input.name !== 'string' || !input.name.trim())
  )
    return Response.json({ error: '草稿名称格式不正确' }, { status: 400 });
  if (input.prompt !== undefined && typeof input.prompt !== 'string')
    return Response.json({ error: '草稿提示词格式不正确' }, { status: 400 });

  const prompt =
    typeof input.prompt === 'string' && input.prompt.trim()
      ? input.prompt.trim().slice(0, 8000)
      : DEFAULT_CAPCUT_DRAFT_PROMPT;
  const requestedName =
    typeof input.name === 'string' ? input.name.trim().slice(0, 120) : '';
  const db = await initialize();
  const plan = await db
    .prepare(
      'SELECT workflow_id, content FROM product_video_plans WHERE id = ?',
    )
    .bind(input.plan_id)
    .first<{ content: string; workflow_id: number }>();
  if (!plan || plan.workflow_id !== input.workflow_id)
    return Response.json(
      { error: '当前工作流的视频方案不存在' },
      { status: 404 },
    );

  const copies = generationCopies(plan.content);
  const copyByKey = new Map(
    copies.map((copy) => [copy.generationKey, copy.subtitle]),
  );
  const clips: ClipRecord[] = [];
  const uniqueIds = new Set(input.clip_ids as number[]);
  if (uniqueIds.size !== input.clip_ids.length)
    return Response.json({ error: '分镜视频不能重复' }, { status: 400 });
  for (const id of input.clip_ids as number[]) {
    const clip = await db
      .prepare(
        "SELECT id, workflow_id, plan_id, generation_key, duration, mime_type FROM product_videos WHERE id = ? AND status = 'succeeded' AND is_selected = 1",
      )
      .bind(id)
      .first<ClipRecord>();
    if (
      !clip ||
      clip.workflow_id !== input.workflow_id ||
      clip.plan_id !== input.plan_id
    )
      return Response.json(
        { error: `分镜视频 ${id} 不存在、未完成或未选中` },
        { status: 400 },
      );
    if (!copyByKey.get(clip.generation_key))
      return Response.json(
        { error: `${clip.generation_key} 没有可用的“配音”字幕` },
        { status: 400 },
      );
    clips.push(clip);
  }
  clips.sort(
    (left, right) =>
      generationNumber(left.generation_key) -
      generationNumber(right.generation_key),
  );
  const requiredKeys = copies.map((copy) => copy.generationKey);
  if (
    clips.length !== requiredKeys.length ||
    clips.some((clip, index) => clip.generation_key !== requiredKeys[index])
  )
    return Response.json(
      { error: '请为当前方案的每个 Generation 完成并选中一段视频' },
      { status: 400 },
    );

  const draftInsert = await db
    .prepare(
      "INSERT INTO capcut_drafts (workflow_id, plan_id, name, prompt, status) VALUES (?, ?, ?, ?, 'creating')",
    )
    .bind(
      input.workflow_id,
      input.plan_id,
      requestedName || '产品视频草稿',
      prompt,
    )
    .run();
  const draftId = Number(draftInsert.meta.last_row_id);
  const name = requestedName || `产品视频草稿-${draftId}`;
  if (!requestedName)
    await db
      .prepare(
        'UPDATE capcut_drafts SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      )
      .bind(name, draftId)
      .run();
  let draftUrl = '';
  try {
    const baseUrl = materialBaseUrl(request);
    let timelineStart = 0;
    const videos = [];
    const captions = [];
    for (const [clipIndex, clip] of clips.entries()) {
      const bytes = await videoBytes(db, clip.id);
      if (bytes.byteLength === 0)
        throw new Error(`${clip.generation_key} 视频文件为空`);
      const durationSeconds = await probeMediaDuration(
        bytes,
        clip.mime_type,
        clip.duration,
      );
      const duration = Math.max(1, Math.round(durationSeconds * 1_000_000));
      const timelineEnd = timelineStart + duration;
      videos.push({
        video_url: `${baseUrl}/api/product-videos/${clip.id}/file`,
        start: timelineStart,
        end: timelineEnd,
        duration,
        volume: 1,
        ...(clipIndex < clips.length - 1
          ? { transition: '叠化', transition_duration: 800_000 }
          : {}),
      });
      captions.push(
        ...timedCaptionItems(
          copyByKey.get(clip.generation_key) ?? '',
          timelineStart,
          timelineEnd,
        ),
      );
      timelineStart = timelineEnd;
    }

    const created = await callCapcut('create_draft', {
      width: 1080,
      height: 1920,
    });
    if (typeof created.draft_url !== 'string' || !created.draft_url)
      throw new Error('create_draft 没有返回草稿地址');
    draftUrl = created.draft_url;
    const withVideos = await callCapcut('add_videos', {
      draft_url: draftUrl,
      video_infos: JSON.stringify(videos),
      alpha: 1,
      scale_x: 1,
      scale_y: 1,
      transform_x: 0,
      transform_y: 0,
    });
    if (typeof withVideos.draft_url === 'string')
      draftUrl = withVideos.draft_url;
    const withCaptions = await callCapcut('add_captions', {
      draft_url: draftUrl,
      captions: JSON.stringify(captions),
      border_color: '#000000',
      font: '江湖体',
      font_size: 12,
      line_spacing: 10,
      text_color: '#ffde00',
      transform_x: 0,
      transform_y: -1280,
      alignment: 1,
    });
    if (typeof withCaptions.draft_url === 'string')
      draftUrl = withCaptions.draft_url;
    const saved = await callCapcut('save_draft', { draft_url: draftUrl });
    if (typeof saved.draft_url === 'string') draftUrl = saved.draft_url;
    const tipUrl = typeof created.tip_url === 'string' ? created.tip_url : '';
    await db
      .prepare(
        "UPDATE capcut_drafts SET draft_url = ?, tip_url = ?, status = 'succeeded', error_message = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .bind(draftUrl, tipUrl, draftId)
      .run();
    return Response.json({
      id: draftId,
      name,
      draft_url: draftUrl,
      tip_url: tipUrl,
      status: 'succeeded',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '剪映草稿生成失败';
    await db
      .prepare(
        "UPDATE capcut_drafts SET draft_url = ?, status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .bind(draftUrl, message.slice(0, 1000), draftId)
      .run();
    return Response.json({ error: message, id: draftId }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const input = (await request.json().catch(() => ({}))) as { id?: unknown };
  if (
    typeof input.id !== 'number' ||
    !Number.isSafeInteger(input.id) ||
    input.id < 1
  )
    return Response.json({ error: '剪映草稿信息不正确' }, { status: 400 });

  const db = await initialize();
  const draft = await db
    .prepare('SELECT id FROM capcut_drafts WHERE id = ?')
    .bind(input.id)
    .first();
  if (!draft)
    return Response.json({ error: '剪映草稿不存在' }, { status: 404 });

  await db
    .prepare('DELETE FROM capcut_drafts WHERE id = ?')
    .bind(input.id)
    .run();
  return Response.json({ ok: true });
}
