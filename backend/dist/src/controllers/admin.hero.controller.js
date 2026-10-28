import { asyncHandler } from "../lib/async-handler.js";
import { body as readBody } from "../lib/request.js";
import { readAdminHero, writeHero } from "../services/hero.service.js";
export const getHero = asyncHandler(async (_request, response) => {
    response.status(200).json(await readAdminHero());
});
export const updateHero = asyncHandler(async (request, response) => {
    const input = readBody(request);
    response.status(200).json(await writeHero(request, input));
});
//# sourceMappingURL=admin.hero.controller.js.map