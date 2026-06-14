# ComfyUI WebUI Prompt Bridge v0.4.2

这一版修复多人提示词编辑时的换行格式问题。

## 更新内容

- 提示词 tag 编辑会保留换行/空行分隔，删除、拖拽、改权重后不会把多人提示词压成一行。
- tag 分块里新增 `↵ / 换行符` 分块，能直观看到提示词里的真实换行。
- 点击 `换行符` 分块可以删除该换行。
- tag 工具条里的 `↵` 按钮现在会真正把当前位置改成换行分隔。
- 换行符分块使用独立文案和样式，不会再显示成相邻 tag 的中文名。

## 验证

- `node --check web/webui_prompt_bridge.js`
- 通过 ComfyUI API 使用 `WebUIPromptBridge` 节点提交多组带真实换行的多人提示词。
- ComfyUI 历史记录确认 `positive_prompt` 保留 `\n`。
- 使用 `waiNSFWIllustrious_v140.safetensors` 成功生成多张多人测试图。

## Comfy Registry

本版本将 `pyproject.toml` 版本更新为 `0.4.2`，并保留现有 `[tool.comfy]` 注册元数据。推送到 `main` 后，仓库中的 `Publish to Comfy Registry` GitHub Action 会触发 Comfy Registry 发布。
