import {
  errorMessage,
  fetchAbout,
  fetchCredentials,
  fetchExperience,
  fetchHero,
  fetchProjects,
  fetchResume,
  fetchSecurity,
  fetchSettings,
  fetchSkills,
} from "./api";
import type {
  About,
  CredentialItem,
  ExperienceItem,
  Hero,
  PublicProject,
  ResumeMetadata,
  SecurityContent,
  Settings,
  SkillGroup,
} from "./api";

/**
 * A request that has settled. The page renders only after every result here is
 * settled, so a failure shows its own error block instead of keeping the
 * global loading screen up, and one failing request never hides the others.
 */
export type InitialResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

const settle = <T,>(task: Promise<T>): Promise<InitialResult<T>> =>
  task.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, message: errorMessage(error) }),
  );

/** Use a settled value, or a fallback when the request failed. */
export const valueOr = <T,>(result: InitialResult<T>, fallback: T): T =>
  result.ok ? result.value : fallback;

export type InitialContent = {
  hero: InitialResult<Hero>;
  about: InitialResult<About | null>;
  credentials: InitialResult<CredentialItem[]>;
  skills: InitialResult<SkillGroup[]>;
  experience: InitialResult<ExperienceItem[]>;
  security: InitialResult<SecurityContent>;
  projects: InitialResult<PublicProject[]>;
  settings: InitialResult<Settings | null>;
  resume: InitialResult<ResumeMetadata>;
};

/**
 * The one read behind the landing page's initial render.
 *
 * Each endpoint is requested once, even though several sections use the same
 * data (hero/settings were previously fetched three times, about and
 * credentials twice). All requests start together and this resolves only when
 * every one of them has settled: success, failure, or an empty response. That
 * is what lets a single route-level loading screen cover the whole initial
 * load — there is no per-section fetching left to show a spinner for.
 */
export const loadInitialContent = async (): Promise<InitialContent> => {
  const [
    hero,
    about,
    credentials,
    skills,
    experience,
    security,
    projects,
    settings,
    resume,
  ] = await Promise.all([
    settle(fetchHero()),
    settle(fetchAbout()),
    settle(fetchCredentials()),
    settle(fetchSkills()),
    settle(fetchExperience()),
    settle(fetchSecurity()),
    settle(fetchProjects()),
    settle(fetchSettings()),
    settle(fetchResume()),
  ]);

  return {
    hero,
    about,
    credentials,
    skills,
    experience,
    security,
    projects,
    settings,
    resume,
  };
};
