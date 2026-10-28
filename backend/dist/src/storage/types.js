export const assertSafeKey = (key) => {
    if (!key ||
        key.startsWith("/") ||
        key.includes("..") ||
        key.includes("\\") ||
        key.includes("\0")) {
        throw new Error("Unsafe storage key.");
    }
};
//# sourceMappingURL=types.js.map