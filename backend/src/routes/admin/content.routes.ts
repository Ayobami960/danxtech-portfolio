import type { Router } from "express";
import {
  experience,
  securityFocus,
  securityOwasp,
  securityStats,
  skills,
} from "../../controllers/admin.content.controller.js";
import { validate } from "../../middleware/validate.js";
import { reorderSchema, uuidParams } from "../../schemas/common.schemas.js";
import {
  createExperienceSchema,
  createOwaspItemSchema,
  createSecurityFocusSchema,
  createSecurityStatSchema,
  createSkillGroupSchema,
  updateExperienceSchema,
  updateOwaspItemSchema,
  updateSecurityFocusSchema,
  updateSecurityStatSchema,
  updateSkillGroupSchema,
} from "../../schemas/content.schemas.js";

export const registerSkillRoutes = (router: Router): void => {
  // Reads are list-only (no pagination), so the same pagination schema is not
  // needed; passing one would reject the request for an unspecified page.
  router.get("/skills", skills.list);
  router.post(
    "/skills",
    validate({ body: createSkillGroupSchema }),
    skills.create,
  );
  router.patch(
    "/skills/reorder",
    validate({ body: reorderSchema }),
    skills.reorder,
  );
  router.get("/skills/:id", validate({ params: uuidParams }), skills.getById);
  router.patch(
    "/skills/:id",
    validate({ params: uuidParams, body: updateSkillGroupSchema }),
    skills.update,
  );
  router.delete("/skills/:id", validate({ params: uuidParams }), skills.remove);
};

export const registerExperienceRoutes = (router: Router): void => {
  router.get("/experience", experience.list);
  router.post(
    "/experience",
    validate({ body: createExperienceSchema }),
    experience.create,
  );
  router.patch(
    "/experience/reorder",
    validate({ body: reorderSchema }),
    experience.reorder,
  );
  router.get(
    "/experience/:id",
    validate({ params: uuidParams }),
    experience.getById,
  );
  router.patch(
    "/experience/:id",
    validate({ params: uuidParams, body: updateExperienceSchema }),
    experience.update,
  );
  router.delete(
    "/experience/:id",
    validate({ params: uuidParams }),
    experience.remove,
  );
};

export const registerSecurityRoutes = (router: Router): void => {
  /* ---------------------------- focus areas ---------------------------- */
  router.get("/security/focus", securityFocus.list);
  router.post(
    "/security/focus",
    validate({ body: createSecurityFocusSchema }),
    securityFocus.create,
  );
  router.patch(
    "/security/focus/reorder",
    validate({ body: reorderSchema }),
    securityFocus.reorder,
  );
  router.get(
    "/security/focus/:id",
    validate({ params: uuidParams }),
    securityFocus.getById,
  );
  router.patch(
    "/security/focus/:id",
    validate({ params: uuidParams, body: updateSecurityFocusSchema }),
    securityFocus.update,
  );
  router.delete(
    "/security/focus/:id",
    validate({ params: uuidParams }),
    securityFocus.remove,
  );

  /* -------------------------------- OWASP ------------------------------ */
  router.get("/security/owasp", securityOwasp.list);
  router.post(
    "/security/owasp",
    validate({ body: createOwaspItemSchema }),
    securityOwasp.create,
  );
  router.patch(
    "/security/owasp/reorder",
    validate({ body: reorderSchema }),
    securityOwasp.reorder,
  );
  router.get(
    "/security/owasp/:id",
    validate({ params: uuidParams }),
    securityOwasp.getById,
  );
  router.patch(
    "/security/owasp/:id",
    validate({ params: uuidParams, body: updateOwaspItemSchema }),
    securityOwasp.update,
  );
  router.delete(
    "/security/owasp/:id",
    validate({ params: uuidParams }),
    securityOwasp.remove,
  );

  /* ------------------------------- stats ------------------------------- */
  router.get("/security/stats", securityStats.list);
  router.post(
    "/security/stats",
    validate({ body: createSecurityStatSchema }),
    securityStats.create,
  );
  router.patch(
    "/security/stats/reorder",
    validate({ body: reorderSchema }),
    securityStats.reorder,
  );
  router.get(
    "/security/stats/:id",
    validate({ params: uuidParams }),
    securityStats.getById,
  );
  router.patch(
    "/security/stats/:id",
    validate({ params: uuidParams, body: updateSecurityStatSchema }),
    securityStats.update,
  );
  router.delete(
    "/security/stats/:id",
    validate({ params: uuidParams }),
    securityStats.remove,
  );
};
