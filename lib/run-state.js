const activeStatuses = new Set([
    "waiting_question",
    "capturing",
    "waiting_answer",
    "selecting",
    "navigating",
]);

export function createRunState(tabId = null) {
    return {
        status: "idle",
        tabId,
        currentQuestion: 0,
        completedCount: 0,
        activeKeyId: null,
        lastError: null,
        startedAt: null,
    };
}

export function transitionRunState(state, action, details = {}) {
    const nextState = { ...state, lastError: null };

    if (action === "start") {
        if (state.status !== "idle" && state.status !== "stopped" && state.status !== "completed") {
            throw new Error(`cannot start from ${state.status}`);
        }
        return {
            ...createRunState(state.tabId),
            status: details.armed ? "armed" : "waiting_question",
            startedAt: details.startedAt ?? Date.now(),
        };
    }

    if (action === "page_ready") {
        if (state.status !== "armed") {
            throw new Error(`cannot activate from ${state.status}`);
        }
        return { ...nextState, status: "waiting_question" };
    }

    if (action === "pause") {
        if (!activeStatuses.has(state.status)) {
            throw new Error(`cannot pause from ${state.status}`);
        }
        return { ...nextState, status: "paused" };
    }

    if (action === "resume") {
        if (state.status !== "paused") {
            throw new Error(`cannot resume from ${state.status}`);
        }
        return { ...nextState, status: "waiting_question" };
    }

    if (action === "stop") {
        if (state.status === "idle" || state.status === "completed") {
            throw new Error(`cannot stop from ${state.status}`);
        }
        return { ...nextState, status: "stopped" };
    }

    if (action === "question_ready") {
        if (state.status !== "waiting_question") {
            throw new Error(`cannot capture from ${state.status}`);
        }
        return { ...nextState, status: "capturing" };
    }

    if (action === "capture_complete") {
        if (state.status !== "capturing") {
            throw new Error(`cannot request answer from ${state.status}`);
        }
        return { ...nextState, status: "waiting_answer" };
    }

    if (action === "answer_received") {
        if (state.status !== "waiting_answer") {
            throw new Error(`cannot select from ${state.status}`);
        }
        return { ...nextState, status: "selecting", activeKeyId: details.activeKeyId ?? state.activeKeyId };
    }

    if (action === "answer_selected") {
        if (state.status !== "selecting") {
            throw new Error(`cannot navigate from ${state.status}`);
        }
        return { ...nextState, status: "navigating" };
    }

    if (action === "next_question") {
        if (state.status !== "navigating") {
            throw new Error(`cannot continue from ${state.status}`);
        }
        return {
            ...nextState,
            status: "waiting_question",
            currentQuestion: state.currentQuestion + 1,
            completedCount: state.completedCount + 1,
        };
    }

    if (action === "complete") {
        if (!activeStatuses.has(state.status) && state.status !== "navigating") {
            throw new Error(`cannot complete from ${state.status}`);
        }
        return { ...nextState, status: "completed" };
    }

    if (action === "error") {
        if (state.status === "idle" || state.status === "completed" || state.status === "stopped") {
            throw new Error(`cannot fail from ${state.status}`);
        }
        return { ...state, status: "error", lastError: details.message ?? "Unknown error" };
    }

    if (action === "retry") {
        if (state.status !== "error") {
            throw new Error(`cannot retry from ${state.status}`);
        }
        return { ...nextState, status: "waiting_question" };
    }

    throw new Error(`unknown run action: ${action}`);
}
