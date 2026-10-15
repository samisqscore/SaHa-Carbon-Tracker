declare module 'fast-levenshtein' {
    export function get(str1: string, str2: string, options?: any): number;
}

// Augment Express global User type so req.user.id and req.user.provider are typed
// without requiring `as any` casts throughout the server codebase.
declare global {
    namespace Express {
        interface User {
            id: string;
            email?: string | null;
            role?: string | null;
            status?: string | null;
            provider?: string;
        }
    }
}

export { };
