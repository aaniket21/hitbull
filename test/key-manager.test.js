import test from "node:test";
import assert from "node:assert/strict";
import { KeyManager } from "../lib/key-manager.js";

const keys = [
    { id: "one", key: "key-one", enabled: true },
    { id: "two", key: "key-two", enabled: true },
];

test("cycles through enabled keys in order", () => {
    const manager = new KeyManager(keys, { cooldownMs: 1000, now: () => 0 });

    assert.equal(manager.next().id, "one");
    assert.equal(manager.next().id, "two");
    assert.equal(manager.next().id, "one");
});

test("skips a key during its cooldown", () => {
    let currentTime = 0;
    const manager = new KeyManager(keys, { cooldownMs: 1000, now: () => currentTime });

    manager.next();
    manager.markFailure("one");
    assert.equal(manager.next().id, "two");

    currentTime = 1001;
    assert.equal(manager.next().id, "one");
});
