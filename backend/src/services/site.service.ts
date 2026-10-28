import type { Request } from "express";
import { notFound } from "../lib/errors.js";
import { audit } from "../repositories/audit-writer.js";
import {
  createCredential,
  deleteCredential,
  findCredential,
  getAbout,
  getSettings,
  listCredentials,
  maxCredentialSortOrder,
  reorderCredentials,
  updateCredential,
  upsertAbout,
  upsertSettings,
} from "../repositories/site.repository.js";
import type {
  AboutInput,
  CreateCredentialInput,
  SettingsInput,
  UpdateCredentialInput,
} from "../schemas/site.schemas.js";
import { REVALIDATE_TAGS } from "../config/constants.js";
import { contentUpdated } from "./revalidate.service.js";
import { publicSkills, publicExperience, publicSecurity } from "./content.service.js";
import { readHero } from "./hero.service.js";
import { listPublic } from "./project.service.js";
import { readMetadata, resumeDownloadUrl } from "./resume.service.js";

/* ---------------------------------- about ---------------------------------- */

export const publicAbout = async () => {
  const about = await getAbout();
  if (!about) return null;
  return {
    paragraphs: about.paragraphs,
    tags: about.tags,
    metrics: about.metrics,
    principles: about.principles,
    updatedAt: about.updatedAt,
  };
};

export const adminAbout = async () => {
  const about = await getAbout();
  return (
    about ?? {
      id: "about",
      paragraphs: [],
      tags: [],
      metrics: [],
      principles: [],
      updatedAt: null,
    }
  );
};

export const saveAbout = async (request: Request, input: AboutInput) => {
  const saved = await upsertAbout(input);
  await audit(request, {
    action: "about.update",
    entity: "about",
    entityId: "about",
    meta: { fields: Object.keys(input) },
  });
  contentUpdated("about", [...REVALIDATE_TAGS.site]);
  return saved;
};

/* -------------------------------- credentials ------------------------------- */

export const publicCredentials = async () =>
  (await listCredentials()).map((credential) => ({
    id: credential.id,
    kind: credential.kind,
    title: credential.title,
    issuer: credential.issuer,
    period: credential.period,
    detail: credential.detail,
  }));

export const adminCredentials = async () => listCredentials();

export const createCredentialEntry = async (
  request: Request,
  input: CreateCredentialInput,
) => {
  const created = await createCredential({
    kind: input.kind,
    title: input.title,
    issuer: input.issuer ?? "",
    period: input.period ?? null,
    detail: input.detail ?? null,
    sortOrder: input.sortOrder ?? (await maxCredentialSortOrder()) + 1,
  });
  await audit(request, {
    action: "credential.create",
    entity: "credential",
    entityId: created.id,
  });
  contentUpdated("credentials", [...REVALIDATE_TAGS.site]);
  return created;
};

export const updateCredentialEntry = async (
  request: Request,
  id: string,
  input: UpdateCredentialInput,
) => {
  if (!(await findCredential(id))) throw notFound("Credential not found.");
  const updated = await updateCredential(id, input);
  if (!updated) throw notFound("Credential not found.");
  await audit(request, {
    action: "credential.update",
    entity: "credential",
    entityId: id,
    meta: { fields: Object.keys(input) },
  });
  contentUpdated("credentials", [...REVALIDATE_TAGS.site]);
  return updated;
};

export const removeCredential = async (
  request: Request,
  id: string,
): Promise<void> => {
  if (!(await findCredential(id))) throw notFound("Credential not found.");
  await deleteCredential(id);
  await audit(request, {
    action: "credential.delete",
    entity: "credential",
    entityId: id,
  });
  contentUpdated("credentials", [...REVALIDATE_TAGS.site]);
};

export const reorderCredentialEntries = async (
  request: Request,
  ids: string[],
): Promise<void> => {
  await reorderCredentials(ids);
  await audit(request, {
    action: "credential.reorder",
    entity: "credential",
    meta: { ids },
  });
  contentUpdated("credentials", [...REVALIDATE_TAGS.site]);
};

/* --------------------------------- settings -------------------------------- */

export const publicSettings = async () => {
  const settings = await getSettings();
  if (!settings) return null;
  return {
    contactEmail: settings.contactEmail,
    phone: settings.phone,
    location: settings.location,
    updatedAt: settings.updatedAt,
  };
};

export const adminSettings = async () => {
  const settings = await getSettings();
  return (
    settings ?? {
      id: "site",
      contactEmail: "",
      phone: "",
      location: "",
      updatedAt: null,
    }
  );
};

export const saveSettings = async (request: Request, input: SettingsInput) => {
  const saved = await upsertSettings(input);
  await audit(request, {
    action: "settings.update",
    entity: "settings",
    entityId: "site",
    meta: { fields: Object.keys(input) },
  });
  contentUpdated("siteSettings", [...REVALIDATE_TAGS.site]);
  return saved;
};

/* ---------------------------------- site ----------------------------------- */

export type SiteDocument = {
  hero: Awaited<ReturnType<typeof readHero>> | null;
  about: Awaited<ReturnType<typeof publicAbout>>;
  credentials: Awaited<ReturnType<typeof publicCredentials>>;
  skills: Awaited<ReturnType<typeof publicSkills>>;
  experience: Awaited<ReturnType<typeof publicExperience>>;
  projects: Awaited<ReturnType<typeof listPublic>>;
  security: Awaited<ReturnType<typeof publicSecurity>>;
  settings: Awaited<ReturnType<typeof publicSettings>>;
  resume: {
    available: boolean;
    fileName?: string;
    updatedAt?: Date;
    downloadUrl: string;
  };
  generatedAt: string;
};

/** One cacheable document with every public section the landing page needs. */
export const siteDocument = async (): Promise<SiteDocument> => {
  const [hero, about, credentials, skills, experience, projects, security, settings, resume] =
    await Promise.all([
      readHero().catch(() => null),
      publicAbout(),
      publicCredentials(),
      publicSkills(),
      publicExperience(),
      listPublic(),
      publicSecurity(),
      publicSettings(),
      readMetadata(),
    ]);

  return {
    hero,
    about,
    credentials,
    skills,
    experience,
    projects,
    security,
    settings,
    resume:        resume.available
      ? {
          available: true,
          fileName: resume.fileName,
          updatedAt: resume.updatedAt,
          downloadUrl: resumeDownloadUrl(resume.updatedAt),
        }
      : { available: false, downloadUrl: "/api/v1/resume/download" },
    generatedAt: new Date().toISOString(),
  };
};
