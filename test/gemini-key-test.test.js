import test from "node:test";
import assert from "node:assert/strict";
import { testGeminiKey } from "../lib/gemini-client.js";

test("reports a usable Gemini key", async () => {
    const fetchImpl = async (url) => {
        assert.match(url, /models\?key=key-one$/);
        return new Response("{}", { status: 200 });
    };

    assert.equal(await testGeminiKey({ apiKey: "key-one", fetchImpl }), true);
});

test("reports an invalid Gemini key without exposing it", async () => {
    const fetchImpl = async () => new Response("unauthorized", { status: 401 });

    await assert.rejects(
        () => testGeminiKey({ apiKey: "key-one", fetchImpl }),
        (error) => error.status === 401 && !error.message.includes("key-one"),
    );
});
