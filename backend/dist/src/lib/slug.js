/** Convert a title to a URL-safe slug. */
export const slugify = (input) => {
    const slug = input
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100)
        .replace(/-+$/g, "");
    return slug || "project";
};
//# sourceMappingURL=slug.js.map