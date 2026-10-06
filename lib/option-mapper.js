export function findAnswerOption(options, answer) {
    const normalizedAnswer = String(answer).trim().toUpperCase();
    const matchingOption = options.find((option) => option.answer.toUpperCase() === normalizedAnswer);

    if (!matchingOption) {
        throw new Error(`Answer ${normalizedAnswer} does not match a visible option`);
    }

    return matchingOption;
}
