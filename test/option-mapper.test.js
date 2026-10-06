import test from "node:test";
import assert from "node:assert/strict";
import { findAnswerOption } from "../lib/option-mapper.js";

test("maps an answer letter to a discovered option", () => {
    const options = [
        { answer: "A", value: "a", label: "Paris" },
        { answer: "B", value: "b", label: "London" },
    ];

    assert.deepEqual(findAnswerOption(options, "b"), options[1]);
});

test("rejects an answer that is not among discovered options", () => {
    assert.throws(
        () => findAnswerOption([{ answer: "A", value: "a", label: "Paris" }], "C"),
        /does not match a visible option/,
    );
});
