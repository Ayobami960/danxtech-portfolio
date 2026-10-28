import { asyncHandler } from "../lib/async-handler.js";
import { sendCacheableJson } from "../lib/cache.js";
import { body as readBody, params } from "../lib/request.js";
import type {
  AboutInput,
  CreateCredentialInput,
  SettingsInput,
  UpdateCredentialInput,
} from "../schemas/site.schemas.js";
import * as site from "../services/site.service.js";

/* --------------------------------- public ---------------------------------- */

export const getAbout = asyncHandler(async (request, response) => {
  sendCacheableJson(request, response, await site.publicAbout());
});

export const getCredentials = asyncHandler(async (request, response) => {
  sendCacheableJson(request, response, await site.publicCredentials());
});

export const getSettings = asyncHandler(async (request, response) => {
  sendCacheableJson(request, response, await site.publicSettings());
});

export const getSite = asyncHandler(async (request, response) => {
  sendCacheableJson(request, response, await site.siteDocument());
});

/* ---------------------------------- admin ---------------------------------- */

export const adminGetAbout = asyncHandler(async (_request, response) => {
  response.status(200).json(await site.adminAbout());
});

export const adminPutAbout = asyncHandler(async (request, response) => {
  const input = readBody<AboutInput>(request);
  response.status(200).json(await site.saveAbout(request, input));
});

export const adminListCredentials = asyncHandler(async (_request, response) => {
  const rows = await site.adminCredentials();
  response.status(200).json({
    data: rows,
    meta: { page: 1, pageSize: Math.max(rows.length, 1), total: rows.length },
  });
});

export const adminCreateCredential = asyncHandler(async (request, response) => {
  const input = readBody<CreateCredentialInput>(request);
  response.status(201).json(await site.createCredentialEntry(request, input));
});

export const adminUpdateCredential = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  const input = readBody<UpdateCredentialInput>(request);
  response.status(200).json(await site.updateCredentialEntry(request, id, input));
});

export const adminDeleteCredential = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  await site.removeCredential(request, id);
  response.status(204).end();
});

export const adminReorderCredentials = asyncHandler(async (request, response) => {
  const { ids } = readBody<{ ids: string[] }>(request);
  await site.reorderCredentialEntries(request, ids);
  response.status(200).json({ ok: true });
});

export const adminGetSettings = asyncHandler(async (_request, response) => {
  response.status(200).json(await site.adminSettings());
});

export const adminPutSettings = asyncHandler(async (request, response) => {
  const input = readBody<SettingsInput>(request);
  response.status(200).json(await site.saveSettings(request, input));
});
