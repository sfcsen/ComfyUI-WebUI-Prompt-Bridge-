# ComfyUI WebUI Prompt Bridge v0.1.8

这版主要面向新用户和没有 WebUI 的 ComfyUI 用户：现在不接 A1111 / Forge WebUI 也能先用起来。

## 主要更新

- 新增首次启动向导：`连接 WebUI`、`使用内置数据`、`导入词库` 三个入口。
- 新增无 WebUI 独立模式：内置基础 tag 分类、自动补全、常用反向词和简单中英映射。
- 新增集中设置面板：统一管理数据来源、翻译来源、布局尺寸、Tag 显示方式和 LoRA 卡片大小。
- 新增词库导入：支持从 JSON / CSV / TSV 导入自己的 tag 映射。
- 新增配套数据补齐：已有 WebUI 和扩展时不会重复下载；WebUI 缺扩展时只补齐缺失项；没有 WebUI 时可下载本地数据包到节点 `data` 目录直接使用。

## 怎么选择

- 已经有 WebUI，并且装过 Prompt All in One / TagComplete：直接点 `一键接入 WebUI`。
- 有 WebUI，但缺 Prompt All in One 或 TagComplete：点 `补齐缺失扩展`。
- 没有 WebUI：点 `使用内置数据`，或在 `设置` 里点 `下载本地数据包` 获取更完整词库。
- 有自己的词库：点 `导入词库`，导入 JSON / CSV / TSV。

## 注意

更新后请重启 ComfyUI，让新的后端接口加载完成。如果页面已经打开，重启后再刷新浏览器页面。
