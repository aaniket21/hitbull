import { createRunState } from "./run-state.js";

const defaultStorageKey = "hitbullseyeRunStates";

export function createRunStore(storageArea, storageKey = defaultStorageKey) {
    async function readStates() {
        const result = await storageArea.get(storageKey);
        return result[storageKey] ?? {};
    }

    return {
        async load(tabId) {
            const states = await readStates();
            return states[String(tabId)] ?? createRunState(tabId);
        },

        async save(state) {
            const states = await readStates();
            states[String(state.tabId)] = state;
            await storageArea.set({ [storageKey]: states });
        },

        async remove(tabId) {
            const states = await readStates();
            delete states[String(tabId)];
            await storageArea.set({ [storageKey]: states });
        },
    };
}
