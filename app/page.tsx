'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  Clapperboard,
  Download,
  FolderKanban,
  FolderPlus,
  ImageIcon,
  ImagePlus,
  Menu,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { DEFAULT_PRODUCT_VIDEO_PLAN_PROMPT } from '@/lib/product-video-plan-prompt';
import { buildKeyframePrompt } from '@/lib/keyframe-prompt';
import { buildVideoGenerationPrompt } from '@/lib/video-generation-prompt';
import { DEFAULT_CAPCUT_DRAFT_PROMPT } from '@/lib/capcut-draft-prompt';

const workflow = [
  '参考视频',
  '智能抽帧',
  '视频总览',
  '结构脚本',
  '产品参考',
  '故事板',
  '关键帧提示词',
  '关键帧图片',
  '视频提示词',
  '分镜视频',
];

const batchGenerationSteps = [
  '抽帧合成参考视频预览图',
  '合成产品预览图',
  '生成我的产品视频方案',
  '生成产品分镜关键帧',
  '生成分镜视频',
];

type BatchStepStatus = 'pending' | 'running' | 'completed' | 'failed';
type BatchMaterialProgress = {
  groupId: number;
  groupName: string;
  workflowId: number | null;
  status: BatchStepStatus;
  error: string;
  steps: Array<{
    label: string;
    status: BatchStepStatus;
    detail: string;
  }>;
};

const story = [
  ['01', '开场钩子', '0–2s', '晨光穿过枝叶，琥珀色精华瓶在露珠间显现'],
  ['02', '产品特写', '2–5s', '镜头推进至瓶身，标签与玻璃质感清晰可见'],
  ['03', '成分演示', '5–9s', '精华液滴落，与透明水珠和植物萃取物交叠'],
  ['04', '使用体验', '9–13s', '滴管靠近指尖，细腻液体在柔光中缓慢流动'],
  ['05', '收尾定格', '13–15s', '产品回到自然场景，品牌信息与行动号召浮现'],
];

const prompts = [
  '清晨逆光，琥珀色滴管瓶立于湿润苔藓，浅景深，微距产品摄影',
  '高端护肤精华瓶正面特写，奶油色背景，柔和侧光，玻璃反射克制',
  '金色精华液与透明气泡悬浮，流体微距，纯净、轻盈、通透',
  '滴管在指尖上方形成一滴精华，肌肤自然纹理，慢动作感',
  '琥珀瓶与新鲜绿叶构成平衡静物，晨雾柔光，极简奢华',
];

const videoPrompt = `{
  "scene_type": "beauty_product",
  "shot_type": "macro_close_up",
  "camera": "slow_push_in",
  "duration": "3s",
  "motion": "gentle_slow_motion",
  "lighting": "warm_natural_backlight",
  "style": "cinematic, clean, premium",
  "transition": "soft_dissolve"
}`;

const positions = [
  '12% 24%',
  '72% 18%',
  '89% 22%',
  '68% 78%',
  '88% 70%',
  '15% 75%',
];

type ModelType = 'multimodal' | 'image' | 'video';
type ModelConfig = {
  model_type: ModelType;
  model_id: string;
  base_url: string;
  api_key: string;
};
type AssetType = 'video' | 'product';
type AssetGroup = {
  id: number;
  asset_type: AssetType;
  reference_group_id: number | null;
  name: string;
  created_at: string;
};
type AssetItem = {
  id: number;
  group_id: number;
  name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};
type ReferenceOverview = {
  id: number;
  name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};
type ProductOverview = {
  id: number;
  group_id: number;
  name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};
type ReferenceStructure = {
  id: number;
  overview_id: number;
  name: string;
  content: string;
  created_at: string;
};
type GenerationPlan = {
  id: number;
  structure_id: number;
  name: string;
  content: string;
  created_at: string;
};
type ProductVideoPlan = {
  id: number;
  reference_overview_id: number;
  product_overview_id: number;
  name: string;
  product_brief: string;
  content: string;
  created_at: string;
};
type ProductKeyframe = {
  id: number;
  plan_id: number;
  generation_key: string;
  prompt: string;
  mime_type: string;
  file_size: number;
  is_selected: number;
  created_at: string;
};
type ProductVideo = {
  id: number;
  plan_id: number;
  generation_key: string;
  keyframe_id: number;
  prompt: string;
  duration: number;
  task_id: string;
  status: string;
  video_url: string;
  mime_type: string;
  file_size: number;
  is_selected: number;
  error_message: string;
  created_at: string;
  updated_at: string;
};
type FinalVideo = {
  id: number;
  workflow_id: number;
  plan_id: number;
  mime_type: string;
  file_size: number;
  created_at: string;
};
type CapcutDraft = {
  id: number;
  workflow_id: number;
  plan_id: number;
  name: string;
  prompt: string;
  draft_url: string;
  tip_url: string;
  status: string;
  error_message: string;
  created_at: string;
  updated_at: string;
};
type WorkflowRun = {
  id: number;
  name: string;
  status: string;
  current_step: number;
  product_group_id: number | null;
  created_at: string;
  updated_at: string;
  reference_overview_count: number;
  product_overview_count: number;
  plan_count: number;
  keyframe_count: number;
  video_count: number;
};

function parseGenerationSections(content: string) {
  const matches = Array.from(
    content.matchAll(
      /(?:^|\n)## (Generation\s+\d+)\s*\n([\s\S]*?)(?=\n## Generation|$)/gi,
    ),
  );
  return matches.map((match) => {
    const key = match[1].replace(/^generation/i, 'Generation');
    const section = `## ${key}\n${match[2].trim()}`;
    const duration = match[2].match(/- 生成时长：([^\n]+)/)?.[1]?.trim();
    return { key, section, duration: duration ?? '不少于 5s' };
  });
}

const emptyModelConfigs: Record<ModelType, ModelConfig> = {
  multimodal: {
    model_type: 'multimodal',
    model_id: '',
    base_url: '',
    api_key: '',
  },
  image: {
    model_type: 'image',
    model_id: 'gpt-image-2',
    base_url: '',
    api_key: '',
  },
  video: { model_type: 'video', model_id: '', base_url: '', api_key: '' },
};

function StepHead({
  number,
  title,
  meta,
}: {
  number: number;
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-sm shadow-primary/25">
          {number}
        </span>
        <h2 className="truncate text-sm font-bold tracking-tight">{title}</h2>
      </div>
      {meta && (
        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
          {meta}
        </span>
      )}
    </div>
  );
}

function Frame({
  index = 0,
  className = '',
  label,
}: {
  index?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-muted ${className}`}>
      {/* oxlint-disable-next-line next/no-img-element */}
      <img
        src="/reference-workflow.png"
        alt="产品镜头参考"
        className="h-full w-full scale-[2.35] object-cover"
        style={{ objectPosition: positions[index % positions.length] }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-white/5" />
      {label && (
        <span className="absolute left-2 top-2 rounded-md bg-slate-950/55 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur">
          {label}
        </span>
      )}
    </div>
  );
}

function AssetLibrary({ onToast }: { onToast: (message: string) => void }) {
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{
    mode: 'create' | 'rename';
    url?: string;
    id?: number;
    value: string;
    title: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    url: string;
    id: number;
    label: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/assets/groups', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as {
        groups: AssetGroup[];
        items: AssetItem[];
      };
      setGroups(data.groups);
      setItems(data.items);
    } catch {
      onToast('素材库读取失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const request = async (url: string, options: RequestInit) => {
    const response = await fetch(url, options);
    const text = await response.text();
    let data: { error?: string } = {};
    try {
      data = text ? (JSON.parse(text) as { error?: string }) : {};
    } catch {
      /* 非 JSON 错误由状态码统一处理 */
    }
    if (!response.ok)
      throw new Error(
        data.error ??
          (response.status === 413
            ? '文件过大，请选择不超过 100 MB 的文件'
            : '操作失败'),
      );
    return data;
  };
  const createGroup = () =>
    setEditor({
      mode: 'create',
      value: '',
      title: '新建同款素材组',
    });
  const rename = (url: string, id: number, current: string) =>
    setEditor({ mode: 'rename', url, id, value: current, title: '重命名' });
  const remove = (url: string, id: number, label: string) =>
    setDeleteTarget({ url, id, label });
  const submitEditor = async () => {
    if (!editor?.value.trim()) return;
    setSubmitting(true);
    try {
      if (editor.mode === 'create')
        await request('/api/assets/groups', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: editor.value }),
        });
      else
        await request(editor.url!, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: editor.id, name: editor.value }),
        });
      await load();
      setEditor(null);
      onToast(editor.mode === 'create' ? '分组已创建' : '名称已更新');
    } catch (error) {
      onToast(error instanceof Error ? error.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await request(deleteTarget.url, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      await load();
      setDeleteTarget(null);
      onToast('已删除');
    } catch (error) {
      onToast(error instanceof Error ? error.message : '删除失败');
    } finally {
      setSubmitting(false);
    }
  };
  const upload = async (
    event: ChangeEvent<HTMLInputElement>,
    groupId: number,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const chunkSize = 512 * 1024;
    const totalParts = Math.ceil(file.size / chunkSize);
    let itemId = 0;
    try {
      for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
        const form = new FormData();
        form.set('group_id', String(groupId));
        form.set(
          'file',
          file.slice(
            partIndex * chunkSize,
            Math.min(file.size, (partIndex + 1) * chunkSize),
            file.type,
          ),
          file.name,
        );
        form.set('part_index', String(partIndex));
        form.set('total_parts', String(totalParts));
        form.set('file_size', String(file.size));
        if (itemId) form.set('item_id', String(itemId));
        const result = (await request('/api/assets/items', {
          method: 'POST',
          body: form,
        })) as { id: number };
        itemId = result.id;
      }
      await load();
      onToast('素材已上传');
    } catch (error) {
      onToast(error instanceof Error ? error.message : '上传失败');
    }
  };
  const referenceGroups = groups.filter(
    (group) => group.asset_type === 'video',
  );
  return (
    <section className="mx-auto max-w-[1520px] pb-8">
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-xl font-bold tracking-tight">同款素材组</p>
          <p className="mt-1 text-xs text-muted-foreground">
            每组包含一个参考视频和一组产品图片，用于生成同款产品视频。
          </p>
        </div>
        <Button onClick={createGroup} className="rounded-xl">
          <FolderPlus />
          新建同款素材组
        </Button>
      </div>
      {loading ? (
        <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
          <RefreshCw className="mr-2 size-4 animate-spin" />
          正在读取素材组…
        </div>
      ) : referenceGroups.length === 0 ? (
        <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-card text-center">
          <div>
            <FolderPlus className="mx-auto size-8 text-primary" />
            <p className="mt-3 text-sm font-semibold">还没有同款素材组</p>
            <p className="mt-1 text-xs text-muted-foreground">
              新建一组后，上传一个参考视频和你的产品图片。
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {referenceGroups.map((referenceGroup) => {
            const referenceVideo = items.find(
              (item) => item.group_id === referenceGroup.id,
            );
            const productGroup = groups.find(
              (group) => group.reference_group_id === referenceGroup.id,
            );
            const productItems = productGroup
              ? items.filter((item) => item.group_id === productGroup.id)
              : [];
            return (
              <section
                key={referenceGroup.id}
                className="rounded-2xl border bg-card p-4 sm:p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold">{referenceGroup.name}</h2>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      1 个参考视频 · {productItems.length} 张产品图片
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() =>
                        rename(
                          '/api/assets/groups',
                          referenceGroup.id,
                          referenceGroup.name,
                        )
                      }
                    >
                      <Pencil />
                      重命名
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-rose-600 hover:text-rose-600"
                      onClick={() =>
                        remove(
                          '/api/assets/groups',
                          referenceGroup.id,
                          referenceGroup.name,
                        )
                      }
                    >
                      <Trash2 />
                      删除
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border bg-background p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold">参考视频</p>
                      {!referenceVideo && (
                        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-medium text-primary-foreground">
                          <Upload className="size-3.5" />
                          上传参考视频
                          <input
                            className="hidden"
                            type="file"
                            accept="video/*"
                            onChange={(event) =>
                              void upload(event, referenceGroup.id)
                            }
                          />
                        </label>
                      )}
                    </div>
                    {referenceVideo ? (
                      <article className="overflow-hidden rounded-lg border">
                        <video
                          src={`/api/assets/items/${referenceVideo.id}/file`}
                          className="aspect-video w-full bg-muted object-cover"
                          preload="metadata"
                          controls
                        />
                        <div className="flex items-center gap-2 p-2.5">
                          <p className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                            {referenceVideo.name}
                          </p>
                          <button
                            onClick={() =>
                              rename(
                                '/api/assets/items',
                                referenceVideo.id,
                                referenceVideo.name,
                              )
                            }
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="重命名参考视频"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              remove(
                                '/api/assets/items',
                                referenceVideo.id,
                                referenceVideo.name,
                              )
                            }
                            className="text-muted-foreground hover:text-rose-600"
                            aria-label="删除参考视频"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </article>
                    ) : (
                      <div className="grid min-h-48 place-items-center rounded-lg border border-dashed text-center">
                        <div>
                          <Video className="mx-auto size-6 text-primary" />
                          <p className="mt-2 text-xs font-semibold">
                            上传一个参考视频
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border bg-background p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold">产品图片</p>
                      {productGroup && (
                        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-medium text-primary-foreground">
                          <Upload className="size-3.5" />
                          添加图片
                          <input
                            className="hidden"
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              void upload(event, productGroup.id)
                            }
                          />
                        </label>
                      )}
                    </div>
                    {productItems.length ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {productItems.map((item) => (
                          <article
                            key={item.id}
                            className="group relative overflow-hidden rounded-lg border bg-white"
                          >
                            <img
                              src={`/api/assets/items/${item.id}/file`}
                              alt={item.name}
                              className="aspect-square w-full object-contain p-1"
                            />
                            <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-slate-950/60 p-1 opacity-0 transition group-hover:opacity-100">
                              <button
                                onClick={() =>
                                  rename(
                                    '/api/assets/items',
                                    item.id,
                                    item.name,
                                  )
                                }
                                className="text-white"
                                aria-label="重命名产品图片"
                              >
                                <Pencil className="size-3" />
                              </button>
                              <button
                                onClick={() =>
                                  remove(
                                    '/api/assets/items',
                                    item.id,
                                    item.name,
                                  )
                                }
                                className="text-white"
                                aria-label="删除产品图片"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="grid min-h-48 place-items-center rounded-lg border border-dashed text-center">
                        <div>
                          <ImagePlus className="mx-auto size-6 text-primary" />
                          <p className="mt-2 text-xs font-semibold">
                            添加产品图片
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
      {editor && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            aria-label="关闭弹窗"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => !submitting && setEditor(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-editor-title"
            className="relative w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2 id="asset-editor-title" className="text-lg font-bold">
              {editor.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              为便于查找，请输入清晰的名称。
            </p>
            <input
              autoFocus
              value={editor.value}
              onChange={(event) =>
                setEditor({ ...editor, value: event.target.value })
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitEditor();
              }}
              className="mt-5 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="例如：护肤精华同款视频"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={submitting}
                onClick={() => setEditor(null)}
              >
                取消
              </Button>
              <Button
                className="rounded-xl"
                disabled={submitting || !editor.value.trim()}
                onClick={() => void submitEditor()}
              >
                {submitting && <RefreshCw className="animate-spin" />}
                {submitting ? '创建中' : '创建'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            aria-label="关闭弹窗"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => !submitting && setDeleteTarget(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-delete-title"
            className="relative w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2 id="asset-delete-title" className="text-lg font-bold">
              确认删除？
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              将删除「{deleteTarget.label}」及其包含的所有素材，此操作无法恢复。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={submitting}
                onClick={() => setDeleteTarget(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                disabled={submitting}
                onClick={() => void confirmDelete()}
              >
                {submitting && <RefreshCw className="animate-spin" />}
                {submitting ? '删除中' : '删除'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );

  /* Legacy two-tab material-library UI retained temporarily for migration reference.
  const selectedGroups = groups.filter(
    (group) => group.asset_type === assetType,
  );
  const label = assetType === 'video' ? '参考视频' : '产品';
  return (
    <section className="mx-auto max-w-[1520px] pb-8">
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-xl font-bold tracking-tight">素材库</p>
          <p className="mt-1 text-xs text-muted-foreground">
            按分组管理参考视频与产品图片
          </p>
        </div>
        <Button onClick={createGroup} className="rounded-xl">
          <FolderPlus />
          新建{label}分组
        </Button>
      </div>
      <div
        role="tablist"
        className="mb-5 flex w-full max-w-md rounded-2xl border bg-muted/45 p-1.5"
      >
        {(
          [
            ['video', '参考视频', Video],
            ['product', '产品', ImageIcon],
          ] as const
        ).map(([type, title, Icon]) => (
          <button
            key={type}
            role="tab"
            aria-selected={assetType === type}
            onClick={() => setAssetType(type)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${assetType === type ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70' : 'text-muted-foreground'}`}
          >
            <Icon className="size-4" />
            {title}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
          <RefreshCw className="mr-2 size-4 animate-spin" />
          正在读取素材库…
        </div>
      ) : selectedGroups.length === 0 ? (
        <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-card text-center">
          <div>
            <FolderPlus className="mx-auto size-8 text-primary" />
            <p className="mt-3 text-sm font-semibold">还没有{label}分组</p>
            <p className="mt-1 text-xs text-muted-foreground">
              先创建一个分组，再上传
              {assetType === 'video' ? '视频' : '产品图片'}。
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {selectedGroups.map((group) => {
            const groupItems = items.filter(
              (item) => item.group_id === group.id,
            );
            return (
              <section
                key={group.id}
                className="rounded-2xl border bg-card p-4 sm:p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold">{group.name}</h2>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {groupItems.length} 个
                      {assetType === 'video' ? '视频' : '图片'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() =>
                        rename('/api/assets/groups', group.id, group.name)
                      }
                    >
                      <Pencil />
                      重命名
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-rose-600 hover:text-rose-600"
                      onClick={() =>
                        remove('/api/assets/groups', group.id, group.name)
                      }
                    >
                      <Trash2 />
                      删除
                    </Button>
                    <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90">
                      <Upload className="size-3.5" />
                      上传{assetType === 'video' ? '视频' : '图片'}
                      <input
                        className="hidden"
                        type="file"
                        accept={assetType === 'video' ? 'video/*' : 'image/*'}
                        onChange={(event) => void upload(event, group.id)}
                      />
                    </label>
                  </div>
                </div>
                {groupItems.length === 0 ? (
                  <div className="grid min-h-32 place-items-center rounded-xl border border-dashed text-xs text-muted-foreground">
                    此分组暂时没有素材
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {groupItems.map((item) => (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-xl border bg-background"
                      >
                        <div className="relative aspect-video bg-muted">
                          {assetType === 'product' ? (
                            <img
                              src={`/api/assets/items/${item.id}/file`}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <video
                              src={`/api/assets/items/${item.id}/file`}
                              className="h-full w-full object-cover"
                              preload="metadata"
                              controls
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2 p-2.5">
                          <p className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                            {item.name}
                          </p>
                          <button
                            onClick={() =>
                              rename('/api/assets/items', item.id, item.name)
                            }
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="重命名素材"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 rounded-lg px-2.5 text-[11px]"
                            onClick={() => selectWorkflow(workflow.id)}
                          >
                            编辑
                          </Button>
                          <button
                            onClick={() =>
                              remove('/api/assets/items', item.id, item.name)
                            }
                            className="text-muted-foreground hover:text-rose-600"
                            aria-label="删除素材"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      {editor && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            aria-label="关闭弹窗"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => !submitting && setEditor(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-editor-title"
            className="relative w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2 id="asset-editor-title" className="text-lg font-bold">
              {editor.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              为便于查找，请输入清晰的名称。
            </p>
            <input
              autoFocus
              value={editor.value}
              onChange={(event) =>
                setEditor({ ...editor, value: event.target.value })
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitEditor();
              }}
              className="mt-5 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="请输入名称"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={submitting}
                onClick={() => setEditor(null)}
              >
                取消
              </Button>
              <Button
                className="rounded-xl"
                disabled={submitting || !editor.value.trim()}
                onClick={() => void submitEditor()}
              >
                {submitting && <RefreshCw className="animate-spin" />}
                {submitting ? '保存中' : '确定'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            aria-label="关闭弹窗"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => !submitting && setDeleteTarget(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-delete-title"
            className="relative w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2 id="asset-delete-title" className="text-lg font-bold">
              确认删除？
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              将删除「{deleteTarget.label}」及其包含的所有素材，此操作无法恢复。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={submitting}
                onClick={() => setDeleteTarget(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                disabled={submitting}
                onClick={() => void confirmDelete()}
              >
                {submitting && <RefreshCw className="animate-spin" />}
                {submitting ? '删除中' : '删除'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
  */
}

export default function Home() {
  const [mobileNav, setMobileNav] = useState(false);
  const [activeSection, setActiveSection] = useState<'project' | 'assets'>(
    'project',
  );
  const [activeWorkflow, setActiveWorkflow] = useState('1');
  const [workflowId, setWorkflowId] = useState(1);
  const [workflowDetailOpen, setWorkflowDetailOpen] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [workflowCreateOpen, setWorkflowCreateOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowRenameId, setWorkflowRenameId] = useState<number | null>(null);
  const [workflowDeleteId, setWorkflowDeleteId] = useState<number | null>(null);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/workflows\/(\d+)\/?$/);
    if (!match) return;
    setWorkflowId(Number(match[1]));
    setWorkflowDetailOpen(true);
  }, []);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState('');
  const [referenceVideos, setReferenceVideos] = useState<AssetItem[]>([]);
  const [referenceGroups, setReferenceGroups] = useState<AssetGroup[]>([]);
  const [productGroups, setProductGroups] = useState<AssetGroup[]>([]);
  const [productImages, setProductImages] = useState<AssetItem[]>([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState('');
  const [overviewUrl, setOverviewUrl] = useState('');
  const [overviews, setOverviews] = useState<ReferenceOverview[]>([]);
  const [selectedOverviewId, setSelectedOverviewId] = useState<number | null>(
    null,
  );
  const [overviewDeleteId, setOverviewDeleteId] = useState<number | null>(null);
  const [overviewViewerOpen, setOverviewViewerOpen] = useState(false);
  const [productOverviews, setProductOverviews] = useState<ProductOverview[]>(
    [],
  );
  const [selectedProductGroupId, setSelectedProductGroupId] = useState('');
  const [selectedProductOverviewId, setSelectedProductOverviewId] = useState<
    number | null
  >(null);
  const [productOverviewUrl, setProductOverviewUrl] = useState('');
  const [productOverviewGenerating, setProductOverviewGenerating] =
    useState(false);
  const [productOverviewDeleteId, setProductOverviewDeleteId] = useState<
    number | null
  >(null);
  const [productOverviewViewerOpen, setProductOverviewViewerOpen] =
    useState(false);
  const [structures, setStructures] = useState<ReferenceStructure[]>([]);
  const [selectedStructureId, setSelectedStructureId] = useState<number | null>(
    null,
  );
  const [structureAnalyzing, setStructureAnalyzing] = useState(false);
  const [structureDeleteId, setStructureDeleteId] = useState<number | null>(
    null,
  );
  const [generationPlans, setGenerationPlans] = useState<GenerationPlan[]>([]);
  const [selectedGenerationPlanId, setSelectedGenerationPlanId] = useState<
    number | null
  >(null);
  const [generationPlanCreating, setGenerationPlanCreating] = useState(false);
  const [generationPlanDeleteId, setGenerationPlanDeleteId] = useState<
    number | null
  >(null);
  const [productVideoPlans, setProductVideoPlans] = useState<
    ProductVideoPlan[]
  >([]);
  const [selectedProductVideoPlanId, setSelectedProductVideoPlanId] = useState<
    number | null
  >(null);
  const [productVideoPlanViewerOpen, setProductVideoPlanViewerOpen] =
    useState(false);
  const [productVideoPlanCreating, setProductVideoPlanCreating] =
    useState(false);
  const [productVideoPlanDeleteId, setProductVideoPlanDeleteId] = useState<
    number | null
  >(null);
  const [productBrief, setProductBrief] = useState('');
  const [productKeyframes, setProductKeyframes] = useState<ProductKeyframe[]>(
    [],
  );
  const [keyframeGeneratingKeys, setKeyframeGeneratingKeys] = useState<
    string[]
  >([]);
  const [keyframePromptEditor, setKeyframePromptEditor] = useState<{
    key: string;
    value: string;
  } | null>(null);
  const [keyframeImageEditor, setKeyframeImageEditor] = useState<{
    id: number;
    key: string;
    value: string;
  } | null>(null);
  const [keyframeDeleteId, setKeyframeDeleteId] = useState<number | null>(null);
  const [keyframeViewerId, setKeyframeViewerId] = useState<number | null>(null);
  const [productVideos, setProductVideos] = useState<ProductVideo[]>([]);
  const [finalVideos, setFinalVideos] = useState<FinalVideo[]>([]);
  const [finalVideoViewerId, setFinalVideoViewerId] = useState<number | null>(
    null,
  );
  const [finalVideoDeleteId, setFinalVideoDeleteId] = useState<number | null>(
    null,
  );
  const finalVideo = finalVideos[0] ?? null;
  const finalVideoViewer =
    finalVideos.find((video) => video.id === finalVideoViewerId) ?? null;
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(DEFAULT_CAPCUT_DRAFT_PROMPT);
  const [draftCreating, setDraftCreating] = useState(false);
  const [capcutDrafts, setCapcutDrafts] = useState<CapcutDraft[]>([]);
  const [capcutDraftDeleteId, setCapcutDraftDeleteId] = useState<number | null>(
    null,
  );
  const [finalVideoComposing, setFinalVideoComposing] = useState(false);
  const [videoSubmittingKeys, setVideoSubmittingKeys] = useState<string[]>([]);
  const [videoPromptEditor, setVideoPromptEditor] = useState<{
    key: string;
    value: string;
  } | null>(null);
  const [productVideoDeleteId, setProductVideoDeleteId] = useState<
    number | null
  >(null);
  const [structurePrompt, setStructurePrompt] = useState(
    DEFAULT_PRODUCT_VIDEO_PLAN_PROMPT,
  );
  const [structurePromptOpen, setStructurePromptOpen] = useState(false);
  const [overviewGenerating, setOverviewGenerating] = useState(false);
  const progress = 72;
  const [toast, setToast] = useState('');
  const [batchGenerationOpen, setBatchGenerationOpen] = useState(false);
  const [selectedBatchMaterialGroupIds, setSelectedBatchMaterialGroupIds] =
    useState<number[]>([]);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchMaterialProgress[]>(
    [],
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeModelTab, setActiveModelTab] = useState<ModelType>('multimodal');
  const [models, setModels] = useState(emptyModelConfigs);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [testingModel, setTestingModel] = useState<ModelType | null>(null);
  const [connectionResult, setConnectionResult] = useState<
    Partial<Record<ModelType, { ok: boolean; message: string }>>
  >({});

  const workflowQuery = () => `?workflow_id=${workflowId}`;

  const loadWorkflows = async () => {
    const response = await fetch('/api/workflows', { cache: 'no-store' });
    if (!response.ok) throw new Error('读取失败');
    const data = (await response.json()) as { workflows: WorkflowRun[] };
    setWorkflows(data.workflows);
    if (!data.workflows.some((workflow) => workflow.id === workflowId))
      setWorkflowId(data.workflows[0]?.id ?? 1);
    return data.workflows;
  };

  const loadOverviews = async () => {
    const response = await fetch(`/api/reference-overviews${workflowQuery()}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('读取失败');
    const data = (await response.json()) as { overviews: ReferenceOverview[] };
    setOverviews(data.overviews);
    const current = data.overviews[0];
    setSelectedOverviewId(current?.id ?? null);
    setOverviewUrl(
      current ? `/api/reference-overviews/${current.id}/file` : '',
    );
    return data.overviews;
  };
  const loadStructures = async () => {
    const response = await fetch('/api/reference-structures', {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('读取失败');
    const data = (await response.json()) as {
      structures: ReferenceStructure[];
    };
    setStructures(data.structures);
    return data.structures;
  };
  const loadProductOverviews = async () => {
    const response = await fetch(`/api/product-overviews${workflowQuery()}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('读取失败');
    const data = (await response.json()) as { overviews: ProductOverview[] };
    setProductOverviews(data.overviews);
    const current = data.overviews[0];
    setSelectedProductOverviewId(current?.id ?? null);
    setProductOverviewUrl(
      current ? `/api/product-overviews/${current.id}/file` : '',
    );
    return data.overviews;
  };
  const loadGenerationPlans = async () => {
    const response = await fetch('/api/generation-plans', {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('读取失败');
    const data = (await response.json()) as { plans: GenerationPlan[] };
    setGenerationPlans(data.plans);
    return data.plans;
  };
  const loadProductVideoPlans = async () => {
    const response = await fetch(`/api/product-video-plans${workflowQuery()}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('读取失败');
    const data = (await response.json()) as { plans: ProductVideoPlan[] };
    setProductVideoPlans(data.plans);
    const current = data.plans[0];
    setSelectedProductVideoPlanId(current?.id ?? null);
    return data.plans;
  };
  const loadProductKeyframes = async () => {
    const response = await fetch(`/api/product-keyframes${workflowQuery()}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('读取失败');
    const data = (await response.json()) as { keyframes: ProductKeyframe[] };
    setProductKeyframes(data.keyframes);
    return data.keyframes;
  };
  const loadProductVideos = async () => {
    const response = await fetch(`/api/product-videos${workflowQuery()}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('读取失败');
    const data = (await response.json()) as { videos: ProductVideo[] };
    setProductVideos(data.videos);
    return data.videos;
  };
  const loadFinalVideo = async () => {
    const response = await fetch(`/api/final-videos${workflowQuery()}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('读取失败');
    const data = (await response.json()) as {
      video: FinalVideo | null;
      videos?: FinalVideo[];
    };
    const videos = data.videos ?? (data.video ? [data.video] : []);
    setFinalVideos(videos);
    return videos;
  };
  const loadCapcutDrafts = async () => {
    const response = await fetch(`/api/capcut-drafts${workflowQuery()}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('读取失败');
    const data = (await response.json()) as { drafts: CapcutDraft[] };
    setCapcutDrafts(data.drafts);
    return data.drafts;
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (activeSection !== 'project') return;
    void loadWorkflows().catch(() => setToast('作品读取失败，请稍后重试'));
    fetch('/api/assets/groups', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as {
          groups: AssetGroup[];
          items: AssetItem[];
        };
        const videoGroupIds = new Set(
          data.groups
            .filter((group) => group.asset_type === 'video')
            .map((group) => group.id),
        );
        const nextReferenceGroups = data.groups.filter(
          (group) => group.asset_type === 'video',
        );
        const nextReferenceVideos = data.items.filter((item) =>
          videoGroupIds.has(item.group_id),
        );
        setReferenceGroups(nextReferenceGroups);
        setReferenceVideos(nextReferenceVideos);
        const nextProductGroups = data.groups.filter(
          (group) => group.asset_type === 'product',
        );
        const productGroupIds = new Set(
          nextProductGroups.map((group) => group.id),
        );
        setProductGroups(nextProductGroups);
        setProductImages(
          data.items.filter((item) => productGroupIds.has(item.group_id)),
        );
        if (!selectedReferenceId) {
          const defaultGroup = nextReferenceGroups.find((group) =>
            nextReferenceVideos.some((video) => video.group_id === group.id),
          );
          const defaultVideo = nextReferenceVideos.find(
            (video) => video.group_id === defaultGroup?.id,
          );
          const defaultProductGroup = nextProductGroups.find(
            (group) => group.reference_group_id === defaultGroup?.id,
          );
          if (defaultGroup && defaultVideo) {
            setSelectedReferenceId(String(defaultGroup.id));
            setReferenceVideoUrl(`/api/assets/items/${defaultVideo.id}/file`);
            setSelectedProductGroupId(
              defaultProductGroup ? String(defaultProductGroup.id) : '',
            );
          }
        }
      })
      .catch(() => setToast('参考视频读取失败，请稍后重试'));
  }, [activeSection, workflowId]);

  useEffect(() => {
    if (activeSection !== 'project') return;
    void loadOverviews().catch(() =>
      setToast('总览图版本读取失败，请稍后重试'),
    );
    void loadProductOverviews().catch(() =>
      setToast('产品预览图版本读取失败，请稍后重试'),
    );
    void loadStructures().catch(() => setToast('镜头结构读取失败，请稍后重试'));
    void loadGenerationPlans().catch(() =>
      setToast('生成段规划读取失败，请稍后重试'),
    );
    void loadProductVideoPlans().catch(() =>
      setToast('产品视频方案读取失败，请稍后重试'),
    );
    void loadProductKeyframes().catch(() =>
      setToast('产品关键帧读取失败，请稍后重试'),
    );
    void loadProductVideos().catch(() =>
      setToast('分镜视频读取失败，请稍后重试'),
    );
    void loadFinalVideo().catch(() => setToast('合成视频读取失败，请稍后重试'));
    void loadCapcutDrafts().catch(() =>
      setToast('剪映草稿记录读取失败，请稍后重试'),
    );
  }, [activeSection, workflowId]);

  useEffect(() => {
    const pending = productVideos.filter((video) =>
      ['queued', 'pending', 'running', 'processing'].includes(video.status),
    );
    if (pending.length === 0) return;
    const timer = window.setTimeout(async () => {
      await Promise.all(
        pending.map((video) =>
          fetch('/api/product-videos', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: video.id, action: 'refresh' }),
          }).catch(() => null),
        ),
      );
      void loadProductVideos();
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [productVideos]);

  const jump = (step: number) =>
    document
      .getElementById(`step-${step}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const openWorkflow = (step: string) => {
    setActiveWorkflow(step);
    window.setTimeout(() => jump(Number(step)), 0);
  };
  const selectWorkflow = (id: number) => {
    window.location.assign(`/workflows/${id}`);
  };
  const createWorkflow = async () => {
    if (!workflowName.trim()) {
      setToast('请填写作品名称');
      return;
    }
    const response = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: workflowName }),
    });
    const data = (await response.json()) as { id?: number; error?: string };
    if (!response.ok || !data.id) {
      setToast(data.error ?? '新建作品失败');
      return;
    }
    await loadWorkflows();
    window.location.assign(`/workflows/${data.id}`);
    setWorkflowName('');
    setWorkflowCreateOpen(false);
    setToast('作品已创建');
  };
  const renameWorkflow = async () => {
    if (workflowRenameId === null || !workflowName.trim()) return;
    const response = await fetch('/api/workflows', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: workflowRenameId, name: workflowName }),
    });
    if (!response.ok) {
      setToast('重命名作品失败');
      return;
    }
    await loadWorkflows();
    setWorkflowName('');
    setWorkflowRenameId(null);
    setToast('作品已重命名');
  };
  const deleteWorkflow = async () => {
    if (workflowDeleteId === null) return;
    const response = await fetch('/api/workflows', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: workflowDeleteId }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setToast(data.error ?? '删除作品失败');
      return;
    }
    const next = await loadWorkflows();
    if (workflowId === workflowDeleteId) {
      window.location.assign('/');
    }
    setWorkflowDeleteId(null);
    setToast('作品及其产物已删除');
  };
  const updateWorkflowProgress = (payload: {
    current_step?: number;
    status?: string;
  }) => {
    void fetch('/api/workflows', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: workflowId, ...payload }),
    }).then(() => void loadWorkflows());
  };
  const download = () => {
    const referenceName =
      referenceVideos.find(
        (video) => String(video.group_id) === selectedReferenceId,
      )?.name ?? '未选择';
    const output = [
      '同款视频作品导出',
      `参考视频：${referenceName}`,
      '',
      '结构脚本',
      ...story.map((s) => `${s[0]} ${s[1]} ${s[2]}｜${s[3]}`),
      '',
      '关键帧提示词',
      ...prompts.map((p, i) => `${i + 1}. ${p}`),
      '',
      '视频提示词',
      videoPrompt,
    ].join('\n');
    const url = URL.createObjectURL(
      new Blob([output], { type: 'text/plain;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = '同款视频-作品.txt';
    a.click();
    URL.revokeObjectURL(url);
    setToast('作品文件已导出');
  };
  const waitFor = (
    target: HTMLVideoElement,
    event: 'loadedmetadata' | 'seeked',
  ) =>
    new Promise<void>((resolve, reject) => {
      const done = () => {
        target.removeEventListener(event, done);
        target.removeEventListener('error', fail);
        resolve();
      };
      const fail = () => {
        target.removeEventListener(event, done);
        target.removeEventListener('error', fail);
        reject(new Error('无法读取视频'));
      };
      target.addEventListener(event, done, { once: true });
      target.addEventListener('error', fail, { once: true });
    });
  const createReferenceOverview = async () => {
    if (!referenceVideoUrl) {
      setToast('请先上传参考视频');
      return;
    }
    setOverviewGenerating(true);
    try {
      const video = document.createElement('video');
      video.src = referenceVideoUrl;
      video.muted = true;
      video.preload = 'auto';
      await waitFor(video, 'loadedmetadata');
      if (
        !Number.isFinite(video.duration) ||
        !video.videoWidth ||
        !video.videoHeight
      )
        throw new Error('视频信息不完整');
      const frameCount = 27;
      const aspectRatio = video.videoWidth / video.videoHeight;
      const columns = aspectRatio < 1 ? 3 : 4;
      const rows = Math.ceil(frameCount / columns);
      const frameWidth = aspectRatio < 1 ? 360 : 480;
      const frameHeight = Math.round(frameWidth / aspectRatio);
      const labelHeight = 42;
      const gap = 10;
      const padding = 24;
      const canvas = document.createElement('canvas');
      canvas.width = padding * 2 + columns * frameWidth + (columns - 1) * gap;
      canvas.height =
        padding * 2 + rows * (frameHeight + labelHeight) + (rows - 1) * gap;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法创建画布');
      context.fillStyle = '#101827';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      for (let index = 0; index < frameCount; index += 1) {
        const targetTime = Math.min(
          video.duration - 0.02,
          video.duration * ((index + 0.5) / frameCount),
        );
        const seeked = waitFor(video, 'seeked');
        video.currentTime = targetTime;
        await seeked;
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = padding + column * (frameWidth + gap);
        const y = padding + row * (frameHeight + labelHeight + gap);
        context.drawImage(video, x, y, frameWidth, frameHeight);
        context.fillStyle = 'rgba(0, 0, 0, 0.78)';
        context.fillRect(x, y + frameHeight, frameWidth, labelHeight);
        const minutes = Math.floor(targetTime / 60);
        const seconds = targetTime % 60;
        context.fillStyle = '#fff';
        context.font = '600 18px system-ui, sans-serif';
        context.fillText(
          `${String(minutes).padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`,
          x + 14,
          y + frameHeight + 27,
        );
      }
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error('总览图生成失败')),
          'image/jpeg',
          0.95,
        ),
      );
      const chunkSize = 512 * 1024;
      const totalParts = Math.ceil(blob.size / chunkSize);
      let overviewId = 0;
      for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
        const form = new FormData();
        form.set(
          'file',
          blob.slice(
            partIndex * chunkSize,
            Math.min(blob.size, (partIndex + 1) * chunkSize),
            'image/jpeg',
          ),
          'reference-overview.jpg',
        );
        form.set(
          'name',
          `reference-overview-${new Date().toLocaleString('sv').replace(/[: ]/g, '-')}.jpg`,
        );
        form.set('workflow_id', String(workflowId));
        form.set('part_index', String(partIndex));
        form.set('total_parts', String(totalParts));
        form.set('file_size', String(blob.size));
        if (overviewId) form.set('overview_id', String(overviewId));
        const response = await fetch('/api/reference-overviews', {
          method: 'POST',
          body: form,
        });
        const payload = (await response.json()) as {
          id?: number;
          error?: string;
        };
        if (!response.ok || !payload.id)
          throw new Error(payload.error ?? '保存失败');
        overviewId = payload.id;
      }
      await loadOverviews();
      setSelectedOverviewId(overviewId);
      setOverviewUrl(`/api/reference-overviews/${overviewId}/file`);
      updateWorkflowProgress({ current_step: 2 });
      setToast('已生成新的总览图版本');
    } catch {
      setToast('总览图生成失败，请确认浏览器可以播放该视频');
    } finally {
      setOverviewGenerating(false);
    }
  };
  const deleteOverview = async () => {
    if (overviewDeleteId === null) return;
    try {
      const response = await fetch('/api/reference-overviews', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: overviewDeleteId }),
      });
      if (!response.ok) throw new Error();
      const next = await loadOverviews();
      if (selectedOverviewId === overviewDeleteId) {
        const nextId = next[0]?.id ?? null;
        setSelectedOverviewId(nextId);
        setOverviewUrl(nextId ? `/api/reference-overviews/${nextId}/file` : '');
      }
      setOverviewDeleteId(null);
      setToast('总览图版本已删除');
    } catch {
      setToast('删除总览图版本失败，请稍后重试');
    }
  };
  const loadProductImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('产品图片读取失败'));
      image.src = url;
    });
  const createProductOverview = async () => {
    const groupId = Number(selectedProductGroupId);
    const images = productImages.filter((item) => item.group_id === groupId);
    if (!groupId || images.length === 0) {
      setToast('请选择包含产品图片的分组');
      return;
    }
    setProductOverviewGenerating(true);
    try {
      const loadedImages = await Promise.all(
        images.map((item) =>
          loadProductImage(`/api/assets/items/${item.id}/file`),
        ),
      );
      const columns =
        images.length === 1
          ? 1
          : images.length <= 4
            ? 2
            : images.length <= 9
              ? 3
              : 4;
      const rows = Math.ceil(images.length / columns);
      const cellWidth = 520;
      const imageHeight = 520;
      const labelHeight = 58;
      const gap = 16;
      const padding = 28;
      const headerHeight = 88;
      const canvas = document.createElement('canvas');
      canvas.width = padding * 2 + columns * cellWidth + (columns - 1) * gap;
      canvas.height =
        padding * 2 +
        headerHeight +
        rows * (imageHeight + labelHeight) +
        (rows - 1) * gap;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法创建画布');
      context.fillStyle = '#f1f5f9';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#0f172a';
      context.font = '700 30px system-ui, sans-serif';
      context.fillText(
        productGroups.find((group) => group.id === groupId)?.name ?? '产品预览',
        padding,
        padding + 34,
      );
      context.fillStyle = '#64748b';
      context.font = '500 18px system-ui, sans-serif';
      context.fillText(
        `${images.length} 张产品参考图 · 保持原始比例`,
        padding,
        padding + 66,
      );
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      loadedImages.forEach((image, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = padding + column * (cellWidth + gap);
        const y =
          padding + headerHeight + row * (imageHeight + labelHeight + gap);
        context.fillStyle = '#ffffff';
        context.fillRect(x, y, cellWidth, imageHeight + labelHeight);
        const innerPadding = 20;
        const availableWidth = cellWidth - innerPadding * 2;
        const availableHeight = imageHeight - innerPadding * 2;
        const scale = Math.min(
          availableWidth / image.naturalWidth,
          availableHeight / image.naturalHeight,
        );
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        context.drawImage(
          image,
          x + (cellWidth - drawWidth) / 2,
          y + (imageHeight - drawHeight) / 2,
          drawWidth,
          drawHeight,
        );
        context.fillStyle = '#e2e8f0';
        context.fillRect(x, y + imageHeight, cellWidth, 1);
        context.fillStyle = '#0f172a';
        context.font = '600 18px system-ui, sans-serif';
        const label = images[index].name;
        context.fillText(
          label.length > 34 ? `${label.slice(0, 33)}…` : label,
          x + 18,
          y + imageHeight + 36,
        );
      });
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error('产品预览图生成失败')),
          'image/jpeg',
          0.95,
        ),
      );
      const chunkSize = 512 * 1024;
      const totalParts = Math.ceil(blob.size / chunkSize);
      let overviewId = 0;
      const versionName = `product-overview-${new Date().toLocaleString('sv').replace(/[: ]/g, '-')}.jpg`;
      for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
        const form = new FormData();
        form.set(
          'file',
          blob.slice(
            partIndex * chunkSize,
            Math.min(blob.size, (partIndex + 1) * chunkSize),
            'image/jpeg',
          ),
          'product-overview.jpg',
        );
        form.set('name', versionName);
        form.set('group_id', String(groupId));
        form.set('workflow_id', String(workflowId));
        form.set('part_index', String(partIndex));
        form.set('total_parts', String(totalParts));
        form.set('file_size', String(blob.size));
        if (overviewId) form.set('overview_id', String(overviewId));
        const response = await fetch('/api/product-overviews', {
          method: 'POST',
          body: form,
        });
        const payload = (await response.json()) as {
          id?: number;
          error?: string;
        };
        if (!response.ok || !payload.id)
          throw new Error(payload.error ?? '保存失败');
        overviewId = payload.id;
      }
      await loadProductOverviews();
      setSelectedProductOverviewId(overviewId);
      setProductOverviewUrl(`/api/product-overviews/${overviewId}/file`);
      updateWorkflowProgress({ current_step: 3 });
      setToast('已生成新的产品预览图版本');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '产品预览图生成失败');
    } finally {
      setProductOverviewGenerating(false);
    }
  };
  const updateBatchItem = (
    groupId: number,
    update: (item: BatchMaterialProgress) => BatchMaterialProgress,
  ) =>
    setBatchProgress((current) =>
      current.map((item) => (item.groupId === groupId ? update(item) : item)),
    );
  const updateBatchStep = (
    groupId: number,
    stepIndex: number,
    status: BatchStepStatus,
    detail = '',
  ) =>
    updateBatchItem(groupId, (item) => ({
      ...item,
      status: status === 'failed' ? 'failed' : item.status,
      error: status === 'failed' ? detail : item.error,
      steps: item.steps.map((step, index) =>
        index === stepIndex ? { ...step, status, detail } : step,
      ),
    }));
  const responseJson = async <T,>(response: Response, fallback: string) => {
    const data = (await response.json().catch(() => ({}))) as T & {
      error?: string;
    };
    if (!response.ok) throw new Error(data.error ?? fallback);
    return data;
  };
  const uploadBatchOverview = async (
    endpoint: '/api/reference-overviews' | '/api/product-overviews',
    blob: Blob,
    targetWorkflowId: number,
    name: string,
    groupId?: number,
  ) => {
    const chunkSize = 512 * 1024;
    const totalParts = Math.ceil(blob.size / chunkSize);
    let overviewId = 0;
    for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
      const form = new FormData();
      form.set(
        'file',
        blob.slice(
          partIndex * chunkSize,
          Math.min(blob.size, (partIndex + 1) * chunkSize),
          'image/jpeg',
        ),
        name,
      );
      form.set('name', name);
      form.set('workflow_id', String(targetWorkflowId));
      form.set('part_index', String(partIndex));
      form.set('total_parts', String(totalParts));
      form.set('file_size', String(blob.size));
      if (groupId) form.set('group_id', String(groupId));
      if (overviewId) form.set('overview_id', String(overviewId));
      const data = await responseJson<{ id?: number }>(
        await fetch(endpoint, { method: 'POST', body: form }),
        '预览图保存失败',
      );
      if (!data.id) throw new Error('预览图保存失败');
      overviewId = data.id;
    }
    return overviewId;
  };
  const createBatchReferenceOverviewBlob = async (url: string) => {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.preload = 'auto';
    await waitFor(video, 'loadedmetadata');
    if (!Number.isFinite(video.duration) || !video.videoWidth || !video.videoHeight)
      throw new Error('参考视频信息不完整');
    const frameCount = 27;
    const aspectRatio = video.videoWidth / video.videoHeight;
    const columns = aspectRatio < 1 ? 3 : 4;
    const rows = Math.ceil(frameCount / columns);
    const frameWidth = aspectRatio < 1 ? 360 : 480;
    const frameHeight = Math.round(frameWidth / aspectRatio);
    const labelHeight = 42;
    const gap = 10;
    const padding = 24;
    const canvas = document.createElement('canvas');
    canvas.width = padding * 2 + columns * frameWidth + (columns - 1) * gap;
    canvas.height =
      padding * 2 + rows * (frameHeight + labelHeight) + (rows - 1) * gap;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建参考视频画布');
    context.fillStyle = '#101827';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    for (let index = 0; index < frameCount; index += 1) {
      const targetTime = Math.min(
        video.duration - 0.02,
        video.duration * ((index + 0.5) / frameCount),
      );
      const seeked = waitFor(video, 'seeked');
      video.currentTime = targetTime;
      await seeked;
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = padding + column * (frameWidth + gap);
      const y = padding + row * (frameHeight + labelHeight + gap);
      context.drawImage(video, x, y, frameWidth, frameHeight);
      context.fillStyle = 'rgba(0, 0, 0, 0.78)';
      context.fillRect(x, y + frameHeight, frameWidth, labelHeight);
      context.fillStyle = '#fff';
      context.font = '600 18px system-ui, sans-serif';
      const minutes = Math.floor(targetTime / 60);
      const seconds = targetTime % 60;
      context.fillText(
        `${String(minutes).padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`,
        x + 14,
        y + frameHeight + 27,
      );
    }
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('参考预览图生成失败')),
        'image/jpeg',
        0.95,
      ),
    );
  };
  const createBatchProductOverviewBlob = async (
    group: AssetGroup,
    images: AssetItem[],
  ) => {
    const loadedImages = await Promise.all(
      images.map((item) =>
        loadProductImage(`/api/assets/items/${item.id}/file`),
      ),
    );
    const columns =
      images.length === 1 ? 1 : images.length <= 4 ? 2 : images.length <= 9 ? 3 : 4;
    const rows = Math.ceil(images.length / columns);
    const cellWidth = 520;
    const imageHeight = 520;
    const labelHeight = 58;
    const gap = 16;
    const padding = 28;
    const headerHeight = 88;
    const canvas = document.createElement('canvas');
    canvas.width = padding * 2 + columns * cellWidth + (columns - 1) * gap;
    canvas.height =
      padding * 2 +
      headerHeight +
      rows * (imageHeight + labelHeight) +
      (rows - 1) * gap;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建产品图片画布');
    context.fillStyle = '#f1f5f9';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#0f172a';
    context.font = '700 30px system-ui, sans-serif';
    context.fillText(group.name, padding, padding + 34);
    context.fillStyle = '#64748b';
    context.font = '500 18px system-ui, sans-serif';
    context.fillText(`${images.length} 张产品参考图 · 保持原始比例`, padding, padding + 66);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    loadedImages.forEach((image, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = padding + column * (cellWidth + gap);
      const y = padding + headerHeight + row * (imageHeight + labelHeight + gap);
      context.fillStyle = '#ffffff';
      context.fillRect(x, y, cellWidth, imageHeight + labelHeight);
      const innerPadding = 20;
      const scale = Math.min(
        (cellWidth - innerPadding * 2) / image.naturalWidth,
        (imageHeight - innerPadding * 2) / image.naturalHeight,
      );
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      context.drawImage(
        image,
        x + (cellWidth - drawWidth) / 2,
        y + (imageHeight - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      context.fillStyle = '#e2e8f0';
      context.fillRect(x, y + imageHeight, cellWidth, 1);
      context.fillStyle = '#0f172a';
      context.font = '600 18px system-ui, sans-serif';
      const label = images[index].name;
      context.fillText(
        label.length > 34 ? `${label.slice(0, 33)}…` : label,
        x + 18,
        y + imageHeight + 36,
      );
    });
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('产品预览图生成失败')),
        'image/jpeg',
        0.95,
      ),
    );
  };
  const patchBatchWorkflow = async (
    targetWorkflowId: number,
    payload: { current_step?: number; status?: string },
  ) => {
    await responseJson(
      await fetch('/api/workflows', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: targetWorkflowId, ...payload }),
      }),
      '作品进度保存失败',
    );
  };
  const runBatchMaterial = async (group: AssetGroup) => {
    let activeStep = 0;
    try {
      updateBatchItem(group.id, (item) => ({
        ...item,
        status: 'running',
      }));
      const referenceGroup = referenceGroups.find(
        (item) => item.id === group.reference_group_id,
      );
      const referenceVideo = referenceVideos.find(
        (item) => item.group_id === referenceGroup?.id,
      );
      const images = productImages.filter((item) => item.group_id === group.id);
      if (!referenceGroup || !referenceVideo || images.length === 0)
        throw new Error('素材不完整，无法开始生成');

      const workflowData = await responseJson<{ id?: number }>(
        await fetch('/api/workflows', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: `${group.name}宣传视频` }),
        }),
        '新建作品失败',
      );
      if (!workflowData.id) throw new Error('新建作品失败');
      const targetWorkflowId = workflowData.id;
      updateBatchItem(group.id, (item) => ({
        ...item,
        workflowId: targetWorkflowId,
      }));

      updateBatchStep(group.id, activeStep, 'running', '正在抽取参考视频画面');
      const referenceBlob = await createBatchReferenceOverviewBlob(
        `/api/assets/items/${referenceVideo.id}/file`,
      );
      const referenceOverviewId = await uploadBatchOverview(
        '/api/reference-overviews',
        referenceBlob,
        targetWorkflowId,
        'reference-overview.jpg',
      );
      await patchBatchWorkflow(targetWorkflowId, { current_step: 2 });
      updateBatchStep(group.id, activeStep, 'completed', '参考预览图已生成');

      activeStep = 1;
      updateBatchStep(group.id, activeStep, 'running', `正在合成 ${images.length} 张图片`);
      const productBlob = await createBatchProductOverviewBlob(group, images);
      const productOverviewId = await uploadBatchOverview(
        '/api/product-overviews',
        productBlob,
        targetWorkflowId,
        'product-overview.jpg',
        group.id,
      );
      await patchBatchWorkflow(targetWorkflowId, { current_step: 3 });
      updateBatchStep(group.id, activeStep, 'completed', '产品预览图已生成');

      activeStep = 2;
      updateBatchStep(group.id, activeStep, 'running', '正在调用多模态模型');
      const plan = await responseJson<{ id?: number; content?: string }>(
        await fetch('/api/product-video-plans', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            reference_overview_id: referenceOverviewId,
            product_overview_id: productOverviewId,
            workflow_id: targetWorkflowId,
            prompt: structurePrompt,
            product_brief: '',
          }),
        }),
        '产品视频方案生成失败',
      );
      if (!plan.id || !plan.content) throw new Error('产品视频方案生成失败');
      const sections = parseGenerationSections(plan.content);
      if (sections.length === 0)
        throw new Error('视频方案中没有找到 Generation 段落');
      updateBatchStep(
        group.id,
        activeStep,
        'completed',
        `已生成 ${sections.length} 个分镜方案`,
      );

      activeStep = 3;
      const keyframes: Array<{ key: string; id: number; section: string }> = [];
      updateBatchStep(group.id, activeStep, 'running', `0/${sections.length}`);
      for (const [index, section] of sections.entries()) {
        const keyframe = await responseJson<{ id?: number }>(
          await fetch('/api/product-keyframes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              plan_id: plan.id,
              generation_key: section.key,
              prompt: buildKeyframePrompt(section.section),
            }),
          }),
          `${section.key} 关键帧生成失败`,
        );
        if (!keyframe.id) throw new Error(`${section.key} 关键帧生成失败`);
        keyframes.push({
          key: section.key,
          id: keyframe.id,
          section: section.section,
        });
        updateBatchStep(
          group.id,
          activeStep,
          'running',
          `${index + 1}/${sections.length}`,
        );
      }
      await patchBatchWorkflow(targetWorkflowId, { current_step: 4 });
      updateBatchStep(
        group.id,
        activeStep,
        'completed',
        `${keyframes.length} 张关键帧已生成`,
      );

      activeStep = 4;
      const videoIds: number[] = [];
      updateBatchStep(group.id, activeStep, 'running', `正在提交 0/${keyframes.length}`);
      for (const [index, keyframe] of keyframes.entries()) {
        const video = await responseJson<{ id?: number }>(
          await fetch('/api/product-videos', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              plan_id: plan.id,
              generation_key: keyframe.key,
              keyframe_id: keyframe.id,
              prompt: buildVideoGenerationPrompt(keyframe.section),
            }),
          }),
          `${keyframe.key} 视频任务提交失败`,
        );
        if (!video.id) throw new Error(`${keyframe.key} 视频任务提交失败`);
        videoIds.push(video.id);
        updateBatchStep(
          group.id,
          activeStep,
          'running',
          `正在提交 ${index + 1}/${keyframes.length}`,
        );
      }
      await patchBatchWorkflow(targetWorkflowId, {
        current_step: 5,
        status: 'processing',
      });
      let pendingIds = videoIds;
      for (let attempt = 0; pendingIds.length > 0 && attempt < 300; attempt += 1) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 6000));
        const statuses = await Promise.all(
          pendingIds.map(async (id) => {
            const result = await responseJson<{
              status?: string;
              error?: string;
            }>(
              await fetch('/api/product-videos', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id, action: 'refresh' }),
              }),
              '分镜视频状态读取失败',
            );
            if (result.status === 'failed')
              throw new Error(result.error ?? '分镜视频生成失败');
            return { id, status: result.status };
          }),
        );
        const completed = videoIds.length - statuses.filter(
          (item) => item.status !== 'succeeded',
        ).length;
        pendingIds = statuses
          .filter((item) => item.status !== 'succeeded')
          .map((item) => item.id);
        updateBatchStep(
          group.id,
          activeStep,
          'running',
          `已完成 ${completed}/${videoIds.length}`,
        );
      }
      if (pendingIds.length > 0) throw new Error('分镜视频生成等待超时');
      await patchBatchWorkflow(targetWorkflowId, {
        current_step: 5,
        status: 'completed',
      });
      updateBatchStep(
        group.id,
        activeStep,
        'completed',
        `${videoIds.length} 段分镜视频已完成`,
      );
      updateBatchItem(group.id, (item) => ({
        ...item,
        status: 'completed',
      }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '批量生成失败';
      updateBatchStep(group.id, activeStep, 'failed', message);
      return false;
    }
  };
  const startBatchGeneration = async () => {
    if (batchGenerating) return;
    const targets = batchMaterialItems.filter(
      (item) =>
        item.ready &&
        (selectedBatchMaterialCount === 0 ||
          selectedBatchMaterialGroupIdSet.has(item.group.id)),
    );
    if (targets.length === 0) {
      setToast('没有可生成的素材组');
      return;
    }
    setBatchProgress(
      targets.map((item) => ({
        groupId: item.group.id,
        groupName: item.group.name,
        workflowId: null,
        status: 'pending',
        error: '',
        steps: batchGenerationSteps.map((label) => ({
          label,
          status: 'pending',
          detail: '',
        })),
      })),
    );
    setBatchGenerating(true);
    let completed = 0;
    for (const target of targets) {
      const succeeded = await runBatchMaterial(target.group);
      if (!succeeded) break;
      completed += 1;
    }
    await loadWorkflows().catch(() => undefined);
    setBatchGenerating(false);
    setSelectedBatchMaterialGroupIds([]);
    setToast(
      completed === targets.length
        ? `批量生成完成：${completed} 个素材组已生成到分镜视频`
        : `批量生成已停止：完成 ${completed}/${targets.length} 个素材组`,
    );
  };
  const deleteProductOverview = async () => {
    if (productOverviewDeleteId === null) return;
    try {
      const response = await fetch('/api/product-overviews', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: productOverviewDeleteId }),
      });
      if (!response.ok) throw new Error();
      const next = await loadProductOverviews();
      if (selectedProductOverviewId === productOverviewDeleteId) {
        const nextId = next[0]?.id ?? null;
        setSelectedProductOverviewId(nextId);
        setProductOverviewUrl(
          nextId ? `/api/product-overviews/${nextId}/file` : '',
        );
      }
      setProductOverviewDeleteId(null);
      setToast('产品预览图版本已删除');
    } catch {
      setToast('删除产品预览图版本失败，请稍后重试');
    }
  };
  const createProductVideoPlan = async () => {
    if (!selectedOverviewId || !selectedProductOverviewId) {
      setToast('请选择参考视频预览图和产品预览图');
      return;
    }
    setProductVideoPlanCreating(true);
    try {
      const response = await fetch('/api/product-video-plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reference_overview_id: selectedOverviewId,
          product_overview_id: selectedProductOverviewId,
          workflow_id: workflowId,
          prompt: structurePrompt,
          product_brief: productBrief,
        }),
      });
      const data = (await response.json()) as { id?: number; error?: string };
      if (!response.ok || !data.id)
        throw new Error(data.error ?? '产品视频方案生成失败');
      await loadProductVideoPlans();
      setSelectedProductVideoPlanId(data.id);
      updateWorkflowProgress({ current_step: 3 });
      setToast('我的产品视频方案已生成');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '产品视频方案生成失败');
    } finally {
      setProductVideoPlanCreating(false);
    }
  };
  const deleteProductVideoPlan = async () => {
    if (productVideoPlanDeleteId === null) return;
    try {
      const response = await fetch('/api/product-video-plans', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: productVideoPlanDeleteId }),
      });
      if (!response.ok) throw new Error();
      const next = await loadProductVideoPlans();
      await loadProductKeyframes();
      if (selectedProductVideoPlanId === productVideoPlanDeleteId)
        setSelectedProductVideoPlanId(next[0]?.id ?? null);
      setProductVideoPlanDeleteId(null);
      setToast('产品视频方案版本已删除');
    } catch {
      setToast('删除产品视频方案失败，请稍后重试');
    }
  };
  const createProductKeyframe = async (
    generationKey: string,
    prompt: string,
    silent = false,
    editKeyframeId?: number,
  ) => {
    if (!selectedProductVideoPlanId) {
      setToast('请先选择产品视频方案版本');
      return false;
    }
    setKeyframeGeneratingKeys((current) => [
      ...new Set([...current, generationKey]),
    ]);
    try {
      const response = await fetch('/api/product-keyframes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          plan_id: selectedProductVideoPlanId,
          generation_key: generationKey,
          prompt,
          ...(editKeyframeId ? { edit_keyframe_id: editKeyframeId } : {}),
        }),
      });
      const data = (await response.json()) as { id?: number; error?: string };
      if (!response.ok || !data.id)
        throw new Error(data.error ?? '关键帧生成失败');
      await loadProductKeyframes();
      if (editKeyframeId) {
        setKeyframeViewerId(data.id);
        setKeyframeImageEditor({
          id: data.id,
          key: generationKey,
          value: '',
        });
      }
      updateWorkflowProgress({ current_step: 4 });
      if (!silent)
        setToast(
          editKeyframeId
            ? `${generationKey} 关键帧已修改`
            : `${generationKey} 关键帧已生成`,
        );
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : '关键帧生成失败');
      return false;
    } finally {
      setKeyframeGeneratingKeys((current) =>
        current.filter((key) => key !== generationKey),
      );
    }
  };
  const createAllProductKeyframes = async () => {
    const plan = productVideoPlans.find(
      (item) => item.id === selectedProductVideoPlanId,
    );
    if (!plan) {
      setToast('请先选择产品视频方案版本');
      return;
    }
    const sections = parseGenerationSections(plan.content);
    if (sections.length === 0) {
      setToast('所选方案中没有找到 Generation');
      return;
    }
    let completed = 0;
    for (const section of sections) {
      const ok = await createProductKeyframe(
        section.key,
        buildKeyframePrompt(section.section),
        true,
      );
      if (!ok) break;
      completed += 1;
    }
    if (completed === sections.length)
      setToast(`全部 ${completed} 张产品关键帧已生成`);
  };
  const selectProductKeyframe = async (id: number) => {
    try {
      const response = await fetch('/api/product-keyframes', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error();
      await loadProductKeyframes();
    } catch {
      setToast('关键帧版本选择失败，请稍后重试');
    }
  };
  const deleteProductKeyframe = async () => {
    if (keyframeDeleteId === null) return;
    try {
      const response = await fetch('/api/product-keyframes', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: keyframeDeleteId }),
      });
      if (!response.ok) throw new Error();
      await loadProductKeyframes();
      setKeyframeDeleteId(null);
      if (keyframeViewerId === keyframeDeleteId) setKeyframeViewerId(null);
      setToast('关键帧版本已删除');
    } catch {
      setToast('删除关键帧失败，请稍后重试');
    }
  };
  const submitProductVideo = async (
    generationKey: string,
    prompt: string,
    silent = false,
  ) => {
    if (!selectedProductVideoPlanId) {
      setToast('请先选择产品视频方案版本');
      return false;
    }
    const keyframe = productKeyframes.find(
      (item) =>
        item.plan_id === selectedProductVideoPlanId &&
        item.generation_key === generationKey &&
        item.is_selected === 1,
    );
    if (!keyframe) {
      setToast(`${generationKey} 还没有选定关键帧`);
      return false;
    }
    setVideoSubmittingKeys((current) => [
      ...new Set([...current, generationKey]),
    ]);
    try {
      const response = await fetch('/api/product-videos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          plan_id: selectedProductVideoPlanId,
          generation_key: generationKey,
          keyframe_id: keyframe.id,
          prompt,
        }),
      });
      const data = (await response.json()) as { id?: number; error?: string };
      if (!response.ok || !data.id)
        throw new Error(data.error ?? '视频任务提交失败');
      await loadProductVideos();
      updateWorkflowProgress({ current_step: 5, status: 'processing' });
      if (!silent) setToast(`${generationKey} 已提交生成`);
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : '视频任务提交失败');
      return false;
    } finally {
      setVideoSubmittingKeys((current) =>
        current.filter((key) => key !== generationKey),
      );
    }
  };
  const submitAllProductVideos = async () => {
    if (!selectedProductVideoPlan) {
      setToast('请先选择产品视频方案版本');
      return;
    }
    let submitted = 0;
    for (const generation of selectedGenerationSections) {
      const existing = productVideos
        .filter(
          (video) =>
            video.plan_id === selectedProductVideoPlan.id &&
            video.generation_key === generation.key,
        )
        .sort((a, b) => b.id - a.id)[0];
      const prompt =
        existing?.prompt ?? buildVideoGenerationPrompt(generation.section);
      const ok = await submitProductVideo(generation.key, prompt, true);
      if (!ok) break;
      submitted += 1;
    }
    if (submitted === selectedGenerationSections.length)
      setToast(`全部 ${submitted} 个分镜视频已提交`);
  };
  const composeFinalVideo = async () => {
    if (!selectedProductVideoPlanId) {
      setToast('请先生成产品视频方案');
      return;
    }
    const clips = selectedGenerationSections
      .map((generation) =>
        selectedPlanVideos.find(
          (video) =>
            video.generation_key === generation.key &&
            video.status === 'succeeded' &&
            video.is_selected === 1,
        ),
      )
      .filter((video): video is ProductVideo => Boolean(video));
    if (clips.length !== selectedGenerationSections.length) {
      setToast('请先完成并选中每一段分镜视频');
      return;
    }
    setFinalVideoComposing(true);
    try {
      const response = await fetch('/api/final-videos/compose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflowId,
          plan_id: selectedProductVideoPlanId,
          clip_ids: clips.map((clip) => clip.id),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'FFmpeg 合成失败');
      await loadFinalVideo();
      updateWorkflowProgress({ current_step: 6, status: 'completed' });
      setToast('完整 MP4 视频已通过 FFmpeg 合成并保存');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '视频合成失败');
    } finally {
      setFinalVideoComposing(false);
    }
  };
  const createCapcutDraft = async () => {
    if (!selectedProductVideoPlanId || draftCreating) return;
    const clips = selectedGenerationSections
      .map((generation) =>
        selectedPlanVideos.find(
          (video) =>
            video.generation_key === generation.key &&
            video.status === 'succeeded' &&
            video.is_selected === 1,
        ),
      )
      .filter((video): video is ProductVideo => Boolean(video));
    if (clips.length !== selectedGenerationSections.length) {
      setToast('请先完成并选中每一段分镜视频');
      return;
    }
    setDraftCreating(true);
    try {
      const response = await fetch('/api/capcut-drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflowId,
          plan_id: selectedProductVideoPlanId,
          clip_ids: clips.map((clip) => clip.id),
          prompt: draftPrompt,
        }),
      });
      const data = (await response.json()) as CapcutDraft & { error?: string };
      await loadCapcutDrafts();
      if (!response.ok || !data.draft_url)
        throw new Error(data.error ?? '剪映草稿生成失败');
      setToast('剪映草稿已生成，点击“复制草稿”获取链接');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '剪映草稿生成失败');
    } finally {
      setDraftCreating(false);
    }
  };
  const deleteFinalVideo = async () => {
    if (finalVideoDeleteId === null) return;
    try {
      const response = await fetch('/api/final-videos', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: finalVideoDeleteId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? '删除成片版本失败');
      if (finalVideoViewerId === finalVideoDeleteId)
        setFinalVideoViewerId(null);
      await loadFinalVideo();
      setFinalVideoDeleteId(null);
      setToast('成片版本已删除');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '删除成片版本失败');
    }
  };
  const deleteCapcutDraft = async () => {
    if (capcutDraftDeleteId === null) return;
    try {
      const response = await fetch('/api/capcut-drafts', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: capcutDraftDeleteId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? '删除剪映草稿失败');
      await loadCapcutDrafts();
      setCapcutDraftDeleteId(null);
      setToast('剪映草稿已删除');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '删除剪映草稿失败');
    }
  };
  const selectProductVideo = async (id: number) => {
    try {
      const response = await fetch('/api/product-videos', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'select' }),
      });
      if (!response.ok) throw new Error();
      await loadProductVideos();
    } catch {
      setToast('分镜视频版本选择失败，请稍后重试');
    }
  };
  const deleteProductVideo = async () => {
    if (productVideoDeleteId === null) return;
    try {
      const response = await fetch('/api/product-videos', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: productVideoDeleteId }),
      });
      if (!response.ok) throw new Error();
      await loadProductVideos();
      setProductVideoDeleteId(null);
      setToast('分镜视频版本已删除');
    } catch {
      setToast('删除分镜视频失败，请稍后重试');
    }
  };
  const analyzeReferenceVideo = async () => {
    if (!selectedOverviewId) {
      setToast('请先选择一个总览图版本');
      return;
    }
    setStructureAnalyzing(true);
    try {
      const response = await fetch('/api/reference-structures', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          overview_id: selectedOverviewId,
          prompt: structurePrompt,
        }),
      });
      const data = (await response.json()) as { id?: number; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? '分析失败');
      await loadStructures();
      setSelectedStructureId(data.id);
      setToast('参考视频镜头结构已生成');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '镜头结构分析失败');
    } finally {
      setStructureAnalyzing(false);
    }
  };
  const deleteStructure = async () => {
    if (structureDeleteId === null) return;
    try {
      const response = await fetch('/api/reference-structures', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: structureDeleteId }),
      });
      if (!response.ok) throw new Error();
      const next = await loadStructures();
      await loadGenerationPlans();
      if (selectedStructureId === structureDeleteId)
        setSelectedStructureId(next[0]?.id ?? null);
      setStructureDeleteId(null);
      setToast('镜头结构版本已删除');
    } catch {
      setToast('删除镜头结构版本失败，请稍后重试');
    }
  };
  const createGenerationPlan = async () => {
    if (!selectedStructureId) {
      setToast('请先选择一个镜头结构版本');
      return;
    }
    setGenerationPlanCreating(true);
    try {
      const response = await fetch('/api/generation-plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ structure_id: selectedStructureId }),
      });
      const data = (await response.json()) as { id?: number; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? '规划失败');
      await loadGenerationPlans();
      setSelectedGenerationPlanId(data.id);
      setToast('生成段规划已生成');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '生成段规划失败');
    } finally {
      setGenerationPlanCreating(false);
    }
  };
  const deleteGenerationPlan = async () => {
    if (generationPlanDeleteId === null) return;
    try {
      const response = await fetch('/api/generation-plans', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: generationPlanDeleteId }),
      });
      if (!response.ok) throw new Error();
      const next = await loadGenerationPlans();
      if (selectedGenerationPlanId === generationPlanDeleteId)
        setSelectedGenerationPlanId(next[0]?.id ?? null);
      setGenerationPlanDeleteId(null);
      setToast('生成段规划版本已删除');
    } catch {
      setToast('删除生成段规划失败，请稍后重试');
    }
  };
  const openSettings = async () => {
    setSettingsOpen(true);
    setConfigLoading(true);
    try {
      const response = await fetch('/api/model-config', { cache: 'no-store' });
      if (!response.ok) throw new Error('读取失败');
      const payload = (await response.json()) as { configs: ModelConfig[] };
      const next = { ...emptyModelConfigs };
      for (const config of payload.configs) next[config.model_type] = config;
      setModels(next);
    } catch {
      setToast('模型配置读取失败，请稍后重试');
    } finally {
      setConfigLoading(false);
    }
  };
  const updateModel = (
    type: ModelType,
    field: keyof Pick<ModelConfig, 'model_id' | 'base_url' | 'api_key'>,
    value: string,
  ) => {
    setModels((current) => ({
      ...current,
      [type]: { ...current[type], [field]: value },
    }));
  };
  const saveModels = async () => {
    setConfigSaving(true);
    try {
      const response = await fetch('/api/model-config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ configs: Object.values(models) }),
      });
      if (!response.ok) throw new Error('保存失败');
      setSettingsOpen(false);
      setToast('模型配置已写入本地 SQLite');
    } catch {
      setToast('模型配置保存失败，请检查填写内容');
    } finally {
      setConfigSaving(false);
    }
  };
  const testModelConnection = async (type: ModelType) => {
    setTestingModel(type);
    setConnectionResult((current) => ({ ...current, [type]: undefined }));
    try {
      const response = await fetch('/api/model-config/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(models[type]),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      setConnectionResult((current) => ({
        ...current,
        [type]: {
          ok: response.ok,
          message:
            payload.message ?? payload.error ?? '连接测试失败，请稍后重试。',
        },
      }));
    } catch {
      setConnectionResult((current) => ({
        ...current,
        [type]: { ok: false, message: '连接测试失败，请检查网络后重试。' },
      }));
    } finally {
      setTestingModel(null);
    }
  };
  const configSections = [
    {
      type: 'multimodal' as const,
      title: '多模态模型',
      description: '分析视频总览图、生成结构脚本与故事板',
      Icon: Bot,
      tone: 'bg-indigo-500/10 text-indigo-600',
      placeholder: '例如：gpt-5.6',
    },
    {
      type: 'image' as const,
      title: '生图模型',
      description: '生成产品参考图与故事板关键帧',
      Icon: ImagePlus,
      tone: 'bg-violet-500/10 text-violet-600',
      placeholder: 'gpt-image-2',
    },
    {
      type: 'video' as const,
      title: '视频生成模型',
      description: '根据关键帧与运动提示词生成分镜视频',
      Icon: Video,
      tone: 'bg-sky-500/10 text-sky-600',
      placeholder: '例如：seedance-2.0-mini',
    },
  ];
  const selectedProductVideoPlan = productVideoPlans.find(
    (plan) => plan.id === selectedProductVideoPlanId,
  );
  const selectedReferenceVideo = referenceVideos.find(
    (video) => video.group_id === Number(selectedReferenceId),
  );
  const selectableMaterialGroups = referenceGroups.filter((group) =>
    referenceVideos.some((video) => video.group_id === group.id),
  );
  const linkedProductGroups = selectedReferenceVideo
    ? productGroups.filter(
        (group) => group.reference_group_id === selectedReferenceVideo.group_id,
      )
    : [];
  const selectedGenerationSections = selectedProductVideoPlan
    ? parseGenerationSections(selectedProductVideoPlan.content)
    : [];
  const selectedPlanKeyframes = productKeyframes.filter(
    (keyframe) => keyframe.plan_id === selectedProductVideoPlanId,
  );
  const viewedKeyframe = productKeyframes.find(
    (keyframe) => keyframe.id === keyframeViewerId,
  );
  const openKeyframeViewer = (keyframe: ProductKeyframe) => {
    setKeyframeViewerId(keyframe.id);
    setKeyframeImageEditor({
      id: keyframe.id,
      key: keyframe.generation_key,
      value: '',
    });
  };
  const selectedPlanVideos = productVideos.filter(
    (video) => video.plan_id === selectedProductVideoPlanId,
  );
  const generatedProductGroupIds = new Set(
    workflows
      .map((workflow) => workflow.product_group_id)
      .filter((id): id is number => id !== null),
  );
  const batchMaterialItems = productGroups
    .filter(
      (group) =>
        group.reference_group_id !== null &&
        !generatedProductGroupIds.has(group.id),
    )
    .map((group) => {
      const referenceGroup = referenceGroups.find(
        (item) => item.id === group.reference_group_id,
      );
      const hasReferenceVideo = referenceVideos.some(
        (video) => video.group_id === referenceGroup?.id,
      );
      const imageCount = productImages.filter(
        (image) => image.group_id === group.id,
      ).length;
      return {
        group,
        imageCount,
        ready: Boolean(referenceGroup && hasReferenceVideo && imageCount > 0),
        referenceGroup,
      };
    });
  const readyBatchMaterialCount = batchMaterialItems.filter(
    (item) => item.ready,
  ).length;
  const readyBatchMaterialGroupIds = batchMaterialItems
    .filter((item) => item.ready)
    .map((item) => item.group.id);
  const selectedBatchMaterialGroupIdSet = new Set(
    selectedBatchMaterialGroupIds.filter((id) =>
      readyBatchMaterialGroupIds.includes(id),
    ),
  );
  const selectedBatchMaterialCount = selectedBatchMaterialGroupIdSet.size;
  const allReadyBatchMaterialsSelected =
    readyBatchMaterialCount > 0 &&
    selectedBatchMaterialCount === readyBatchMaterialCount;

  return (
    <main className="min-h-screen bg-background text-foreground">
      {toast && (
        <div className="fixed left-1/2 top-5 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-2xl">
          <Check className="size-3.5 text-emerald-400" />
          {toast}
        </div>
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[88px] border-r bg-sidebar/95 backdrop-blur-xl transition-transform lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-20 items-center justify-center border-b">
          <div
            className="relative grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-primary/25"
            aria-label="同款视频 Logo"
          >
            <Clapperboard className="size-5" strokeWidth={2.2} />
            <Sparkles className="absolute right-1.5 top-1.5 size-2.5 fill-white" />
          </div>
        </div>
        <nav
          className="flex flex-col items-center gap-2 px-3 py-5"
          aria-label="主导航"
        >
          {[
            [FolderKanban, '作品', 'project'],
            [ImageIcon, '素材', 'assets'],
            [Bot, '模型', 'models'],
          ].map(([Icon, label, section]) => {
            const NavIcon = Icon as typeof FolderKanban;
            const active = settingsOpen
              ? section === 'models'
              : activeSection === section;
            return (
              <button
                key={label as string}
                onClick={() => {
                  if (section === 'models') void openSettings();
                  else if (section === 'project') {
                    setMobileNav(false);
                    if (window.location.pathname === '/')
                      setActiveSection('project');
                    else window.location.assign('/');
                  } else setActiveSection(section as 'project' | 'assets');
                }}
                className={`group flex w-full flex-col items-center gap-1 rounded-xl py-2 text-[9px] font-medium transition ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <NavIcon className="size-[17px]" />
                {label as string}
              </button>
            );
          })}
        </nav>
      </aside>
      {mobileNav && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden"
          onClick={() => setMobileNav(false)}
          aria-label="关闭导航"
        />
      )}

      <div className="lg:pl-[88px]">
        <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-4 border-b bg-background/90 px-4 backdrop-blur-xl md:px-7">
          <div className="flex items-center gap-3">
            <button
              className="grid size-9 place-items-center rounded-xl border lg:hidden"
              onClick={() => setMobileNav(true)}
              aria-label="打开导航"
            >
              <Menu className="size-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight">
                  同款<span className="text-primary">视频</span>
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                  AI STUDIO
                </span>
              </div>
              <p className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">
                参考视频结构，生成你的产品视频
              </p>
            </div>
          </div>
          {activeSection === 'project' && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setBatchProgress([]);
                  setBatchGenerationOpen(true);
                }}
              >
                <Sparkles />
                批量生成
              </Button>
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => setWorkflowCreateOpen(true)}
              >
                <Plus />
                新建作品
              </Button>
            </div>
          )}
        </header>

        <div className="mx-auto max-w-[1520px] px-4 pb-28 pt-6 md:px-7">
          {activeSection === 'assets' ? (
            <AssetLibrary onToast={setToast} />
          ) : (
            <>
              <Card
                className={
                  workflowDetailOpen
                    ? 'mb-4 border-0 py-0 ring-1 ring-border/80'
                    : 'overflow-visible rounded-none border-0 bg-transparent py-0 shadow-none ring-0'
                }
              >
                {workflowDetailOpen && (
                  <CardHeader className="pt-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 rounded-lg px-2 text-base"
                            onClick={() => window.location.assign('/')}
                            aria-label="返回作品列表"
                            title="返回作品列表"
                          >
                            ←
                          </Button>
                          <h1 className="text-base font-bold">
                            {workflows.find((item) => item.id === workflowId)
                              ?.name ?? '作品详情'}
                          </h1>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                )}
                <CardContent className={workflowDetailOpen ? 'pb-4' : 'p-0'}>
                  {!workflowDetailOpen && (
                    <div className="space-y-2">
                      {workflows.map((workflow) => {
                        const done = workflow.video_count;
                        const total =
                          finalVideo && finalVideo.workflow_id === workflow.id
                            ? 6
                            : workflow.video_count > 0
                              ? 5
                              : workflow.keyframe_count > 0
                                ? 4
                                : workflow.plan_count > 0
                                  ? 3
                                  : workflow.product_overview_count > 0
                                    ? 2
                                    : workflow.reference_overview_count > 0
                                      ? 1
                                      : 0;
                        return (
                          <div
                            key={workflow.id}
                            className={`flex items-center gap-3 rounded-2xl border p-3 transition ${workflow.id === workflowId ? 'border-primary/50 bg-primary/5' : 'bg-card hover:border-primary/30'}`}
                          >
                            <button
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              onClick={() => selectWorkflow(workflow.id)}
                            >
                              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                <Clapperboard className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="truncate text-xs font-bold">
                                    {workflow.name}
                                  </span>
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${workflow.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}
                                  >
                                    {workflow.status === 'completed'
                                      ? '已完成'
                                      : '草稿'}
                                  </span>
                                </span>
                                <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                                  第 {workflow.current_step} 步 · {done}{' '}
                                  段视频已完成 · 更新于 {workflow.updated_at}
                                </span>
                              </span>
                              <span className="hidden shrink-0 text-right sm:block">
                                <span className="block text-xs font-bold text-primary">
                                  {total}/6
                                </span>
                                <span className="text-[9px] text-muted-foreground">
                                  进度
                                </span>
                              </span>
                            </button>
                            <button
                              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={() => {
                                setWorkflowName(workflow.name);
                                setWorkflowRenameId(workflow.id);
                              }}
                              aria-label="重命名作品"
                              title="重命名"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                              onClick={() => setWorkflowDeleteId(workflow.id)}
                              aria-label="删除作品"
                              title="删除"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        );
                      })}
                      {workflows.length === 0 && (
                        <p className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                          还没有作品，点击“新建作品”开始制作。
                        </p>
                      )}
                    </div>
                  )}
                  {workflowDetailOpen && (
                    <>
                      <div className="grid gap-2 md:grid-cols-6">
                        {[
                          ['1', '抽帧合成参考视频预览图'],
                          ['2', '合成产品预览图'],
                          ['3', '生成我的产品视频方案'],
                          ['4', '生成产品分镜关键帧'],
                          ['5', '生成分镜视频'],
                          ['6', '合成视频'],
                        ].map(([id, title], index) => (
                          <button
                            key={id}
                            onClick={() => openWorkflow(id as string)}
                            className={`group relative min-w-0 rounded-2xl border p-3 text-left transition ${activeWorkflow === id ? 'border-primary/50 bg-primary/5 shadow-sm' : 'bg-card hover:border-primary/30 hover:bg-muted/40'}`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${activeWorkflow === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                              >
                                {index + 1}
                              </span>
                              <span className="min-w-0 truncate text-[11px] font-bold">
                                {title}
                              </span>
                            </div>
                            {index < 5 && (
                              <ArrowRight className="absolute -right-3 top-6 z-10 hidden size-4 text-border md:block" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              <div
                className={`${workflowDetailOpen ? '' : 'hidden'} grid gap-4 xl:grid-cols-12`}
              >
                <Card
                  id="step-1"
                  className={`border-0 py-0 ring-1 ring-border/80 xl:col-span-12 ${activeWorkflow !== '1' ? 'hidden' : ''}`}
                >
                  <CardHeader className="pt-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <StepHead
                        number={1}
                        title="抽帧合成参考视频预览图"
                        meta={`${overviews.length} 个版本`}
                      />
                      <div className="flex min-w-0 items-center gap-2 lg:flex-1">
                        <select
                          value={selectedReferenceId}
                          disabled={Boolean(overviewUrl)}
                          onChange={(event) => {
                            const groupId = event.target.value;
                            const selected = referenceVideos.find(
                              (video) => video.group_id === Number(groupId),
                            );
                            const productGroup = productGroups.find(
                              (group) =>
                                group.reference_group_id === selected?.group_id,
                            );
                            setSelectedReferenceId(groupId);
                            setSelectedProductGroupId(
                              productGroup ? String(productGroup.id) : '',
                            );
                            setReferenceVideoUrl(
                              selected
                                ? `/api/assets/items/${selected.id}/file`
                                : '',
                            );
                            setSelectedOverviewId(null);
                            setOverviewUrl('');
                          }}
                          className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">选择同款素材组</option>
                          {selectableMaterialGroups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          disabled={!referenceVideoUrl || overviewGenerating}
                          className="shrink-0 whitespace-nowrap rounded-xl"
                          onClick={() => void createReferenceOverview()}
                        >
                          {overviewGenerating && (
                            <RefreshCw className="animate-spin" />
                          )}
                          {overviewGenerating
                            ? '正在抽帧并保存…'
                            : overviewUrl
                              ? '再生成一个版本'
                              : '抽帧并合成总览图'}
                        </Button>
                      </div>
                      {referenceVideos.length === 0 && (
                        <p className="text-[10px] text-amber-600 lg:hidden">
                          请先到「素材 → 同款素材组」上传参考视频。
                        </p>
                      )}
                    </div>
                  </CardHeader>
                  {overviewUrl && (
                    <div className="px-6 pb-4">
                      <button
                        onClick={() => setOverviewViewerOpen(true)}
                        className="block aspect-[4/3] w-full overflow-hidden rounded-2xl border bg-muted/40 p-2 shadow-sm transition hover:border-primary/40 hover:shadow-md lg:w-1/4"
                        aria-label="查看参考视频预览图"
                      >
                        <img
                          src={overviewUrl}
                          alt="参考视频预览图"
                          className="h-full w-full object-cover object-top"
                        />
                      </button>
                    </div>
                  )}
                  <CardContent className="hidden">
                    <div
                      className={`overflow-hidden rounded-2xl border ${overviewUrl ? 'bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-6' : 'hidden'}`}
                    >
                      {overviewUrl ? (
                        <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row">
                          <button
                            className="flex min-h-[380px] flex-1 items-center justify-center rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
                            onClick={() => setOverviewViewerOpen(true)}
                            aria-label="放大查看总览图"
                          >
                            <img
                              src={overviewUrl}
                              alt="参考视频总览图"
                              className="max-h-[560px] max-w-full w-auto rounded-lg border bg-white shadow-md"
                            />
                          </button>
                          <aside className="flex shrink-0 flex-col justify-between rounded-2xl border bg-white p-5 lg:w-60">
                            <div>
                              <span className="inline-flex rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                                REFERENCE OVERVIEW
                              </span>
                              <h3 className="mt-4 text-sm font-bold">
                                当前版本
                              </h3>
                              <p className="mt-1 text-xs text-muted-foreground">
                                版本 #{selectedOverviewId}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-4 w-full rounded-xl"
                                onClick={() => setOverviewViewerOpen(true)}
                              >
                                查看大图
                              </Button>
                              <div className="mt-5 space-y-3 border-t pt-4 text-[11px]">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    采样帧数
                                  </span>
                                  <b>27 帧</b>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    输出格式
                                  </span>
                                  <b>JPEG</b>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    排序方式
                                  </span>
                                  <b>时间顺序</b>
                                </div>
                              </div>
                            </div>
                            <p className="mt-6 text-[10px] leading-4 text-muted-foreground">
                              用于后续视觉模型判断镜头结构与切换位置。
                            </p>
                          </aside>
                        </div>
                      ) : (
                        <div className="w-full max-w-sm">
                          <Video className="mx-auto size-7 text-primary" />
                          <p className="mt-2 text-xs font-semibold">
                            27 帧 · 时间顺序采样
                          </p>
                          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                            抽帧仅在内存中处理，完成后保存为新版本。
                          </p>
                          <select
                            value={selectedReferenceId}
                            onChange={(event) => {
                              const groupId = event.target.value;
                              const selected = referenceVideos.find(
                                (video) => video.group_id === Number(groupId),
                              );
                              const productGroup = productGroups.find(
                                (group) =>
                                  group.reference_group_id ===
                                  selected?.group_id,
                              );
                              setSelectedReferenceId(groupId);
                              setSelectedProductGroupId(
                                productGroup ? String(productGroup.id) : '',
                              );
                              setReferenceVideoUrl(
                                selected
                                  ? `/api/assets/items/${selected.id}/file`
                                  : '',
                              );
                              setSelectedOverviewId(null);
                              setOverviewUrl('');
                            }}
                            className="mt-4 h-10 w-full rounded-xl border bg-background px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">选择同款素材组</option>
                            {selectableMaterialGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                          {referenceVideos.length === 0 && (
                            <p className="mt-2 text-[10px] text-amber-600">
                              请先到「素材 → 同款素材组」上传参考视频。
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      {overviewUrl && (
                        <Button
                          variant="outline"
                          className="flex-1 rounded-xl"
                          onClick={() => {
                            setSelectedOverviewId(null);
                            setOverviewUrl('');
                          }}
                        >
                          <Plus />
                          生成新版本
                        </Button>
                      )}
                      <Button
                        disabled={!referenceVideoUrl || overviewGenerating}
                        className="hidden"
                        onClick={() => void createReferenceOverview()}
                      >
                        {overviewGenerating && (
                          <RefreshCw className="animate-spin" />
                        )}
                        {overviewGenerating
                          ? '正在抽帧并保存…'
                          : overviewUrl
                            ? '再生成一个版本'
                            : '抽帧并合成总览图'}
                      </Button>
                      {overviewUrl && (
                        <Button
                          variant="outline"
                          className="flex-1 rounded-xl"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = overviewUrl;
                            link.download = 'reference-overview.jpg';
                            link.click();
                          }}
                        >
                          <Download />
                          下载当前版本
                        </Button>
                      )}
                    </div>
                    {overviews.length > 0 && (
                      <div className="mt-5 border-t pt-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-bold">总览图版本</p>
                          <span className="text-[10px] text-muted-foreground">
                            点击缩略图打开查看
                          </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {overviews.map((overview) => (
                            <article
                              key={overview.id}
                              className={`overflow-hidden rounded-xl border bg-card ${selectedOverviewId === overview.id ? 'ring-2 ring-primary/40' : ''}`}
                            >
                              <button
                                className="block w-full bg-slate-50 p-2"
                                onClick={() => {
                                  setSelectedOverviewId(overview.id);
                                  setOverviewUrl(
                                    `/api/reference-overviews/${overview.id}/file`,
                                  );
                                  setOverviewViewerOpen(true);
                                }}
                              >
                                <img
                                  src={`/api/reference-overviews/${overview.id}/file`}
                                  alt={overview.name}
                                  className="aspect-video w-full rounded-md object-contain"
                                />
                              </button>
                              <div className="flex items-center gap-2 p-2.5">
                                <p className="min-w-0 flex-1 truncate text-[10px] font-semibold">
                                  {overview.name}
                                </p>
                                <button
                                  className="text-muted-foreground hover:text-rose-600"
                                  onClick={() =>
                                    setOverviewDeleteId(overview.id)
                                  }
                                  aria-label="删除总览图版本"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card
                  id="step-2"
                  className={`border-0 py-0 ring-1 ring-border/80 xl:col-span-12 ${activeWorkflow !== '2' ? 'hidden' : ''}`}
                >
                  <CardHeader className="pt-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <StepHead
                        number={2}
                        title="合成产品预览图"
                        meta={`${productOverviews.length} 个版本`}
                      />
                      <div className="flex min-w-0 items-center gap-2 lg:flex-1">
                        <select
                          value={selectedReferenceId}
                          disabled
                          className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">请先选择参考视频</option>
                          {selectableMaterialGroups
                            .filter(
                              (group) =>
                                group.id === Number(selectedReferenceId),
                            )
                            .map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                        </select>
                        <Button
                          disabled={
                            !selectedProductGroupId || productOverviewGenerating
                          }
                          className="shrink-0 whitespace-nowrap rounded-xl"
                          onClick={() => void createProductOverview()}
                        >
                          {productOverviewGenerating && (
                            <RefreshCw className="animate-spin" />
                          )}
                          {productOverviewGenerating
                            ? '正在合成并保存…'
                            : productOverviewUrl
                              ? '再生成一个版本'
                              : '合成产品预览图'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {productOverviewUrl && (
                    <div className="px-6 pb-4">
                      <button
                        onClick={() => setProductOverviewViewerOpen(true)}
                        className="block aspect-[4/3] w-full overflow-hidden rounded-2xl border bg-muted/40 p-2 shadow-sm transition hover:border-primary/40 hover:shadow-md lg:w-1/4"
                        aria-label="查看产品预览图"
                      >
                        <img
                          src={productOverviewUrl}
                          alt="产品预览图"
                          className="h-full w-full object-cover object-top"
                        />
                      </button>
                    </div>
                  )}
                  <CardContent className="hidden">
                    <div
                      className={`overflow-hidden rounded-2xl border ${productOverviewUrl ? 'bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-6' : 'grid min-h-[360px] place-items-center border-dashed bg-muted/50 p-4 text-center'}`}
                    >
                      {productOverviewUrl ? (
                        <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row">
                          <button
                            className="flex min-h-[320px] min-w-0 flex-1 items-center justify-center rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
                            onClick={() => setProductOverviewViewerOpen(true)}
                            aria-label="放大查看产品预览图"
                          >
                            <img
                              src={productOverviewUrl}
                              alt="产品预览图"
                              className="max-h-[560px] w-auto max-w-full rounded-lg border bg-white shadow-md"
                            />
                          </button>
                          <aside className="flex shrink-0 flex-col justify-between rounded-2xl border bg-white p-5 lg:w-60">
                            <div>
                              <span className="inline-flex rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                                PRODUCT OVERVIEW
                              </span>
                              <h3 className="mt-4 text-sm font-bold">
                                当前版本
                              </h3>
                              <p className="mt-1 text-xs text-muted-foreground">
                                版本 #{selectedProductOverviewId}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-4 w-full rounded-xl"
                                onClick={() =>
                                  setProductOverviewViewerOpen(true)
                                }
                              >
                                查看大图
                              </Button>
                              <div className="mt-5 space-y-3 border-t pt-4 text-[11px]">
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">
                                    产品分组
                                  </span>
                                  <b className="truncate">
                                    {productGroups.find(
                                      (group) =>
                                        group.id ===
                                        productOverviews.find(
                                          (overview) =>
                                            overview.id ===
                                            selectedProductOverviewId,
                                        )?.group_id,
                                    )?.name ?? '已删除分组'}
                                  </b>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    输出格式
                                  </span>
                                  <b>JPEG</b>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    图片处理
                                  </span>
                                  <b>完整显示</b>
                                </div>
                              </div>
                            </div>
                          </aside>
                        </div>
                      ) : (
                        <div className="w-full max-w-md">
                          <ImageIcon className="mx-auto size-7 text-primary" />
                          <p className="mt-2 text-xs font-semibold">
                            合成产品参考总览
                          </p>
                          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                            自动使用所选分组中的全部图片，不裁剪、不拉伸。
                          </p>
                          <select
                            value={selectedProductGroupId}
                            onChange={(event) =>
                              setSelectedProductGroupId(event.target.value)
                            }
                            disabled={!selectedReferenceId}
                            className="mt-4 h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">
                              {selectedReferenceId
                                ? '选择该参考视频对应的产品图片组'
                                : '请先选择参考视频'}
                            </option>
                            {linkedProductGroups.map((group) => {
                              const count = productImages.filter(
                                (item) => item.group_id === group.id,
                              ).length;
                              return (
                                <option key={group.id} value={group.id}>
                                  {group.name} · {count} 张图片
                                </option>
                              );
                            })}
                          </select>
                          {selectedProductGroupId && (
                            <div className="mt-3 grid grid-cols-5 gap-2">
                              {productImages
                                .filter(
                                  (item) =>
                                    item.group_id ===
                                    Number(selectedProductGroupId),
                                )
                                .slice(0, 5)
                                .map((item) => (
                                  <img
                                    key={item.id}
                                    src={`/api/assets/items/${item.id}/file`}
                                    alt={item.name}
                                    className="aspect-square w-full rounded-lg border bg-white object-contain p-1"
                                  />
                                ))}
                            </div>
                          )}
                          {selectedReferenceId &&
                            linkedProductGroups.length === 0 && (
                              <p className="mt-2 text-[10px] text-amber-600">
                                此参考视频还没有对应的产品图片，请到「素材 →
                                同款素材组」添加。
                              </p>
                            )}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      {productOverviewUrl && (
                        <Button
                          variant="outline"
                          className="flex-1 rounded-xl"
                          onClick={() => {
                            setSelectedProductOverviewId(null);
                            setProductOverviewUrl('');
                          }}
                        >
                          <Plus />
                          生成新版本
                        </Button>
                      )}
                      <Button
                        disabled={
                          !selectedProductGroupId || productOverviewGenerating
                        }
                        className="flex-1 rounded-xl"
                        onClick={() => void createProductOverview()}
                      >
                        {productOverviewGenerating && (
                          <RefreshCw className="animate-spin" />
                        )}
                        {productOverviewGenerating
                          ? '正在合成并保存…'
                          : productOverviewUrl
                            ? '再生成一个版本'
                            : '合成产品预览图'}
                      </Button>
                      {productOverviewUrl && (
                        <Button
                          variant="outline"
                          className="flex-1 rounded-xl"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = productOverviewUrl;
                            link.download = 'product-overview.jpg';
                            link.click();
                          }}
                        >
                          <Download />
                          下载当前版本
                        </Button>
                      )}
                    </div>
                    {productOverviews.length > 0 && (
                      <div className="mt-5 border-t pt-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-bold">产品预览图版本</p>
                          <span className="text-[10px] text-muted-foreground">
                            点击缩略图打开查看
                          </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {productOverviews.map((overview) => (
                            <article
                              key={overview.id}
                              className={`overflow-hidden rounded-xl border bg-card ${selectedProductOverviewId === overview.id ? 'ring-2 ring-primary/40' : ''}`}
                            >
                              <button
                                className="block w-full bg-slate-50 p-2"
                                onClick={() => {
                                  setSelectedProductOverviewId(overview.id);
                                  setSelectedProductGroupId(
                                    String(overview.group_id),
                                  );
                                  setProductOverviewUrl(
                                    `/api/product-overviews/${overview.id}/file`,
                                  );
                                  setProductOverviewViewerOpen(true);
                                }}
                              >
                                <img
                                  src={`/api/product-overviews/${overview.id}/file`}
                                  alt={overview.name}
                                  className="aspect-video w-full rounded-md object-contain"
                                />
                              </button>
                              <div className="flex items-center gap-2 p-2.5">
                                <p className="min-w-0 flex-1 truncate text-[10px] font-semibold">
                                  {overview.name}
                                </p>
                                <button
                                  className="text-muted-foreground hover:text-rose-600"
                                  onClick={() =>
                                    setProductOverviewDeleteId(overview.id)
                                  }
                                  aria-label="删除产品预览图版本"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card
                  id="step-3"
                  className={`border-0 py-0 ring-1 ring-border/80 xl:col-span-12 ${activeWorkflow !== '3' ? 'hidden' : ''}`}
                >
                  <CardHeader className="pt-4 pb-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <StepHead
                        number={3}
                        title="生成我的产品视频方案"
                        meta={`${productVideoPlans.length} 个版本`}
                      />
                      <div className="flex min-w-0 items-center gap-2 lg:flex-1">
                        <input
                          value={productBrief}
                          onChange={(event) =>
                            setProductBrief(event.target.value)
                          }
                          maxLength={2000}
                          placeholder="产品补充信息（可选）"
                          className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-xs outline-none placeholder:text-muted-foreground/55 focus:ring-2 focus:ring-primary/20"
                        />
                        <Button
                          variant="outline"
                          className="shrink-0 whitespace-nowrap rounded-xl"
                          onClick={() => setStructurePromptOpen(true)}
                        >
                          <Pencil />
                          提示词
                        </Button>
                        <Button
                          disabled={
                            !selectedOverviewId ||
                            !selectedProductOverviewId ||
                            productVideoPlanCreating
                          }
                          className="shrink-0 whitespace-nowrap rounded-xl"
                          onClick={() => void createProductVideoPlan()}
                        >
                          {productVideoPlanCreating && (
                            <RefreshCw className="animate-spin" />
                          )}
                          {productVideoPlanCreating ? '生成中…' : '生成方案'}
                        </Button>
                        {selectedProductVideoPlan && (
                          <Button
                            variant="outline"
                            className="shrink-0 whitespace-nowrap rounded-xl"
                            onClick={() => setProductVideoPlanViewerOpen(true)}
                          >
                            查看方案
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {(overviewUrl || productOverviewUrl) && (
                    <div className="flex gap-3 px-6 pb-4">
                      {overviewUrl && (
                        <button
                          onClick={() => setOverviewViewerOpen(true)}
                          className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted/40 p-1.5 transition hover:border-primary/40 lg:w-1/6"
                          aria-label="查看参考预览图"
                        >
                          <img
                            src={overviewUrl}
                            alt="参考预览图"
                            className="h-full w-full object-cover object-top"
                          />
                          <span className="absolute left-2 top-2 rounded-md bg-slate-950/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                            参考预览图
                          </span>
                        </button>
                      )}
                      {productOverviewUrl && (
                        <button
                          onClick={() => setProductOverviewViewerOpen(true)}
                          className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted/40 p-1.5 transition hover:border-primary/40 lg:w-1/6"
                          aria-label="查看产品预览图"
                        >
                          <img
                            src={productOverviewUrl}
                            alt="产品预览图"
                            className="h-full w-full object-cover object-top"
                          />
                          <span className="absolute left-2 top-2 rounded-md bg-slate-950/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                            产品预览图
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                  {selectedProductVideoPlan && (
                    <div className="hidden px-6 pb-4">
                      <div className="rounded-2xl border bg-background p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-bold">生成方案</p>
                          <select
                            value={selectedProductVideoPlanId ?? ''}
                            onChange={(event) => {
                              const plan = productVideoPlans.find(
                                (item) =>
                                  item.id === Number(event.target.value),
                              );
                              if (!plan) return;
                              setSelectedProductVideoPlanId(plan.id);
                              setSelectedOverviewId(plan.reference_overview_id);
                              setOverviewUrl(
                                `/api/reference-overviews/${plan.reference_overview_id}/file`,
                              );
                              setSelectedProductOverviewId(
                                plan.product_overview_id,
                              );
                              setProductOverviewUrl(
                                `/api/product-overviews/${plan.product_overview_id}/file`,
                              );
                              setProductBrief(plan.product_brief);
                            }}
                            className="h-8 max-w-48 rounded-lg border bg-card px-2 text-[10px] font-medium outline-none"
                            aria-label="选择方案版本"
                          >
                            {productVideoPlans.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                方案 #{plan.id}
                              </option>
                            ))}
                          </select>
                        </div>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-sans text-xs leading-6 text-foreground">
                          {selectedProductVideoPlan.content}
                        </pre>
                      </div>
                    </div>
                  )}
                  <CardContent className="hidden">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="min-h-[480px] min-w-0 rounded-2xl border bg-slate-50/60 p-5">
                        {productVideoPlans.find(
                          (plan) => plan.id === selectedProductVideoPlanId,
                        ) ? (
                          <pre className="whitespace-pre-wrap font-sans text-xs leading-6 text-foreground">
                            {
                              productVideoPlans.find(
                                (plan) =>
                                  plan.id === selectedProductVideoPlanId,
                              )?.content
                            }
                          </pre>
                        ) : (
                          <div className="grid h-full place-items-center text-center">
                            <div>
                              <Sparkles className="mx-auto size-7 text-primary" />
                              <p className="mt-3 text-sm font-semibold">
                                尚未生成产品视频方案
                              </p>
                              <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                                选择参考视频预览图和产品预览图，一次完成参考拍法分析、产品替换、生成段规划与完整配音。
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <aside className="min-w-0 rounded-2xl border bg-card p-4">
                        <p className="text-xs font-bold">方案输入</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                          参考图提供拍法，产品图提供自己的产品主体。
                        </p>
                        <label className="mt-4 grid min-w-0 gap-1.5 text-[10px] font-bold text-muted-foreground">
                          参考视频预览图
                          <select
                            value={selectedOverviewId ?? ''}
                            onChange={(event) => {
                              const id = Number(event.target.value);
                              setSelectedOverviewId(id || null);
                              setOverviewUrl(
                                id ? `/api/reference-overviews/${id}/file` : '',
                              );
                            }}
                            className="h-10 w-full min-w-0 max-w-full truncate rounded-xl border bg-background px-3 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">选择参考视频预览图</option>
                            {overviews.map((overview) => (
                              <option key={overview.id} value={overview.id}>
                                {overview.name} · #{overview.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="mt-3 grid min-w-0 gap-1.5 text-[10px] font-bold text-muted-foreground">
                          产品预览图
                          <select
                            value={selectedProductOverviewId ?? ''}
                            onChange={(event) => {
                              const id = Number(event.target.value);
                              setSelectedProductOverviewId(id || null);
                              setProductOverviewUrl(
                                id ? `/api/product-overviews/${id}/file` : '',
                              );
                            }}
                            className="h-10 w-full min-w-0 max-w-full truncate rounded-xl border bg-background px-3 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">选择产品预览图</option>
                            {productOverviews.map((overview) => (
                              <option key={overview.id} value={overview.id}>
                                {overview.name} · #{overview.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="mt-3 grid gap-1.5 text-[10px] font-bold text-muted-foreground">
                          产品补充信息
                          <textarea
                            value={productBrief}
                            onChange={(event) =>
                              setProductBrief(event.target.value)
                            }
                            rows={4}
                            maxLength={2000}
                            placeholder="产品名称、核心卖点、目标人群、禁止出现的描述（可选）"
                            className="w-full resize-y rounded-xl border bg-background px-3 py-2 text-xs font-normal leading-5 text-foreground outline-none placeholder:text-muted-foreground/55 focus:ring-2 focus:ring-primary/20"
                          />
                        </label>
                        <Button
                          variant="outline"
                          className="mt-3 w-full rounded-xl"
                          onClick={() => setStructurePromptOpen(true)}
                        >
                          <Pencil />
                          提示词
                        </Button>
                        <Button
                          disabled={
                            !selectedOverviewId ||
                            !selectedProductOverviewId ||
                            productVideoPlanCreating
                          }
                          className="mt-2 w-full rounded-xl"
                          onClick={() => void createProductVideoPlan()}
                        >
                          {productVideoPlanCreating && (
                            <RefreshCw className="animate-spin" />
                          )}
                          {productVideoPlanCreating
                            ? '正在生成方案…'
                            : '生成我的产品视频方案'}
                        </Button>
                        {productVideoPlans.find(
                          (plan) => plan.id === selectedProductVideoPlanId,
                        ) && (
                          <Button
                            variant="outline"
                            className="mt-2 w-full rounded-xl"
                            onClick={() => {
                              const content =
                                productVideoPlans.find(
                                  (plan) =>
                                    plan.id === selectedProductVideoPlanId,
                                )?.content ?? '';
                              const url = URL.createObjectURL(
                                new Blob([content], {
                                  type: 'text/markdown;charset=utf-8',
                                }),
                              );
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = 'product-video-plan.md';
                              link.click();
                              URL.revokeObjectURL(url);
                            }}
                          >
                            <Download />
                            下载方案
                          </Button>
                        )}
                        <div className="mt-5 border-t pt-4">
                          <p className="mb-2 text-[10px] font-bold text-muted-foreground">
                            方案版本
                          </p>
                          <div className="max-h-48 space-y-2 overflow-auto pr-1">
                            {productVideoPlans.map((plan) => (
                              <div
                                key={plan.id}
                                className={`flex items-center gap-2 rounded-xl border p-2 ${selectedProductVideoPlanId === plan.id ? 'border-primary/40 bg-primary/5' : ''}`}
                              >
                                <button
                                  className="min-w-0 flex-1 text-left"
                                  onClick={() => {
                                    setSelectedProductVideoPlanId(plan.id);
                                    setSelectedOverviewId(
                                      plan.reference_overview_id,
                                    );
                                    setSelectedProductOverviewId(
                                      plan.product_overview_id,
                                    );
                                    setProductBrief(plan.product_brief);
                                  }}
                                >
                                  <p className="truncate text-[10px] font-semibold">
                                    {plan.name} · #{plan.id}
                                  </p>
                                  <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                                    参考 #{plan.reference_overview_id} · 产品 #
                                    {plan.product_overview_id}
                                  </p>
                                </button>
                                <button
                                  onClick={() =>
                                    setProductVideoPlanDeleteId(plan.id)
                                  }
                                  className="text-muted-foreground hover:text-rose-600"
                                  aria-label="删除产品视频方案版本"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            ))}
                            {productVideoPlans.length === 0 && (
                              <p className="py-2 text-[10px] text-muted-foreground">
                                暂无版本
                              </p>
                            )}
                          </div>
                        </div>
                      </aside>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  id="step-4"
                  className={`border-0 py-0 ring-1 ring-border/80 xl:col-span-12 ${activeWorkflow !== '4' ? 'hidden' : ''}`}
                >
                  <CardHeader className="py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <StepHead number={4} title="生成产品分镜关键帧" />
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <select
                          value={selectedProductVideoPlanId ?? ''}
                          disabled
                          className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-xs font-medium text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-80"
                        >
                          <option value="">选择产品视频方案</option>
                          {productVideoPlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} · #{plan.id}
                            </option>
                          ))}
                        </select>
                        <div className="shrink-0 rounded-xl border bg-background px-3 py-2 text-center">
                          <p className="text-[9px] text-muted-foreground">
                            生成段
                          </p>
                          <p className="text-xs font-bold">
                            {selectedGenerationSections.length}
                          </p>
                        </div>
                        <Button
                          disabled={
                            !selectedProductVideoPlanId ||
                            selectedGenerationSections.length === 0 ||
                            keyframeGeneratingKeys.length > 0
                          }
                          className="shrink-0 whitespace-nowrap rounded-xl"
                          onClick={() => void createAllProductKeyframes()}
                        >
                          {keyframeGeneratingKeys.length > 0 ? (
                            <RefreshCw className="animate-spin" />
                          ) : (
                            <ImagePlus />
                          )}
                          {keyframeGeneratingKeys.length > 0
                            ? `正在生成 ${keyframeGeneratingKeys[0]}…`
                            : '生成全部关键帧'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-5">
                    <div className="hidden">
                      <div className="min-w-0 flex-1">
                        <select
                          value={selectedProductVideoPlanId ?? ''}
                          disabled
                          className="h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-xs font-medium text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-80"
                        >
                          <option value="">选择产品视频方案</option>
                          {productVideoPlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} · #{plan.id}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <div className="rounded-xl border bg-background px-3 py-2 text-center">
                          <p className="text-[9px] text-muted-foreground">
                            生成段
                          </p>
                          <p className="text-xs font-bold">
                            {selectedGenerationSections.length}
                          </p>
                        </div>
                        <Button
                          disabled={
                            !selectedProductVideoPlanId ||
                            selectedGenerationSections.length === 0 ||
                            keyframeGeneratingKeys.length > 0
                          }
                          className="rounded-xl"
                          onClick={() => void createAllProductKeyframes()}
                        >
                          {keyframeGeneratingKeys.length > 0 ? (
                            <RefreshCw className="animate-spin" />
                          ) : (
                            <ImagePlus />
                          )}
                          {keyframeGeneratingKeys.length > 0
                            ? `正在生成 ${keyframeGeneratingKeys[0]}…`
                            : '生成全部关键帧'}
                        </Button>
                      </div>
                    </div>

                    {selectedGenerationSections.length > 0 ? (
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                        {selectedGenerationSections.map((generation) => {
                          const versions = selectedPlanKeyframes.filter(
                            (keyframe) =>
                              keyframe.generation_key === generation.key,
                          );
                          const selected =
                            versions.find(
                              (keyframe) => keyframe.is_selected === 1,
                            ) ?? versions[0];
                          const generating = keyframeGeneratingKeys.includes(
                            generation.key,
                          );
                          const prompt =
                            selected?.prompt ??
                            buildKeyframePrompt(generation.section);
                          return (
                            <article
                              key={generation.key}
                              className="overflow-hidden rounded-2xl border bg-card"
                            >
                              <button
                                disabled={!selected}
                                onClick={() =>
                                  selected && openKeyframeViewer(selected)
                                }
                                className="relative grid h-52 w-full place-items-center overflow-hidden bg-slate-100"
                              >
                                {selected ? (
                                  <img
                                    src={`/api/product-keyframes/${selected.id}/file`}
                                    alt={`${generation.key} 产品关键帧`}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <div className="px-6 text-center">
                                    {generating ? (
                                      <RefreshCw className="mx-auto size-7 animate-spin text-primary" />
                                    ) : (
                                      <ImageIcon className="mx-auto size-7 text-primary" />
                                    )}
                                    <p className="mt-3 text-xs font-semibold">
                                      {generating
                                        ? '正在生成关键帧…'
                                        : '等待生成关键帧'}
                                    </p>
                                    <p className="mt-1 text-[10px] text-muted-foreground">
                                      产品外观以产品预览图为准
                                    </p>
                                  </div>
                                )}
                                <span className="absolute left-3 top-3 rounded-full bg-slate-950/75 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                                  {generation.key}
                                </span>
                                <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-800 backdrop-blur">
                                  {generation.duration}
                                </span>
                              </button>
                              <div className="p-2">
                                {versions.length > 0 && (
                                  <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
                                    {versions.map((version) => (
                                      <div
                                        key={version.id}
                                        className={`relative shrink-0 overflow-hidden rounded-lg border ${version.is_selected === 1 ? 'ring-2 ring-primary/50' : ''}`}
                                      >
                                        <button
                                          onClick={() =>
                                            void selectProductKeyframe(
                                              version.id,
                                            )
                                          }
                                        >
                                          <img
                                            src={`/api/product-keyframes/${version.id}/file`}
                                            alt={`版本 ${version.id}`}
                                            className="size-11 bg-slate-50 object-cover"
                                          />
                                        </button>
                                        <button
                                          onClick={() =>
                                            setKeyframeDeleteId(version.id)
                                          }
                                          className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-md bg-slate-950/70 text-white"
                                          aria-label="删除关键帧版本"
                                        >
                                          <X className="size-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 rounded-xl"
                                    onClick={() =>
                                      setKeyframePromptEditor({
                                        key: generation.key,
                                        value: prompt,
                                      })
                                    }
                                  >
                                    <Pencil />
                                    提示词
                                  </Button>
                                  <Button
                                    size="sm"
                                    disabled={generating}
                                    className="flex-1 rounded-xl"
                                    onClick={() =>
                                      void createProductKeyframe(
                                        generation.key,
                                        prompt,
                                      )
                                    }
                                  >
                                    {generating && (
                                      <RefreshCw className="animate-spin" />
                                    )}
                                    {selected ? '再生成' : '生成'}
                                  </Button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 grid min-h-72 place-items-center rounded-2xl border border-dashed bg-muted/40 p-6 text-center">
                        <div>
                          <ImagePlus className="mx-auto size-7 text-primary" />
                          <p className="mt-3 text-sm font-semibold">
                            选择产品视频方案
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            方案中的每个 Generation 会生成一张独立关键帧。
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card
                  id="step-5"
                  className={`border-0 py-0 ring-1 ring-border/80 xl:col-span-12 ${activeWorkflow !== '5' ? 'hidden' : ''}`}
                >
                  <CardHeader className="py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <StepHead number={5} title="生成分镜视频" />
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <select
                          value={selectedProductVideoPlanId ?? ''}
                          disabled
                          className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-xs font-medium text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-80"
                        >
                          <option value="">选择产品视频方案</option>
                          {productVideoPlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} · #{plan.id}
                            </option>
                          ))}
                        </select>
                        <Button
                          disabled={
                            !selectedProductVideoPlanId ||
                            selectedGenerationSections.length === 0 ||
                            videoSubmittingKeys.length > 0 ||
                            !selectedGenerationSections.every((generation) =>
                              selectedPlanKeyframes.some(
                                (keyframe) =>
                                  keyframe.generation_key === generation.key &&
                                  keyframe.is_selected === 1,
                              ),
                            )
                          }
                          className="shrink-0 whitespace-nowrap rounded-xl"
                          onClick={() => void submitAllProductVideos()}
                        >
                          {videoSubmittingKeys.length > 0 ? (
                            <RefreshCw className="animate-spin" />
                          ) : (
                            <Video />
                          )}
                          {videoSubmittingKeys.length > 0
                            ? `正在提交 ${videoSubmittingKeys[0]}…`
                            : '生成全部分镜视频'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-5">
                    <div className="hidden">
                      <label className="grid min-w-0 flex-1 gap-1.5 text-[10px] font-bold text-muted-foreground">
                        产品视频方案版本
                        <select
                          value={selectedProductVideoPlanId ?? ''}
                          onChange={(event) =>
                            setSelectedProductVideoPlanId(
                              Number(event.target.value) || null,
                            )
                          }
                          className="h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">选择产品视频方案</option>
                          {productVideoPlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} · #{plan.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        disabled={
                          !selectedProductVideoPlanId ||
                          selectedGenerationSections.length === 0 ||
                          videoSubmittingKeys.length > 0 ||
                          !selectedGenerationSections.every((generation) =>
                            selectedPlanKeyframes.some(
                              (keyframe) =>
                                keyframe.generation_key === generation.key &&
                                keyframe.is_selected === 1,
                            ),
                          )
                        }
                        className="rounded-xl"
                        onClick={() => void submitAllProductVideos()}
                      >
                        {videoSubmittingKeys.length > 0 ? (
                          <RefreshCw className="animate-spin" />
                        ) : (
                          <Video />
                        )}
                        {videoSubmittingKeys.length > 0
                          ? `正在提交 ${videoSubmittingKeys[0]}…`
                          : '生成全部分镜视频'}
                      </Button>
                    </div>

                    {selectedGenerationSections.length > 0 ? (
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                        {selectedGenerationSections.map((generation) => {
                          const keyframe = selectedPlanKeyframes.find(
                            (item) =>
                              item.generation_key === generation.key &&
                              item.is_selected === 1,
                          );
                          const versions = selectedPlanVideos
                            .filter(
                              (video) =>
                                video.generation_key === generation.key,
                            )
                            .sort((a, b) => b.id - a.id);
                          const selected =
                            versions.find(
                              (video) =>
                                video.status === 'succeeded' &&
                                video.is_selected === 1,
                            ) ??
                            versions.find(
                              (video) => video.status === 'succeeded',
                            );
                          const latest = versions[0];
                          const pending = versions.find((video) =>
                            [
                              'queued',
                              'pending',
                              'running',
                              'processing',
                            ].includes(video.status),
                          );
                          const prompt =
                            latest?.prompt ??
                            buildVideoGenerationPrompt(generation.section);
                          const submitting = videoSubmittingKeys.includes(
                            generation.key,
                          );
                          return (
                            <article
                              key={generation.key}
                              className="overflow-hidden rounded-2xl border bg-card"
                            >
                              <div className="relative h-52 overflow-hidden bg-slate-950">
                                {selected ? (
                                  <video
                                    key={selected.id}
                                    src={`/api/product-videos/${selected.id}/file`}
                                    poster={
                                      keyframe
                                        ? `/api/product-keyframes/${keyframe.id}/file`
                                        : undefined
                                    }
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="h-full w-full object-contain"
                                  />
                                ) : keyframe ? (
                                  <img
                                    src={`/api/product-keyframes/${keyframe.id}/file`}
                                    alt={`${generation.key} 首帧`}
                                    className="h-full w-full object-contain opacity-70"
                                  />
                                ) : (
                                  <div className="grid h-full place-items-center text-center text-white/80">
                                    <div>
                                      <Video className="mx-auto size-7" />
                                      <p className="mt-3 text-xs font-semibold">
                                        请先生成并选择关键帧
                                      </p>
                                    </div>
                                  </div>
                                )}
                                <span className="absolute left-3 top-3 rounded-full bg-slate-950/75 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                                  {generation.key}
                                </span>
                                <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-800 backdrop-blur">
                                  {generation.duration}
                                </span>
                                {(pending || submitting) && (
                                  <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl bg-slate-950/80 px-3 py-2 text-[10px] font-semibold text-white backdrop-blur">
                                    <RefreshCw className="size-3.5 animate-spin" />
                                    {submitting
                                      ? '正在提交任务…'
                                      : `生成中 · ${pending?.status}`}
                                  </div>
                                )}
                                {!pending && latest?.status === 'failed' && (
                                  <div className="absolute inset-x-3 bottom-3 rounded-xl bg-rose-600/90 px-3 py-2 text-[10px] leading-4 text-white backdrop-blur">
                                    {latest.error_message || '视频生成失败'}
                                  </div>
                                )}
                              </div>
                              <div className="p-2">
                                {versions.length > 0 && (
                                  <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
                                    {versions.map((version) => (
                                      <div
                                        key={version.id}
                                        className={`relative shrink-0 rounded-lg border px-2.5 py-2 ${version.is_selected === 1 ? 'ring-2 ring-primary/50' : ''}`}
                                      >
                                        <button
                                          disabled={
                                            version.status !== 'succeeded'
                                          }
                                          onClick={() =>
                                            void selectProductVideo(version.id)
                                          }
                                          className="pr-4 text-left"
                                        >
                                          <p className="text-[9px] font-bold">
                                            版本 #{version.id}
                                          </p>
                                          <p
                                            className={`mt-0.5 text-[8px] ${version.status === 'failed' ? 'text-rose-600' : 'text-muted-foreground'}`}
                                          >
                                            {version.status === 'succeeded'
                                              ? '已完成'
                                              : version.status === 'failed'
                                                ? '失败'
                                                : '生成中'}
                                          </p>
                                        </button>
                                        <button
                                          onClick={() =>
                                            setProductVideoDeleteId(version.id)
                                          }
                                          className="absolute right-1 top-1 text-muted-foreground hover:text-rose-600"
                                          aria-label="删除分镜视频版本"
                                        >
                                          <X className="size-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 rounded-xl"
                                    onClick={() =>
                                      setVideoPromptEditor({
                                        key: generation.key,
                                        value: prompt,
                                      })
                                    }
                                  >
                                    <Pencil />
                                    提示词
                                  </Button>
                                  <Button
                                    size="sm"
                                    disabled={!keyframe || submitting}
                                    className="flex-1 rounded-xl"
                                    onClick={() =>
                                      void submitProductVideo(
                                        generation.key,
                                        prompt,
                                      )
                                    }
                                  >
                                    {submitting && (
                                      <RefreshCw className="animate-spin" />
                                    )}
                                    {versions.length > 0 ? '再生成' : '生成'}
                                  </Button>
                                </div>
                                {selected && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 w-full rounded-xl"
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = `/api/product-videos/${selected.id}/file`;
                                      link.download = `${generation.key.replace(' ', '-').toLowerCase()}.mp4`;
                                      link.click();
                                    }}
                                  >
                                    <Download />
                                    下载当前视频
                                  </Button>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 grid min-h-72 place-items-center rounded-2xl border border-dashed bg-muted/40 p-6 text-center">
                        <div>
                          <Video className="mx-auto size-7 text-primary" />
                          <p className="mt-3 text-sm font-semibold">
                            选择产品视频方案
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            完成第四步关键帧后，即可生成带完整配音的分镜视频。
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card
                  id="step-6"
                  className={`border-0 py-0 ring-1 ring-border/80 xl:col-span-12 ${activeWorkflow !== '6' ? 'hidden' : ''}`}
                >
                  <CardHeader className="py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <StepHead
                        number={6}
                        title="合成视频"
                        meta={`${selectedPlanVideos.filter((video) => video.status === 'succeeded' && video.is_selected === 1).length}/${selectedGenerationSections.length} 段已选`}
                      />
                      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!selectedProductVideoPlan}
                          className="shrink-0 rounded-xl px-3"
                          onClick={() => setDraftPromptOpen(true)}
                        >
                          <Pencil />
                          提示词
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            draftCreating ||
                            selectedGenerationSections.length === 0 ||
                            selectedPlanVideos.filter(
                              (video) =>
                                video.status === 'succeeded' &&
                                video.is_selected === 1,
                            ).length !== selectedGenerationSections.length
                          }
                          className="shrink-0 rounded-xl px-3"
                          onClick={() => void createCapcutDraft()}
                        >
                          {draftCreating ? (
                            <RefreshCw className="animate-spin" />
                          ) : (
                            <FolderPlus />
                          )}
                          {draftCreating ? '正在生成…' : '生成草稿'}
                        </Button>
                        <Button
                          size="sm"
                          disabled={
                            finalVideoComposing ||
                            selectedGenerationSections.length === 0 ||
                            selectedPlanVideos.filter(
                              (video) =>
                                video.status === 'succeeded' &&
                                video.is_selected === 1,
                            ).length !== selectedGenerationSections.length
                          }
                          className="shrink-0 whitespace-nowrap rounded-xl px-3"
                          onClick={() => void composeFinalVideo()}
                        >
                          {finalVideoComposing ? (
                            <RefreshCw className="animate-spin" />
                          ) : (
                            <Video />
                          )}
                          {finalVideoComposing
                            ? '正在合成视频…'
                            : finalVideo
                              ? '再生成一个版本'
                              : '合成完整视频'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-5">
                    {finalVideos.length > 0 ? (
                      <div className="overflow-hidden rounded-2xl border bg-card">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b bg-muted/40 px-4 py-2.5 text-[10px] font-bold text-muted-foreground">
                          <span>成片版本</span>
                          <span>操作</span>
                        </div>
                        <div className="divide-y">
                          {finalVideos.map((video, index) => {
                            const extension =
                              video.mime_type === 'video/mp4' ? 'mp4' : 'webm';
                            return (
                              <div
                                key={video.id}
                                className="flex items-center gap-3 px-4 py-3"
                              >
                                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                  <Clapperboard className="size-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-xs font-bold">
                                      完整视频 #{video.id}
                                    </p>
                                    {index === 0 && (
                                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                                        最新
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 truncate text-[10px] text-muted-foreground">
                                    {extension.toUpperCase()} ·{' '}
                                    {(video.file_size / 1024 / 1024).toFixed(1)}{' '}
                                    MB
                                    {' · '}
                                    {video.created_at
                                      .replace('T', ' ')
                                      .slice(0, 16)}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() =>
                                      setFinalVideoViewerId(video.id)
                                    }
                                  >
                                    <Play />
                                    播放
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = `/api/final-videos/${video.id}/file`;
                                      link.download = `完整产品视频-${video.id}.${extension}`;
                                      link.click();
                                    }}
                                  >
                                    <Download />
                                    下载
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl text-destructive hover:text-destructive"
                                    onClick={() =>
                                      setFinalVideoDeleteId(video.id)
                                    }
                                    aria-label={`删除完整视频 ${video.id}`}
                                  >
                                    <Trash2 />
                                    删除
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 grid min-h-40 place-items-center rounded-2xl border border-dashed bg-muted/40 p-5 text-center">
                        <div>
                          <Video className="mx-auto size-7 text-primary" />
                          <p className="mt-2 text-sm font-semibold">
                            准备合成完整视频
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            完成并选中全部分镜视频后，按 Generation 顺序合成。
                          </p>
                        </div>
                      </div>
                    )}
                    {capcutDrafts.length > 0 && (
                      <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b bg-muted/40 px-4 py-2.5 text-[10px] font-bold text-muted-foreground">
                          <span>剪映草稿</span>
                          <span>操作</span>
                        </div>
                        <div className="divide-y">
                          {capcutDrafts.map((draft) => (
                            <div
                              key={draft.id}
                              className="flex items-center gap-3 px-4 py-3"
                            >
                              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600">
                                <FolderPlus className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold">
                                  {/^产品视频草稿-\d+$/.test(draft.name)
                                    ? `产品视频草稿-${draft.id}`
                                    : draft.name}
                                </p>
                                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                                  {draft.status === 'failed'
                                    ? draft.error_message
                                    : draft.created_at
                                        .replace('T', ' ')
                                        .slice(0, 16)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {draft.status === 'succeeded' &&
                                draft.draft_url ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => {
                                      void navigator.clipboard
                                        .writeText(draft.draft_url)
                                        .then(() => setToast('草稿链接已复制'))
                                        .catch(() =>
                                          setToast('复制草稿链接失败'),
                                        );
                                    }}
                                  >
                                    复制草稿
                                  </Button>
                                ) : (
                                  <span className="max-w-28 truncate rounded-full bg-rose-500/10 px-2.5 py-1 text-[9px] font-bold text-rose-600">
                                    生成失败
                                  </span>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-xl text-destructive hover:text-destructive"
                                  onClick={() =>
                                    setCapcutDraftDeleteId(draft.id)
                                  }
                                  aria-label={`删除剪映草稿 ${draft.name}`}
                                >
                                  <Trash2 />
                                  删除
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {false && (
                  <>
                    <Card
                      id="legacy-step-3"
                      className="border-0 py-0 ring-1 ring-border/80 xl:col-span-12"
                    >
                      <CardHeader className="pt-4">
                        <StepHead
                          number={3}
                          title="分析参考视频"
                          meta={`${structures.length} 个版本`}
                        />
                        <CardDescription>
                          使用多模态模型根据总览图粗略拆分主要镜头结构。
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-5">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                          <div className="min-h-[320px] min-w-0 rounded-2xl border bg-slate-50/60 p-5">
                            {structures.find(
                              (structure) =>
                                structure.id === selectedStructureId,
                            ) ? (
                              <pre className="whitespace-pre-wrap font-sans text-xs leading-6 text-foreground">
                                {
                                  structures.find(
                                    (structure) =>
                                      structure.id === selectedStructureId,
                                  )?.content
                                }
                              </pre>
                            ) : (
                              <div className="grid h-full place-items-center text-center">
                                <div>
                                  <Bot className="mx-auto size-7 text-primary" />
                                  <p className="mt-3 text-sm font-semibold">
                                    尚未生成镜头结构
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    选择一个总览图版本后开始分析。
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          <aside className="min-w-0 rounded-2xl border bg-card p-4">
                            <p className="text-xs font-bold">分析操作</p>
                            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                              选择总览图版本后生成新的镜头结构。
                            </p>
                            <label className="mt-4 grid min-w-0 gap-1.5 text-[10px] font-bold text-muted-foreground">
                              总览图版本
                              <select
                                value={selectedOverviewId ?? ''}
                                onChange={(event) => {
                                  const id = Number(event.target.value);
                                  setSelectedOverviewId(id || null);
                                  setOverviewUrl(
                                    id
                                      ? `/api/reference-overviews/${id}/file`
                                      : '',
                                  );
                                }}
                                className="h-10 w-full min-w-0 max-w-full truncate rounded-xl border bg-background px-3 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                              >
                                <option value="">选择总览图版本</option>
                                {overviews.map((overview) => (
                                  <option key={overview.id} value={overview.id}>
                                    {overview.name} · #{overview.id}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Button
                              disabled={
                                !selectedOverviewId || structureAnalyzing
                              }
                              className="mt-3 w-full rounded-xl"
                              onClick={() => void analyzeReferenceVideo()}
                            >
                              {structureAnalyzing && (
                                <RefreshCw className="animate-spin" />
                              )}
                              {structureAnalyzing
                                ? '正在分析…'
                                : '分析所选总览图'}
                            </Button>
                            <Button
                              variant="outline"
                              className="mt-2 w-full rounded-xl"
                              onClick={() => setStructurePromptOpen(true)}
                            >
                              <Pencil />
                              提示词
                            </Button>
                            {structures.find(
                              (structure) =>
                                structure.id === selectedStructureId,
                            ) && (
                              <Button
                                variant="outline"
                                className="mt-2 w-full rounded-xl"
                                onClick={() => {
                                  const content =
                                    structures.find(
                                      (structure) =>
                                        structure.id === selectedStructureId,
                                    )?.content ?? '';
                                  const url = URL.createObjectURL(
                                    new Blob([content], {
                                      type: 'text/markdown;charset=utf-8',
                                    }),
                                  );
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = 'reference-structure.md';
                                  link.click();
                                  URL.revokeObjectURL(url);
                                }}
                              >
                                <Download />
                                下载 reference-structure.md
                              </Button>
                            )}
                            <div className="mt-5 border-t pt-4">
                              <p className="mb-2 text-[10px] font-bold text-muted-foreground">
                                结构版本
                              </p>
                              <div className="space-y-2">
                                {structures.map((structure) => (
                                  <div
                                    key={structure.id}
                                    className={`flex items-center gap-2 rounded-xl border p-2 ${selectedStructureId === structure.id ? 'border-primary/40 bg-primary/5' : ''}`}
                                  >
                                    <button
                                      className="min-w-0 flex-1 text-left"
                                      onClick={() =>
                                        setSelectedStructureId(structure.id)
                                      }
                                    >
                                      <p className="truncate text-[10px] font-semibold">
                                        {structure.name} · #{structure.id}
                                      </p>
                                      <p className="mt-0.5 text-[9px] text-muted-foreground">
                                        总览图版本 #{structure.overview_id}
                                      </p>
                                    </button>
                                    <button
                                      onClick={() =>
                                        setStructureDeleteId(structure.id)
                                      }
                                      className="text-muted-foreground hover:text-rose-600"
                                      aria-label="删除结构版本"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </div>
                                ))}
                                {structures.length === 0 && (
                                  <p className="py-2 text-[10px] text-muted-foreground">
                                    暂无版本
                                  </p>
                                )}
                              </div>
                            </div>
                          </aside>
                        </div>
                      </CardContent>
                    </Card>

                    <Card
                      id="legacy-step-4"
                      className="border-0 py-0 ring-1 ring-border/80 xl:col-span-12"
                    >
                      <CardHeader className="pt-4">
                        <StepHead
                          number={4}
                          title="规划生成段"
                          meta={`${generationPlans.length} 个版本`}
                        />
                        <CardDescription>
                          将短镜头重组为不少于 5
                          秒、包含完整配音且无需裁剪的生成段。
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-5">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                          <div className="min-h-[360px] min-w-0 rounded-2xl border bg-slate-50/60 p-5">
                            {generationPlans.find(
                              (plan) => plan.id === selectedGenerationPlanId,
                            ) ? (
                              <pre className="whitespace-pre-wrap font-sans text-xs leading-6 text-foreground">
                                {
                                  generationPlans.find(
                                    (plan) =>
                                      plan.id === selectedGenerationPlanId,
                                  )?.content
                                }
                              </pre>
                            ) : (
                              <div className="grid h-full place-items-center text-center">
                                <div>
                                  <Clapperboard className="mx-auto size-7 text-primary" />
                                  <p className="mt-3 text-sm font-semibold">
                                    尚未生成生成段规划
                                  </p>
                                  <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                                    选择镜头结构版本，将短 Shot
                                    合并成可整段生成并保留完整配音的任务。
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          <aside className="min-w-0 rounded-2xl border bg-card p-4">
                            <p className="text-xs font-bold">规划操作</p>
                            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                              每个生成段至少 5 秒，整段使用，不裁剪、不变速。
                            </p>
                            <label className="mt-4 grid min-w-0 gap-1.5 text-[10px] font-bold text-muted-foreground">
                              镜头结构版本
                              <select
                                value={selectedStructureId ?? ''}
                                onChange={(event) =>
                                  setSelectedStructureId(
                                    Number(event.target.value) || null,
                                  )
                                }
                                className="h-10 w-full min-w-0 max-w-full truncate rounded-xl border bg-background px-3 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                              >
                                <option value="">选择镜头结构版本</option>
                                {structures.map((structure) => (
                                  <option
                                    key={structure.id}
                                    value={structure.id}
                                  >
                                    {structure.name} · #{structure.id}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Button
                              disabled={
                                !selectedStructureId || generationPlanCreating
                              }
                              className="mt-3 w-full rounded-xl"
                              onClick={() => void createGenerationPlan()}
                            >
                              {generationPlanCreating && (
                                <RefreshCw className="animate-spin" />
                              )}
                              {generationPlanCreating
                                ? '正在规划…'
                                : '生成完整生成段'}
                            </Button>
                            {generationPlans.find(
                              (plan) => plan.id === selectedGenerationPlanId,
                            ) && (
                              <Button
                                variant="outline"
                                className="mt-2 w-full rounded-xl"
                                onClick={() => {
                                  const content =
                                    generationPlans.find(
                                      (plan) =>
                                        plan.id === selectedGenerationPlanId,
                                    )?.content ?? '';
                                  const url = URL.createObjectURL(
                                    new Blob([content], {
                                      type: 'text/markdown;charset=utf-8',
                                    }),
                                  );
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = 'generation-plan.md';
                                  link.click();
                                  URL.revokeObjectURL(url);
                                }}
                              >
                                <Download />
                                下载 generation-plan.md
                              </Button>
                            )}
                            <div className="mt-5 border-t pt-4">
                              <p className="mb-2 text-[10px] font-bold text-muted-foreground">
                                规划版本
                              </p>
                              <div className="space-y-2">
                                {generationPlans.map((plan) => (
                                  <div
                                    key={plan.id}
                                    className={`flex items-center gap-2 rounded-xl border p-2 ${selectedGenerationPlanId === plan.id ? 'border-primary/40 bg-primary/5' : ''}`}
                                  >
                                    <button
                                      className="min-w-0 flex-1 text-left"
                                      onClick={() =>
                                        setSelectedGenerationPlanId(plan.id)
                                      }
                                    >
                                      <p className="truncate text-[10px] font-semibold">
                                        {plan.name} · #{plan.id}
                                      </p>
                                      <p className="mt-0.5 text-[9px] text-muted-foreground">
                                        结构版本 #{plan.structure_id}
                                      </p>
                                    </button>
                                    <button
                                      onClick={() =>
                                        setGenerationPlanDeleteId(plan.id)
                                      }
                                      className="text-muted-foreground hover:text-rose-600"
                                      aria-label="删除生成段规划版本"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </div>
                                ))}
                                {generationPlans.length === 0 && (
                                  <p className="py-2 text-[10px] text-muted-foreground">
                                    暂无版本
                                  </p>
                                )}
                              </div>
                            </div>
                          </aside>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}

                {false && (
                  <>
                    <Card
                      id="step-4"
                      className="border-0 py-0 ring-1 ring-border/80 xl:col-span-3"
                    >
                      <CardHeader className="pt-4">
                        <StepHead
                          number={4}
                          title="分析并生成结构脚本"
                          meta="15 秒"
                        />
                        <CardDescription>
                          拆解叙事功能、镜头时长与节奏
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <div className="space-y-2">
                          {story.slice(0, 4).map((s, i) => (
                            <div
                              key={s[0]}
                              className="flex gap-2 rounded-lg bg-muted/65 p-2"
                            >
                              <span
                                className={`mt-1 size-2 shrink-0 rounded-full ${['bg-indigo-500', 'bg-violet-500', 'bg-sky-500', 'bg-fuchsia-500'][i]}`}
                              />
                              <div>
                                <div className="flex gap-2 text-[10px] font-bold">
                                  <span>{s[1]}</span>
                                  <span className="text-muted-foreground">
                                    {s[2]}
                                  </span>
                                </div>
                                <p className="mt-0.5 line-clamp-1 text-[9px] leading-4 text-muted-foreground">
                                  {s[3]}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          className="mt-3 text-[10px] font-semibold text-primary"
                          onClick={() => jump(6)}
                        >
                          查看完整脚本{' '}
                          <ArrowRight className="ml-1 inline size-3" />
                        </button>
                      </CardContent>
                    </Card>

                    <Card
                      id="step-5"
                      className="border-0 py-0 ring-1 ring-border/80 xl:col-span-4"
                    >
                      <CardHeader className="pt-4">
                        <StepHead
                          number={5}
                          title="生成并合并产品参考图"
                          meta="6 张"
                        />
                        <CardDescription>
                          锁定产品外观、材质与自然光影
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <div className="grid grid-cols-3 gap-2">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <Frame
                              key={i}
                              index={i}
                              label={`0${i + 1}`}
                              className="aspect-[4/5] rounded-lg"
                            />
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full rounded-lg border-dashed"
                          onClick={() =>
                            setToast('可以继续添加产品正面、侧面或细节参考')
                          }
                        >
                          <Plus />
                          添加更多参考图
                        </Button>
                      </CardContent>
                    </Card>

                    <Card
                      id="step-6"
                      className="border-0 py-0 ring-1 ring-border/80 xl:col-span-8"
                    >
                      <CardHeader className="pt-4">
                        <StepHead
                          number={6}
                          title="生成故事板"
                          meta="5 个镜头"
                        />
                        <CardDescription>
                          综合总览图、结构脚本与产品参考，重组为新产品叙事
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <div className="grid gap-2.5 sm:grid-cols-5">
                          {story.map((s, i) => (
                            <article
                              key={s[0]}
                              className="overflow-hidden rounded-xl border bg-background"
                            >
                              <Frame
                                index={i}
                                label={s[0]}
                                className="aspect-[3/4]"
                              />
                              <div className="p-2.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-bold">
                                    {s[1]}
                                  </p>
                                  <span className="text-[9px] text-muted-foreground">
                                    {s[2]}
                                  </span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-muted-foreground">
                                  {s[3]}
                                </p>
                              </div>
                            </article>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card
                      id="step-7"
                      className="border-0 py-0 ring-1 ring-border/80 xl:col-span-4"
                    >
                      <CardHeader className="pt-4">
                        <StepHead
                          number={7}
                          title="生成关键帧图片提示词"
                          meta="5 条"
                        />
                        <CardDescription>
                          把每个故事板镜头转译为图像生成语言
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <div className="space-y-2">
                          {prompts.map((p, i) => (
                            <div
                              key={p}
                              className="flex gap-2.5 rounded-lg border bg-background p-2.5"
                            >
                              <span className="font-mono text-[9px] font-bold text-primary">
                                0{i + 1}
                              </span>
                              <p className="line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                                {p}
                              </p>
                            </div>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full rounded-lg"
                          onClick={() => setToast('关键帧提示词已重新生成')}
                        >
                          <RefreshCw />
                          重新生成
                        </Button>
                      </CardContent>
                    </Card>

                    <Card
                      id="step-8"
                      className="border-0 py-0 ring-1 ring-border/80 xl:col-span-5"
                    >
                      <CardHeader className="pt-4">
                        <StepHead
                          number={8}
                          title="生成关键帧图片"
                          meta="1024 × 1820"
                        />
                        <CardDescription>
                          统一产品形态与光影风格，生成首帧视觉
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <div className="grid grid-cols-5 gap-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Frame
                              key={i}
                              index={i + 1}
                              label={`0${i + 1}`}
                              className="aspect-[9/16] rounded-lg"
                            />
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 w-full rounded-lg"
                          onClick={() => setToast('5 张关键帧已打包下载')}
                        >
                          <Download />
                          下载全部
                        </Button>
                      </CardContent>
                    </Card>

                    <Card
                      id="step-9"
                      className="border-0 py-0 ring-1 ring-border/80 xl:col-span-3"
                    >
                      <CardHeader className="pt-4">
                        <StepHead
                          number={9}
                          title="生成视频提示词"
                          meta="JSON"
                        />
                        <CardDescription>
                          为每个镜头补全运动、机位与转场
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <pre className="h-[230px] overflow-auto rounded-xl bg-[#111827] p-3 text-[9px] leading-[1.75] text-indigo-200">
                          <code>{videoPrompt}</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 w-full rounded-lg"
                          onClick={() => {
                            void navigator.clipboard?.writeText(videoPrompt);
                            setToast('视频提示词已复制');
                          }}
                        >
                          复制提示词
                        </Button>
                      </CardContent>
                    </Card>

                    <Card
                      id="step-10"
                      className="border-0 py-0 ring-1 ring-border/80 xl:col-span-12"
                    >
                      <CardHeader className="pt-4">
                        <StepHead
                          number={10}
                          title="生成分镜视频"
                          meta="5 段 · 15 秒"
                        />
                        <CardDescription>
                          逐镜头生成视频片段，并保持产品与视觉风格一致
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <div className="grid gap-3 sm:grid-cols-5">
                          {story.map((s, i) => (
                            <button
                              key={s[0]}
                              className="group text-left"
                              onClick={() =>
                                setToast(`正在预览镜头 ${s[0]}：${s[1]}`)
                              }
                            >
                              <div className="relative">
                                <Frame
                                  index={i}
                                  className="aspect-[9/13] rounded-xl"
                                  label={s[0]}
                                />
                                <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-950 shadow-lg transition group-hover:scale-110">
                                  <Play className="ml-0.5 size-4 fill-current" />
                                </span>
                                <span className="absolute bottom-2 right-2 rounded bg-slate-950/65 px-1.5 py-0.5 text-[9px] text-white">
                                  00:0{3 + (i % 2)}
                                </span>
                              </div>
                              <p className="mt-2 text-[10px] font-bold">
                                {s[1]}
                              </p>
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="overflow-hidden border-0 bg-[#111827] py-0 text-white ring-1 ring-white/10 xl:col-span-12">
                      <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_1.5fr_auto] lg:items-center">
                        <div>
                          <span className="mb-3 inline-flex rounded-full bg-emerald-400/15 px-2.5 py-1 text-[9px] font-bold text-emerald-300">
                            READY TO EXPORT
                          </span>
                          <h2 className="text-xl font-bold">
                            产品短片已准备就绪
                          </h2>
                          <p className="mt-1 text-xs text-slate-400">
                            15 秒 · 1080 × 1920 · 30fps · MP4 (H.264)
                          </p>
                        </div>
                        <div className="flex h-16 items-center gap-1 overflow-hidden rounded-xl bg-white/5 p-1.5">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <Frame
                              key={i}
                              index={i}
                              className="h-full min-w-12 flex-1 rounded-md"
                            />
                          ))}
                        </div>
                        <Button
                          onClick={download}
                          className="h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 shadow-xl shadow-violet-500/20"
                        >
                          <Download />
                          导出作品
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {false && activeSection === 'project' && (
          <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/92 px-3 py-2 backdrop-blur-xl lg:left-[88px]">
            <div className="mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto">
              {workflow.map((name, i) => (
                <button
                  key={name}
                  onClick={() => jump(i + 1)}
                  className="group flex shrink-0 items-center"
                >
                  <span
                    className={`grid size-6 place-items-center rounded-full text-[9px] font-bold ${progress >= (i + 1) * 10 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {progress >= (i + 1) * 10 ? (
                      <Check className="size-3" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="ml-1.5 text-[9px] font-semibold text-muted-foreground group-hover:text-foreground">
                    {name}
                  </span>
                  {i < workflow.length - 1 && (
                    <span className="mx-2 h-px w-4 bg-border" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {productOverviewDeleteId !== null && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setProductOverviewDeleteId(null)}
            aria-label="关闭删除确认"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-overview-delete-title"
            className="relative w-full max-w-sm rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2
              id="product-overview-delete-title"
              className="text-lg font-bold"
            >
              删除此产品预览图版本？
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              删除后无法恢复，产品素材和其他预览图版本不会受影响。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setProductOverviewDeleteId(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => void deleteProductOverview()}
              >
                删除版本
              </Button>
            </div>
          </div>
        </div>
      )}
      {productOverviewViewerOpen && productOverviewUrl && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
            onClick={() => setProductOverviewViewerOpen(false)}
            aria-label="关闭产品预览图查看器"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-overview-viewer-title"
            className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2
                  id="product-overview-viewer-title"
                  className="text-sm font-bold"
                >
                  产品预览图
                </h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  版本 #{selectedProductOverviewId} · 原始比例完整显示
                </p>
              </div>
              <button
                onClick={() => setProductOverviewViewerOpen(false)}
                className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭查看器"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-5">
              <img
                src={productOverviewUrl}
                alt="产品预览图大图"
                className="mx-auto h-auto max-w-full rounded-lg border bg-white shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
      {batchGenerationOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => {
              if (!batchGenerating) setBatchGenerationOpen(false);
            }}
            disabled={batchGenerating}
            aria-label="关闭批量生成"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-generation-title"
            className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between border-b px-6 py-5">
              <div>
                <h2 id="batch-generation-title" className="text-lg font-bold">
                  批量生成
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  可指定要生成的素材组；未选择时仅生成尚未生成的素材组。
                </p>
              </div>
              <button
                onClick={() => setBatchGenerationOpen(false)}
                disabled={batchGenerating}
                className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-auto p-6">
              {batchProgress.length === 0 &&
                selectedBatchMaterialCount === 0 && (
                <output
                  className="block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800"
                >
                  <span className="font-bold">未选择素材组：</span>
                  本次将只生成尚未生成的素材组，已生成或素材不完整的素材组会自动跳过。
                </output>
                )}

              <section
                aria-labelledby="batch-generation-steps-title"
                className="rounded-2xl border p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3
                      id="batch-generation-steps-title"
                      className="text-xs font-bold"
                    >
                      生成步骤
                    </h3>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      每个素材组依次完成以下步骤
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-[9px] font-bold text-amber-700">
                    不生成最终视频
                  </span>
                </div>
                <ol className="mt-4 grid gap-2 sm:grid-cols-5">
                  {batchGenerationSteps.map((step, index) => (
                    <li
                      key={step}
                      className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5 sm:block"
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                        {index + 1}
                      </span>
                      <span className="text-[10px] font-semibold leading-4 sm:mt-2 sm:block">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              {batchProgress.length > 0 && (
                <section
                  aria-labelledby="batch-progress-title"
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 id="batch-progress-title" className="text-xs font-bold">
                      执行进度
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      {batchProgress.filter((item) => item.status === 'completed').length}/
                      {batchProgress.length} 个素材组已完成
                    </span>
                  </div>
                  {batchProgress.map((item) => (
                    <article
                      key={item.groupId}
                      className="overflow-hidden rounded-2xl border"
                    >
                      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold">
                            {item.groupName}
                          </p>
                          <p className="mt-0.5 text-[9px] text-muted-foreground">
                            {item.status === 'pending'
                              ? '等待开始'
                              : item.status === 'running'
                                ? '正在生成'
                                : item.status === 'completed'
                                  ? '已完成至分镜视频'
                                  : item.error}
                          </p>
                        </div>
                        {item.workflowId && !batchGenerating && (
                          <a
                            href={`/workflows/${item.workflowId}`}
                            className="shrink-0 text-[10px] font-bold text-primary hover:underline"
                          >
                            查看作品
                          </a>
                        )}
                      </div>
                      <ol className="divide-y px-4">
                        {item.steps.map((step, index) => (
                          <li
                            key={step.label}
                            className="flex items-center gap-3 py-2.5"
                          >
                            <span
                              className={`grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                                step.status === 'completed'
                                  ? 'bg-emerald-500 text-white'
                                  : step.status === 'running'
                                    ? 'bg-primary text-primary-foreground'
                                    : step.status === 'failed'
                                      ? 'bg-rose-500 text-white'
                                      : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {step.status === 'completed' ? (
                                <Check className="size-3" />
                              ) : step.status === 'running' ? (
                                <RefreshCw className="size-3 animate-spin" />
                              ) : step.status === 'failed' ? (
                                <X className="size-3" />
                              ) : (
                                index + 1
                              )}
                            </span>
                            <span className="min-w-0 flex-1 text-[10px] font-semibold">
                              {step.label}
                            </span>
                            <span
                              className={`max-w-[45%] truncate text-right text-[9px] ${
                                step.status === 'failed'
                                  ? 'text-rose-600'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {step.detail ||
                                (step.status === 'pending' ? '等待' : '')}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </article>
                  ))}
                </section>
              )}

              {batchProgress.length === 0 && (
                <div className="overflow-hidden rounded-2xl border">
                <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(120px,0.7fr)_auto] gap-3 border-b bg-muted/40 px-4 py-2.5 text-[10px] font-bold text-muted-foreground">
                  <Checkbox
                    checked={allReadyBatchMaterialsSelected}
                    disabled={readyBatchMaterialCount === 0}
                    onCheckedChange={(checked) =>
                      setSelectedBatchMaterialGroupIds(
                        checked ? readyBatchMaterialGroupIds : [],
                      )
                    }
                    aria-label="选择全部可生成素材组"
                  />
                  <span>产品素材组</span>
                  <span>参考素材</span>
                  <span>状态</span>
                </div>
                <div className="max-h-72 divide-y overflow-auto">
                  {batchMaterialItems.map((item) => (
                    <div
                      key={item.group.id}
                      className={`grid grid-cols-[36px_minmax(0,1fr)_minmax(120px,0.7fr)_auto] items-center gap-3 px-4 py-3 transition-colors ${
                        selectedBatchMaterialGroupIdSet.has(item.group.id)
                          ? 'bg-primary/5'
                          : ''
                      }`}
                    >
                      <Checkbox
                        checked={selectedBatchMaterialGroupIdSet.has(
                          item.group.id,
                        )}
                        disabled={!item.ready}
                        onCheckedChange={(checked) =>
                          setSelectedBatchMaterialGroupIds((current) =>
                            checked
                              ? [...new Set([...current, item.group.id])]
                              : current.filter((id) => id !== item.group.id),
                          )
                        }
                        aria-label={`选择素材组：${item.group.name}`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">
                          {item.group.name}
                        </p>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          {item.imageCount} 张产品图片
                        </p>
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {item.referenceGroup?.name ?? '未关联参考素材'}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${
                          item.ready
                            ? selectedBatchMaterialCount > 0 &&
                              !selectedBatchMaterialGroupIdSet.has(
                                item.group.id,
                              )
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-primary/10 text-primary'
                            : 'bg-amber-500/10 text-amber-700'
                        }`}
                      >
                        {item.ready
                          ? selectedBatchMaterialGroupIdSet.has(item.group.id)
                            ? '已选择'
                            : selectedBatchMaterialCount > 0
                              ? '未选择'
                              : '待生成'
                          : '素材不完整'}
                      </span>
                    </div>
                  ))}
                  {batchMaterialItems.length === 0 && (
                    <div className="p-8 text-center">
                      <ImageIcon className="mx-auto size-6 text-muted-foreground" />
                      <p className="mt-2 text-xs font-semibold">
                        暂无未生成素材组
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        当前素材组均已生成，或还没有可生成的素材组。
                      </p>
                    </div>
                  )}
                </div>
                </div>
              )}

              <p className="text-[10px] leading-5 text-muted-foreground">
                素材组将按顺序执行，失败时停止在当前步骤。完成所有分镜视频后结束，不合成最终视频。
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t bg-muted/20 px-6 py-4">
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={batchGenerating}
                onClick={() => setBatchGenerationOpen(false)}
              >
                {batchProgress.length > 0 ? '关闭' : '取消'}
              </Button>
              <Button
                className="rounded-xl px-5"
                disabled={batchGenerating || readyBatchMaterialCount === 0}
                onClick={() => void startBatchGeneration()}
              >
                {batchGenerating ? (
                  <RefreshCw className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                {batchGenerating
                  ? '正在批量生成…'
                  : selectedBatchMaterialCount > 0
                    ? `生成已选 ${selectedBatchMaterialCount} 个素材组`
                    : '生成未生成的素材组'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {(workflowCreateOpen || workflowRenameId !== null) && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => {
              setWorkflowCreateOpen(false);
              setWorkflowRenameId(null);
              setWorkflowName('');
            }}
            aria-label="关闭作品编辑"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workflow-edit-title"
            className="relative w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2 id="workflow-edit-title" className="text-lg font-bold">
              {workflowRenameId !== null ? '重命名作品' : '新建作品'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              每个作品拥有独立的预览图、关键帧、提示词和视频版本。
            </p>
            <input
              autoFocus
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter')
                  void (workflowRenameId !== null
                    ? renameWorkflow()
                    : createWorkflow());
              }}
              maxLength={80}
              placeholder="例如：夏日坚果饼干宣传片"
              className="mt-5 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setWorkflowCreateOpen(false);
                  setWorkflowRenameId(null);
                  setWorkflowName('');
                }}
              >
                取消
              </Button>
              <Button
                className="rounded-xl px-5"
                onClick={() =>
                  void (workflowRenameId !== null
                    ? renameWorkflow()
                    : createWorkflow())
                }
              >
                {workflowRenameId !== null ? '保存名称' : '创建作品'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {workflowDeleteId !== null && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setWorkflowDeleteId(null)}
            aria-label="关闭删除确认"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workflow-delete-title"
            className="relative w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2 id="workflow-delete-title" className="text-lg font-bold">
              删除此作品？
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              该作品下的预览图、方案、关键帧和视频都会被删除，其他作品不受影响。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setWorkflowDeleteId(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => void deleteWorkflow()}
              >
                删除作品
              </Button>
            </div>
          </div>
        </div>
      )}
      {videoPromptEditor && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setVideoPromptEditor(null)}
            aria-label="关闭视频提示词"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-prompt-title"
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between border-b px-6 py-5">
              <div>
                <h2 id="video-prompt-title" className="text-lg font-bold">
                  {videoPromptEditor.key} 视频提示词
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  选定关键帧作为 first_frame，并启用完整音频生成。
                </p>
              </div>
              <button
                onClick={() => setVideoPromptEditor(null)}
                className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-6">
              <textarea
                autoFocus
                value={videoPromptEditor.value}
                onChange={(event) =>
                  setVideoPromptEditor((current) =>
                    current ? { ...current, value: event.target.value } : null,
                  )
                }
                rows={18}
                maxLength={8000}
                className="w-full resize-y rounded-2xl border bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>9:16 · 480p · 完整配音 · 不裁剪</span>
                <span>{videoPromptEditor.value.length}/8000</span>
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    const section = selectedGenerationSections.find(
                      (item) => item.key === videoPromptEditor.key,
                    );
                    if (section)
                      setVideoPromptEditor({
                        key: section.key,
                        value: buildVideoGenerationPrompt(section.section),
                      });
                  }}
                >
                  恢复默认
                </Button>
                <Button
                  className="rounded-xl px-5"
                  disabled={videoSubmittingKeys.includes(videoPromptEditor.key)}
                  onClick={() => {
                    const editor = videoPromptEditor;
                    setVideoPromptEditor(null);
                    void submitProductVideo(editor.key, editor.value);
                  }}
                >
                  生成分镜视频
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {finalVideoViewer && (
        <div className="fixed inset-0 z-[90] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setFinalVideoViewerId(null)}
            aria-label="关闭完整视频播放器"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="final-video-viewer-title"
            className="relative flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div className="min-w-0">
                <h2 id="final-video-viewer-title" className="text-sm font-bold">
                  完整视频 #{finalVideoViewer.id}
                </h2>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {finalVideoViewer.mime_type === 'video/mp4' ? 'MP4' : 'WebM'}
                  {' · '}
                  {(finalVideoViewer.file_size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    const extension =
                      finalVideoViewer.mime_type === 'video/mp4'
                        ? 'mp4'
                        : 'webm';
                    const link = document.createElement('a');
                    link.href = `/api/final-videos/${finalVideoViewer.id}/file`;
                    link.download = `完整产品视频-${finalVideoViewer.id}.${extension}`;
                    link.click();
                  }}
                >
                  <Download />
                  下载
                </Button>
                <button
                  onClick={() => setFinalVideoViewerId(null)}
                  className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="关闭播放器"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-slate-950 p-4">
              <video
                key={finalVideoViewer.id}
                src={`/api/final-videos/${finalVideoViewer.id}/file`}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="max-h-[76vh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
      {finalVideoDeleteId !== null && (
        <div className="fixed inset-0 z-[95] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setFinalVideoDeleteId(null)}
            aria-label="关闭成片删除确认"
          />
          <dialog
            open
            aria-labelledby="final-video-delete-title"
            className="relative m-0 w-full max-w-sm rounded-3xl border bg-card p-6 text-foreground shadow-2xl"
          >
            <h2 id="final-video-delete-title" className="text-lg font-bold">
              删除此成片版本？
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              删除后无法恢复，其他成片版本和分镜视频不会受影响。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setFinalVideoDeleteId(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => void deleteFinalVideo()}
              >
                删除版本
              </Button>
            </div>
          </dialog>
        </div>
      )}
      {capcutDraftDeleteId !== null && (
        <div className="fixed inset-0 z-[95] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setCapcutDraftDeleteId(null)}
            aria-label="关闭剪映草稿删除确认"
          />
          <dialog
            open
            aria-labelledby="capcut-draft-delete-title"
            className="relative m-0 w-full max-w-sm rounded-3xl border bg-card p-6 text-foreground shadow-2xl"
          >
            <h2 id="capcut-draft-delete-title" className="text-lg font-bold">
              删除此剪映草稿？
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              删除后会移除当前作品中的草稿记录，此操作无法恢复。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setCapcutDraftDeleteId(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => void deleteCapcutDraft()}
              >
                删除草稿
              </Button>
            </div>
          </dialog>
        </div>
      )}
      {draftPromptOpen && (
        <div className="fixed inset-0 z-[90] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setDraftPromptOpen(false)}
            aria-label="关闭草稿提示词"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-prompt-title"
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between border-b px-6 py-5">
              <div>
                <h2 id="draft-prompt-title" className="text-lg font-bold">
                  草稿提示词
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  用于当前方案分镜拼接和字幕生成的执行规则。
                </p>
              </div>
              <button
                onClick={() => setDraftPromptOpen(false)}
                className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-6">
              <textarea
                autoFocus
                value={draftPrompt}
                onChange={(event) => setDraftPrompt(event.target.value)}
                rows={14}
                maxLength={8000}
                className="w-full resize-y rounded-2xl border bg-background px-4 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>规则随草稿保存，视频与字幕时间线由后端严格执行</span>
                <span>{draftPrompt.length}/8000</span>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={draftPrompt === DEFAULT_CAPCUT_DRAFT_PROMPT}
                  onClick={() => setDraftPrompt(DEFAULT_CAPCUT_DRAFT_PROMPT)}
                >
                  恢复默认
                </Button>
                <Button
                  className="rounded-xl px-5"
                  disabled={!draftPrompt.trim()}
                  onClick={() => {
                    setDraftPromptOpen(false);
                    setToast('草稿提示词已保存');
                  }}
                >
                  保存提示词
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {productVideoDeleteId !== null && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setProductVideoDeleteId(null)}
            aria-label="关闭删除确认"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-video-delete-title"
            className="relative w-full max-w-sm rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2 id="product-video-delete-title" className="text-lg font-bold">
              删除此分镜视频版本？
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              删除后无法恢复，关键帧和同一 Generation 的其他视频版本不会受影响。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setProductVideoDeleteId(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => void deleteProductVideo()}
              >
                删除版本
              </Button>
            </div>
          </div>
        </div>
      )}
      {keyframePromptEditor && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setKeyframePromptEditor(null)}
            aria-label="关闭关键帧提示词"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyframe-prompt-title"
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between border-b px-6 py-5">
              <div>
                <h2 id="keyframe-prompt-title" className="text-lg font-bold">
                  {keyframePromptEditor.key} 关键帧提示词
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  产品预览图会作为 image[] 参考图一同提交。
                </p>
              </div>
              <button
                onClick={() => setKeyframePromptEditor(null)}
                className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-6">
              <textarea
                autoFocus
                value={keyframePromptEditor.value}
                onChange={(event) =>
                  setKeyframePromptEditor((current) =>
                    current ? { ...current, value: event.target.value } : null,
                  )
                }
                rows={18}
                maxLength={8000}
                className="w-full resize-y rounded-2xl border bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>生成一张竖版起始关键帧</span>
                <span>{keyframePromptEditor.value.length}/8000</span>
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    const section = selectedGenerationSections.find(
                      (item) => item.key === keyframePromptEditor.key,
                    );
                    if (section)
                      setKeyframePromptEditor({
                        key: section.key,
                        value: buildKeyframePrompt(section.section),
                      });
                  }}
                >
                  恢复默认
                </Button>
                <Button
                  className="rounded-xl px-5"
                  disabled={keyframeGeneratingKeys.includes(
                    keyframePromptEditor.key,
                  )}
                  onClick={() => {
                    const editor = keyframePromptEditor;
                    setKeyframePromptEditor(null);
                    void createProductKeyframe(editor.key, editor.value);
                  }}
                >
                  生成关键帧
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {keyframeDeleteId !== null && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setKeyframeDeleteId(null)}
            aria-label="关闭删除确认"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyframe-delete-title"
            className="relative w-full max-w-sm rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2 id="keyframe-delete-title" className="text-lg font-bold">
              删除此关键帧版本？
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              删除后无法恢复，同一 Generation 的其他版本不会受影响。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setKeyframeDeleteId(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => void deleteProductKeyframe()}
              >
                删除版本
              </Button>
            </div>
          </div>
        </div>
      )}
      {keyframeViewerId !== null && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => {
              setKeyframeViewerId(null);
              setKeyframeImageEditor(null);
            }}
            aria-label="关闭关键帧查看器"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyframe-viewer-title"
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 id="keyframe-viewer-title" className="text-sm font-bold">
                  产品分镜关键帧
                </h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  版本 #{keyframeViewerId} · 竖版起始画面
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `/api/product-keyframes/${keyframeViewerId}/file`;
                    link.download = `product-keyframe-${keyframeViewerId}.png`;
                    link.click();
                  }}
                >
                  <Download />
                  下载
                </Button>
                <button
                  onClick={() => {
                    setKeyframeViewerId(null);
                    setKeyframeImageEditor(null);
                  }}
                  className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="关闭查看器"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-950 p-5">
              <img
                src={`/api/product-keyframes/${keyframeViewerId}/file`}
                alt="产品关键帧大图"
                className="mx-auto max-h-[52vh] w-auto max-w-full rounded-lg bg-white object-contain shadow-2xl"
              />
            </div>
            {keyframeImageEditor?.id === keyframeViewerId && (
              <div className="border-t bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold">图生图编辑</p>
                  <span className="text-[10px] text-muted-foreground">
                    直接修改当前关键帧，不新增版本
                  </span>
                </div>
                <textarea
                  autoFocus
                  value={keyframeImageEditor.value}
                  onChange={(event) =>
                    setKeyframeImageEditor((current) =>
                      current
                        ? { ...current, value: event.target.value }
                        : null,
                    )
                  }
                  placeholder="描述想要修改的内容，例如：将背景改为奶油色桌面，保留产品包装和构图"
                  maxLength={8000}
                  className="mt-3 min-h-20 w-full resize-y rounded-xl border bg-background px-3 py-2 text-xs leading-5 outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    size="sm"
                    className="rounded-xl"
                    disabled={
                      keyframeGeneratingKeys.includes(
                        keyframeImageEditor.key,
                      ) || !keyframeImageEditor.value.trim()
                    }
                    onClick={() => {
                      const editor = keyframeImageEditor;
                      setKeyframeImageEditor(null);
                      void createProductKeyframe(
                        editor.key,
                        editor.value,
                        false,
                        editor.id,
                      );
                    }}
                  >
                    {keyframeGeneratingKeys.includes(
                      keyframeImageEditor.key,
                    ) && <RefreshCw className="animate-spin" />}
                    保存修改
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {productVideoPlanDeleteId !== null && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setProductVideoPlanDeleteId(null)}
            aria-label="关闭删除确认"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-video-plan-delete-title"
            className="relative w-full max-w-sm rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2
              id="product-video-plan-delete-title"
              className="text-lg font-bold"
            >
              删除此产品视频方案版本？
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              删除后无法恢复，参考图、产品图和其他方案版本不会受影响。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setProductVideoPlanDeleteId(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => void deleteProductVideoPlan()}
              >
                删除版本
              </Button>
            </div>
          </div>
        </div>
      )}
      {structurePromptOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setStructurePromptOpen(false)}
            aria-label="关闭提示词编辑"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="structure-prompt-title"
            className="relative w-full max-w-xl rounded-3xl border bg-card p-0 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b px-6 py-5">
              <div>
                <h2 id="structure-prompt-title" className="text-lg font-bold">
                  提示词
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  编辑参考拍法分析与产品视频方案使用的完整提示词。
                </p>
              </div>
              <button
                onClick={() => setStructurePromptOpen(false)}
                className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭提示词编辑"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-6">
              <textarea
                autoFocus
                value={structurePrompt}
                onChange={(event) => setStructurePrompt(event.target.value)}
                rows={18}
                maxLength={8000}
                className="w-full resize-y rounded-2xl border bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/55 focus:ring-2 focus:ring-primary/20"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>分析时将直接使用这里的完整提示词</span>
                <span>{structurePrompt.length}/8000</span>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={
                    structurePrompt === DEFAULT_PRODUCT_VIDEO_PLAN_PROMPT
                  }
                  onClick={() =>
                    setStructurePrompt(DEFAULT_PRODUCT_VIDEO_PLAN_PROMPT)
                  }
                >
                  恢复默认
                </Button>
                <Button
                  className="rounded-xl px-5"
                  onClick={() => setStructurePromptOpen(false)}
                >
                  完成
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {structureDeleteId !== null && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setStructureDeleteId(null)}
            aria-label="关闭删除确认"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="structure-delete-title"
            className="relative w-full max-w-sm rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2 id="structure-delete-title" className="text-lg font-bold">
              删除此镜头结构版本？
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              删除后无法恢复，总览图和其他结构版本不会受影响。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setStructureDeleteId(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => void deleteStructure()}
              >
                删除版本
              </Button>
            </div>
          </div>
        </div>
      )}
      {generationPlanDeleteId !== null && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setGenerationPlanDeleteId(null)}
            aria-label="关闭删除确认"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="generation-plan-delete-title"
            className="relative w-full max-w-sm rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2 id="generation-plan-delete-title" className="text-lg font-bold">
              删除此生成段规划版本？
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              删除后无法恢复，镜头结构和其他规划版本不会受影响。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setGenerationPlanDeleteId(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => void deleteGenerationPlan()}
              >
                删除版本
              </Button>
            </div>
          </div>
        </div>
      )}
      {overviewViewerOpen && overviewUrl && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
            onClick={() => setOverviewViewerOpen(false)}
            aria-label="关闭总览图查看器"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="overview-viewer-title"
            className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 id="overview-viewer-title" className="text-sm font-bold">
                  参考视频总览图
                </h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  版本 #{selectedOverviewId} · 27 帧 · 时间顺序
                </p>
              </div>
              <button
                onClick={() => setOverviewViewerOpen(false)}
                className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭查看器"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-5">
              <img
                src={overviewUrl}
                alt="参考视频总览图大图"
                className="mx-auto h-auto max-w-full rounded-lg border bg-white shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
      {productVideoPlanViewerOpen && selectedProductVideoPlan && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
            onClick={() => setProductVideoPlanViewerOpen(false)}
            aria-label="关闭方案查看器"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-video-plan-viewer-title"
            className="relative flex max-h-[84vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2
                  id="product-video-plan-viewer-title"
                  className="text-sm font-bold"
                >
                  产品视频方案
                </h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  当前方案
                </p>
              </div>
              <button
                onClick={() => setProductVideoPlanViewerOpen(false)}
                className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭方案查看器"
              >
                <X className="size-4" />
              </button>
            </div>
            <pre className="min-h-0 overflow-auto whitespace-pre-wrap p-5 font-sans text-xs leading-6 text-foreground">
              {selectedProductVideoPlan.content}
            </pre>
          </div>
        </div>
      )}
      {overviewDeleteId !== null && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setOverviewDeleteId(null)}
            aria-label="关闭删除确认"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="overview-delete-title"
            className="relative w-full max-w-sm rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <h2 id="overview-delete-title" className="text-lg font-bold">
              删除此版本？
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              删除后无法恢复，其他总览图版本不会受影响。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setOverviewDeleteId(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => void deleteOverview()}
              >
                删除版本
              </Button>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setSettingsOpen(false)}
            aria-label="关闭模型配置"
          />
          <dialog
            open
            aria-labelledby="model-settings-title"
            className="relative m-0 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border bg-card p-0 text-foreground shadow-2xl"
          >
            <div className="flex items-start justify-between border-b px-6 py-5">
              <div>
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Settings2 className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
                    Model connections
                  </span>
                </div>
                <h2
                  id="model-settings-title"
                  className="text-xl font-bold tracking-tight"
                >
                  模型连接配置
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  填写各阶段调用模型所需的接口信息。
                </p>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭模型配置"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-6">
              <div
                role="tablist"
                aria-label="模型类型"
                className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border bg-muted/45 p-1.5"
              >
                {configSections.map(({ type, title, Icon, tone }) => {
                  const active = activeModelTab === type;
                  return (
                    <button
                      key={type}
                      role="tab"
                      aria-selected={active}
                      aria-controls={`model-panel-${type}`}
                      onClick={() => setActiveModelTab(type)}
                      className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${active ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70' : 'text-muted-foreground hover:bg-background/65 hover:text-foreground'}`}
                    >
                      <span
                        className={`grid size-6 place-items-center rounded-lg ${active ? tone : 'bg-background text-muted-foreground'}`}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      {title}
                    </button>
                  );
                })}
              </div>
              {configLoading ? (
                <div className="grid min-h-64 place-items-center text-xs font-medium text-muted-foreground">
                  <RefreshCw className="mb-3 size-5 animate-spin text-primary" />
                  正在从 SQLite 读取配置…
                </div>
              ) : (
                configSections
                  .filter(({ type }) => type === activeModelTab)
                  .map(
                    ({ type, title, description, Icon, tone, placeholder }) => (
                      <section
                        key={type}
                        id={`model-panel-${type}`}
                        role="tabpanel"
                        aria-label={title}
                        className="rounded-2xl border bg-background p-4"
                      >
                        <div className="mb-4 flex items-start gap-3">
                          <span
                            className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone}`}
                          >
                            <Icon className="size-4" />
                          </span>
                          <div>
                            <h3 className="text-sm font-bold">{title}</h3>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {description}
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-1.5 text-[10px] font-bold text-muted-foreground">
                            模型 ID
                            <input
                              value={models[type].model_id}
                              onChange={(event) =>
                                updateModel(
                                  type,
                                  'model_id',
                                  event.target.value,
                                )
                              }
                              placeholder={placeholder}
                              className="h-10 rounded-xl border bg-card px-3 text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground/55 focus:ring-2 focus:ring-primary/20"
                            />
                          </label>
                          <label className="grid gap-1.5 text-[10px] font-bold text-muted-foreground">
                            接口地址（Base URL）
                            <input
                              type="url"
                              value={models[type].base_url}
                              onChange={(event) =>
                                updateModel(
                                  type,
                                  'base_url',
                                  event.target.value,
                                )
                              }
                              placeholder="https://api.example.com/v1"
                              className="h-10 rounded-xl border bg-card px-3 text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground/55 focus:ring-2 focus:ring-primary/20"
                            />
                          </label>
                          <label className="grid gap-1.5 text-[10px] font-bold text-muted-foreground sm:col-span-2">
                            API Key
                            <input
                              type="password"
                              autoComplete="off"
                              value={models[type].api_key}
                              onChange={(event) =>
                                updateModel(type, 'api_key', event.target.value)
                              }
                              placeholder="sk-••••••••••••"
                              className="h-10 rounded-xl border bg-card px-3 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/55 focus:ring-2 focus:ring-primary/20"
                            />
                          </label>
                        </div>
                        <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <p
                            aria-live="polite"
                            className={`min-h-4 text-[10px] font-medium ${connectionResult[type]?.ok ? 'text-emerald-600' : connectionResult[type] ? 'text-rose-600' : 'text-muted-foreground'}`}
                          >
                            {connectionResult[type]?.message ??
                              '将使用当前填写的信息测试 OpenAI 兼容的 /models 接口。'}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={testingModel !== null}
                            className="shrink-0 rounded-xl"
                            onClick={() => void testModelConnection(type)}
                          >
                            {testingModel === type && (
                              <RefreshCw className="animate-spin" />
                            )}
                            {testingModel === type ? '测试中…' : '测试连接'}
                          </Button>
                        </div>
                      </section>
                    ),
                  )
              )}
            </div>
            <div className="flex flex-col gap-3 border-t bg-muted/35 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] text-muted-foreground">
                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500" />
                配置由服务端写入本地 SQLite 数据库
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setSettingsOpen(false)}
                >
                  取消
                </Button>
                <Button
                  disabled={configLoading || configSaving}
                  className="rounded-xl px-5"
                  onClick={() => void saveModels()}
                >
                  {configSaving && <RefreshCw className="animate-spin" />}
                  {configSaving ? '保存中' : '保存到 SQLite'}
                </Button>
              </div>
            </div>
          </dialog>
        </div>
      )}
    </main>
  );
}
