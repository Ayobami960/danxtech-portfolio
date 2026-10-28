import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  heroContent,
  type HeroContent,
  type NewHeroContent,
} from "../database/schema.js";
import { HERO_ID } from "../config/constants.js";

export const getHero = async (): Promise<HeroContent | null> => {
  const rows = await db
    .select()
    .from(heroContent)
    .where(eq(heroContent.id, HERO_ID))
    .limit(1);
  return rows[0] ?? null;
};

export const upsertHero = async (
  values: Omit<NewHeroContent, "id" | "updatedAt">,
): Promise<HeroContent> => {
  const rows = await db
    .insert(heroContent)
    .values({ ...values, id: HERO_ID })
    .onConflictDoUpdate({
      target: heroContent.id,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  const hero = rows[0];
  if (!hero) throw new Error("Failed to save hero content.");
  return hero;
};
