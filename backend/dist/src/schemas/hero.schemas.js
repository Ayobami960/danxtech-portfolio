import { z } from "zod";
export const heroSocialPlatforms = [
    "github",
    "linkedin",
    "twitter",
    "email",
];
const socialUrl = z
    .string()
    .max(2048)
    .refine((value) => {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "mailto:";
    }
    catch {
        return false;
    }
}, { message: "Social URLs must use https:// (mailto: is allowed for email)." });
export const heroInputSchema = z
    .object({
    nameParts: z
        .array(z.string().trim().min(1).max(30))
        .min(1)
        .max(4),
    typingPhrases: z
        .array(z.string().trim().min(1).max(60))
        .min(1)
        .max(10),
    intro: z.string().max(400),
    location: z.string().trim().max(100),
    isAvailable: z.boolean(),
    availabilityLabel: z.string().trim().min(1).max(120),
    stats: z
        .array(z
        .object({
        value: z.string().trim().min(1).max(12),
        label: z.string().trim().min(1).max(30),
    })
        .strict())
        .max(4),
    socials: z
        .array(z
        .object({
        platform: z.enum(heroSocialPlatforms),
        url: socialUrl,
    })
        .strict()
        .refine((social) => social.platform === "email" ||
        social.url.startsWith("https://"), {
        message: "Only the email platform may use a mailto: URL.",
        path: ["url"],
    }))
        .max(10),
})
    .strict();
//# sourceMappingURL=hero.schemas.js.map