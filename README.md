# 同款视频 · AI Product Reel

上传参考视频和产品图片，沿用参考视频的镜头结构与节奏，生成产品视频方案、关键帧、分镜视频，最终合成 MP4 或生成剪映草稿。

这是一个可在本地运行的单用户 AI 视频制作应用，也是一个供 Vibe Coding / Codex 实践的全栈项目。README 按当前运行界面的**六步工作台**组织；详细需求与验收标准见 [需求文档](./docs/需求文档.md)。

## 真实运行界面

下面的截图来自实际运行的项目，不是设计稿。完整的桌面端、移动端页面与弹窗见 [界面截图目录](./docs/design/README.md)。

| 桌面端 | 移动端 |
| --- | --- |
| ![桌面端产品关键帧界面](./docs/design/桌面端-封面.png) | <img src="./docs/design/移动端-封面.png" width="240" alt="移动端产品关键帧界面" /> |

> 截图使用本地已有作品和素材数据；仓库不附带这些运行数据。移动端素材库目前仍有横向溢出，截图保留了实际状态。

## 功能模块

| 模块 | 当前可做的事 | 界面 |
| --- | --- | --- |
| 作品管理 | 新建、重命名、删除作品；进入独立工作台并恢复已保存进度 | [作品列表](./docs/design/01-作品列表.png) |
| 素材库 | 管理参考视频组与产品图片组，上传、预览、重命名和删除素材 | [素材库](./docs/design/02-素材库.png) |
| 六步创作工作台 | 从参考视频与产品素材生成预览图、方案、关键帧、分镜视频和成片 | [工作台截图](./docs/design/README.md) |
| 批量生成 | 对多个准备就绪的素材组依次生成到分镜视频，查看各组、各步状态 | [批量生成](./docs/design/04-批量生成.png) |
| 模型设置 | 分别配置多模态、生图、视频模型的接口与密钥，并测试连接 | [模型设置](./docs/design/03-模型设置.png) |

### 六步创作流程

```text
准备参考视频与产品图片 → 创建作品 → 参考视频预览 → 产品预览
                         → 产品视频方案 → 关键帧 → 分镜视频 → MP4 / 剪映草稿
```

| 步骤 | 用户操作与结果 | 真实界面 |
| --- | --- | --- |
| 1. 参考视频预览 | 选择参考视频，抽帧并合成按时间顺序排列的预览图 | [桌面端](./docs/design/05-第一步-参考视频预览.png) · [移动端](./docs/design/移动端-01-参考视频预览.png) |
| 2. 产品预览 | 选择产品图片，合成便于检查和供模型参考的产品预览图 | [桌面端](./docs/design/06-第二步-产品预览.png) · [移动端](./docs/design/移动端-02-产品预览.png) |
| 3. 产品视频方案 | 分析参考拍法，生成按 Generation 分段的视频方案；可查看和选择版本 | [桌面端](./docs/design/07-第三步-产品视频方案.png) · [方案详情](./docs/design/08-方案查看器.png) |
| 4. 产品关键帧 | 编辑提示词，为各生成段制作、预览并选择关键帧图片版本 | [桌面端](./docs/design/09-第四步-产品关键帧.png) · [移动端](./docs/design/移动端-封面.png) |
| 5. 分镜视频 | 根据所选关键帧提交异步视频任务，查看状态并选择片段版本 | [桌面端](./docs/design/10-第五步-分镜视频.png) · [移动端](./docs/design/移动端-05-分镜视频.png) |
| 6. 成片与草稿 | 按分镜顺序合成 MP4、播放或下载成片；也可生成剪映草稿继续编辑 | [桌面端](./docs/design/11-第六步-完整视频与剪映草稿.png) · [移动端](./docs/design/移动端-06-完整视频与剪映草稿.png) |

各步骤保留已生成的版本和选择状态，刷新页面后可继续操作。批量生成**只进行到分镜视频**，最终成片需要进入对应作品单独合成。AI 生成效果与可用性取决于所配置的模型服务；剪映草稿还依赖外部草稿服务。

## 本地运行

### 环境要求

- Node.js **22.13.0 或更高版本**、npm。
- FFmpeg 与 FFprobe（抽帧、媒体探测和成片合成需要）。
- 如需执行 AI 生成：可用的多模态、生图和视频模型服务。

```bash
git clone https://gitee.com/alinec/ai-product-reel.git
cd ai-product-reel
npm ci
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。进入“模型”页面配置模型 ID、Base URL 和 API Key，并分别测试连接。仅浏览界面与管理本地素材时，无须先调用付费模型。

### 环境变量

| 变量 | 用途 |
| --- | --- |
| `SQLITE_PATH` | 可选；SQLite 文件路径，默认 `.data/ai-product-reel.sqlite` |
| `FFMPEG_PATH` / `FFPROBE_PATH` | 可选；自定义可执行文件路径，默认从系统 PATH 查找 |
| `CAPCUT_MATE_BASE_URL` | 剪映草稿服务地址；示例值见 `.env.example` |
| `CAPCUT_MATE_API_KEY` | 草稿服务启用鉴权时使用的密钥 |
| `DRAFT_ASSET_BASE_URL` | 草稿服务读取本地素材的地址；远程服务需要可访问的公网地址 |

模型配置在应用“模型”页面填写并保存在本地 SQLite。不要将真实密钥、`.env.local` 或 `.data/` 提交到仓库。远程草稿服务通常无法访问 `localhost`，需要正确配置 `DRAFT_ASSET_BASE_URL`。

### 第一次制作

1. 在“素材”中创建参考视频组，上传参考视频；再创建关联的产品图片组并上传产品图片。
2. 在“作品”中创建作品，进入六步工作台。
3. 按页面顺序生成并检查两类预览图、视频方案、关键帧和分镜视频；有多个版本时选择要用于下一步的版本。
4. 为每段选择完成的视频后合成成片；需要二次编辑时再生成剪映草稿。

## 技术实现与目录

| 层次 | 实现 |
| --- | --- |
| 页面与接口 | Next.js 16 App Router、React 19、TypeScript |
| UI | Tailwind CSS、shadcn/ui、Base UI |
| 数据持久化 | SQLite、better-sqlite3；作品、素材、任务与版本保存在本地 |
| AI 能力 | 多模态分析与方案、生图、异步视频生成 |
| 媒体处理 | FFmpeg / FFprobe 抽帧、探测与成片合成 |
| 代码检查 | Oxlint、Oxfmt |

```text
app/page.tsx                页面与六步工作台
app/api/                   作品、素材、模型和生成结果接口
db/schema.ts               SQLite 表结构
lib/database.ts            数据库连接
lib/ffmpeg.ts              媒体处理
lib/*-prompt.ts            各生成阶段的提示词
components/ui/             通用界面组件
docs/需求文档.md            功能需求与验收要点
docs/design/README.md      真实运行界面截图索引
```

常用命令：

```bash
npm run dev       # 开发服务器
npm run lint      # 静态检查
npm run build     # 生产构建
npm run start     # 启动生产构建
npm run format    # 格式化
```

## 用于 Vibe Coding / Codex

建议按 [需求文档的模块与验收要点](./docs/需求文档.md) 逐个完成闭环，并用 [真实界面截图](./docs/design/README.md) 对照交互与页面状态。修改 Next.js 代码前，先阅读 `AGENTS.md` 和本仓库 `node_modules/next/dist/docs/` 中的相关指南。

仓库提供 `ai-product-reel-next-step` Skill，可基于实际代码和 Git 状态推荐一个可验证的下一步任务：

```text
$ai-product-reel-next-step 检查当前项目进度并告诉我下一步该做什么。
```

它默认只检查与建议；开发、提交、推送或付费模型调用应分别明确提出。完成改动后至少检查 `git diff --check`、`npm run lint` 和 `npm run build`，并核对对应功能的用户行为。

## 当前范围与注意事项

本项目面向单用户本地运行与教学验证，不是开箱即用的多用户生产服务。账号体系、团队协作、云同步和支付不在当前范围内。公网部署前需要补充身份认证、权限控制、上传与远程下载防护，并评估将大量媒体从单机 SQLite 迁移到对象存储与任务队列。

项目地址：[码云](https://gitee.com/alinec/ai-product-reel) · [GitHub](https://github.com/laohan-repos/ai-product-reel)
