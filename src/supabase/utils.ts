export function describeError(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return typeof error === 'string' ? error : fallback;
}

export function isMissingRelationError(error: unknown, relationName: string) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const code = 'code' in error ? (error as { code?: unknown }).code : undefined;
    const message = 'message' in error ? (error as { message?: unknown }).message : undefined;
    return code === '42P01'
        || code === 'PGRST204'
        || code === 'PGRST205'
        || (typeof message === 'string' && message.toLowerCase().includes(relationName.toLowerCase()));
}
