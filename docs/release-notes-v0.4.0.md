# ComfyUI WebUI Prompt Bridge v0.4.0

这是一次较大的功能更新。Bridge 主节点现在更像一个 WebUI 风格的提示词工作台：默认界面更干净，常用功能直接内置，高级功能可以按需打开，并且可以一键构建对应的外置节点。

## 更新内容

- 默认界面更清爽：新节点默认显示基础提示词操作、模型切换、尺寸快捷、布局预设和 LoRA 浏览区；区域控制、Styles 和高级模块默认隐藏，需要时可以在 `设置` 中打开。
- 设置窗口更宽、更清晰：设置内容按数据/翻译、布局/显示、主节点功能、高级扩展和 WebUI/AI 分组，底部按钮不会再挤到看不清。
- 主节点直接内置更多常用能力：Prompt / Negative、LoRA 加载、Styles、区域提示词文本、区域 conditioning、负向 Common、区域翻转、区域 Preset、模型切换、尺寸、布局和显示隐藏都可以在 Bridge 节点内完成。
- 高级扩展按需使用：ADetailer、ControlNet、SAM/Inpaint、Mask 区域、放大修复和区域 LoRA 提示都可以在设置里单独显示或隐藏。
- 新增一键构建外置节点：打开高级模块后，可以在侧栏点击 `一键构建...节点`，Bridge 会自动创建对应外置节点，并连接 `module_config`、`positive`、`negative`、`model`、`clip` 等已知输出。
- 构建提示更清楚：成功会显示自动连接了几条线；如果输入口已经被占用，会提示“输入已被占用，未覆盖”；如果节点类型不存在，会提示检查后端是否加载并重启 ComfyUI。
- 新增可实际参与工作流的后端节点：ControlNet Apply、Image Upscale、Latent Upscale、Set Latent Mask、ADetailer Conditioning/Apply、Inpaint Conditioning。
- 高级扩展下载更克制：Impact Pack、Impact Subpack、ControlNet Aux、SAM 和 Ultimate SD Upscale 都是按需下载，不会默认一次全部安装。
- 侧边栏显示更稳定：隐藏/显示侧边栏不会再强行压缩提示词区域；新建节点默认打开侧栏，旧节点保存过的折叠状态不会污染新节点。
- 布局预设更可靠：宽松布局更高，更适合查看长提示词和 LoRA；切换预设时会清理旧高度缓存，减少旧设置覆盖新布局的问题。
- 工作流示例已同步：推荐 Anima 工作流和 3 个最小教程工作流都补齐了新 Bridge 输入和 `module_config` 输出。
- 节点更容易搜索：可以在节点库里搜索 `webui`、`prompt bridge`、`区域提示词`、`ADetailer`、`ControlNet`、`Hires fix` 等关键词找到对应节点。

## 使用提示

- 只想保持基础生图体验时，不需要打开高级模块；默认状态已经可以正常使用 Prompt、Negative、LoRA、模型切换、尺寸和布局预设。
- 想使用脸部、手部或人物局部细节修复时，在设置里显示 `ADetailer` 模块，再使用一键构建外置节点。ADetailer 主要用于脸、手和人物局部的细节增强。
- 想使用 ControlNet、SAM 或放大修复时，先在设置里显示对应模块；如果侧栏提示缺少外部扩展，可以在高级扩展下载区域按需安装，安装后重启 ComfyUI。
- 一键构建不会覆盖你已经接好的输入线。如果提示“输入已被占用，未覆盖”，说明目标输入口已经有线，需要你手动确认是否替换。

## 兼容性

- 旧工作流没有新字段时仍会按默认值处理，高级模块默认关闭，不会自动改变原有生图链路。
- 仓库内置的推荐工作流和最小教程工作流已经同步到 v0.4.0 的 Bridge 节点结构。
- 完整 Anima 推荐工作流仍然需要它原本依赖的外部节点包，例如 Impact Pack、ControlNet Aux、rgthree/Set/Get 类节点和 Advanced ControlNet。

## Comfy Registry

本版本将 `pyproject.toml` 版本更新为 `0.4.0`，并保留现有 `[tool.comfy]` 注册元数据。推送到 `main` 后，仓库中的 `Publish to Comfy Registry` GitHub Action 会触发 Comfy Registry 发布。

## 验证

- 后端语法检查通过：`python -m py_compile nodes.py`
- 前端语法检查通过：`node --check web/webui_prompt_bridge.js`
- 设置接口返回默认 `ui_visibility`，旧配置缺字段时会自动补齐默认值。
- 高级模块关闭时，Bridge 主节点基础文生图成功。
- XL 最小文生图示例成功生成图片。
- XL 图生图示例成功生成图片。
- 一键构建放大修复节点成功创建外置节点并连接 Bridge 输出。
- 模拟接口占用时会显示“输入已被占用，未覆盖”提示。
- 模拟节点缺失时会显示红色错误提示，提醒检查后端加载并重启 ComfyUI。

## 升级提示

更新后请重启 ComfyUI，并强制刷新浏览器页面，确保前端扩展脚本和节点搜索索引都加载到最新版本。
