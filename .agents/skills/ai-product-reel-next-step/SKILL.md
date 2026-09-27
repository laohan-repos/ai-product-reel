---
name: ai-product-reel-next-step
description: Inspect AI Product Reel's real repository state and recommend the single next verifiable development loop. Use when the user asks what to build next, requests the next lesson or roadmap step, wants a progress check, or asks to continue this project's implementation. Do not use for unrelated repositories or ordinary requests that already specify a concrete task.
---

# AI Product Reel Next Step

Guide the next decision from evidence, not from filenames or an assumed lesson position.

## Scope

This skill has two behaviors:

- **Advise:** Default for requests such as “下一步做什么”, “检查进度”, or “课程该讲哪一步”. Inspect and recommend, but do not edit files.
- **Continue:** When the user explicitly asks to implement, fix, or complete the next step, first identify the step and then execute only that bounded loop. Do not interpret “tell me the next step” as permission to modify code, commit, push, deploy, or call paid model APIs.

Use **course order** when the user mentions teaching, learning, lessons, or following the implementation order in `docs/需求文档.md`. Otherwise use **project priority**.

## Evidence to inspect

Start with the smallest read-only inspection that can support the decision:

1. Read the repository `AGENTS.md` completely.
2. Inspect `git status --short --branch` and recent commit subjects.
3. Read the relevant module and acceptance points in `docs/需求文档.md`; for course order, also read its suggested implementation order.
4. For UI work, inspect the current page and relevant design images when needed.
5. Inspect the implementation, package scripts, tests, and configuration that provide evidence for that stage.
6. Run a focused check when its result changes the recommendation. Do not run costly generation jobs or mutate data merely to diagnose progress.

If one of these files does not exist, continue with the remaining evidence and state the limitation. Do not create missing planning documents unless the user asks.

## Determine completion

Treat an item as complete only when observable evidence supports its acceptance criteria.

- A file, route, button, table, or function existing is not proof that the feature works.
- A successful build proves compilation, not runtime behavior.
- An unchecked or absent test means behavior is **unverified**, not necessarily missing.
- Commented-out UI, hard-coded sample data, and unreachable code do not count as completed product behavior.
- If the worktree contains a coherent unfinished change, finishing and validating that change normally comes before starting a new feature.
- Preserve user changes and distinguish them from repository baseline work.

Classify relevant requirements as:

- **Complete:** implementation and proportionate verification exist.
- **Partial:** meaningful implementation exists, but a required path or acceptance criterion is missing.
- **Unverified:** implementation appears present, but the required evidence has not been produced.
- **Blocked:** completion needs user input, credentials, unavailable services, or additional authority.
- **Not started:** no meaningful implementation evidence exists.

## Select one next loop

Recommend exactly one smallest coherent loop that can end in a useful Git commit.

In **course order**:

1. Find the earliest module in the suggested implementation order that is not complete.
2. Within it, choose the smallest missing user-visible or data-integrity loop.
3. Do not move to the next stage until the current stage's required acceptance criteria are satisfied or explicitly deferred by the user.

In **project priority** apply this order:

1. The user's explicit current objective.
2. A broken build, destructive defect, exposed secret, or serious data-integrity risk.
3. The current unfinished worktree task.
4. A partial core user flow.
5. Missing verification for a flow that appears complete.
6. The next documented capability.
7. Optional polish or expansion.

Prefer a vertical loop such as “rename a workflow through UI, API, persistence, and error handling” over a horizontal task such as “create all remaining database tables”.

Do not recommend broad tasks like “finish the frontend”, “improve security”, or “add tests”. Name the exact behavior, boundary, and evidence of completion.

## Next.js constraint

Before recommending or implementing a Next.js change, account for the repository rule that this version may differ from prior knowledge. When implementation is requested, read the relevant guide in `node_modules/next/dist/docs/` before editing. Include that reading step in a generated Codex task when the next loop touches Next.js.

## Response contract

Keep the answer compact enough to act on. Use this structure:

```markdown
## 当前判断

当前阶段或优先级，以及 Complete / Partial / Unverified / Blocked 状态。

证据：
- 具体文件、Git 状态、测试或命令结果。

## 下一步

一个明确的开发闭环。

为什么现在做：一句到三句。

涉及范围：
- 预计涉及的真实文件或模块。

验收标准：
1. 可观察的用户行为。
2. 数据或错误处理要求。
3. 必须通过的验证。

## 给 Codex 的任务

一段可直接复制的任务提示词，包含范围、保持不变的行为、验收标准和验证命令。
```

Omit empty sections. If evidence is insufficient, say which status is unverified and recommend the smallest diagnostic action instead of guessing.

## When implementing

If the user explicitly authorizes implementation:

1. State the selected loop briefly.
2. Follow `AGENTS.md` and relevant repository documentation.
3. Implement only that loop and preserve unrelated changes.
4. Verify in proportion to risk.
5. Report what changed, what passed, and what remains unverified.

Do not commit, push, deploy, delete material data, or use paid external generation services unless the user separately authorizes that action.
