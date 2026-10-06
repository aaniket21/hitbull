let automationActive = false;
let questionNumber = 0;
let readinessTimer = null;
let readinessStartedAt = 0;

function isTestPage() {
    return window.location.href.includes("onlinetest.hitbullseye.com/online_load");
}

setTimeout(() => {
    chrome.runtime.sendMessage({ type: "PAGE_READY", isTestPage: isTestPage() }).catch(() => undefined);
}, 0);

function optionLabel(input) {
    const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
    return (label?.textContent || input.parentElement?.textContent || input.value || "").trim();
}

function getOptionInputs() {
    const expectedName = `radio_${questionNumber + 1}`;
    const expectedOptions = [...document.querySelectorAll(`input[type="radio"][name="${expectedName}"]`)];
    if (expectedOptions.length > 0) {
        return expectedOptions;
    }

    if (questionNumber > 0) {
        return [];
    }

    const firstGroup = document.querySelector('input[type="radio"][name^="radio_"]')?.getAttribute("name");
    return firstGroup
        ? [...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(firstGroup)}"]`)]
        : [];
}

function getQuestionSnapshot() {
    const inputs = getOptionInputs();
    return {
        questionNumber,
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
        return;
    }

    const options = getOptionInputs();
    const normalizedAnswer = String(answer).trim().toUpperCase();
    const index = normalizedAnswer.charCodeAt(0) - 65;
    const input = options.find((option) => option.value.toUpperCase() === normalizedAnswer) || options[index];

    if (!input) {
        throw new Error(`Answer ${normalizedAnswer} does not match a visible option`);
    }

    input.click();
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

    setTimeout(() => {
        if (!automationActive) {
            return;
        }
        questionNumber += 1;
        readinessStartedAt = Date.now();
        nextButton.click();
        reportQuestionReady();
    }, Math.max(0, Number(delayMs) || 0));
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