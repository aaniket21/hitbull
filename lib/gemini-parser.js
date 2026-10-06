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

    const questionDetected = parsedResponse.questionDetected !== false;
    if (parsedResponse.questionDetected !== undefined && typeof parsedResponse.questionDetected !== "boolean") {
        throw new Error("Gemini returned an invalid question-detection flag");
    }

    const answer = parsedResponse.answer === undefined || parsedResponse.answer === null
        ? ""
        : String(parsedResponse.answer).trim();
    const confidence = parsedResponse.confidence;

    if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        throw new Error("Gemini returned an invalid answer or confidence");
    }

    if (questionDetected && (!answer || answer.length > 200 || /[\r\n]/.test(answer))) {
        throw new Error("Gemini returned an invalid answer or confidence");
    }

    return { questionDetected, answer, confidence };
}
