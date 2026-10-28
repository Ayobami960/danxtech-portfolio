import type { Request } from "express";
import { notFound } from "../lib/errors.js";
import { REVALIDATE_TAGS } from "../config/constants.js";
import {
  createExperience,
  createOwaspItem,
  createSecurityFocus,
  createSecurityStat,
  createSkillGroup,
  deleteExperience,
  deleteOwaspItem,
  deleteSecurityFocus,
  deleteSecurityStat,
  deleteSkillGroup,
  findExperience,
  findOwaspItem,
  findSecurityFocus,
  findSecurityStat,
  findSkillGroup,
  listExperiences,
  listOwaspItems,
  listSecurityFocusAreas,
  listSecurityStats,
  listSkillGroups,
  maxExperienceSortOrder,
  maxOwaspSortOrder,
  maxSecurityFocusSortOrder,
  maxSecurityStatSortOrder,
  maxSkillSortOrder,
  reorderExperiences,
  reorderOwaspItems,
  reorderSecurityFocusAreas,
  reorderSecurityStats,
  reorderSkillGroups,
  updateExperience,
  updateOwaspItem,
  updateSecurityFocus,
  updateSecurityStat,
  updateSkillGroup,
} from "../repositories/content.repository.js";
import { audit } from "../repositories/audit-writer.js";
import { contentUpdated } from "./revalidate.service.js";

/* ---------------------------------- skills --------------------------------- */

export const publicSkills = async () =>
  (await listSkillGroups()).map((group) => ({
    id: group.id,
    title: group.title,
    icon: group.icon,
    items: group.items,
    color: group.color
  }));

export const adminSkills = async () => listSkillGroups();

export const createSkill = async (
  request: Request,
  input: Parameters<typeof createSkillGroup>[0],
) => {
  const created = await createSkillGroup({
    ...input,
    sortOrder: input.sortOrder ?? (await maxSkillSortOrder()) + 1,
  });
  await audit(request, {
    action: "skill.create",
    entity: "skill_group",
    entityId: created.id,
  });
  contentUpdated("skills", [...REVALIDATE_TAGS.skills]);
  return created;
};

export const updateSkill = async (
  request: Request,
  id: string,
  input: Parameters<typeof updateSkillGroup>[1],
) => {
  if (!(await findSkillGroup(id))) throw notFound("Skill group not found.");
  const updated = await updateSkillGroup(id, input);
  if (!updated) throw notFound("Skill group not found.");
  await audit(request, {
    action: "skill.update",
    entity: "skill_group",
    entityId: id,
    meta: { fields: Object.keys(input) },
  });
  contentUpdated("skills", [...REVALIDATE_TAGS.skills]);
  return updated;
};

export const removeSkill = async (
  request: Request,
  id: string,
): Promise<void> => {
  if (!(await findSkillGroup(id))) throw notFound("Skill group not found.");
  await deleteSkillGroup(id);
  await audit(request, {
    action: "skill.delete",
    entity: "skill_group",
    entityId: id,
  });
  contentUpdated("skills", [...REVALIDATE_TAGS.skills]);
};

export const reorderSkill = async (
  request: Request,
  ids: string[],
): Promise<void> => {
  await reorderSkillGroups(ids);
  await audit(request, {
    action: "skill.reorder",
    entity: "skill_group",
    meta: { ids },
  });
  contentUpdated("skills", [...REVALIDATE_TAGS.skills]);
};

/* -------------------------------- experience ------------------------------- */

export const publicExperience = async () =>
  (await listExperiences()).map((entry) => ({
    id: entry.id,
    type: entry.type,
    role: entry.role,
    company: entry.company,
    period: entry.period,
    current: entry.isCurrent,
    color: entry.color,
    highlights: entry.highlights,
  }));

export const adminExperience = async () => listExperiences();

export const createExperienceEntry = async (
  request: Request,
  input: Parameters<typeof createExperience>[0],
) => {
  const created = await createExperience({
    ...input,
    sortOrder: input.sortOrder ?? (await maxExperienceSortOrder()) + 1,
  });
  await audit(request, {
    action: "experience.create",
    entity: "experience",
    entityId: created.id,
  });
  contentUpdated("experience", [...REVALIDATE_TAGS.experience]);
  return created;
};

export const updateExperienceEntry = async (
  request: Request,
  id: string,
  input: Parameters<typeof updateExperience>[1],
) => {
  if (!(await findExperience(id))) throw notFound("Experience not found.");
  const updated = await updateExperience(id, input);
  if (!updated) throw notFound("Experience not found.");
  await audit(request, {
    action: "experience.update",
    entity: "experience",
    entityId: id,
    meta: { fields: Object.keys(input) },
  });
  contentUpdated("experience", [...REVALIDATE_TAGS.experience]);
  return updated;
};

export const removeExperience = async (
  request: Request,
  id: string,
): Promise<void> => {
  if (!(await findExperience(id))) throw notFound("Experience not found.");
  await deleteExperience(id);
  await audit(request, {
    action: "experience.delete",
    entity: "experience",
    entityId: id,
  });
  contentUpdated("experience", [...REVALIDATE_TAGS.experience]);
};

export const reorderExperience = async (
  request: Request,
  ids: string[],
): Promise<void> => {
  await reorderExperiences(ids);
  await audit(request, {
    action: "experience.reorder",
    entity: "experience",
    meta: { ids },
  });
  contentUpdated("experience", [...REVALIDATE_TAGS.experience]);
};

/* ------------------------------ security focus ----------------------------- */

export const publicSecurity = async () => {
  const [focus, owasp, stats] = await Promise.all([
    listSecurityFocusAreas(),
    listOwaspItems(),
    listSecurityStats(),
  ]);

  return {
    focus: focus.map((area) => ({
      id: area.id,
      title: area.title,
      icon: area.icon,
      color: area.color,
      description: area.description,
      skills: area.skills,
    })),
    owasp: owasp.map((item) => ({
      id: item.code,
      name: item.name,
      covered: item.covered,
    })),
    stats: stats.map((stat) => ({
      icon: stat.icon,
      label: stat.label,
      value: stat.value,
    })),
  };
};

export const adminSecurityFocus = async () => listSecurityFocusAreas();
export const adminOwasp = async () => listOwaspItems();
export const adminSecurityStats = async () => listSecurityStats();

export const createFocus = async (
  request: Request,
  input: Parameters<typeof createSecurityFocus>[0],
) => {
  const created = await createSecurityFocus({
    ...input,
    sortOrder: input.sortOrder ?? (await maxSecurityFocusSortOrder()) + 1,
  });
  await audit(request, {
    action: "security.focus.create",
    entity: "security_focus",
    entityId: created.id,
  });
  contentUpdated("security", [...REVALIDATE_TAGS.security]);
  return created;
};

export const updateFocus = async (
  request: Request,
  id: string,
  input: Parameters<typeof updateSecurityFocus>[1],
) => {
  if (!(await findSecurityFocus(id))) {
    throw notFound("Security focus area not found.");
  }
  const updated = await updateSecurityFocus(id, input);
  if (!updated) throw notFound("Security focus area not found.");
  await audit(request, {
    action: "security.focus.update",
    entity: "security_focus",
    entityId: id,
    meta: { fields: Object.keys(input) },
  });
  contentUpdated("security", [...REVALIDATE_TAGS.security]);
  return updated;
};

export const removeFocus = async (
  request: Request,
  id: string,
): Promise<void> => {
  if (!(await findSecurityFocus(id))) {
    throw notFound("Security focus area not found.");
  }
  await deleteSecurityFocus(id);
  await audit(request, {
    action: "security.focus.delete",
    entity: "security_focus",
    entityId: id,
  });
  contentUpdated("security", [...REVALIDATE_TAGS.security]);
};

export const reorderFocus = async (
  request: Request,
  ids: string[],
): Promise<void> => {
  await reorderSecurityFocusAreas(ids);
  await audit(request, {
    action: "security.focus.reorder",
    entity: "security_focus",
    meta: { ids },
  });
  contentUpdated("security", [...REVALIDATE_TAGS.security]);
};

export const createOwasp = async (
  request: Request,
  input: Parameters<typeof createOwaspItem>[0],
) => {
  const created = await createOwaspItem({
    ...input,
    sortOrder: input.sortOrder ?? (await maxOwaspSortOrder()) + 1,
  });
  await audit(request, {
    action: "security.owasp.create",
    entity: "owasp_item",
    entityId: created.id,
  });
  contentUpdated("security", [...REVALIDATE_TAGS.security]);
  return created;
};

export const updateOwasp = async (
  request: Request,
  id: string,
  input: Parameters<typeof updateOwaspItem>[1],
) => {
  if (!(await findOwaspItem(id))) throw notFound("OWASP item not found.");
  const updated = await updateOwaspItem(id, input);
  if (!updated) throw notFound("OWASP item not found.");
  await audit(request, {
    action: "security.owasp.update",
    entity: "owasp_item",
    entityId: id,
    meta: { fields: Object.keys(input) },
  });
  contentUpdated("security", [...REVALIDATE_TAGS.security]);
  return updated;
};

export const removeOwasp = async (
  request: Request,
  id: string,
): Promise<void> => {
  if (!(await findOwaspItem(id))) throw notFound("OWASP item not found.");
  await deleteOwaspItem(id);
  await audit(request, {
    action: "security.owasp.delete",
    entity: "owasp_item",
    entityId: id,
  });
  contentUpdated("security", [...REVALIDATE_TAGS.security]);
};

export const reorderOwasp = async (
  request: Request,
  ids: string[],
): Promise<void> => {
  await reorderOwaspItems(ids);
  await audit(request, {
    action: "security.owasp.reorder",
    entity: "owasp_item",
    meta: { ids },
  });
  contentUpdated("security", [...REVALIDATE_TAGS.security]);
};

export const createStat = async (
  request: Request,
  input: Parameters<typeof createSecurityStat>[0],
) => {
  const created = await createSecurityStat({
    ...input,
    sortOrder: input.sortOrder ?? (await maxSecurityStatSortOrder()) + 1,
  });
  await audit(request, {
    action: "security.stats.create",
    entity: "security_stat",
    entityId: created.id,
  });
  contentUpdated("security", [...REVALIDATE_TAGS.security]);
  return created;
};

export const updateStat = async (
  request: Request,
  id: string,
  input: Parameters<typeof updateSecurityStat>[1],
) => {
  if (!(await findSecurityStat(id))) {
    throw notFound("Security stat not found.");
  }
  const updated = await updateSecurityStat(id, input);
  if (!updated) throw notFound("Security stat not found.");
  await audit(request, {
    action: "security.stats.update",
    entity: "security_stat",
    entityId: id,
    meta: { fields: Object.keys(input) },
  });
  contentUpdated("security", [...REVALIDATE_TAGS.security]);
  return updated;
};

export const removeStat = async (
  request: Request,
  id: string,
): Promise<void> => {
  if (!(await findSecurityStat(id))) {
    throw notFound("Security stat not found.");
  }
  await deleteSecurityStat(id);
  await audit(request, {
    action: "security.stats.delete",
    entity: "security_stat",
    entityId: id,
  });
  contentUpdated("security", [...REVALIDATE_TAGS.security]);
};

export const reorderStats = async (
  request: Request,
  ids: string[],
): Promise<void> => {
  await reorderSecurityStats(ids);
  await audit(request, {
    action: "security.stats.reorder",
    entity: "security_stat",
    meta: { ids },
  });
  contentUpdated("security", [...REVALIDATE_TAGS.security]);
};
