# ComfyUI WebUI Prompt Bridge v0.4.3

This release improves prompt editing, adds image-to-image and inpaint support inside the main node, expands the prompt market, and makes onboarding clearer for new users.

## Prompt Editing

- Prompt tag editing now preserves line breaks and blank lines.
- Deleting, dragging, or changing tag weights no longer collapses multi-character or multi-region prompts into one line.
- Line breaks now appear as visible `↵ / 换行符` blocks in the tag area.
- Clicking a line-break block removes that line break.
- The toolbar `↵` button now inserts a real line break at the current position.
- Line-break blocks use their own label and style, so they no longer display the translated name of nearby tags.

## Image-to-image and Inpaint

- Image-to-image and inpaint can now be used directly from the main WebUI Prompt Bridge node.
- Images can be uploaded in the node sidebar, previewed immediately, and explicitly enabled for generation.
- Inpaint masks can be painted inside the node with the built-in mask editor.
- The node now outputs `image`, `mask`, `img2img_denoise`, and `img2img_mode` for custom workflows.
- A one-click image-to-image wiring button can create the right VAE Encode chain and connect it to KSampler `latent_image`.

## First-time Tutorial

- A guided tutorial appears the first time the main node is added.
- The tutorial explains the main node outputs, LoRA area, image-to-image, inpaint, advanced modules, and common connection mistakes.
- Tutorial behavior can be changed in settings: show once, show every time, disable automatic display, reset first-time status, or open manually.

## Prompt Market

The prompt market now includes more importable and browsable sources:

- TagComplete Danbooru + e621 merged tags
- TagComplete e621 SFW anthropomorphic tags
- e621 NSFW zero-filter tags
- e621 NSFW light-filter tags
- TagComplete Derpibooru character tags
- Krea / Open Prompts full prompt examples
- PromptHero, Civitai, Lexica, OpenArt, and DiffusionDB browsing entries

NSFW sources are split into two choices:

- Zero-filter: imports more of the original source order.
- Light-filter: keeps common NSFW tags while excluding more extreme or disputed terms.

## Improvements

- Resource downloads and extension checks now show clearer in-window progress, success, and failure states.
- Uploaded images now use the correct ComfyUI input preview path, fixing preview load failures.
- Image-to-image input has an explicit enable switch, so uploaded images are not used accidentally.
- The tutorial explains the most common image-to-image issue: uploaded images only affect generation after the image/mask chain is connected to KSampler `latent_image`.

## Validation

- JavaScript syntax check passed.
- Python syntax check passed.
- Prompt line-break editing was tested through the ComfyUI API.
- Image-to-image and inpaint were tested with Bridge image/mask outputs connected into the KSampler latent chain.
- Prompt market sources were loaded from the local ComfyUI endpoint and the new e621 / Krea sources were parsed successfully.

## Upgrade Notes

Restart ComfyUI after updating, then hard-refresh the browser page.

For image-to-image or inpaint, open Settings, enable `图生图 / 局部重绘`, upload an image, then click `一键接入图生图链路` to connect the workflow automatically.

This version keeps the existing `[tool.comfy]` registry metadata and updates the package version to `0.4.3`.
