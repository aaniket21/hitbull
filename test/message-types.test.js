import test from "node:test";
import assert from "node:assert/strict";
import { MESSAGE_TYPES, isMessageType } from "../lib/message-types.js";

test("defines the popup, worker, and content message protocol", () => {
    assert.equal(MESSAGE_TYPES.START, "START");
    assert.equal(MESSAGE_TYPES.QUESTION_READY, "QUESTION_READY");
    assert.equal(MESSAGE_TYPES.SELECT_ANSWER, "SELECT_ANSWER");
    assert.equal(MESSAGE_TYPES.NAVIGATE_NEXT, "NAVIGATE_NEXT");
    assert.equal(MESSAGE_TYPES.QUESTION_COMPLETE, "QUESTION_COMPLETE");
    assert.equal(isMessageType("STOP_AUTOMATION"), true);
    assert.equal(isMessageType("UNKNOWN"), false);
});
