import test from "node:test";
import assert from "node:assert/strict";
import { parseGeminiAnswer } from "../lib/gemini-parser.js";

test("parses a valid Gemini answer object", () => {
    assert.deepEqual(parseGeminiAnswer('{"answer":"B","confidence":0.95}'), {
        questionDetected: true,
        answer: "B",
        confidence: 0.95,
    });
});

test("accepts an option number or option text", () => {
    assert.deepEqual(parseGeminiAnswer('{"questionDetected":true,"answer":"Option 2","confidence":0.91}'), {
        questionDetected: true,
        answer: "Option 2",
        confidence: 0.91,
    });
});

test("represents a screen without a question", () => {
    assert.deepEqual(parseGeminiAnswer('{"questionDetected":false,"answer":"","confidence":0}'), {
        questionDetected: false,
        answer: "",
        confidence: 0,
    });
});

test("rejects malformed Gemini output", () => {
    assert.throws(
        () => parseGeminiAnswer("The answer is probably B"),
        /valid JSON answer/,
    );
});
