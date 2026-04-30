export async function runWithConcurrency<T>(
    items: T[],
    fn: (item: T) => Promise<void>,
    concurrency: number
): Promise<void> {
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const i = index++;
            await fn(items[i]);
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
}
