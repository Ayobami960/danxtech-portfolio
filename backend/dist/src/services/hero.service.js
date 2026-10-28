import { getHero, upsertHero } from "../repositories/hero.repository.js";
import { audit } from "../repositories/audit-writer.js";
import { contentUpdated } from "./revalidate.service.js";
import { REVALIDATE_TAGS } from "../config/constants.js";
const DEFAULT_HERO = {
    nameParts: [],
    typingPhrases: [],
    intro: "",
    location: "",
    availability: {
        isAvailable: true,
        label: "Available for new opportunities",
    },
    stats: [],
    socials: [],
    updatedAt: null,
};
export const toPublicHero = (hero) => {
    if (!hero)
        return DEFAULT_HERO;
    return {
        nameParts: hero.nameParts,
        typingPhrases: hero.typingPhrases,
        intro: hero.intro,
        location: hero.location,
        availability: {
            isAvailable: hero.isAvailable,
            label: hero.availabilityLabel,
        },
        stats: hero.stats,
        socials: hero.socials,
        updatedAt: hero.updatedAt,
    };
};
export const readHero = async () => toPublicHero(await getHero());
/** The editable shape: availability arrives flat instead of nested. */
const toAdminHero = (hero) => ({
    nameParts: hero?.nameParts ?? [],
    typingPhrases: hero?.typingPhrases ?? [],
    intro: hero?.intro ?? "",
    location: hero?.location ?? "",
    isAvailable: hero?.isAvailable ?? true,
    availabilityLabel: hero?.availabilityLabel ?? "Available for new opportunities",
    stats: hero?.stats ?? [],
    socials: hero?.socials ?? [],
    updatedAt: hero?.updatedAt ?? null,
});
export const readAdminHero = async () => toAdminHero(await getHero());
export const writeHero = async (request, input) => {
    const hero = await upsertHero({
        nameParts: input.nameParts,
        typingPhrases: input.typingPhrases,
        intro: input.intro,
        location: input.location,
        isAvailable: input.isAvailable,
        availabilityLabel: input.availabilityLabel,
        stats: input.stats,
        socials: input.socials,
    });
    await audit(request, {
        action: "hero.update",
        entity: "hero",
        entityId: "hero",
    });
    contentUpdated("hero", [...REVALIDATE_TAGS.hero]);
    return toAdminHero(hero);
};
//# sourceMappingURL=hero.service.js.map