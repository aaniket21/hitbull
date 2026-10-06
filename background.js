import { requestGeminiAnswer, testGeminiKey } from "./lib/gemini-client.js";
import { KeyManager } from "./lib/key-manager.js";
import { createRunStore } from "./lib/run-storage.js";
import { transitionRunState } from "./lib/run-state.js";
import { withRetries } from "./lib/retry.js";
import { MESSAGE_TYPES, isMessageType } from "./lib/message-types.js";

const runStore = createRunStore(chrome.storage.local);
const keyManagers = new Map();
const defaultSettings = {
	model: "gemini-3.5-flash-lite",
	delayMs: 1500,
	confidence: 0,
	autoSubmit: false,
};

function sendToTab(tabId, message) {
	return chrome.tabs.sendMessage(tabId, message).catch(() => undefined);
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
	const tab = await chrome.tabs.get(tabId);
	return chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
}

async function answerQuestion(tabId, state, question) {
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
			const answer = await withRetries(async () => {
				const imageData = await captureTab(tabId);
				return requestGeminiAnswer({
					apiKey: activeKey.key,
					imageData,
					model: settings.model,
				});
			}, {
				retries: 2,
				delayMs: 250,
			});

			if (!answer.questionDetected) {
				throw new Error("No question detected");
			}

			if (answer.confidence < Number(settings.confidence)) {
				throw new Error(`Gemini confidence ${answer.confidence} is below the configured threshold`);
			}

			keyManager.markSuccess(activeKey.id);
			const answeredState = transitionRunState(state, "answer_received", { activeKeyId: activeKey.id });
			await saveStatus(answeredState);
			const response = await sendToTab(tabId, { type: MESSAGE_TYPES.SELECT_ANSWER, answer: answer.answer });
			if (response?.ok === false) {
				throw new Error(response.error || "The answer could not be selected");
			}
			return answeredState;
		} catch (error) {
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
	const state = await runStore.load(tabId);
	if (state.status !== "waiting_question") {
		return;
	}

	try {
		const capturingState = transitionRunState(state, "question_ready");
		await saveStatus(capturingState);
		const capturedState = transitionRunState(capturingState, "capture_complete");
		await saveStatus(capturedState);
		await answerQuestion(tabId, capturedState, message.question);
	} catch (error) {
		const errorState = transitionRunState(state, "error", { message: error.message });
		await saveStatus(errorState);
		await sendToTab(tabId, { type: "PAUSE_AUTOMATION" });
	}
}

async function handleAnswerSelected(tabId) {
	const state = await runStore.load(tabId);
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
	const keyEntry = keys.find((entry) => entry.id === keyId && entry.enabled !== false);
	if (!keyEntry) {
		return { ok: false, error: "Select an enabled Gemini key first" };
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
		result: `Answer ${answer.answer} · ${Math.round(answer.confidence * 100)}% confidence`,
		answer,
	};
}

async function handleQuestionError(tabId, message) {
	const state = await runStore.load(tabId);
	if (["idle", "completed", "stopped"].includes(state.status)) {
		return;
	}

	const errorState = transitionRunState(state, "error", { message: message.error || "The question could not be processed" });
	await saveStatus(errorState);
}

async function handleControl(tabId, action, details = {}) {
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
				const { keys } = await getSettings();
				if (!keys.some((entry) => entry.enabled !== false)) {
					throw new Error("Add and enable a Gemini API key before starting");
				}
				keyManagers.delete(tabId);
				await handleControl(tabId, "start", { armed: false });
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