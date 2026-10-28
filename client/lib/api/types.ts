/**
 * Canonical shapes for the public API. These mirror
 * `backend/src/services/*` exactly — keep them in sync with the server.
 * Dates arrive as ISO strings because the API serializes JSON.
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "CSRF_INVALID"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "DUPLICATE_MESSAGE"
  | "INVITE_INVALID"
  | "CHAT_CLOSED";

/** Error envelope: `{ error: { code, message, details? } }`. */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/* ---------------------------------- hero ----------------------------------- */

export type HeroSocialPlatform = "github" | "linkedin" | "twitter" | "email";

export type HeroSocial = {
  platform: HeroSocialPlatform;
  url: string;
};

export type HeroStat = {
  value: string;
  label: string;
  icon?: string;
};

export type Hero = {
  nameParts: string[];
  typingPhrases: string[];
  intro: string;
  location: string;
  availability: { isAvailable: boolean; label: string };
  stats: HeroStat[];
  socials: HeroSocial[];
  updatedAt: string | null;
};

/* ---------------------------------- about ---------------------------------- */

export type AboutMetric = { value: string; label: string };
export type AboutPrinciple = { icon: string; title: string; body: string };

export type About = {
  paragraphs: string[];
  tags: string[];
  metrics: AboutMetric[];
  principles: AboutPrinciple[];
  updatedAt: string | null;
};

export type CredentialItem = {
  id: string;
  kind: "degree" | "certification";
  title: string;
  issuer: string;
  period: string | null;
  detail: string | null;
};

/* -------------------------------- content ---------------------------------- */

export type SkillGroup = {
  id: string;
  title: string;
  icon: string;
  items: string[];
};

export type ExperienceItem = {
  id: string;
  type: "engineering" | "security";
  role: string;
  company: string;
  period: string;
  current: boolean;
  color: string;
  highlights: string[];
};

export type SecurityFocusItem = {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  skills: string[];
};

export type OwaspItem = { id: string; name: string; covered: boolean };
export type SecurityStat = { icon: string; label: string; value: string };

export type SecurityContent = {
  focus: SecurityFocusItem[];
  owasp: OwaspItem[];
  stats: SecurityStat[];
};

/* -------------------------------- projects --------------------------------- */

export type PublicProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  accentColor: string;
  tech: string[];
  stats: string[];
  liveUrl: string | null;
  githubUrl: string | null;
  /** Cover URL, already resolved to an absolute ImageKit URL by the API. */
  imageParent: string | null;
  /** Gallery URLs, absolute. */
  imageBox: string[];
  featured: boolean;
};

/* ------------------------------- site misc --------------------------------- */

export type Settings = {
  contactEmail: string;
  phone: string;
  location: string;
  updatedAt: string | null;
};

/** GET /resume */
export type ResumeMetadata =
  | { available: false }
  | {
      available: true;
      fileName: string;
      sizeBytes: number;
      updatedAt: string;
      downloadUrl: string;
    };

/** Resume block inside GET /site (no sizeBytes there — use GET /resume for it). */
export type SiteResume =
  | { available: false; downloadUrl: string }
  | {
      available: true;
      fileName: string;
      updatedAt: string;
      downloadUrl: string;
    };

/** GET /site — the aggregate used for a single-shot fetch. */
export type SiteDocument = {
  hero: Hero | null;
  about: About | null;
  credentials: CredentialItem[] | null;
  skills: SkillGroup[] | null;
  experience: ExperienceItem[] | null;
  projects: PublicProject[] | null;
  security: SecurityContent | null;
  settings: Settings | null;
  resume: SiteResume;
  generatedAt: string;
};

/* -------------------------------- contact ---------------------------------- */

export type ContactInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
};

export type ContactResult = { ok: boolean };
