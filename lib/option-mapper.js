export function findAnswerOption(options, answer) {
    const rawAnswer = String(answer).trim();
    const normalizedAnswer = rawAnswer.toUpperCase();
    const normalizedText = rawAnswer.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const numberMatch = normalizedText.match(/^(?:option|choice|answer)?\s*(\d+)$/);
    const letterMatch = normalizedAnswer.match(/^(?:OPTION\s*)?([A-Z])$/);
    const matchingOption = numberMatch
        ? options[Number(numberMatch[1]) - 1]
        : options.find((option, index) => option.answer.toUpperCase() === letterMatch?.[1]
            || option.value.toUpperCase() === normalizedAnswer
            || option.label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === normalizedText
            || index + 1 === Number(normalizedAnswer));

    if (!matchingOption) {
        throw new Error(`Answer ${normalizedAnswer} does not match a visible option`);
    }

    return matchingOption;
}
