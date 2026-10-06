let automationActive = false;
let questionNumber = 0;
let readinessTimer = null;
let readinessStartedAt = 0;
let pageToolbar = null;
let lastReportedQuestionSignature = "";
let nextNavigationTimer = null;
const logPrefix = "[Hitbullseye Automate]";

function debugLog(message, details = {}) {
    console.log(`${logPrefix} ${message}`, details);
}

function sendAutomationMessage(message) {
    debugLog(`Sending ${message.type}`, message.type === "SELECT_ANSWER"
        ? { optionNumber: message.optionNumber, optionText: message.optionText }
        : {});
    return chrome.runtime.sendMessage(message)
        .then((response) => {
            debugLog(`Response for ${message.type}`, response || {});
            return response;
        })
        .catch((error) => {
            debugLog(`Message failed: ${message.type}`, { error: error.message });
            return { ok: false, error: error.message };
        });
}

function isTestPage() {
    return window.location.href.includes("onlinetest.hitbullseye.com/online_load");
}

setTimeout(() => {
    debugLog("Content script loaded", { url: window.location.href, isTestPage: isTestPage() });
    sendAutomationMessage({ type: "PAGE_READY", isTestPage: isTestPage() });
    injectPageToolbar();
}, 0);

function injectPageToolbar() {
    if (!isTestPage() || document.getElementById("hitbullseye-helper-toolbar")) {
        return;
    }

    pageToolbar = document.createElement("aside");
    pageToolbar.id = "hitbullseye-helper-toolbar";
    pageToolbar.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:6px;padding:8px;background:#17252b;color:#fff;border:1px solid #3d6257;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.25);font:12px Arial,sans-serif";

    const status = document.createElement("span");
    status.textContent = "Ready";
    status.style.cssText = "max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";

    const createButton = (label, handler) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.style.cssText = "border:0;border-radius:5px;padding:6px 9px;background:#bfe9d1;color:#173b2f;cursor:pointer;font:11px Arial,sans-serif";
        button.addEventListener("click", handler);
        return button;
    };

    const sendToolbarMessage = async (message, loadingText, successText = "Done") => {
        status.textContent = loadingText;
        try {
            const response = await chrome.runtime.sendMessage(message);
            status.textContent = response?.ok ? response.result || successText : response?.error || "Request failed";
        } catch (error) {
            status.textContent = error.message;
        }
    };

    const checkButton = createButton("Check", () => sendToolbarMessage({ type: "TEST_SCREENSHOT" }, "Checking..."));
    const startButton = createButton("Start", () => sendToolbarMessage({ type: "START_ACTIVE" }, "Starting..."));
    const stopButton = createButton("Stop", () => sendToolbarMessage({ type: "CONTROL", action: "stop" }, "Stopping...", "Stopped"));
    pageToolbar.append(status, checkButton, startButton, stopButton);
    document.documentElement.append(pageToolbar);
}

function optionLabel(input) {
    const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
    const candidates = [
        label?.textContent,
        input.nextSibling?.textContent,
        input.closest("td,li")?.innerText,
        input.parentElement?.innerText,
        input.value,
    ].filter((text) => text?.trim()).map((text) => text.trim());
    return candidates.sort((left, right) => left.length - right.length)[0] || "";
}

function normalizeOptionText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/^(?:option|choice|answer)\s*\d+\s*[:.)-]?\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

function getOptionInputs() {
    const questionArea = document.querySelector("#main_div > div.tableWidthPercent > div.onlineTestLeftDiv");
    const candidates = [...(questionArea || document).querySelectorAll('input[type="radio"][name^="radio_"]')]
        .filter((input) => {
            const style = window.getComputedStyle(input);
            return input.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden";
        });
    const groups = new Map();
    candidates.forEach((input) => {
        const name = input.getAttribute("name");
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(input);
    });

    const currentGroup = [...groups.entries()].sort((left, right) => right[1].length - left[1].length)[0];
    debugLog("Discovered radio groups", {
        groups: [...groups.entries()].map(([name, inputs]) => ({ name, count: inputs.length })),
        selectedGroup: currentGroup?.[0] || null,
    });
    return currentGroup?.[1] || [];
}

function getQuestionSnapshot() {
    const inputs = getOptionInputs();
    const questionArea = document.querySelector("#main_div > div.tableWidthPercent > div.onlineTestLeftDiv");
    return {
        questionNumber,
        questionText: questionArea?.innerText?.trim() || "",
        options: inputs.map((input, index) => ({
            answer: /^[a-z]$/i.test(input.value) ? input.value.toUpperCase() : String.fromCharCode(65 + index),
            value: input.value,
            label: optionLabel(input),
        })),
    };
}

function getQuestionSignature() {
    const question = getQuestionSnapshot();
    return JSON.stringify({
        text: question.questionText,
        options: question.options.map((option) => `${option.value}|${option.label}`),
    });
}

function getNextButton() {
    return document.querySelector("#main_div > div.tableWidthPercent > div.onlineTestLeftDiv > div.qnav > span.saveNextButton > a")
        || [...document.querySelectorAll("a,button")].find((element) => /save\s*&?\s*next|next/i.test(element.textContent));
}

function reportQuestionReady() {
    if (!automationActive) {
        return;
    }

    const question = getQuestionSnapshot();
    debugLog("Question readiness check", { questionNumber, optionCount: question.options.length, group: getOptionInputs()[0]?.name || null });
    if (question.options.length > 0) {
        const signature = getQuestionSignature();
        if (signature === lastReportedQuestionSignature) {
            debugLog("Duplicate question readiness ignored", { questionNumber });
            return;
        }
        lastReportedQuestionSignature = signature;
        clearTimeout(readinessTimer);
        sendAutomationMessage({ type: "QUESTION_READY", question });
        return;
    }

    if (document.querySelector("#activator")) {
        stopAutomation();
        chrome.runtime.sendMessage({ type: "QUESTION_COMPLETE" });
        return;
    }

    if (Date.now() - readinessStartedAt > 15_000) {
        stopAutomation();
        const error = "The next question did not load within 15 seconds";
        toast(error, "error");
        chrome.runtime.sendMessage({ type: "QUESTION_ERROR", error });
        return;
    }

    readinessTimer = setTimeout(reportQuestionReady, 250);
}

function selectAnswer(answer) {
    if (!automationActive) {
        throw new Error("Automation is not active; answer selection was blocked");
    }

    const options = getOptionInputs();
    const legacyAnswer = typeof answer === "string" ? answer : answer?.answer;
    const rawOptionNumber = answer?.optionNumber ?? (/^(?:option|choice|answer)?\s*\d+$/i.test(String(legacyAnswer || "").trim())
        ? String(legacyAnswer).replace(/\D/g, "")
        : null);
    const optionNumber = rawOptionNumber === null || rawOptionNumber === ""
        ? null
        : Number(rawOptionNumber);
    const optionText = String(answer?.optionText || (rawOptionNumber === null ? legacyAnswer : "") || "").trim();
    const normalizedText = normalizeOptionText(optionText);
    const numberInput = Number.isInteger(optionNumber) && optionNumber > 0
        ? options[optionNumber - 1]
        : null;
    const textInput = normalizedText
        ? options.find((option) => {
            const label = normalizeOptionText(optionLabel(option));
            return label === normalizedText
                || label.includes(normalizedText)
                || normalizedText.includes(label)
                || normalizeOptionText(option.value) === normalizedText;
        })
        : null;
    const input = numberInput || textInput;

    debugLog("Selecting answer", {
        optionNumber,
        optionText,
        textMatch: Boolean(textInput),
        numberMatch: Boolean(numberInput),
        selectedBy: numberInput ? "number" : textInput ? "text" : "none",
        optionCount: options.length,
        optionNames: options.map((option) => option.name),
    });

    if (!input) {
        throw new Error(`Gemini answer did not match a visible option: ${optionText || optionNumber || "empty answer"}`);
    }

    debugLog("Matched answer option", { name: input.name, value: input.value, checkedBefore: input.checked });
    input.click();
    if (!input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (!input.checked) {
        throw new Error(`Could not select answer ${normalizedAnswer}`);
    }

    debugLog("Answer verified checked", { name: input.name, value: input.value, checked: input.checked });
    sendAutomationMessage({ type: "ANSWER_SELECTED" });
}

function navigateNext(delayMs) {
    if (!automationActive) {
        return;
    }

    const nextButton = getNextButton();
    debugLog("Next button lookup", { found: Boolean(nextButton), text: nextButton?.textContent?.trim() || null });
    if (!nextButton) {
        if (document.querySelector("#activator")) {
            chrome.runtime.sendMessage({ type: "QUESTION_COMPLETE" });
            return;
        }
        throw new Error("The next-question control was not found");
    }

    const previousSignature = getQuestionSignature();
    nextNavigationTimer = setTimeout(() => {
        nextNavigationTimer = null;
        if (!automationActive) {
            return;
        }
        questionNumber += 1;
        readinessStartedAt = Date.now();
        debugLog("Clicking Save & Next", { questionNumber });
        nextButton.click();
        waitForNextQuestion(previousSignature);
    }, Math.max(0, Number(delayMs) || 0));
}

    function waitForNextQuestion(previousSignature) {
    if (!automationActive) {
        return;
    }

    const nextOptions = getOptionInputs();
    const hasOptions = nextOptions.length > 0;
    const currentSignature = hasOptions ? getQuestionSignature() : "";
    const hasStaleSelection = nextOptions.some((input) => input.checked);
    if (hasOptions && currentSignature !== previousSignature && !hasStaleSelection) {
        debugLog("New question content detected", { previousQuestionLength: previousSignature.length, currentQuestionLength: currentSignature.length });
        reportQuestionReady();
        return;
    }

    if (document.querySelector("#activator")) {
        stopAutomation();
        chrome.runtime.sendMessage({ type: "QUESTION_COMPLETE" });
        return;
    }

    if (Date.now() - readinessStartedAt > 15_000) {
        stopAutomation();
        const error = "The next question did not load within 15 seconds";
        toast(error, "error");
        chrome.runtime.sendMessage({ type: "QUESTION_ERROR", error });
        return;
    }

    readinessTimer = setTimeout(() => waitForNextQuestion(previousSignature), 250);
}

function stopAutomation() {
    automationActive = false;
    clearTimeout(readinessTimer);
    clearTimeout(nextNavigationTimer);
    nextNavigationTimer = null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "INSPECT_QUESTION") {
        const question = isTestPage() ? getQuestionSnapshot() : { questionNumber: 0, options: [] };
        sendResponse({ ok: true, questionDetected: question.options.length > 0, question });
        return false;
    }

    if (!isTestPage()) {
        sendResponse({ ok: false, error: "Please open the Hitbullseye test page" });
        return false;
    }

    try {
        if (message.type === "BEGIN_QUESTION") {
            automationActive = true;
            if (message.reset) {
                questionNumber = 0;
                lastReportedQuestionSignature = "";
            }
            readinessStartedAt = Date.now();
            toast("Automation started");
            debugLog("Automation started", { reset: Boolean(message.reset), questionNumber });
            reportQuestionReady();
        } else if (message.type === "SELECT_ANSWER") {
            selectAnswer(message.answer);
        } else if (message.type === "NAVIGATE_NEXT") {
            navigateNext(message.delayMs);
        } else if (message.type === "STOP_AUTOMATION" || message.type === "PAUSE_AUTOMATION") {
            stopAutomation();
            toast(message.type === "PAUSE_AUTOMATION" ? "Automation paused" : "Automation stopped");
        } else if (message.type === "SUBMIT_TEST") {
            document.querySelector("#activator")?.click();
            document.querySelector('input[name="rd"][value="Y"]')?.click();
        }
        sendResponse({ ok: true });
    } catch (error) {
        stopAutomation();
        toast(error.message, "error");
        chrome.runtime.sendMessage({ type: "QUESTION_ERROR", error: error.message });
        sendResponse({ ok: false, error: error.message });
    }

    return false;
});