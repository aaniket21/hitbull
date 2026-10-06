import test from "node:test";
import assert from "node:assert/strict";
import { requestGeminiAnswer } from "../lib/gemini-client.js";

test("sends a screenshot as inline image data and parses the answer", async () => {
    let request;
    const fetchImpl = async (url, options) => {
        request = { url, options };
        return new Response(JSON.stringify({
            candidates: [{ content: { parts: [{ text: '{"answer":"C","confidence":0.88}' }] } }],
        }), { status: 200, headers: { "content-type": "application/json" } });
    };

    const result = await requestGeminiAnswer({
        apiKey: "secret-key",
        imageData: "data:image/png;base64,abc123",
        model: "gemini-test-model",
        fetchImpl,
    });

    assert.deepEqual(result, { questionDetected: true, answer: "C", confidence: 0.88 });
    assert.match(request.url, /models\/gemini-test-model:generateContent\?key=secret-key$/);
    const body = JSON.parse(request.options.body);
    assert.equal(body.contents[0].parts[1].inlineData.data, "abc123");
    assert.equal(body.contents[0].parts[1].inlineData.mimeType, "image/png");
});

test("exposes an HTTP status for key rotation", async () => {
    const fetchImpl = async () => new Response("quota exceeded", { status: 429 });

    await assert.rejects(
        () => requestGeminiAnswer({ apiKey: "secret-key", imageData: "abc", fetchImpl }),
        (error) => error.status === 429 && error.retryable === true,
    );
});
