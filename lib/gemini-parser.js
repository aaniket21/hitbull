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

    const legacyAnswer = parsedResponse.answer === undefined || parsedResponse.answer === null
        ? ""
        : String(parsedResponse.answer).trim();
    const optionText = String(parsedResponse.optionText ?? (!/^\d+$/.test(legacyAnswer) ? legacyAnswer : "")).trim();
    const rawOptionNumber = parsedResponse.optionNumber ?? (/^\d+$/.test(legacyAnswer) ? legacyAnswer : null);
    const optionNumber = rawOptionNumber === null || rawOptionNumber === ""
        ? null
        : Number(rawOptionNumber);
    const confidence = parsedResponse.confidence;

    if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        throw new Error("Gemini returned an invalid answer or confidence");
    }

    if (optionNumber !== null && (!Number.isInteger(optionNumber) || optionNumber < 1)) {
        throw new Error("Gemini returned an invalid option number");
    }

    if (questionDetected && ((!optionText && optionNumber === null) || optionText.length > 200 || /[\r\n]/.test(optionText))) {
        throw new Error("Gemini must return one exact option text, number, or letter");
    }

    return { questionDetected, optionNumber, optionText, confidence };
}
