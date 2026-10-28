import { adminCreateCredential, adminDeleteCredential, adminGetAbout, adminGetSettings, adminListCredentials, adminPutAbout, adminPutSettings, adminReorderCredentials, adminUpdateCredential, } from "../../controllers/site.controller.js";
import { validate } from "../../middleware/validate.js";
import { reorderSchema, uuidParams } from "../../schemas/common.schemas.js";
import { aboutInputSchema, createCredentialSchema, settingsInputSchema, updateCredentialSchema, } from "../../schemas/site.schemas.js";
export const registerSiteRoutes = (router) => {
    router.get("/about", adminGetAbout);
    router.put("/about", validate({ body: aboutInputSchema }), adminPutAbout);
    router.get("/credentials", adminListCredentials);
    router.post("/credentials", validate({ body: createCredentialSchema }), adminCreateCredential);
    router.patch("/credentials/reorder", validate({ body: reorderSchema }), adminReorderCredentials);
    router.patch("/credentials/:id", validate({ params: uuidParams, body: updateCredentialSchema }), adminUpdateCredential);
    router.delete("/credentials/:id", validate({ params: uuidParams }), adminDeleteCredential);
    router.get("/settings", adminGetSettings);
    router.put("/settings", validate({ body: settingsInputSchema }), adminPutSettings);
};
//# sourceMappingURL=site.routes.js.map