function normalizeJsonText(responseText) {
    const trimmedText = String(responseText).trim();
    const fencedMatch = trimmedText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fencedMatch ? fencedMatch[1].trim() : trimmedText;
}

export function parseGeminiAnswer(responseText) {
    let parsedResponse;

    try {
        parsedResponse = JSON.parse(normalizeJsonText(responseText));
    } catch {
        throw new Error("Gemini did not return a valid JSON answer");
    }

    if (!parsedResponse || typeof parsedResponse !== "object") {
        throw new Error("Gemini did not return a valid JSON answer");
    }

    const answer = typeof parsedResponse.answer === "string"
        ? parsedResponse.answer.trim().toUpperCase()
        : "";
    const confidence = parsedResponse.confidence;

    if (!/^[A-Z]$/.test(answer) || typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        throw new Error("Gemini returned an invalid answer or confidence");
    }

    return { answer, confidence };
}
