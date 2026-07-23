# ComfyUI WebUI Prompt Bridge v0.2.4

这是一个面向 LoRA 生效判断的补丁更新。

## 修复内容

- **LoRA 匹配不再等于生效**：界面现在会区分“找到 LoRA 文件”和“LoRA 已进入采样器模型链路”。
- **内置 LoRA 加载说明更清楚**：不需要额外连接 LoRA Loader；只要 `<lora:name:weight>` 能匹配到文件，节点会在后端调用 ComfyUI 的 LoRA 加载逻辑。
- **接线错误会拦截**：如果提示词里有 LoRA，但 `WebUIPromptBridge` 的 `model` 输出没有接到采样器实际使用的模型链路，前端会提示并阻止提交。
- **修复异步覆盖误报**：LoRA metadata 检测回来后，不会再把“model 输出未接”的警告覆盖成“匹配 sdxl/noob”。
- **后端日志更明确**：实际应用、上游已加载、缺失 LoRA、以及 model 输出未接都会写入更清楚的日志或 `lora_info`。

## 正确接法

使用内置 LoRA 加载时，需要保证：

- `WebUIPromptBridge` 的 `model` / `clip` 输入接了基础模型。
- Prompt 或 Negative prompt 里有 `<lora:name:weight>`。
- `WebUIPromptBridge` 的 `model` 输出接到采样器实际使用的模型链路。
- `positive` / `negative` conditioning 输出接到采样器。

如果你已经在上游使用 LoRA Loader，节点会识别上游 LoRA，避免重复加载同一个 LoRA。

## 升级提示

更新后请重启 ComfyUI，并强制刷新浏览器页面，确保前端扩展脚本重新加载。
