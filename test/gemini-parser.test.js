import test from "node:test";
import assert from "node:assert/strict";
import { parseGeminiAnswer } from "../lib/gemini-parser.js";

test("parses a numeric option answer", () => {
    assert.deepEqual(parseGeminiAnswer('{"optionNumber":2,"optionText":"88","confidence":0.95}'), {
        questionDetected: true,
        optionNumber: 2,
        optionText: "88",
        confidence: 0.95,
    });
});

test("represents a screen without a question", () => {
    assert.deepEqual(parseGeminiAnswer('{"questionDetected":false,"optionNumber":null,"optionText":"","confidence":0}'), {
        questionDetected: false,
        optionNumber: null,
        optionText: "",
        confidence: 0,
    });
});

test("accepts an exact option text answer", () => {
    assert.deepEqual(parseGeminiAnswer('{"optionNumber":2,"optionText":"Processing data analytics","confidence":0.91}'), {
        questionDetected: true,
        optionNumber: 2,
        optionText: "Processing data analytics",
        confidence: 0.91,
    });
});

test("rejects malformed Gemini output", () => {
    assert.throws(
        () => parseGeminiAnswer("The answer is probably B"),
        /valid JSON answer/,
    );
});
