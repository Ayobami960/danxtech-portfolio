import { notFound } from "../lib/errors.js";
import { REVALIDATE_TAGS } from "../config/constants.js";
import { createExperience, createOwaspItem, createSecurityFocus, createSecurityStat, createSkillGroup, deleteExperience, deleteOwaspItem, deleteSecurityFocus, deleteSecurityStat, deleteSkillGroup, findExperience, findOwaspItem, findSecurityFocus, findSecurityStat, findSkillGroup, listExperiences, listOwaspItems, listSecurityFocusAreas, listSecurityStats, listSkillGroups, maxExperienceSortOrder, maxOwaspSortOrder, maxSecurityFocusSortOrder, maxSecurityStatSortOrder, maxSkillSortOrder, reorderExperiences, reorderOwaspItems, reorderSecurityFocusAreas, reorderSecurityStats, reorderSkillGroups, updateExperience, updateOwaspItem, updateSecurityFocus, updateSecurityStat, updateSkillGroup, } from "../repositories/content.repository.js";
import { audit } from "../repositories/audit-writer.js";
import { contentUpdated } from "./revalidate.service.js";
/* ---------------------------------- skills --------------------------------- */
export const publicSkills = async () => (await listSkillGroups()).map((group) => ({
    id: group.id,
    title: group.title,
    icon: group.icon,
    items: group.items,
    color: group.color
}));
export const adminSkills = async () => listSkillGroups();
export const createSkill = async (request, input) => {
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
export const updateSkill = async (request, id, input) => {
    if (!(await findSkillGroup(id)))
        throw notFound("Skill group not found.");
    const updated = await updateSkillGroup(id, input);
    if (!updated)
        throw notFound("Skill group not found.");
    await audit(request, {
        action: "skill.update",
        entity: "skill_group",
        entityId: id,
        meta: { fields: Object.keys(input) },
    });
    contentUpdated("skills", [...REVALIDATE_TAGS.skills]);
    return updated;
};
export const removeSkill = async (request, id) => {
    if (!(await findSkillGroup(id)))
        throw notFound("Skill group not found.");
    await deleteSkillGroup(id);
    await audit(request, {
        action: "skill.delete",
        entity: "skill_group",
        entityId: id,
    });
    contentUpdated("skills", [...REVALIDATE_TAGS.skills]);
};
export const reorderSkill = async (request, ids) => {
    await reorderSkillGroups(ids);
    await audit(request, {
        action: "skill.reorder",
        entity: "skill_group",
        meta: { ids },
    });
    contentUpdated("skills", [...REVALIDATE_TAGS.skills]);
};
/* -------------------------------- experience ------------------------------- */
export const publicExperience = async () => (await listExperiences()).map((entry) => ({
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
export const createExperienceEntry = async (request, input) => {
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
export const updateExperienceEntry = async (request, id, input) => {
    if (!(await findExperience(id)))
        throw notFound("Experience not found.");
    const updated = await updateExperience(id, input);
    if (!updated)
        throw notFound("Experience not found.");
    await audit(request, {
        action: "experience.update",
        entity: "experience",
        entityId: id,
        meta: { fields: Object.keys(input) },
    });
    contentUpdated("experience", [...REVALIDATE_TAGS.experience]);
    return updated;
};
export const removeExperience = async (request, id) => {
    if (!(await findExperience(id)))
        throw notFound("Experience not found.");
    await deleteExperience(id);
    await audit(request, {
        action: "experience.delete",
        entity: "experience",
        entityId: id,
    });
    contentUpdated("experience", [...REVALIDATE_TAGS.experience]);
};
export const reorderExperience = async (request, ids) => {
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
export const createFocus = async (request, input) => {
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
export const updateFocus = async (request, id, input) => {
    if (!(await findSecurityFocus(id))) {
        throw notFound("Security focus area not found.");
    }
    const updated = await updateSecurityFocus(id, input);
    if (!updated)
        throw notFound("Security focus area not found.");
    await audit(request, {
        action: "security.focus.update",
        entity: "security_focus",
        entityId: id,
        meta: { fields: Object.keys(input) },
    });
    contentUpdated("security", [...REVALIDATE_TAGS.security]);
    return updated;
};
export const removeFocus = async (request, id) => {
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
export const reorderFocus = async (request, ids) => {
    await reorderSecurityFocusAreas(ids);
    await audit(request, {
        action: "security.focus.reorder",
        entity: "security_focus",
        meta: { ids },
    });
    contentUpdated("security", [...REVALIDATE_TAGS.security]);
};
export const createOwasp = async (request, input) => {
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
export const updateOwasp = async (request, id, input) => {
    if (!(await findOwaspItem(id)))
        throw notFound("OWASP item not found.");
    const updated = await updateOwaspItem(id, input);
    if (!updated)
        throw notFound("OWASP item not found.");
    await audit(request, {
        action: "security.owasp.update",
        entity: "owasp_item",
        entityId: id,
        meta: { fields: Object.keys(input) },
    });
    contentUpdated("security", [...REVALIDATE_TAGS.security]);
    return updated;
};
export const removeOwasp = async (request, id) => {
    if (!(await findOwaspItem(id)))
        throw notFound("OWASP item not found.");
    await deleteOwaspItem(id);
    await audit(request, {
        action: "security.owasp.delete",
        entity: "owasp_item",
        entityId: id,
    });
    contentUpdated("security", [...REVALIDATE_TAGS.security]);
};
export const reorderOwasp = async (request, ids) => {
    await reorderOwaspItems(ids);
    await audit(request, {
        action: "security.owasp.reorder",
        entity: "owasp_item",
        meta: { ids },
    });
    contentUpdated("security", [...REVALIDATE_TAGS.security]);
};
export const createStat = async (request, input) => {
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
export const updateStat = async (request, id, input) => {
    if (!(await findSecurityStat(id))) {
        throw notFound("Security stat not found.");
    }
    const updated = await updateSecurityStat(id, input);
    if (!updated)
        throw notFound("Security stat not found.");
    await audit(request, {
        action: "security.stats.update",
        entity: "security_stat",
        entityId: id,
        meta: { fields: Object.keys(input) },
    });
    contentUpdated("security", [...REVALIDATE_TAGS.security]);
    return updated;
};
export const removeStat = async (request, id) => {
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
export const reorderStats = async (request, ids) => {
    await reorderSecurityStats(ids);
    await audit(request, {
        action: "security.stats.reorder",
        entity: "security_stat",
        meta: { ids },
    });
    contentUpdated("security", [...REVALIDATE_TAGS.security]);
};
//# sourceMappingURL=content.service.js.map