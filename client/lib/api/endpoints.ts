import { apiGet, apiPost } from "./client";
import type {
  About,
  ContactInput,
  ContactResult,
  CredentialItem,
  ExperienceItem,
  Hero,
  PublicProject,
  ResumeMetadata,
  SecurityContent,
  Settings,
  SiteDocument,
  SkillGroup,
} from "./types";

/**
 * Cache tags. The first six match `REVALIDATE_TAGS` in the backend, so an
 * admin mutation busts exactly the sections it touched.
 *
 * `site` covers about / credentials / settings: the backend does not emit a
 * revalidate tag for those mutations yet, so they refresh on the revalidate
 * window below instead of instantly.
 */
export const CACHE_TAGS = {
  hero: "hero",
  projects: "projects",
  resume: "resume",
  skills: "skills",
  experience: "experience",
  security: "security",
  site: "site",
} as const;

const SITE_WINDOW_SECONDS = 60;

export const fetchHero = (): Promise<Hero> =>
  apiGet<Hero>("/hero", { tags: [CACHE_TAGS.hero] });

export const fetchAbout = (): Promise<About | null> =>
  apiGet<About | null>("/about", { tags: [CACHE_TAGS.site], revalidate: SITE_WINDOW_SECONDS });

export const fetchCredentials = (): Promise<CredentialItem[]> =>
  apiGet<CredentialItem[]>("/credentials", {
    tags: [CACHE_TAGS.site],
    revalidate: SITE_WINDOW_SECONDS,
  });

export const fetchSkills = (): Promise<SkillGroup[]> =>
  apiGet<SkillGroup[]>("/skills", { tags: [CACHE_TAGS.skills] });

export const fetchExperience = (): Promise<ExperienceItem[]> =>
  apiGet<ExperienceItem[]>("/experience", { tags: [CACHE_TAGS.experience] });

export const fetchSecurity = (): Promise<SecurityContent> =>
  apiGet<SecurityContent>("/security", { tags: [CACHE_TAGS.security] });

export const fetchProjects = (tech?: string): Promise<PublicProject[]> =>
  apiGet<PublicProject[]>(
    tech ? `/projects?tech=${encodeURIComponent(tech)}` : "/projects",
    { tags: [CACHE_TAGS.projects] },
  );

export const fetchProject = (slug: string): Promise<PublicProject> =>
  apiGet<PublicProject>(`/projects/${encodeURIComponent(slug)}`, {
    tags: [CACHE_TAGS.projects],
  });

export const fetchSettings = (): Promise<Settings | null> =>
  apiGet<Settings | null>("/settings", {
    tags: [CACHE_TAGS.site],
    revalidate: SITE_WINDOW_SECONDS,
  });

/**
 * Availability changes only on upload/delete, and the backend revalidates the
 * `resume` tag for both, so this stays cacheable instead of forcing the page
 * to render dynamically.
 */
export const fetchResume = (): Promise<ResumeMetadata> =>
  apiGet<ResumeMetadata>("/resume", { tags: [CACHE_TAGS.resume] });

/** One-shot aggregate, used where a single document is enough. */
export const fetchSite = (): Promise<SiteDocument> =>
  apiGet<SiteDocument>("/site", { tags: [CACHE_TAGS.site] });

export const sendContact = (input: ContactInput): Promise<ContactResult> =>
  apiPost<ContactResult>("/contact", input);
