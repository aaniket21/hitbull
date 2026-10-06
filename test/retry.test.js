import test from "node:test";
import assert from "node:assert/strict";
import { withRetries } from "../lib/retry.js";

test("retries retryable failures with bounded exponential delays", async () => {
    let attempts = 0;
    const delays = [];
    const result = await withRetries(async () => {
        attempts += 1;
        if (attempts < 3) {
            const error = new Error("temporary");
            error.retryable = true;
            throw error;
        }
        return "ok";
    }, { retries: 2, delayMs: 10, sleep: async (delay) => delays.push(delay) });

    assert.equal(result, "ok");
    assert.equal(attempts, 3);
    assert.deepEqual(delays, [10, 20]);
});

test("does not retry non-retryable failures", async () => {
    let attempts = 0;
    await assert.rejects(
        () => withRetries(async () => {
            attempts += 1;
            throw new Error("invalid answer");
        }, { retries: 3, sleep: async () => {} }),
        /invalid answer/,
    );
    assert.equal(attempts, 1);
});
