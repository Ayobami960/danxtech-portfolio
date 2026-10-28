import { asyncHandler } from "../lib/async-handler.js";
import { body as readBody, currentAdmin, params } from "../lib/request.js";
import * as account from "../services/account.service.js";
export const getTwoFactor = asyncHandler(async (request, response) => {
    response.status(200).json(await account.twoFactorStatus(currentAdmin(request)));
});
export const setupTwoFactor = asyncHandler(async (request, response) => {
    response
        .status(200)
        .json(await account.beginTwoFactorSetup(request, currentAdmin(request)));
});
export const enableTwoFactor = asyncHandler(async (request, response) => {
    const { code } = readBody(request);
    response
        .status(200)
        .json(await account.enableTwoFactor(request, currentAdmin(request), code));
});
export const disableTwoFactor = asyncHandler(async (request, response) => {
    const { password, code } = readBody(request);
    await account.disableTwoFactor(request, currentAdmin(request), password, code);
    response.status(200).json({ ok: true });
});
export const regenerateRecoveryCodes = asyncHandler(async (request, response) => {
    const { password } = readBody(request);
    response
        .status(200)
        .json(await account.regenerateRecoveryCodes(request, currentAdmin(request), password));
});
export const listSessions = asyncHandler(async (request, response) => {
    response
        .status(200)
        .json({ data: await account.sessions(request, currentAdmin(request)) });
});
export const revokeOtherSessions = asyncHandler(async (request, response) => {
    const revoked = await account.revokeOtherSessions(request, currentAdmin(request));
    response.status(200).json({ ok: true, revoked });
});
export const revokeSession = asyncHandler(async (request, response) => {
    const { id } = params(request);
    await account.revokeSession(request, currentAdmin(request), id);
    response.status(204).end();
});
//# sourceMappingURL=admin.account.controller.js.map