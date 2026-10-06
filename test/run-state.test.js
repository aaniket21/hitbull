import test from "node:test";
import assert from "node:assert/strict";
import { createRunState, transitionRunState } from "../lib/run-state.js";

test("creates an idle run and starts it", () => {
    const initialState = createRunState(42);
    const startedState = transitionRunState(initialState, "start");

    assert.equal(initialState.status, "idle");
    assert.equal(startedState.status, "waiting_question");
    assert.equal(startedState.step, "capture");
    assert.equal(startedState.tabId, 42);
});

test("arms outside the test page and activates when the test page is ready", () => {
    const armedState = transitionRunState(createRunState(42), "start", { armed: true, startedAt: 0 });
    const activeState = transitionRunState(armedState, "page_ready");

    assert.equal(armedState.status, "armed");
    assert.equal(activeState.status, "waiting_question");
});

test("pauses and resumes without losing progress", () => {
    const state = {
        ...createRunState(42),
        status: "waiting_answer",
        step: "answer",
        currentQuestion: 3,
        completedCount: 2,
    };

    const pausedState = transitionRunState(state, "pause");
    const resumedState = transitionRunState(pausedState, "resume");

    assert.equal(pausedState.status, "paused");
    assert.equal(resumedState.status, "waiting_question");
    assert.equal(resumedState.step, "answer");
    assert.equal(resumedState.currentQuestion, 3);
    assert.equal(resumedState.completedCount, 2);
});

test("rejects an invalid transition", () => {
    assert.throws(
        () => transitionRunState(createRunState(42), "pause"),
        /cannot pause/,
    );
});

test("completes one question and retries an error without losing progress", () => {
    let state = transitionRunState(createRunState(42), "start", { startedAt: 0 });
    state = transitionRunState(state, "question_ready");
    state = transitionRunState(state, "capture_complete");
    state = transitionRunState(state, "answer_received", { activeKeyId: "one" });
    state = transitionRunState(state, "answer_selected");
    state = transitionRunState(state, "next_question");
    state = transitionRunState(state, "error", { message: "question did not load" });
    state = transitionRunState(state, "retry");

    assert.equal(state.status, "waiting_question");
    assert.equal(state.step, "capture");
    assert.equal(state.currentQuestion, 1);
    assert.equal(state.completedCount, 1);
    assert.equal(state.lastError, null);
});

test("tracks the four automation steps in order", () => {
    let state = transitionRunState(createRunState(42), "start", { startedAt: 0 });
    assert.equal(state.step, "capture");
    state = transitionRunState(state, "question_ready");
    state = transitionRunState(state, "capture_complete");
    assert.equal(state.step, "answer");
    state = transitionRunState(state, "answer_received", { activeKeyId: "one" });
    assert.equal(state.step, "select");
    state = transitionRunState(state, "answer_selected");
    assert.equal(state.step, "next");
    state = transitionRunState(state, "next_question");
    assert.equal(state.step, "capture");
});
