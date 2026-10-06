export class KeyManager {
    constructor(keys = [], options = {}) {
        this.cooldownMs = options.cooldownMs ?? 30_000;
        this.now = options.now ?? (() => Date.now());
        this.keys = keys.map((key, index) => ({
            id: key.id ?? `key-${index + 1}`,
            key: key.key,
            enabled: key.enabled !== false,
            cooldownUntil: key.cooldownUntil ?? 0,
        }));
        this.cursor = 0;
    }

    next() {
        if (this.keys.length === 0) {
            return null;
        }

        const currentTime = this.now();
        for (let offset = 0; offset < this.keys.length; offset += 1) {
            const index = (this.cursor + offset) % this.keys.length;
            const candidate = this.keys[index];
            if (!candidate.enabled || candidate.cooldownUntil > currentTime) {
                continue;
            }

            this.cursor = (index + 1) % this.keys.length;
            return { ...candidate };
        }

        return null;
    }

    markFailure(id) {
        const failedKey = this.keys.find((key) => key.id === id);
        if (!failedKey) {
            return;
        }

        failedKey.cooldownUntil = this.now() + this.cooldownMs;
    }

    markSuccess(id) {
        const successfulKey = this.keys.find((key) => key.id === id);
        if (successfulKey) {
            successfulKey.cooldownUntil = 0;
        }
    }

    getStatus() {
        return this.keys.map(({ id, enabled, cooldownUntil }) => ({
            id,
            enabled,
            cooldownUntil,
        }));
    }
}
