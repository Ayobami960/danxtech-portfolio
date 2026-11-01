export type CompletenessInput = {
  title: string;
  description: string;
  tech: string[];
  stats: string[];
  liveUrl?: string | null;
  githubUrl?: string | null;
  hasCover: boolean;
  galleryCount: number;
};

export type CompletenessCheck = { label: string; weight: number; ok: boolean };

const TOTAL = 90;

export const completenessChecks = (p: CompletenessInput): CompletenessCheck[] => [
  { label: "Title", weight: 10, ok: p.title.trim().length > 0 },
  { label: "Description of 80+ characters", weight: 15, ok: p.description.trim().length >= 80 },
  { label: "At least 3 technologies", weight: 15, ok: p.tech.length >= 3 },
  { label: "Two or more stats", weight: 10, ok: p.stats.filter((s) => s.trim()).length >= 2 },
  { label: "Live URL", weight: 10, ok: Boolean(p.liveUrl?.trim()) },
  { label: "GitHub URL", weight: 5, ok: Boolean(p.githubUrl?.trim()) },
  { label: "Cover image", weight: 15, ok: p.hasCover },
  { label: "Three or more gallery images", weight: 10, ok: p.galleryCount >= 3 },
];

/** 0–100, derived from what the project actually contains. */
export const completenessScore = (p: CompletenessInput): number =>
  Math.round(
    (completenessChecks(p).reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0) / TOTAL) * 100,
  );
