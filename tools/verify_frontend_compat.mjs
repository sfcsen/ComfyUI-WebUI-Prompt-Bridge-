import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const comfyRoot = path.resolve(repoRoot, "..", "..");
const defaultBaseUrl = "http://127.0.0.1:8188";
const switchIds = [10, 15, 19, 24, 40, 47, 196, 197, 198];
const rightColumnIds = [6, 8, 9, 11, 199, 200, 201, 202, 221];
const customLayoutIds = [];
const oldSwitchPositions = new Map([
    [10, [1040, 60]],
    [15, [1040, 155]],
    [19, [1040, 250]],
    [24, [1040, 345]],
    [40, [1040, 440]],
    [47, [1040, 535]],
    [196, [1040, 660]],
    [197, [1040, 755]],
    [198, [1040, 850]],
]);
const oldRightPositions = new Map([
    [6, [1390, 60]],
    [8, [1760, 60]],
    [9, [1760, 590]],
    [11, [1380, 40]],
    [63, [1298, 106]],
    [73, [1298, 201]],
    [79, [1298, 296]],
    [85, [1298, 391]],
    [108, [1298, 486]],
    [120, [1298, 581]],
    [199, [1420, 660]],
    [200, [1420, 755]],
    [201, [1420, 850]],
    [202, [1685, 850]],
    [221, [1420, 945]],
]);
customLayoutIds.push(...new Set([...switchIds, ...rightColumnIds, ...oldRightPositions.keys()]));

function parseArgs() {
    const options = {
        baseUrl: process.env.COMFYUI_URL || defaultBaseUrl,
        queue: false,
        headed: false,
    };
    for (const arg of process.argv.slice(2)) {
        if (arg === "--queue") {
            options.queue = true;
        } else if (arg === "--headed") {
            options.headed = true;
        } else if (arg.startsWith("--url=")) {
            options.baseUrl = arg.slice("--url=".length);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    return options;
}

async function importPlaywright() {
    const candidates = [
        "playwright",
        process.env.PLAYWRIGHT_IMPORT,
        "C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright/index.mjs",
        "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
    ].filter(Boolean);
    const errors = [];
    for (const candidate of candidates) {
        try {
            if (/^[A-Za-z]:[\\/]/.test(candidate)) {
                await access(candidate);
                return await import(pathToFileURL(candidate).href);
            }
            return await import(candidate);
        } catch (error) {
            errors.push(`${candidate}: ${error.message}`);
        }
    }
    throw new Error(`Unable to import Playwright. Tried:\n${errors.join("\n")}`);
}

function assert(condition, message, details = null) {
    if (!condition) {
        const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : "";
        throw new Error(`${message}${suffix}`);
    }
}

function workflowPositions(workflow, ids) {
    const positions = {};
    for (const id of ids) {
        const node = workflow.nodes?.find((item) => item.id === id);
        positions[id] = node?.pos ? Array.from(node.pos) : null;
    }
    return positions;
}

function changedPositions(before, after, ids) {
    const changes = [];
    for (const id of ids) {
        const from = before?.[id];
        const to = after?.[id];
        if (!Array.isArray(from) || !Array.isArray(to) || from.length < 2 || to.length < 2 ||
            Math.abs(from[0] - to[0]) > 0.5 || Math.abs(from[1] - to[1]) > 0.5) {
            changes.push({ id, before: from ?? null, after: to ?? null });
        }
    }
    return changes;
}

async function graphPositions(page, ids) {
    return await page.evaluate((nodeIds) => {
        const positions = {};
        for (const id of nodeIds) {
            const node = window.app.graph.getNodeById(id);
            positions[id] = node?.pos ? Array.from(node.pos) : null;
        }
        return positions;
    }, ids);
}

async function dragElementCenter(page, selector, deltaY, nth = 0) {
    const box = await page.evaluate(({ selector, nth }) => {
        const element = [...document.querySelectorAll(selector)][nth];
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            width: rect.width,
            height: rect.height,
            text: element.textContent || "",
        };
    }, { selector, nth });
    assert(box, `Could not find draggable element ${selector}`, { selector, nth });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x, box.y + deltaY, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    return box;
}

async function bridgeBottomBlankMetrics(page, label = "metrics") {
    return await page.evaluate((metricLabel) => {
        const panel = document.querySelector(".webui-bridge-panel");
        const topRow = document.querySelector(".webui-bridge-toprow");
        const extra = document.querySelector(".webui-bridge-extra");
        const splitter = document.querySelector(".webui-bridge-panel-splitter");
        const rect = (element) => {
            if (!element) return null;
            const item = element.getBoundingClientRect();
            return {
                top: item.top,
                bottom: item.bottom,
                height: item.height,
            };
        };
        return {
            label: metricLabel,
            blankBelowExtra: panel && extra ? panel.getBoundingClientRect().bottom - extra.getBoundingClientRect().bottom - 8 : null,
            panel: rect(panel),
            topRow: rect(topRow),
            splitter: rect(splitter),
            extra: rect(extra),
            nodeSize: Array.from(window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge")?.size || []),
        };
    }, label);
}

async function waitForComfy(page, baseUrl) {
    const response = await page.goto(`${baseUrl}/?webui_bridge_verify=${Date.now()}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
    });
    assert(response?.ok(), `ComfyUI did not return OK at ${baseUrl}`, {
        status: response?.status(),
    });
    await page.waitForFunction(() => Boolean(window.app?.graph && window.app?.canvas && window.LiteGraph), null, {
        timeout: 60000,
    });
}

async function loadWorkflow() {
    const workflowPath = path.join(repoRoot, "workflows", "anima-webui-prompt-bridge.json");
    return JSON.parse(await readFile(workflowPath, "utf8"));
}

function makeOldWorkflow(workflow) {
    const oldWorkflow = JSON.parse(JSON.stringify(workflow));
    delete oldWorkflow.extra;
    for (const node of oldWorkflow.nodes || []) {
        if (oldSwitchPositions.has(node.id)) node.pos = [...oldSwitchPositions.get(node.id)];
        if (oldRightPositions.has(node.id)) node.pos = [...oldRightPositions.get(node.id)];
        if (node.type === "WebUIPromptBridge" && Array.isArray(node.widgets_values)) {
            node.widgets_values = node.widgets_values.slice(0, 6);
        }
    }
    return oldWorkflow;
}

function makeCustomRightSideWorkflow(workflow) {
    const customWorkflow = JSON.parse(JSON.stringify(workflow));
    for (const node of customWorkflow.nodes || []) {
        if (switchIds.includes(node.id)) {
            node.pos = [1900, Number(node.pos?.[1]) || 60];
        } else if (oldRightPositions.has(node.id)) {
            const y = Number(node.pos?.[1]) || oldRightPositions.get(node.id)[1];
            const tiny = ["SetNode", "GetNode"].includes(String(node.type || "")) && Number(node.size?.[0] || 0) <= 90;
            node.pos = [tiny ? 2184 : 2400 + ((node.id % 4) * 90), y];
        } else if (rightColumnIds.includes(node.id)) {
            node.pos = [2400 + ((node.id % 4) * 90), Number(node.pos?.[1]) || 60];
        }
    }
    return customWorkflow;
}

async function screenshot(page, name) {
    const outDir = path.join(repoRoot, "output", "playwright");
    await mkdir(outDir, { recursive: true });
    const file = path.join(outDir, name);
    await page.screenshot({ path: file, fullPage: false });
    return file;
}

async function newComfyPage(browser, baseUrl, consoleMessages, viewport = { width: 1400, height: 1000 }) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("console", (message) => {
        consoleMessages.push({ type: message.type(), text: message.text() });
    });
    page.on("pageerror", (error) => {
        consoleMessages.push({ type: "pageerror", text: String(error?.stack || error) });
    });
    await waitForComfy(page, baseUrl);
    return { context, page };
}

async function clickSwitch(page, id) {
    const before = await page.evaluate((switchId) => {
        const node = window.app.graph.getNodeById(switchId);
        if (!node?.widgets?.[0]) throw new Error(`Missing switch widget ${switchId}`);
        node.widgets[0].value = false;
        if (Array.isArray(node.widgets_values)) node.widgets_values[0] = false;
        const canvasRect = document.querySelector("#graph-canvas").getBoundingClientRect();
        const graphPoint = [node.pos[0] + 80, node.pos[1] + (node.widgets[0].y || 26) + 9];
        const canvasPoint = window.app.canvas.convertOffsetToCanvas(graphPoint);
        const client = [canvasPoint[0] + canvasRect.left, canvasPoint[1] + canvasRect.top];
        const hit = window.app.graph.getNodeOnPos(graphPoint[0], graphPoint[1], null, 0);
        const dom = document.elementFromPoint(client[0], client[1]);
        return {
            title: node.title,
            value: node.widgets[0].value,
            client,
            graphHitId: hit?.id ?? null,
            graphHitType: hit?.type ?? null,
            dom: dom ? `${dom.tagName}.${String(dom.className || "").replace(/\s+/g, ".")}` : null,
        };
    }, id);
    await page.mouse.click(before.client[0], before.client[1]);
    await page.waitForTimeout(180);
    const after = await page.evaluate((switchId) => window.app.graph.getNodeById(switchId)?.widgets?.[0]?.value, id);
    return { id, ...before, after };
}

async function verifyBridgeDoesNotCancelCanvasWidgets(browser, baseUrl) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1200, height: 900 });
    try {
        await page.evaluate(() => {
            window.app.graph.clear();
            const bridge = window.LiteGraph.createNode("WebUIPromptBridge");
            bridge.id = 950000;
            bridge.pos = [60, 40];
            window.app.graph.add(bridge);
            const sw = window.LiteGraph.createNode("ImpactBoolean");
            sw.id = 950001;
            sw.title = "Switch beside bridge after fix";
            sw.pos = [1300, 120];
            window.app.graph.add(sw);
            window.app.canvas.ds.offset = [-820, 70];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForTimeout(2000);
        const results = [];
        for (const point of [[20, 35], [80, 35], [140, 35], [220, 35]]) {
            const result = await page.evaluate(([gxOff, gyOff]) => {
                const node = window.app.graph.getNodeById(950001);
                node.widgets[0].value = false;
                const canvasRect = document.querySelector("#graph-canvas").getBoundingClientRect();
                const graphPoint = [node.pos[0] + gxOff, node.pos[1] + gyOff];
                const canvasPoint = window.app.canvas.convertOffsetToCanvas(graphPoint);
                const client = [canvasPoint[0] + canvasRect.left, canvasPoint[1] + canvasRect.top];
                const hit = window.app.graph.getNodeOnPos(graphPoint[0], graphPoint[1], null, 0);
                return { client, graphHitId: hit?.id ?? null, before: node.widgets[0].value };
            }, point);
            await page.mouse.click(result.client[0], result.client[1]);
            await page.waitForTimeout(180);
            result.after = await page.evaluate(() => window.app.graph.getNodeById(950001).widgets[0].value);
            results.push(result);
        }
        await screenshot(page, "compat-minimal-with-bridge.png");
        const pointerCancelCount = consoleMessages.filter((message) => message.text.includes("Pointer cancel")).length;
        assert(results.every((result) => result.after === true), "ImpactBoolean did not toggle beside WebUIPromptBridge", results);
        assert(pointerCancelCount === 0, "Canvas pointer was canceled while clicking a normal widget", {
            pointerCancelCount,
        });
        return { toggles: results.length, pointerCancelCount };
    } finally {
        await context.close();
    }
}

async function verifyCommonWidgetCompatibility(browser, baseUrl) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1200, height: 900 });
    try {
        await page.evaluate(() => {
            window.app.graph.clear();
            const bridge = window.LiteGraph.createNode("WebUIPromptBridge");
            bridge.id = 960000;
            bridge.pos = [60, 40];
            window.app.graph.add(bridge);
            const specs = [
                ["ImpactBoolean", 960001, [1300, 100], false],
                ["BOOLConstant", 960002, [1300, 190], true],
                ["FloatConstant", 960003, [1300, 280], 0],
                ["INTConstant", 960004, [1300, 370], 0],
            ];
            for (const [type, id, pos, value] of specs) {
                const node = window.LiteGraph.createNode(type);
                if (!node) throw new Error(`Missing node type ${type}`);
                node.id = id;
                node.pos = pos;
                if (node.widgets?.[0]) node.widgets[0].value = value;
                if (Array.isArray(node.widgets_values)) node.widgets_values[0] = value;
                window.app.graph.add(node);
            }
            window.app.canvas.ds.offset = [-820, 70];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForTimeout(2000);
        const results = [];
        for (const id of [960001, 960002, 960003, 960004]) {
            const before = await page.evaluate((nodeId) => {
                const node = window.app.graph.getNodeById(nodeId);
                if (!node?.widgets?.[0]) throw new Error(`Missing widget for ${nodeId}`);
                const canvasRect = document.querySelector("#graph-canvas").getBoundingClientRect();
                const isNumber = node.widgets[0].type === "number";
                const graphPoint = [
                    node.pos[0] + (isNumber ? node.size[0] - 22 : Math.min(node.size[0] - 34, 232)),
                    node.pos[1] + 35,
                ];
                const canvasPoint = window.app.canvas.convertOffsetToCanvas(graphPoint);
                const client = [canvasPoint[0] + canvasRect.left, canvasPoint[1] + canvasRect.top];
                const hit = window.app.graph.getNodeOnPos(graphPoint[0], graphPoint[1], null, 0);
                return {
                    id: nodeId,
                    type: node.type,
                    widgetType: node.widgets[0].type,
                    before: node.widgets[0].value,
                    client,
                    graphHitId: hit?.id ?? null,
                };
            }, id);
            await page.mouse.click(before.client[0], before.client[1]);
            await page.waitForTimeout(220);
            before.after = await page.evaluate((nodeId) => window.app.graph.getNodeById(nodeId)?.widgets?.[0]?.value, id);
            results.push(before);
        }
        await screenshot(page, "compat-common-widget-clicks.png");
        const pointerCancelCount = consoleMessages.filter((message) => message.text.includes("Pointer cancel")).length;
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(results.every((result) => result.graphHitId === result.id), "Common widget click point is not owned by its node", results);
        assert(results.every((result) => result.after !== result.before), "A common widget did not respond to click beside WebUIPromptBridge", results);
        assert(pointerCancelCount === 0, "Pointer cancel appeared while clicking common widgets", {
            pointerCancelCount,
        });
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during common widget compatibility check", bridgeConsoleErrors);
        return {
            clickedWidgets: results.map((item) => `${item.type}:${item.widgetType}`),
            pointerCancelCount,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyFullWorkflowSwitches(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "anima-webui-prompt-bridge.json",
            });
        }, workflow);
        await page.waitForTimeout(2200);
        await page.evaluate(() => {
            window.app.canvas.ds.offset = [-820, 70];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.deselectAll?.();
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForTimeout(400);
        const results = [];
        for (const id of switchIds) results.push(await clickSwitch(page, id));
        await screenshot(page, "compat-full-workflow-switches.png");
        const pointerCancelCount = consoleMessages.filter((message) => message.text.includes("Pointer cancel")).length;
        assert(results.every((result) => result.graphHitId === result.id), "Switch click point is not owned by its switch node", results);
        assert(results.every((result) => result.after === true), "Not every workflow switch toggled to true", results);
        assert(pointerCancelCount === 0, "Pointer cancel appeared during full workflow switch clicking", {
            pointerCancelCount,
        });
        return { toggles: results.length, pointerCancelCount };
    } finally {
        await context.close();
    }
}

async function verifyCurrentWorkflowLayoutIdempotency(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages);
    const ids = [...switchIds, ...rightColumnIds];
    try {
        const expected = workflowPositions(workflow, ids);
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "current-layout-idempotency.json",
            });
        }, workflow);
        await page.waitForTimeout(2200);
        const afterInitialLoad = await graphPositions(page, ids);
        await page.evaluate(async () => {
            const graphData = window.app.graph.serialize();
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "current-layout-idempotency-reload.json",
            });
        });
        await page.waitForTimeout(2200);
        const afterReload = await graphPositions(page, ids);
        const changedFromWorkflow = changedPositions(expected, afterInitialLoad, ids);
        const changedAfterReload = changedPositions(afterInitialLoad, afterReload, ids);
        await screenshot(page, "compat-current-layout-idempotency.png");
        assert(changedFromWorkflow.length === 0, "Current workflow layout changed while loading", changedFromWorkflow);
        assert(changedAfterReload.length === 0, "Current workflow layout changed after a second load", changedAfterReload);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors while loading current workflow", bridgeConsoleErrors);
        return {
            checkedNodes: ids.length,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyCustomWorkflowLayoutPreserved(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages);
    const customWorkflow = makeCustomRightSideWorkflow(workflow);
    const expected = workflowPositions(customWorkflow, customLayoutIds);
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "custom-layout-preservation.json",
            });
        }, customWorkflow);
        await page.waitForTimeout(2600);
        const afterLoad = await graphPositions(page, customLayoutIds);
        const changedAfterLoad = changedPositions(expected, afterLoad, customLayoutIds);
        await page.evaluate(async () => {
            const graphData = window.app.graph.serialize();
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "custom-layout-preservation-reload.json",
            });
        });
        await page.waitForTimeout(2200);
        const afterReload = await graphPositions(page, customLayoutIds);
        const changedAfterReload = changedPositions(afterLoad, afterReload, customLayoutIds);
        await screenshot(page, "compat-custom-layout-preserved.png");
        assert(changedAfterLoad.length === 0, "Custom control-node layout changed while loading", changedAfterLoad);
        assert(changedAfterReload.length === 0, "Custom control-node layout changed after reload", changedAfterReload);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during custom layout preservation check", bridgeConsoleErrors);
        return {
            checkedNodes: customLayoutIds.length,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyBridgeUiErgonomics(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "ui-ergonomics.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3000);
        const scrollReport = await page.evaluate(() => {
            const prompts = document.querySelector(".webui-bridge-prompts");
            const positiveRow = document.querySelector(".webui-bridge-positive-prompt-row");
            const extra = document.querySelector(".webui-bridge-extra");
            if (!prompts || !positiveRow || !extra) {
                return { missing: { prompts: !prompts, positiveRow: !positiveRow, extra: !extra } };
            }
            const beforeTop = positiveRow.getBoundingClientRect().top;
            prompts.scrollTop = Math.min(220, prompts.scrollHeight - prompts.clientHeight);
            const afterTop = positiveRow.getBoundingClientRect().top;
            return {
                beforeTop,
                afterTop,
                movedBy: beforeTop - afterTop,
                promptsScrollableBy: prompts.scrollHeight - prompts.clientHeight,
                extraHeight: extra.getBoundingClientRect().height,
                extraMaxHeight: extra.__webuiBridgeMaxHeight || null,
            };
        });
        assert(!scrollReport.missing, "Bridge UI did not render expected prompt/LoRA regions", scrollReport);
        assert(scrollReport.promptsScrollableBy > 120, "Prompt column is not scrollable enough to verify wheel behavior", scrollReport);
        assert(scrollReport.movedBy > 80, "Positive prompt row stayed fixed while prompt column scrolled", scrollReport);
        assert(scrollReport.extraMaxHeight === 520, "LoRA inline max height was not capped at 520px", scrollReport);

        const collapseReport = await page.evaluate(() => {
            const prompts = document.querySelector(".webui-bridge-prompts");
            if (prompts) prompts.scrollTop = 0;
            const collapseButton = [...document.querySelectorAll(".webui-bridge-collapse-btn")]
                .find((button) => /折叠反向|展开反向/.test(button.textContent || ""));
            if (!collapseButton) return { missingCollapseButton: true };
            if ((collapseButton.textContent || "").includes("折叠")) collapseButton.click();
            return { clicked: true };
        });
        assert(!collapseReport.missingCollapseButton, "Negative prompt collapse button was not found", collapseReport);
        await page.waitForTimeout(1500);

        const layoutReport = await page.evaluate(() => {
            const panel = document.querySelector(".webui-bridge-panel");
            const negativeRow = [...document.querySelectorAll(".webui-bridge-prompt-row")]
                .find((row) => !row.classList.contains("webui-bridge-positive-prompt-row"));
            const extra = document.querySelector(".webui-bridge-extra");
            const topRow = document.querySelector(".webui-bridge-toprow");
            const rect = (element) => {
                if (!element) return null;
                const item = element.getBoundingClientRect();
                return { top: item.top, bottom: item.bottom, height: item.height };
            };
            return {
                collapsed: negativeRow?.classList.contains("collapsed") || false,
                panel: rect(panel),
                topRow: rect(topRow),
                negative: rect(negativeRow),
                extra: rect(extra),
                blankBelowExtra: panel && extra ? panel.getBoundingClientRect().bottom - extra.getBoundingClientRect().bottom : null,
                extraMaxHeight: extra?.__webuiBridgeMaxHeight || null,
            };
        });
        await screenshot(page, "compat-ui-ergonomics.png");
        assert(layoutReport.collapsed, "Negative prompt row did not collapse", layoutReport);
        assert(layoutReport.negative?.height <= 48, "Collapsed negative prompt row remained too tall", layoutReport);
        assert(layoutReport.extra?.height <= 520, "LoRA region exceeded its inline height cap", layoutReport);
        assert(layoutReport.extra?.height >= 180, "LoRA region did not reclaim space after collapsing the negative prompt", layoutReport);
        assert(layoutReport.blankBelowExtra !== null && layoutReport.blankBelowExtra <= 36, "Large blank space remained below LoRA after negative prompt collapse", layoutReport);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during UI ergonomics check", bridgeConsoleErrors);
        return {
            promptScrollMovedBy: Math.round(scrollReport.movedBy),
            loraHeightAfterNegativeCollapse: Math.round(layoutReport.extra.height),
            blankBelowExtra: Math.round(layoutReport.blankBelowExtra),
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifySectionResizeBlankRecovery(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            localStorage.removeItem("webui-bridge-negative-collapsed");
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "section-resize-blank-recovery.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3500);
        const samples = [await bridgeBottomBlankMetrics(page, "initial")];
        await dragElementCenter(page, ".webui-bridge-panel-splitter", 260);
        samples.push(await bridgeBottomBlankMetrics(page, "after panel split down"));
        await dragElementCenter(page, ".webui-bridge-positive-prompt-row .webui-bridge-section-resizer", 180, 0);
        samples.push(await bridgeBottomBlankMetrics(page, "after positive text tag split"));
        await page.evaluate(() => {
            const collapseButton = [...document.querySelectorAll(".webui-bridge-collapse-btn")]
                .find((button) => /折叠反向|展开反向/.test(button.textContent || ""));
            if (collapseButton && /折叠反向/.test(collapseButton.textContent || "")) collapseButton.click();
        });
        await page.waitForTimeout(900);
        samples.push(await bridgeBottomBlankMetrics(page, "after collapse negative"));
        await dragElementCenter(page, ".webui-bridge-negative-main-resizer", -220);
        samples.push(await bridgeBottomBlankMetrics(page, "after tag negative split up"));
        await dragElementCenter(page, ".webui-bridge-panel-splitter", -360);
        samples.push(await bridgeBottomBlankMetrics(page, "after panel split up"));
        await dragElementCenter(page, ".webui-bridge-panel-splitter", 180);
        await page.waitForTimeout(3600);
        samples.push(await bridgeBottomBlankMetrics(page, "after settle"));
        await screenshot(page, "compat-section-resize-blank-recovery.png");
        const final = samples[samples.length - 1];
        assert(final.blankBelowExtra !== null, "Could not measure bottom blank after section resize stress", samples);
        assert(final.blankBelowExtra <= 36, "Large bottom blank remained after combined tag and LoRA section dragging", samples);
        assert(final.extra?.height >= 42, "LoRA section collapsed or disappeared after resize stress", samples);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during section resize blank recovery check", bridgeConsoleErrors);
        return {
            finalBlankBelowExtra: Math.round(final.blankBelowExtra),
            finalExtraHeight: Math.round(final.extra.height),
            samples: samples.map((item) => ({
                label: item.label,
                blankBelowExtra: item.blankBelowExtra === null ? null : Math.round(item.blankBelowExtra),
                extraHeight: item.extra?.height ? Math.round(item.extra.height) : null,
            })),
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function bridgeRestoreSizeMetrics(page, label = "metrics") {
    return await page.evaluate((metricLabel) => {
        const panel = document.querySelector(".webui-bridge-panel");
        const topRow = document.querySelector(".webui-bridge-toprow");
        const extra = document.querySelector(".webui-bridge-extra");
        const node = window.app.graph._nodes.find((item) => item.type === "WebUIPromptBridge");
        const rect = (element) => {
            if (!element) return null;
            const item = element.getBoundingClientRect();
            return {
                height: Math.round(item.height),
                top: Math.round(item.top),
                bottom: Math.round(item.bottom),
            };
        };
        return {
            label: metricLabel,
            nodeSize: node?.size ? Array.from(node.size).map((value) => Math.round(value)) : null,
            desiredSize: node?.__webuiBridgeDesiredSize
                ? Array.from(node.__webuiBridgeDesiredSize).map((value) => Math.round(value))
                : null,
            panel: rect(panel),
            topRow: rect(topRow),
            extra: rect(extra),
            blankBelowExtra: panel && extra
                ? Math.round(panel.getBoundingClientRect().bottom - extra.getBoundingClientRect().bottom - 8)
                : null,
        };
    }, label);
}

async function verifyRestoreSizeStability(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "restore-size-stability.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3500);
        await page.evaluate(() => {
            const panel = document.querySelector(".webui-bridge-panel");
            const node = window.app.graph._nodes.find((item) => item.type === "WebUIPromptBridge");
            if (node) {
                node.setSize?.([1180, 760]);
                node.size = [1180, 760];
                node.__webuiBridgeDesiredSize = [1180, 760];
                node.__webuiBridgeSavedPanelSize = [1180, 760];
                node.__webuiBridgeUserSized = true;
            }
            const top = document.querySelector(".webui-bridge-toprow");
            const extra = document.querySelector(".webui-bridge-extra");
            const positiveTags = document.querySelector(".webui-bridge-positive-prompt-row .webui-bridge-tag-panel");
            if (top) {
                top.style.height = "420px";
                top.style.flex = "0 0 auto";
            }
            if (extra) {
                extra.style.height = "320px";
                extra.style.flex = "0 0 auto";
            }
            if (positiveTags) {
                positiveTags.style.height = "260px";
                positiveTags.style.flex = "0 0 auto";
            }
            panel?.__webuiBridgeScheduleAdaptiveLayout?.();
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForTimeout(800);
        const before = await bridgeRestoreSizeMetrics(page, "disturbed");
        await page.evaluate(() => {
            const restoreButton = [...document.querySelectorAll(".webui-bridge-top-controls button")]
                .find((button) => /恢复尺寸/.test(button.textContent || ""));
            if (!restoreButton) throw new Error("Restore size button not found");
            restoreButton.click();
        });
        const samples = [];
        for (let index = 0; index < 90; index += 1) {
            await page.waitForTimeout(50);
            samples.push(await bridgeRestoreSizeMetrics(page, `after-${index}`));
        }
        await screenshot(page, "compat-restore-size-stability.png");
        const settled = samples.slice(24);
        const settledExtraHeights = settled.map((item) => item.extra?.height).filter(Number.isFinite);
        const minSettledExtra = Math.min(...settledExtraHeights);
        const maxSettledExtra = Math.max(...settledExtraHeights);
        const settledExtraSpan = maxSettledExtra - minSettledExtra;
        const largeTransitions = settled.slice(1).filter((item, index) =>
            Math.abs((item.extra?.height || 0) - (settled[index].extra?.height || 0)) > 32
        ).length;
        const final = samples[samples.length - 1];
        assert(settledExtraHeights.length > 4, "Could not measure LoRA height after restore size", samples);
        assert(settledExtraSpan <= 18 && largeTransitions === 0, "Restore size caused repeated LoRA height jitter", {
            before,
            settledExtraSpan,
            largeTransitions,
            samples: samples.filter((item, index) => index < 5 || index > 23),
        });
        assert(final.nodeSize?.[0] === 1180 && final.nodeSize?.[1] === 1180, "Restore size did not settle on default node size", final);
        assert(Math.abs(final.blankBelowExtra || 0) <= 36, "Restore size left a large bottom gap or overflow", final);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during restore size stability check", bridgeConsoleErrors);
        return {
            finalNodeSize: final.nodeSize,
            finalExtraHeight: final.extra?.height || null,
            finalBlankBelowExtra: final.blankBelowExtra,
            settledExtraSpan,
            largeTransitions,
        };
    } finally {
        await context.close();
    }
}

async function verifyLoraBrowserFlow(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "lora-browser-flow.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3500);
        const report = await page.evaluate(async () => {
            const positiveTextarea = document.querySelector(".webui-bridge-positive-prompt-row textarea");
            const card = document.querySelector(".webui-bridge-card");
            const checkbox = card?.querySelector("input[type='checkbox']");
            const addButton = [...document.querySelectorAll("button")]
                .find((button) => /添加选中到正向/.test(button.textContent || ""));
            if (!positiveTextarea || !card || !checkbox || !addButton) {
                return {
                    missing: {
                        positiveTextarea: !positiveTextarea,
                        card: !card,
                        checkbox: !checkbox,
                        addButton: !addButton,
                    },
                };
            }
            const before = positiveTextarea.value;
            checkbox.click();
            await new Promise((resolve) => setTimeout(resolve, 250));
            addButton.click();
            await new Promise((resolve) => setTimeout(resolve, 650));
            const after = positiveTextarea.value;
            return {
                cardText: card.textContent?.slice(0, 180) || "",
                checked: checkbox.checked,
                beforeLength: before.length,
                afterLength: after.length,
                addedText: after.slice(before.length),
                containsNewLora: /<\s*lora:[^>]+>/i.test(after.slice(before.length)),
                totalLoraTags: (after.match(/<\s*lora:/gi) || []).length,
            };
        });
        await screenshot(page, "compat-lora-browser-flow.png");
        assert(!report.missing, "LoRA browser flow did not render expected controls", report);
        assert(report.checked, "LoRA card checkbox did not become selected", report);
        assert(report.afterLength > report.beforeLength, "Adding selected LoRA did not change the positive prompt", report);
        assert(report.containsNewLora, "Adding selected LoRA did not insert a LoRA tag", report);
        assert(report.totalLoraTags >= 1, "Positive prompt did not contain any LoRA tags after adding selected LoRA", report);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during LoRA browser flow", bridgeConsoleErrors);
        return {
            totalLoraTags: report.totalLoraTags,
            addedText: report.addedText.trim().slice(0, 120),
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyBridgeSettingsRoundTrip(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        const report = await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "settings-round-trip.json",
            });
            await new Promise((resolve) => setTimeout(resolve, 2200));
            const marker = `codex-roundtrip-${Date.now()}`;
            const textareas = [...document.querySelectorAll(".webui-bridge-prompt-row textarea")];
            if (textareas.length < 2) {
                return { marker, missingTextareas: textareas.length };
            }
            const setTextarea = (textarea, value) => {
                textarea.value = value;
                textarea.dispatchEvent(new Event("input", { bubbles: true }));
                textarea.dispatchEvent(new Event("change", { bubbles: true }));
            };
            setTextarea(textareas[0], `positive ${marker}`);
            setTextarea(textareas[1], `negative ${marker}`);
            await new Promise((resolve) => setTimeout(resolve, 300));
            const serialized = window.app.graph.serialize();
            await window.app.loadGraphData(serialized, true, true, undefined, {
                filename: "settings-round-trip-reload.json",
            });
            await new Promise((resolve) => setTimeout(resolve, 2200));
            const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
            const widgetValues = Object.fromEntries((bridge?.widgets || [])
                .filter((widget) => ["positive_prompt", "negative_prompt"].includes(widget.name))
                .map((widget) => [widget.name, widget.value]));
            const uiValues = [...document.querySelectorAll(".webui-bridge-prompt-row textarea")]
                .slice(0, 2)
                .map((textarea) => textarea.value);
            let graphToPromptOk = false;
            let graphToPromptError = null;
            try {
                const prompt = await window.app.graphToPrompt();
                graphToPromptOk = Boolean(prompt?.output && prompt?.workflow);
            } catch (error) {
                graphToPromptError = String(error?.stack || error);
            }
            return {
                marker,
                widgetValues,
                uiValues,
                widgetCount: bridge?.widgets_values?.length || bridge?.widgets?.length || 0,
                graphToPromptOk,
                graphToPromptError,
            };
        }, workflow);
        await screenshot(page, "compat-settings-round-trip.png");
        assert(!report.missingTextareas, "Bridge prompt textareas did not render for settings round-trip", report);
        assert(report.widgetValues?.positive_prompt === `positive ${report.marker}`, "Positive prompt widget value did not survive reload", report);
        assert(report.widgetValues?.negative_prompt === `negative ${report.marker}`, "Negative prompt widget value did not survive reload", report);
        assert(report.uiValues?.[0] === `positive ${report.marker}`, "Positive prompt UI value did not survive reload", report);
        assert(report.uiValues?.[1] === `negative ${report.marker}`, "Negative prompt UI value did not survive reload", report);
        assert(report.widgetCount >= 60, "Bridge widget values were not complete after settings round-trip", report);
        assert(report.graphToPromptOk, "graphToPrompt failed after settings round-trip", report);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during settings round-trip", bridgeConsoleErrors);
        return {
            marker: report.marker,
            widgetCount: report.widgetCount,
            graphToPromptOk: report.graphToPromptOk,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyBridgeLayoutPreferencePersistence(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        const firstPass = await page.evaluate(async (graphData) => {
            localStorage.removeItem("webui-bridge-negative-collapsed");
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "layout-preference-persistence.json",
            });
            await new Promise((resolve) => setTimeout(resolve, 2200));
            const collapseButton = [...document.querySelectorAll(".webui-bridge-collapse-btn")]
                .find((button) => /折叠反向|展开反向/.test(button.textContent || ""));
            if (!collapseButton) return { missingCollapseButton: true };
            if ((collapseButton.textContent || "").includes("折叠")) collapseButton.click();
            await new Promise((resolve) => setTimeout(resolve, 500));
            const negativeRow = [...document.querySelectorAll(".webui-bridge-prompt-row")]
                .find((row) => !row.classList.contains("webui-bridge-positive-prompt-row"));
            return {
                collapsed: negativeRow?.classList.contains("collapsed") || false,
                stored: localStorage.getItem("webui-bridge-negative-collapsed"),
            };
        }, workflow);
        assert(!firstPass.missingCollapseButton, "Negative collapse button missing before persistence check", firstPass);
        assert(firstPass.collapsed, "Negative prompt did not collapse before persistence check", firstPass);
        assert(firstPass.stored === "1" || firstPass.stored === "true", "Collapsed state was not written to localStorage", firstPass);

        await page.goto(`${baseUrl}/?layout_preference_reload=${Date.now()}`, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
        });
        await page.waitForFunction(() => Boolean(window.app?.graph && window.app?.canvas && window.LiteGraph), null, {
            timeout: 60000,
        });
        const secondPass = await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "layout-preference-persistence-reload.json",
            });
            await new Promise((resolve) => setTimeout(resolve, 2200));
            const negativeRow = [...document.querySelectorAll(".webui-bridge-prompt-row")]
                .find((row) => !row.classList.contains("webui-bridge-positive-prompt-row"));
            const button = document.querySelector(".webui-bridge-collapse-btn");
            return {
                collapsed: negativeRow?.classList.contains("collapsed") || false,
                buttonText: button?.textContent || "",
                stored: localStorage.getItem("webui-bridge-negative-collapsed"),
            };
        }, workflow);
        await screenshot(page, "compat-layout-preference-persistence.png");
        assert(secondPass.collapsed, "Collapsed negative prompt state did not persist after page reload", secondPass);
        assert(/展开反向/.test(secondPass.buttonText), "Collapse button did not reflect persisted collapsed state", secondPass);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during layout preference persistence check", bridgeConsoleErrors);
        return {
            collapsedAfterReload: secondPass.collapsed,
            stored: secondPass.stored,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyOldWorkflowCompatibility(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages);
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "old-layout-compat-test.json",
            });
        }, makeOldWorkflow(workflow));
        await page.waitForTimeout(2500);
        const report = await page.evaluate(async (ids) => {
            const switches = ids.map((id) => {
                const node = window.app.graph.getNodeById(id);
                const graphPoint = [node.pos[0] + 80, node.pos[1] + (node.widgets?.[0]?.y || 26) + 9];
                const hit = window.app.graph.getNodeOnPos(graphPoint[0], graphPoint[1], null, 0);
                return {
                    id,
                    pos: Array.from(node.pos || []),
                    hitSelfAtWidget: hit?.id === id,
                    value: node.widgets?.[0]?.value,
                };
            });
            const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
            let graphToPromptOk = false;
            let graphToPromptError = null;
            try {
                const prompt = await window.app.graphToPrompt();
                graphToPromptOk = Boolean(prompt?.output && prompt?.workflow);
            } catch (error) {
                graphToPromptError = String(error?.stack || error);
            }
            return {
                switches,
                bridgeSize: bridge ? Array.from(bridge.size || []) : null,
                bridgeWidgetCount: bridge?.widgets_values?.length || bridge?.widgets?.length || 0,
                graphToPromptOk,
                graphToPromptError,
            };
        }, switchIds);
        await screenshot(page, "compat-old-workflow-layout.png");
        assert(report.switches.every((item) => item.pos[0] >= 1300), "Old workflow switch positions were not repaired", report.switches);
        assert(report.switches.every((item) => item.hitSelfAtWidget), "Old workflow switches are still occluded", report.switches);
        assert(report.bridgeWidgetCount >= 60, "Legacy WebUIPromptBridge widget values were not repaired", report);
        assert(report.graphToPromptOk, "Old workflow graphToPrompt failed", report);
        return report;
    } finally {
        await context.close();
    }
}

async function verifyQueueGeneration(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages);
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "anima-webui-prompt-bridge.json",
            });
        }, workflow);
        await page.waitForTimeout(2200);
        const submit = await page.evaluate(async () => {
            for (const id of [10, 15, 19, 24, 40, 47, 196, 197, 198]) {
                const node = window.app.graph.getNodeById(id);
                if (node?.widgets?.[0]) node.widgets[0].value = false;
                if (Array.isArray(node?.widgets_values)) node.widgets_values[0] = false;
            }
            const save = window.app.graph.getNodeById(9);
            const prefixWidget = save?.widgets?.find((widget) => widget.name === "filename_prefix") || save?.widgets?.[0];
            if (prefixWidget) prefixWidget.value = "webui_bridge_regression_verify";
            const graphPrompt = await window.app.graphToPrompt();
            const response = await fetch("/prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: graphPrompt.output,
                    workflow: graphPrompt.workflow,
                    client_id: `webui-bridge-regression-${Date.now()}`,
                }),
            });
            const data = await response.json();
            return { ok: response.ok, status: response.status, data };
        });
        assert(submit.ok && submit.data?.prompt_id && !Object.keys(submit.data.node_errors || {}).length, "Prompt submission failed", submit);
        let historyItem = null;
        for (let attempt = 0; attempt < 60; attempt += 1) {
            const poll = await page.evaluate(async (promptId) => {
                const [historyResponse, queueResponse] = await Promise.all([
                    fetch(`/history/${promptId}`),
                    fetch("/queue"),
                ]);
                const history = await historyResponse.json();
                const queue = await queueResponse.json();
                return {
                    item: history[promptId] || null,
                    queueRunning: queue?.queue_running?.length || 0,
                    queuePending: queue?.queue_pending?.length || 0,
                };
            }, submit.data.prompt_id);
            if (poll.item) {
                historyItem = poll.item;
                break;
            }
            await page.waitForTimeout(3000);
        }
        assert(historyItem?.status?.completed && historyItem?.status?.status_str === "success", "Prompt did not complete successfully", historyItem);
        const outputImages = Object.values(historyItem.outputs || {}).flatMap((output) => output.images || []);
        assert(outputImages.some((image) => image.type === "output"), "Generation finished without an output image", outputImages);
        return { promptId: submit.data.prompt_id, images: outputImages };
    } finally {
        await context.close();
    }
}

async function main() {
    const options = parseArgs();
    const { chromium } = await importPlaywright();
    const browser = await chromium.launch({ headless: !options.headed });
    const workflow = await loadWorkflow();
    try {
        const results = {
            bridgeEventFix: await verifyBridgeDoesNotCancelCanvasWidgets(browser, options.baseUrl),
            commonWidgetCompatibility: await verifyCommonWidgetCompatibility(browser, options.baseUrl),
            fullWorkflowSwitches: await verifyFullWorkflowSwitches(browser, options.baseUrl, workflow),
            currentWorkflowLayoutIdempotency: await verifyCurrentWorkflowLayoutIdempotency(browser, options.baseUrl, workflow),
            customWorkflowLayoutPreserved: await verifyCustomWorkflowLayoutPreserved(browser, options.baseUrl, workflow),
            bridgeUiErgonomics: await verifyBridgeUiErgonomics(browser, options.baseUrl, workflow),
            sectionResizeBlankRecovery: await verifySectionResizeBlankRecovery(browser, options.baseUrl, workflow),
            restoreSizeStability: await verifyRestoreSizeStability(browser, options.baseUrl, workflow),
            loraBrowserFlow: await verifyLoraBrowserFlow(browser, options.baseUrl, workflow),
            bridgeSettingsRoundTrip: await verifyBridgeSettingsRoundTrip(browser, options.baseUrl, workflow),
            bridgeLayoutPreferencePersistence: await verifyBridgeLayoutPreferencePersistence(browser, options.baseUrl, workflow),
            oldWorkflowCompatibility: await verifyOldWorkflowCompatibility(browser, options.baseUrl, workflow),
        };
        if (options.queue) {
            results.queueGeneration = await verifyQueueGeneration(browser, options.baseUrl, workflow);
        }
        console.log(JSON.stringify({
            ok: true,
            baseUrl: options.baseUrl,
            comfyRoot,
            results,
        }, null, 2));
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
});
