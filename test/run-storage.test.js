import test from "node:test";
import assert from "node:assert/strict";
import { createRunState } from "../lib/run-state.js";
import { createRunStore } from "../lib/run-storage.js";

function createMemoryStorage() {
    const values = {};
    return {
        async get(key) {
            return { [key]: values[key] };
        },
        async set(update) {
            Object.assign(values, update);
        },
    };
}

test("loads an idle state when nothing is persisted", async () => {
    const store = createRunStore(createMemoryStorage());

    assert.deepEqual(await store.load(7), createRunState(7));
});

test("saves and restores execution state", async () => {
    const store = createRunStore(createMemoryStorage());
    const state = {
        ...createRunState(7),
        status: "waiting_answer",
        currentQuestion: 4,
    };

    await store.save(state);

    assert.deepEqual(await store.load(7), state);
});
