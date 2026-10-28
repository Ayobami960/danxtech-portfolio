import { asyncHandler } from "../lib/async-handler.js";
import { sendCacheableJson } from "../lib/cache.js";
import {
  publicExperience,
  publicSecurity,
  publicSkills,
} from "../services/content.service.js";

export const getSkills = asyncHandler(async (request, response) => {
  sendCacheableJson(request, response, await publicSkills());
});

export const getExperience = asyncHandler(async (request, response) => {
  sendCacheableJson(request, response, await publicExperience());
});

export const getSecurity = asyncHandler(async (request, response) => {
  sendCacheableJson(request, response, await publicSecurity());
});
