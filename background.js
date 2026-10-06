import { requestGeminiAnswer, testGeminiKey } from "./lib/gemini-client.js";
import { KeyManager } from "./lib/key-manager.js";
import { createRunStore } from "./lib/run-storage.js";
import { transitionRunState } from "./lib/run-state.js";
import { withRetries } from "./lib/retry.js";
import { MESSAGE_TYPES, isMessageType } from "./lib/message-types.js";

const runStore = createRunStore(chrome.storage.local);
const keyManagers = new Map();
const runEpochs = new Map();
function debugLog() {}

function bumpRunEpoch(tabId) {
	const nextEpoch = (runEpochs.get(tabId) || 0) + 1;
	runEpochs.set(tabId, nextEpoch);
	return nextEpoch;
}

function getRunEpoch(tabId) {
	return runEpochs.get(tabId) || 0;
}

function normalizeSelectionText(text) {
	return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function resolveSelection(answer, question) {
	const options = question?.options || [];
	const requestedNumber = Number(answer.optionNumber);
	const text = normalizeSelectionText(answer.optionText);
	const textIndex = text
		? options.findIndex((option) => normalizeSelectionText(option.label) === text)
		: -1;
	const numberIndex = Number.isInteger(requestedNumber) && requestedNumber > 0 && requestedNumber <= options.length
		? requestedNumber - 1
		: -1;
	const selectedIndex = numberIndex >= 0 ? numberIndex : textIndex >= 0 ? textIndex : 0;
	const selectedOption = options[selectedIndex];

	return {
		optionNumber: selectedIndex + 1,
		optionText: selectedOption?.label || answer.optionText || "",
		selectedBy: numberIndex >= 0 ? "number" : textIndex >= 0 ? "text" : "first-option-fallback",
	};
}
const defaultSettings = {
	model: "gemini-3.5-flash-lite",
	delayMs: 1500,
	confidence: 0,
	autoSubmit: false,
};

function sendToTab(tabId, message) {
	debugLog(`Sending ${message.type} to tab`, { tabId });
	return chrome.tabs.sendMessage(tabId, message)
		.then((response) => {
			debugLog(`Tab response for ${message.type}`, response || {});
			return response;
		})
		.catch((error) => {
			debugLog(`Tab message failed: ${message.type}`, { error: error.message });
			return { ok: false, error: error.message || "The test page did not respond" };
		});
}

function isTestUrl(url = "") {
	return url.includes("onlinetest.hitbullseye.com/online_load");
}

async function getSettings() {
	const stored = await chrome.storage.local.get({ geminiKeys: [], geminiSettings: defaultSettings });
	return {
		keys: stored.geminiKeys,
		settings: { ...defaultSettings, ...stored.geminiSettings },
	};
}

function getKeyManager(tabId, keys) {
	if (!keyManagers.has(tabId)) {
		keyManagers.set(tabId, new KeyManager(keys));
	}
	return keyManagers.get(tabId);
}

async function saveStatus(state) {
	await runStore.save(state);
	chrome.runtime.sendMessage({ type: "STATUS", state }).catch(() => undefined);
}

async function captureTab(tabId) {
	try {
		const tab = await chrome.tabs.get(tabId);
		return await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
	} catch (error) {
		if (/activeTab|permission/i.test(error.message || "")) {
			throw new Error("Screenshot permission is unavailable. Reload the extension and grant site access, then try Check again.");
		}
		throw error;
	}
}

async function answerQuestion(tabId, state, question, epoch) {
	debugLog("Starting answer workflow", { tabId, questionNumber: question?.questionNumber, optionCount: question?.options?.length, step: state.step });
	const { keys, settings } = await getSettings();
	const keyManager = getKeyManager(tabId, keys);
	let attempts = 0;
	let lastError;

	while (attempts < keys.filter((key) => key.enabled !== false).length) {
		const activeKey = keyManager.next();
		if (!activeKey) {
			break;
		}

		try {
			debugLog("Capturing screenshot", { tabId, keyId: activeKey.id });
			const answer = await withRetries(async () => {
				const imageData = await captureTab(tabId);
				return requestGeminiAnswer({
					apiKey: activeKey.key,
					imageData,
					model: settings.model,
					questionContext: question,
				});
			}, {
				retries: 2,
				delayMs: 250,
			});
			debugLog("Gemini answer received", { questionDetected: answer.questionDetected, optionNumber: answer.optionNumber, optionText: answer.optionText, confidence: answer.confidence, keyId: activeKey.id });
			if (getRunEpoch(tabId) !== epoch) {
				debugLog("Ignoring stale answer from previous run", { tabId, epoch, currentEpoch: getRunEpoch(tabId) });
				return null;
			}

			if (!answer.questionDetected) {
				throw new Error("No question detected");
			}

			if (answer.confidence < Number(settings.confidence)) {
				throw new Error(`Gemini confidence ${answer.confidence} is below the configured threshold`);
			}

			const latestState = await runStore.load(tabId);
			if (latestState.status !== "waiting_answer") {
				debugLog("Ignoring answer because run is no longer waiting for an answer", { status: latestState.status, step: latestState.step });
				return null;
			}

			keyManager.markSuccess(activeKey.id);
			const answeredState = transitionRunState(state, "answer_received", { activeKeyId: activeKey.id });
			await saveStatus(answeredState);
			const selection = resolveSelection(answer, question);
			debugLog("Resolved selection", selection);
			const response = await sendToTab(tabId, {
				type: MESSAGE_TYPES.SELECT_ANSWER,
				optionNumber: selection.optionNumber,
				optionText: selection.optionText,
				answer: selection.optionText || String(selection.optionNumber),
			});
			if (!response?.ok) {
				throw new Error(response?.error || "The answer was not selected; navigation was blocked");
			}
			debugLog("Selection confirmed by content script", { answer: answer.answer });
			return answeredState;
		} catch (error) {
			debugLog("Answer workflow failed", { message: error.message, retryable: Boolean(error.retryable), keyId: activeKey.id });
			lastError = error;
			if (error.retryable) {
				keyManager.markFailure(activeKey.id);
			} else {
				break;
			}
		}

		attempts += 1;
	}

	throw lastError ?? new Error("No enabled Gemini API key is available");
}

async function handleQuestionReady(tabId, message) {
	let state = await runStore.load(tabId);
	const epoch = getRunEpoch(tabId);
	debugLog("Question ready received", { tabId, status: state.status, step: state.step, questionNumber: message.question?.questionNumber });
	if (state.status === "navigating") {
		state = transitionRunState(state, "next_question");
		await saveStatus(state);
	}
	if (state.status !== "waiting_question") {
		return;
	}

	try {
		const capturingState = transitionRunState(state, "question_ready");
		await saveStatus(capturingState);
		const capturedState = transitionRunState(capturingState, "capture_complete");
		await saveStatus(capturedState);
		await answerQuestion(tabId, capturedState, message.question, epoch);
	} catch (error) {
		const latestState = await runStore.load(tabId);
		if (getRunEpoch(tabId) !== epoch || ["stopped", "paused"].includes(latestState.status)) {
			debugLog("Ignoring stale question error", { error: error.message, status: latestState.status });
			return;
		}
		const errorState = transitionRunState(state, "error", { message: error.message });
		await saveStatus(errorState);
		await sendToTab(tabId, { type: "PAUSE_AUTOMATION" });
	}
}

async function handleAnswerSelected(tabId) {
	const state = await runStore.load(tabId);
	debugLog("Answer selected message received", { tabId, status: state.status, step: state.step });
	if (state.status !== "selecting") {
		return;
	}

	const navigatingState = transitionRunState(state, "answer_selected");
	await saveStatus(navigatingState);
	await sendToTab(tabId, { type: MESSAGE_TYPES.NAVIGATE_NEXT, delayMs: (await getSettings()).settings.delayMs });
}

async function handleQuestionComplete(tabId) {
	const state = await runStore.load(tabId);
	if (!["navigating", "waiting_question"].includes(state.status)) {
		return;
	}

	const completedState = transitionRunState(state, "complete");
	await saveStatus(completedState);
	const { settings } = await getSettings();
	if (settings.autoSubmit) {
		await sendToTab(tabId, { type: MESSAGE_TYPES.SUBMIT_TEST });
	}
}

async function handlePageReady(tabId, message) {
	if (!message.isTestPage) {
		return;
	}

	const state = await runStore.load(tabId);
	if (state.status !== "armed") {
		return;
	}

	const activeState = transitionRunState(state, "page_ready");
	await saveStatus(activeState);
	await sendToTab(tabId, { type: "BEGIN_QUESTION", reset: true });
}

async function handleScreenshotTest(tabId, keyId) {
	const { keys, settings } = await getSettings();
	const keyEntry = keys.find((entry) => entry.id === keyId && entry.enabled !== false)
		|| keys.find((entry) => entry.enabled !== false);
	if (!keyEntry) {
		return { ok: false, error: "Add and enable a Gemini API key first" };
	}

	const imageData = await captureTab(tabId);
	const answer = await requestGeminiAnswer({
		apiKey: keyEntry.key,
		imageData,
		model: settings.model,
	});
	if (!answer.questionDetected) {
		return { ok: true, result: "No question detected" };
	}

	return {
		ok: true,
		result: `Answer ${answer.optionText || answer.optionNumber} · ${Math.round(answer.confidence * 100)}% confidence`,
		answer,
	};
}

async function handleQuestionError(tabId, message) {
	const state = await runStore.load(tabId);
	if (["idle", "completed", "stopped"].includes(state.status)) {
		return;
	}

	const errorState = transitionRunState(state, "error", { message: message.error || "The question could not be processed" });
	debugLog("Question error stored", { error: message.error });
	await saveStatus(errorState);
}

async function handleControl(tabId, action, details = {}) {
	bumpRunEpoch(tabId);
	const state = await runStore.load(tabId);
	let nextState = transitionRunState(state, action, details);
	await saveStatus(nextState);

	if ((action === "start" && nextState.status === "waiting_question") || action === "resume" || action === "retry") {
		await sendToTab(tabId, { type: MESSAGE_TYPES.BEGIN_QUESTION, reset: action === "start" });
	}
	if (action === "stop" || action === "pause") {
		await sendToTab(tabId, { type: MESSAGE_TYPES.STOP_AUTOMATION });
	}
}

async function handleActiveStart(tabId) {
	const state = await runStore.load(tabId);
	if (state.status === "waiting_question") {
		bumpRunEpoch(tabId);
		await sendToTab(tabId, { type: MESSAGE_TYPES.BEGIN_QUESTION, reset: false });
		return { ok: true, result: "Automation started" };
	}
	if (["armed", "capturing", "waiting_answer", "selecting", "navigating"].includes(state.status)) {
		return { ok: true, result: "Automation already running" };
	}
	if (state.status === "paused") {
		await handleControl(tabId, "resume");
		return { ok: true, result: "Automation resumed" };
	}
	if (state.status === "error") {
		await handleControl(tabId, "retry");
		return { ok: true, result: "Automation retried" };
	}

	const { keys } = await getSettings();
	if (!keys.some((entry) => entry.enabled !== false)) {
		throw new Error("Add and enable a Gemini API key before starting");
	}

	keyManagers.delete(tabId);
	await handleControl(tabId, "start", { armed: false });
	return { ok: true, result: "Automation started" };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	const tabId = message.tabId ?? sender.tab?.id;
	if (!tabId) {
		sendResponse({ ok: false, error: "No active test tab" });
		return false;
	}

	if (!isMessageType(message.type)) {
		sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
		return false;
	}

	(async () => {
		try {
			if (message.type === MESSAGE_TYPES.START) {
				await chrome.storage.local.set({
					geminiKeys: message.keys,
					geminiSettings: { ...defaultSettings, ...message.settings },
				});
				keyManagers.delete(tabId);
				const tab = await chrome.tabs.get(tabId);
				await handleControl(tabId, "start", { armed: !isTestUrl(tab.url) });
			} else if (message.type === MESSAGE_TYPES.START_ACTIVE) {
				sendResponse(await handleActiveStart(tabId));
				return;
			} else if (message.type === MESSAGE_TYPES.TEST_SCREENSHOT) {
				sendResponse(await handleScreenshotTest(tabId, message.keyId));
				return;
			} else if (message.type === MESSAGE_TYPES.TEST_KEY) {
				const { keys } = await getSettings();
				const keyEntry = keys.find((entry) => entry.id === message.keyId);
				if (!keyEntry) {
					throw new Error("The selected Gemini key was not found");
				}
				await testGeminiKey({ apiKey: keyEntry.key });
			} else if (message.type === MESSAGE_TYPES.CONTROL) {
				await handleControl(tabId, message.action);
			} else if (message.type === MESSAGE_TYPES.QUESTION_READY) {
				await handleQuestionReady(tabId, message);
			} else if (message.type === MESSAGE_TYPES.ANSWER_SELECTED) {
				await handleAnswerSelected(tabId);
			} else if (message.type === MESSAGE_TYPES.QUESTION_COMPLETE) {
				await handleQuestionComplete(tabId);
			} else if (message.type === MESSAGE_TYPES.QUESTION_ERROR) {
				await handleQuestionError(tabId, message);
			} else if (message.type === MESSAGE_TYPES.PAGE_READY) {
				await handlePageReady(tabId, message);
			} else if (message.type === MESSAGE_TYPES.GET_STATUS) {
				sendResponse({ ok: true, state: await runStore.load(tabId) });
				return;
			} else {
				throw new Error(`Unknown message type: ${message.type}`);
			}

			sendResponse({ ok: true });
		} catch (error) {
			sendResponse({ ok: false, error: error.message });
		}
	})();

	return true;
});