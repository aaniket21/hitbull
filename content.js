let automationActive = false;
let questionNumber = 0;
let readinessTimer = null;
let readinessStartedAt = 0;
let pageToolbar = null;

function isTestPage() {
    return window.location.href.includes("onlinetest.hitbullseye.com/online_load");
}

setTimeout(() => {
    chrome.runtime.sendMessage({ type: "PAGE_READY", isTestPage: isTestPage() }).catch(() => undefined);
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
    return (label?.textContent || input.parentElement?.textContent || input.value || "").trim();
}

function getOptionInputs() {
    const firstRadio = document.querySelector('input[type="radio"][name^="radio_"]');
    if (!firstRadio) {
        return [];
    }

    const currentGroup = firstRadio.getAttribute("name");
    return [...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(currentGroup)}"]`)];
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

function getNextButton() {
    return document.querySelector("#main_div > div.tableWidthPercent > div.onlineTestLeftDiv > div.qnav > span.saveNextButton > a")
        || [...document.querySelectorAll("a,button")].find((element) => /save\s*&?\s*next|next/i.test(element.textContent));
}

function reportQuestionReady() {
    if (!automationActive) {
        return;
    }

    const question = getQuestionSnapshot();
    if (question.options.length > 0) {
        clearTimeout(readinessTimer);
        chrome.runtime.sendMessage({ type: "QUESTION_READY", question });
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
    const rawAnswer = String(answer).trim();
    const normalizedAnswer = rawAnswer.toUpperCase();
    const normalizedText = rawAnswer.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const numberMatch = normalizedText.match(/^(?:option|choice|answer)?\s*(\d+)$/);
    const letterMatch = normalizedAnswer.match(/^(?:OPTION\s*)?([A-Z])$/);
    const input = numberMatch
        ? options[Number(numberMatch[1]) - 1]
        : options.find((option, index) => {
            const label = optionLabel(option).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
            return option.value.toUpperCase() === normalizedAnswer
                || option.value.toUpperCase() === letterMatch?.[1]
                || label === normalizedText
                || index + 1 === Number(normalizedAnswer);
        });

    if (!input) {
        throw new Error(`Answer ${normalizedAnswer} does not match a visible option`);
    }

    input.click();
    if (!input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (!input.checked) {
        throw new Error(`Could not select answer ${normalizedAnswer}`);
    }

    chrome.runtime.sendMessage({ type: "ANSWER_SELECTED" });
}

function navigateNext(delayMs) {
    if (!automationActive) {
        return;
    }

    const nextButton = getNextButton();
    if (!nextButton) {
        if (document.querySelector("#activator")) {
            chrome.runtime.sendMessage({ type: "QUESTION_COMPLETE" });
            return;
        }
        throw new Error("The next-question control was not found");
    }

    const previousGroupName = getOptionInputs()[0]?.getAttribute("name") || "";
    setTimeout(() => {
        if (!automationActive) {
            return;
        }
        questionNumber += 1;
        readinessStartedAt = Date.now();
        nextButton.click();
        waitForNextQuestion(previousGroupName);
    }, Math.max(0, Number(delayMs) || 0));
}

function waitForNextQuestion(previousGroupName) {
    if (!automationActive) {
        return;
    }

    const currentGroupName = document.querySelector('input[type="radio"][name^="radio_"]')?.getAttribute("name") || "";
    const hasOptions = getOptionInputs().length > 0;
    if (hasOptions && currentGroupName !== previousGroupName) {
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

    readinessTimer = setTimeout(() => waitForNextQuestion(previousGroupName), 250);
}

function stopAutomation() {
    automationActive = false;
    clearTimeout(readinessTimer);
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
            }
            readinessStartedAt = Date.now();
            toast("Automation started");
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