---
name: zhihu-answerer
description: 给定知乎问题链接后自动完成题面理解、原创回答生成并直接发布。用于用户只提供知乎问题 URL（可选风格或长度要求）时执行端到端流程；发布时固定从 ~/.config/zhihu_cookie.txt 读取登录态 Cookie。
---

# Zhihu Auto Answerer

## 输入要求

最小输入：
- 目标问题 URL（`https://www.zhihu.com/question/...`）

可选输入：
- 语气/风格偏好（理性分析、轻松口语、强观点等）
- 长度偏好（短答、中等、长答）
- 其他写作约束（如是否给一句话总结）

## 执行流程

1. 抓取并理解题面：标题、题主补充、话题标签、问题语境。
2. 按 `references/zhihu-quality-playbook.md` 先确定写作策略：导语、结构、论证、话题适配与合规边界。
3. 依据 `references/answer-framework.md` 生成结构完整、可发布的原创正文。
4. 依据 `references/originality-checklist.md` 与 `references/zhihu-quality-playbook.md` 的“出稿质量闸门”做发布前自检，改写高相似或低信息密度段落。
5. 若问题属于高风险领域（医疗/法律/投资等），必须加入边界说明与“咨询专业人士/以当地法规为准”提示。
6. 运行 `scripts/post_answer_playwright.js`，传入 URL、正文，并固定使用 `--mode publish` 直接发布。
7. 脚本从 `~/.config/zhihu_cookie.txt` 读取 Cookie，先校验登录态，再执行写入并发布。
8. 校验 `POST /api/v4/content/publish` 成功，输出结果 JSON（`ok`、`publishVerified`、`finalUrl` 等）。

## 写作规则

- 必须使用“信息流两行导语 + 开门见山给结论 + 分段论证 + 落地清单 + 边界声明”结构。
- 以题面问题为中心，优先信息价值、判断价值、情绪价值三者平衡。
- 提供可验证事实、机制解释和可执行建议，避免只给观点不给论据。
- 保持真诚、克制、可讨论，不使用攻击性措辞。
- 争议问题至少包含 1 段反方观点与回应，避免单边叙事。
- 避免模板化口头禅（如“先说结论”“先给结论”），直接自然陈述核心判断。
- 结尾互动为可选项：仅在确实有助于补充条件或推进讨论时使用，不强制每篇都加。

## 安全要求

- 不要求用户直接粘贴 Cookie 字符串。
- 仅从本地文件 `~/.config/zhihu_cookie.txt` 读取 Cookie。
- 不在日志中打印完整 Cookie。
- 不将 Cookie 写入仓库文件。
- 默认直接发布（`publish`），不走草稿分支。

## 失败处理

- 若 Cookie 文件不存在或为空，立即报错并停止。
- 若检测到未登录或 Cookie 失效，立即报错并停止。
- 若按钮文案或 DOM 结构变化，输出失败原因并提示更新选择器。
- 若发布请求未触发或返回非 2xx，返回错误并停止。
- 若商品链接未匹配到卡片，记录跳过原因并继续发布。

## 参考文件

- 知乎写作方法论：`references/zhihu-quality-playbook.md`
- 写作结构模板：`references/answer-framework.md`
- 原创与查重自检：`references/originality-checklist.md`
- Cookie 文件格式：`references/cookie-format.md`
- 运行示例：`references/runbook.md`
