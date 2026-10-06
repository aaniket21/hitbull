import { parseGeminiAnswer } from "./gemini-parser.js";

const defaultModel = "gemini-3.5-flash-lite";
const defaultEndpoint = "https://generativelanguage.googleapis.com/v1beta/models";
const answerPrompt = [
    "Inspect only the main page content in the screenshot; ignore browser chrome, navigation bars, dashboards, menus, timers, the Hitbullseye helper toolbar, and unrelated text.",
    "Look for one visible multiple-choice question and its answer options.",
    "If no question and answer options are visible, return exactly {\"questionDetected\":false,\"answer\":\"\",\"confidence\":0}.",
    "If a question is visible, return only valid JSON with this exact shape: {\"questionDetected\":true,\"answer\":\"...\",\"confidence\":0.0}.",
    "For answer, return only the option number as digits, using the visible option order from top to bottom. For example, the second visible option must be returned as \"2\".",
    "Do not explain the answer and do not invent an option that is not visible.",
    "Confidence must be a number from 0 to 1.",
].join(" ");

function splitImageData(imageData) {
    const dataUrlMatch = String(imageData).match(/^data:([^;]+);base64,(.*)$/s);
    return dataUrlMatch
        ? { mimeType: dataUrlMatch[1], data: dataUrlMatch[2] }
        : { mimeType: "image/png", data: String(imageData) };
}

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    error.retryable = status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;
    return error;
}

export async function requestGeminiAnswer({
    apiKey,
    imageData,
    model = defaultModel,
    questionContext = null,
    endpoint = defaultEndpoint,
    fetchImpl = fetch,
}) {
    if (!apiKey) {
        throw new Error("A Gemini API key is required");
    }

    const image = splitImageData(imageData);
    const contextText = questionContext
        ? `\n\nExtracted page text and options for cross-checking only:\n${JSON.stringify(questionContext)}`
        : "";
    let response;
    try {
        response = await fetchImpl(
            `${endpoint}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: `${answerPrompt}${contextText}` },
                            { inlineData: image },
                        ],
                    }],
                    generationConfig: {
                        responseMimeType: "application/json",
                    },
                }),
            },
        );
    } catch (error) {
        error.retryable = true;
        throw error;
    }

    if (!response.ok) {
        throw createHttpError(response.status, `Gemini request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const responseText = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .filter(Boolean)
        .join("");

    if (!responseText) {
        throw new Error("Gemini returned no answer");
    }

    return parseGeminiAnswer(responseText);
}

export async function testGeminiKey({
    apiKey,
    endpoint = defaultEndpoint,
    fetchImpl = fetch,
}) {
    if (!apiKey) {
        throw new Error("A Gemini API key is required");
    }

    const response = await fetchImpl(`${endpoint}?key=${encodeURIComponent(apiKey)}`);
    if (!response.ok) {
        throw createHttpError(response.status, `Gemini key test failed with status ${response.status}`);
    }

    return true;
}
