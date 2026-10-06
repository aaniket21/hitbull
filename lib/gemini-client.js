import { parseGeminiAnswer } from "./gemini-parser.js";

const defaultModel = "gemini-3.5-flash-lite";
const defaultEndpoint = "https://generativelanguage.googleapis.com/v1beta/models";
const answerPrompt = [
    "Read the visible multiple-choice question in the image.",
    "Return only valid JSON with this exact shape: {\"answer\":\"A\",\"confidence\":0.0}.",
    "The answer must be one uppercase option letter visible in the question.",
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
    endpoint = defaultEndpoint,
    fetchImpl = fetch,
}) {
    if (!apiKey) {
        throw new Error("A Gemini API key is required");
    }

    const image = splitImageData(imageData);
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
                            { text: answerPrompt },
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
