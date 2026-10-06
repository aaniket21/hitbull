import test from "node:test";
import assert from "node:assert/strict";
import { parseGeminiAnswer } from "../lib/gemini-parser.js";

test("parses a numeric option answer", () => {
    assert.deepEqual(parseGeminiAnswer('{"answer":"2","confidence":0.95}'), {
        questionDetected: true,
        answer: "2",
        confidence: 0.95,
    });
});

test("represents a screen without a question", () => {
    assert.deepEqual(parseGeminiAnswer('{"questionDetected":false,"answer":"","confidence":0}'), {
        questionDetected: false,
        answer: "",
        confidence: 0,
    });
});

test("accepts an exact option text answer", () => {
    assert.deepEqual(parseGeminiAnswer('{"answer":"Processing data analytics","confidence":0.91}'), {
        questionDetected: true,
        answer: "Processing data analytics",
        confidence: 0.91,
    });
});

test("rejects malformed Gemini output", () => {
    assert.throws(
        () => parseGeminiAnswer("The answer is probably B"),
        /valid JSON answer/,
    );
});
