import { disableTwoFactor, enableTwoFactor, getTwoFactor, listSessions, regenerateRecoveryCodes, revokeOtherSessions, revokeSession, setupTwoFactor, } from "../../controllers/admin.account.controller.js";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { passwordConfirmSchema, twoFactorDisableSchema, twoFactorVerifySchema, } from "../../schemas/auth.schemas.js";
const familyParams = z.object({ id: z.uuid() }).strict();
export const registerAccountRoutes = (router) => {
    router.get("/account/2fa", getTwoFactor);
    router.post("/account/2fa/setup", setupTwoFactor);
    router.post("/account/2fa/enable", validate({ body: twoFactorVerifySchema }), enableTwoFactor);
    router.post("/account/2fa/disable", validate({ body: twoFactorDisableSchema }), disableTwoFactor);
    router.post("/account/2fa/recovery-codes", validate({ body: passwordConfirmSchema }), regenerateRecoveryCodes);
    router.get("/account/sessions", listSessions);
    router.delete("/account/sessions", revokeOtherSessions);
    router.delete("/account/sessions/:id", validate({ params: familyParams }), revokeSession);
};
//# sourceMappingURL=account.routes.js.map