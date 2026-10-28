import type { Request, RequestHandler } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { notFound } from "../lib/errors.js";
import { paginated } from "../lib/pagination.js";
import { body as readBody, params } from "../lib/request.js";
import {
  findExperience,
  findOwaspItem,
  findSecurityFocus,
  findSecurityStat,
  findSkillGroup,
} from "../repositories/content.repository.js";
import {
  adminExperience,
  adminOwasp,
  adminSecurityFocus,
  adminSecurityStats,
  adminSkills,
  createExperienceEntry,
  createFocus,
  createOwasp,
  createSkill,
  createStat,
  removeExperience,
  removeFocus,
  removeOwasp,
  removeSkill,
  removeStat,
  reorderExperience,
  reorderFocus,
  reorderOwasp,
  reorderSkill,
  reorderStats,
  updateExperienceEntry,
  updateFocus,
  updateOwasp,
  updateSkill,
  updateStat,
} from "../services/content.service.js";

export type CrudHandlers = {
  list: RequestHandler;
  getById: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
  reorder: RequestHandler;
};

/**
 * The five Part B resources share identical HTTP semantics, so their handlers
 * are generated from one explicit shape. Validation schemas stay in the route
 * file, which keeps this layer free of business logic.
 */
const buildCrud = <TInput, TUpdate>(spec: {
  list: () => Promise<unknown[]>;
  find: (id: string) => Promise<unknown | null>;
  create: (request: Request, input: TInput) => Promise<unknown>;
  update: (request: Request, id: string, input: TUpdate) => Promise<unknown>;
  remove: (request: Request, id: string) => Promise<void>;
  reorder: (request: Request, ids: string[]) => Promise<void>;
  entityName: string;
}): CrudHandlers => ({
  list: asyncHandler(async (_request, response) => {
    const rows = await spec.list();
    const total = rows.length;
    response
      .status(200)
      .json(paginated(rows, total, { page: 1, pageSize: Math.max(total, 1) }));
  }),

  getById: asyncHandler(async (request, response) => {
    const { id } = params<{ id: string }>(request);
    const row = await spec.find(id);
    if (!row) throw notFound(`${spec.entityName} not found.`);
    response.status(200).json(row);
  }),

  create: asyncHandler(async (request, response) => {
    const input = readBody<TInput>(request);
    response.status(201).json(await spec.create(request, input));
  }),

  update: asyncHandler(async (request, response) => {
    const { id } = params<{ id: string }>(request);
    const input = readBody<TUpdate>(request);
    response.status(200).json(await spec.update(request, id, input));
  }),

  remove: asyncHandler(async (request, response) => {
    const { id } = params<{ id: string }>(request);
    await spec.remove(request, id);
    response.status(204).end();
  }),

  reorder: asyncHandler(async (request, response) => {
    const { ids } = readBody<{ ids: string[] }>(request);
    await spec.reorder(request, ids);
    response.status(200).json({ ok: true });
  }),
});

export const skills = buildCrud({
  list: adminSkills,
  find: findSkillGroup,
  create: createSkill,
  update: updateSkill,
  remove: removeSkill,
  reorder: reorderSkill,
  entityName: "Skill group",
});

export const experience = buildCrud({
  list: adminExperience,
  find: findExperience,
  create: createExperienceEntry,
  update: updateExperienceEntry,
  remove: removeExperience,
  reorder: reorderExperience,
  entityName: "Experience",
});

export const securityFocus = buildCrud({
  list: adminSecurityFocus,
  find: findSecurityFocus,
  create: createFocus,
  update: updateFocus,
  remove: removeFocus,
  reorder: reorderFocus,
  entityName: "Security focus area",
});

export const securityOwasp = buildCrud({
  list: adminOwasp,
  find: findOwaspItem,
  create: createOwasp,
  update: updateOwasp,
  remove: removeOwasp,
  reorder: reorderOwasp,
  entityName: "OWASP item",
});

export const securityStats = buildCrud({
  list: adminSecurityStats,
  find: findSecurityStat,
  create: createStat,
  update: updateStat,
  remove: removeStat,
  reorder: reorderStats,
  entityName: "Security stat",
});
