import { z } from "zod";
const hexColor = z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "color must be a 6-digit hex colour.");
const shortText = (max) => z.string().trim().min(1).max(max);
/* --------------------------------- skills --------------------------------- */
export const createSkillGroupSchema = z
    .object({
    title: shortText(80),
    icon: shortText(16).default("🛠️"),
    color: hexColor.default("#4f8ef7"),
    items: z.array(shortText(60)).max(40).default([]),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
})
    .strict();
export const updateSkillGroupSchema = createSkillGroupSchema
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
});
/* -------------------------------- experience ------------------------------- */
export const createExperienceSchema = z
    .object({
    type: z.enum(["engineering", "security"]).default("engineering"),
    role: shortText(120),
    company: shortText(120),
    period: shortText(60),
    isCurrent: z.boolean().default(false),
    color: hexColor.default("#4f8ef7"),
    highlights: z.array(shortText(500)).max(30).default([]),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
})
    .strict();
export const updateExperienceSchema = createExperienceSchema
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
});
/* ------------------------------ security focus ----------------------------- */
export const createSecurityFocusSchema = z
    .object({
    title: shortText(120),
    icon: shortText(16).default("🛡️"),
    color: hexColor.default("#ef4444"),
    description: z.string().max(1000).default(""),
    skills: z.array(shortText(60)).max(30).default([]),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
})
    .strict();
export const updateSecurityFocusSchema = createSecurityFocusSchema
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
});
/* --------------------------------- OWASP ---------------------------------- */
export const createOwaspItemSchema = z
    .object({
    code: z
        .string()
        .trim()
        .min(2)
        .max(8)
        .regex(/^[A-Z0-9]+$/, "code must be uppercase letters and digits."),
    name: shortText(120),
    covered: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
})
    .strict();
export const updateOwaspItemSchema = createOwaspItemSchema
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
});
/* ------------------------------ security stats ----------------------------- */
export const createSecurityStatSchema = z
    .object({
    icon: shortText(16).default("🔒"),
    label: shortText(60),
    value: shortText(20),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
})
    .strict();
export const updateSecurityStatSchema = createSecurityStatSchema
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
});
//# sourceMappingURL=content.schemas.js.map