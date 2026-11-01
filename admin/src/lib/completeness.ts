/**
 * Completeness score used by the project list (ring) and the editor (score card).
 * Weights and labels follow the reference design and add up to 100.
 */
export type CompletenessInput = {
  title: string;
  description: string;
  tech: string[];
  stats: string[];
  liveUrl?: string | null;
  githubUrl?: string | null;
  hasCover: boolean;
  galleryCount: number;
  hasDocument: boolean;
};

export type CompletenessCheck = {
  label: string;
  weight: number;
  passed: (input: CompletenessInput) => boolean;
};

const filled = (value: string | null | undefined): boolean => (value ?? "").trim().length > 0;

export const COMPLETENESS_CHECKS: CompletenessCheck[] = [
  { label: "Title", weight: 10, passed: (p) => filled(p.title) },
  { label: "Description of 80+ characters", weight: 15, passed: (p) => (p.description ?? "").trim().length >= 80 },
  { label: "At least 3 technologies", weight: 15, passed: (p) => p.tech.length >= 3 },
  { label: "Two or more stats", weight: 10, passed: (p) => p.stats.filter((s) => filled(s)).length >= 2 },
  { label: "Live URL", weight: 10, passed: (p) => filled(p.liveUrl) },
  { label: "GitHub URL", weight: 5, passed: (p) => filled(p.githubUrl) },
  { label: "Cover image", weight: 15, passed: (p) => p.hasCover },
  { label: "Three or more gallery images", weight: 10, passed: (p) => p.galleryCount >= 3 },
  { label: "Project PDF", weight: 10, passed: (p) => p.hasDocument },
];

export const completenessScore = (input: CompletenessInput): number =>
  COMPLETENESS_CHECKS.reduce((sum, check) => sum + (check.passed(input) ? check.weight : 0), 0);

export const completenessHint = (score: number): string =>
  score >= 90
    ? "Ready to feature on your site."
    : score >= 60
      ? "Good. A few details left."
      : "Add details to make it stand out.";
