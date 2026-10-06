import test from "node:test";
import assert from "node:assert/strict";
import { parseGeminiAnswer } from "../lib/gemini-parser.js";

test("parses a valid Gemini answer object", () => {
    assert.deepEqual(parseGeminiAnswer('{"answer":"B","confidence":0.95}'), {
        answer: "B",
        confidence: 0.95,
    });
});

test("rejects malformed Gemini output", () => {
    assert.throws(
        () => parseGeminiAnswer("The answer is probably B"),
        /valid JSON answer/,
    );
});
