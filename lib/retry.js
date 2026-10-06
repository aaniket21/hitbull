export async function withRetries(operation, options = {}) {
    const retries = Math.max(0, options.retries ?? 0);
    const delayMs = Math.max(0, options.delayMs ?? 250);
    const sleep = options.sleep ?? ((delay) => new Promise((resolve) => setTimeout(resolve, delay)));
    let attempt = 0;

    while (true) {
        try {
            return await operation(attempt);
        } catch (error) {
            if (!error.retryable || attempt >= retries) {
                throw error;
            }
            await sleep(delayMs * (2 ** attempt));
            attempt += 1;
        }
    }
}
