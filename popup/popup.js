let keys = [];
let activeTabId = null;
let currentState = null;
const defaultModel = "gemini-3.5-flash-lite";
let settingsDirty = false;

const elements = {};

document.addEventListener("DOMContentLoaded", async () => {
    Object.assign(elements, {
        apiKey: document.getElementById("api_key"),
        addKey: document.getElementById("add_key"),
        keyList: document.getElementById("key_list"),
        keyCount: document.getElementById("key_count"),
        model: document.getElementById("model"),
        delay: document.getElementById("delay"),
        delayValue: document.getElementById("delay_value"),
        confidence: document.getElementById("confidence"),
        confidenceValue: document.getElementById("confidence_value"),
        autoSubmit: document.getElementById("auto_submit"),
        saveSettings: document.getElementById("save_settings"),
        start: document.getElementById("start"),
        pause: document.getElementById("pause"),
        resume: document.getElementById("resume"),
        stop: document.getElementById("stop"),
        retry: document.getElementById("retry"),
        statusDot: document.getElementById("status_dot"),
        statusText: document.getElementById("status_text"),
        progressText: document.getElementById("progress_text"),
        errorText: document.getElementById("error_text"),
        testResult: document.getElementById("test_result"),
    });

    elements.addKey.addEventListener("click", addKey);
    elements.apiKey.addEventListener("keydown", (event) => {
        if (event.key === "Enter") addKey();
    });
    elements.delay.addEventListener("input", updateRangeLabels);
    elements.confidence.addEventListener("input", updateRangeLabels);
    elements.model.addEventListener("change", markSettingsDirty);
    elements.delay.addEventListener("change", markSettingsDirty);
    elements.confidence.addEventListener("change", markSettingsDirty);
    elements.autoSubmit.addEventListener("change", markSettingsDirty);
    elements.saveSettings.addEventListener("click", saveSettings);
    elements.start.addEventListener("click", () => sendControl("START"));
    elements.pause.addEventListener("click", () => sendControl("pause"));
    elements.resume.addEventListener("click", () => sendControl("resume"));
    elements.stop.addEventListener("click", () => sendControl("stop"));
    elements.retry.addEventListener("click", () => sendControl("retry"));

    updateRangeLabels();
    await loadConfiguration();
    await loadActiveTabState();
});

function runtimeMessage(message) {
    return chrome.runtime.sendMessage(message);
}

function tabQuery(query) {
    return chrome.tabs.query(query);
}

async function loadConfiguration() {
    const stored = await chrome.storage.local.get({ geminiKeys: [], geminiSettings: {} });
    keys = stored.geminiKeys;
    const savedModel = stored.geminiSettings.model;
    elements.model.value = ["gemini-3.5-flash-lite", "gemini-3.5-flash"].includes(savedModel)
        ? savedModel
        : defaultModel;
    elements.delay.value = stored.geminiSettings.delayMs || 1500;
    elements.confidence.value = stored.geminiSettings.confidence || 0;
    elements.autoSubmit.checked = stored.geminiSettings.autoSubmit === true;
    settingsDirty = false;
    elements.saveSettings.disabled = true;
    renderKeys();
    updateRangeLabels();
}

async function loadActiveTabState() {
    const tabs = await tabQuery({ active: true, currentWindow: true });
    activeTabId = tabs[0]?.id ?? null;
    if (activeTabId) {
        const response = await runtimeMessage({ type: "GET_STATUS", tabId: activeTabId });
        if (response?.ok) renderState(response.state);
    }
}

function addKey() {
    const value = elements.apiKey.value.trim();
    if (!value || keys.some((entry) => entry.key === value)) return;
    keys.push({ id: crypto.randomUUID(), key: value, enabled: true });
    elements.apiKey.value = "";
    persistConfiguration();
    renderKeys();
}

function removeKey(id) {
    keys = keys.filter((entry) => entry.id !== id);
    persistConfiguration();
    renderKeys();
}

function toggleKey(id, enabled) {
    const entry = keys.find((key) => key.id === id);
    if (entry) entry.enabled = enabled;
    persistConfiguration();
}

async function testKey(id, button) {
    if (!activeTabId) {
        renderTestResult("No question detected", false);
        return;
    }

    button.disabled = true;
    button.textContent = "...";
    const response = await runtimeMessage({ type: "TEST_KEY", tabId: activeTabId, keyId: id });
    button.disabled = false;
    button.textContent = "Check";
    renderTestResult(response?.ok ? response.result : response?.error || "Check failed", response?.ok);
}

function renderKeys() {
    elements.keyList.replaceChildren();
    elements.keyCount.textContent = String(keys.length);
    keys.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "key-row";
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.checked = entry.enabled !== false;
        toggle.title = "Enable API key";
        toggle.addEventListener("change", () => toggleKey(entry.id, toggle.checked));
        const label = document.createElement("span");
        label.textContent = `•••• ${entry.key.slice(-4)}`;
        const test = document.createElement("button");
        test.className = "test-button";
        test.textContent = "Check";
        test.title = "Send the current question screenshot to Gemini";
        test.addEventListener("click", () => testKey(entry.id, test));
        const remove = document.createElement("button");
        remove.className = "remove-button";
        remove.textContent = "×";
        remove.title = "Remove API key";
        remove.addEventListener("click", () => removeKey(entry.id));
        row.append(toggle, label, test, remove);
        elements.keyList.append(row);
    });
}

function getSettings() {
    return {
        model: elements.model.value || defaultModel,
        delayMs: Number(elements.delay.value),
        confidence: Number(elements.confidence.value),
        autoSubmit: elements.autoSubmit.checked,
    };
}

async function persistConfiguration() {
    await chrome.storage.local.set({ geminiKeys: keys, geminiSettings: getSettings() });
}

function markSettingsDirty() {
    settingsDirty = true;
    elements.saveSettings.disabled = false;
}

async function saveSettings() {
    await persistConfiguration();
    settingsDirty = false;
    elements.saveSettings.disabled = true;
    renderTestResult("Settings saved", true);
}

async function sendControl(action) {
    if (!activeTabId) {
        renderError("No active browser tab was found.");
        return;
    }

    if (action === "START" && !keys.some((entry) => entry.enabled !== false)) {
        renderError("Add and enable at least one Gemini API key before starting.");
        return;
    }

    await persistConfiguration();
    const message = action === "START"
        ? { type: "START", tabId: activeTabId, keys, settings: getSettings() }
        : { type: "CONTROL", tabId: activeTabId, action };
    const response = await runtimeMessage(message);
    if (!response?.ok) renderError(response?.error || "The command could not be completed.");
}

function updateRangeLabels() {
    if (!elements.delay) return;
    elements.delayValue.textContent = `${(Number(elements.delay.value) / 1000).toFixed(2)}s`;
    elements.confidenceValue.textContent = `${Math.round(Number(elements.confidence.value) * 100)}%`;
}

function renderState(state) {
    currentState = state;
    const label = state.status.replaceAll("_", " ");
    elements.statusText.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    elements.progressText.textContent = state.status === "idle"
        ? "No active run"
        : state.status === "armed"
            ? "Waiting for the test page"
        : `Question ${state.currentQuestion + 1} · ${state.completedCount} completed`;
    elements.statusDot.dataset.status = state.status;
    elements.errorText.textContent = state.lastError || "";
    elements.start.disabled = ["armed", "waiting_question", "capturing", "waiting_answer", "selecting", "navigating", "paused", "error"].includes(state.status);
    elements.pause.disabled = !["waiting_question", "capturing", "waiting_answer", "selecting", "navigating"].includes(state.status);
    elements.resume.disabled = state.status !== "paused";
    elements.stop.disabled = !["armed", "waiting_question", "capturing", "waiting_answer", "selecting", "navigating", "paused", "error"].includes(state.status);
    elements.retry.disabled = state.status !== "error";
}

function renderError(message) {
    elements.errorText.textContent = message;
}

function renderTestResult(message, success) {
    elements.testResult.textContent = message;
    elements.testResult.dataset.state = success ? "success" : "error";
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "STATUS") renderState(message.state);
});