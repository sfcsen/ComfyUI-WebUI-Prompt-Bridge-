# ComfyUI WebUI Prompt Bridge

![ComfyUI WebUI Prompt Bridge workflow](docs/images/webui-prompt-bridge-workflow.png)

**ComfyUI WebUI Prompt Bridge** brings WebUI-style prompt editing into ComfyUI: visual tag chips, Chinese-to-English prompt translation, autocomplete, favorites, styles, prompt history, LoRA tag parsing and real LoRA application through the ComfyUI model / CLIP path.

It is built for anime and Anima workflows where prompt speed matters: type naturally, translate quickly, organize tags visually, confirm LoRAs are actually loaded, then generate without leaving the graph.

## Node Preview

![WebUI Prompt Bridge node close-up](docs/images/webui-prompt-bridge-node-panel.png)

The node acts like a prompt control panel rather than a plain multiline textbox:

- Write Chinese or English prompts and translate them into model-friendly English.
- Split prompts into editable chips with copy, disable, delete, weight and drag reorder controls.
- Browse WebUI-style grouped tags, favorites, history, negative prompts and styles.
- Use autocomplete data from TagComplete when a WebUI install is connected.
- Parse `<lora:name:weight>` tags, detect missing LoRAs and apply valid LoRAs to model and CLIP.

## 中文简介

**ComfyUI WebUI Prompt Bridge** 是一个把 WebUI 式提示词编辑体验移植到 ComfyUI 的自定义节点。它把中文自动翻译、Tag 自动补全、提示词分块编辑、收藏、历史记录、样式管理、LoRA 检测和 LoRA 实际加载整合在一个节点里。

它适合二次元、Anima 和大量 Tag 操作的工作流：你可以直接输入中文自然语言，自动转成英文提示词；也可以像 WebUI 一样点选分类标签、收藏常用提示词、整理负面词，并确认 LoRA 是否真实生效。

## Recommended Workflow

This repository includes a recommended Anima workflow:

```text
workflows/anima-webui-prompt-bridge.json
```

The workflow is designed as a full Anima production graph around this node:

- **Prompt cockpit**: one WebUI Prompt Bridge node controls positive prompt, negative prompt, styles, favorites, translation and LoRA tags.
- **Anima base generation**: Anima model, text encoder and VAE are wired into the prompt bridge and sampler.
- **Model switch**: one lazy switch can choose either Anima/Qwen split loaders or a full `CheckpointLoaderSimple` model.
- **HiRes switch**: optional latent upscale and second-pass denoise for cleaner details.
- **Face and hand detailers**: optional repair branches for portraits and character images.
- **Multiple upscale outputs**: model upscale, pixel scale, target megapixel and fixed-size output controls.
- **Reference and pose control**: optional reference image, DWPose / OpenPose / Canny / lineart preprocessors and Qwen Union pose LoRA path.
- **Clean control panel**: width, height, batch size, HiRes scale, denoise strength, hand threshold and output sizing are exposed as editable controls.

![Anima workflow model switch](docs/images/anima-model-switch-panel.png)

Recommended use:

1. Install this custom node.
2. Import `workflows/anima-webui-prompt-bridge.json` into ComfyUI.
3. Place required models in your own ComfyUI model folders.
4. Start from the prompt bridge node, then enable HiRes, detailers, pose or upscale branches only when needed.

Required model names used by the example workflow:

- `anima_baseV10.safetensors`
- `anima_baseV10_txt.safetensors`
- `qwen_image_vae.safetensors`
- Optional full checkpoint branch: `Qwen-Rapid-AIO-NSFW-v16.safetensors`, or any compatible SD1.5 / SDXL / Pony / Illustrious checkpoint in your own model folder.
- `RealESRGAN_x4plus_anime_6B.pth`
- Optional: `qwen_image_union_diffsynth_lora.safetensors`
- Optional DWPose / ControlNet aux detector files such as `yolox_l.torchscript.pt`

Models and LoRAs are **not** included in this repository. Check each model license before redistribution.

Verified locally:

- Split Anima/Qwen mode generated successfully.
- Full checkpoint mode generated successfully with `Qwen-Rapid-AIO-NSFW-v16.safetensors`.

## Install

Clone into `ComfyUI/custom_nodes`:

```bash
git clone https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge.git
```

Install requirements if your ComfyUI environment does not already include them:

```bash
pip install -r ComfyUI-WebUI-Prompt-Bridge/requirements.txt
```

Restart ComfyUI, then add:

```text
conditioning/webui -> WebUI Prompt Bridge
```

## Optional WebUI Data Bridge

For the full WebUI-like experience, point the node to an existing AUTOMATIC1111 WebUI folder with these extensions installed:

- `sd-webui-prompt-all-in-one`
- `a1111-sd-webui-tagcomplete`

Copy `config.local.example.json` to `config.local.json` and edit the paths:

```json
{
  "webui_root": "X:/path/to/stable-diffusion-webui",
  "prompt_all_in_one_dir": "X:/path/to/stable-diffusion-webui/extensions/sd-webui-prompt-all-in-one",
  "tagcomplete_dir": "X:/path/to/stable-diffusion-webui/extensions/a1111-sd-webui-tagcomplete",
  "webui_python_site_packages": "X:/path/to/stable-diffusion-webui/python/Lib/site-packages",
  "styles_file": "X:/path/to/stable-diffusion-webui/styles.csv"
}
```

`config.local.json` is ignored by git so private local paths are not published.

## LoRA Behavior

The node removes LoRA tags from the final text prompt, resolves them against ComfyUI's `loras` folder, and applies them through ComfyUI's LoRA loader API.

Example:

```text
1girl, blue dress, standing by the sea, <lora:my-style-lora:0.75>
```

If `fail_on_missing_lora` is enabled, generation stops when a referenced LoRA is not found. This avoids silent LoRA failures.

## RunningHub Publishing Notes

To publish the recommended workflow on RunningHub:

1. Import `workflows/anima-webui-prompt-bridge.json` into a RunningHub ComfyUI workspace.
2. Install or map this custom node and all required dependency nodes.
3. Upload or select the required Anima, VAE, upscaler, LoRA and detector models according to their licenses.
4. Run the workflow successfully once inside RunningHub.
5. Save it as a reusable workflow or app.
6. Add a clear cover image, node close-up screenshot, model dependency list, and usage notes.
7. Publish it from RunningHub's workflow/app publish entry.

Suggested RunningHub title:

```text
Anima WebUI Prompt Bridge - Chinese Prompt, LoRA, HiRes, Pose and Upscale Workflow
```

Suggested short description:

```text
A full Anima workflow with WebUI-style prompt editing, Chinese-to-English prompt translation, autocomplete, LoRA validation, HiRes, detailers, pose/reference control and multiple upscale modes.
```

## License

MIT. See `LICENSE`.
