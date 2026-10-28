import { getHero, updateHero } from "../../controllers/admin.hero.controller.js";
import { validate } from "../../middleware/validate.js";
import { heroInputSchema } from "../../schemas/hero.schemas.js";
export const registerHeroRoutes = (router) => {
    router.get("/hero", getHero);
    router.put("/hero", validate({ body: heroInputSchema }), updateHero);
};
//# sourceMappingURL=hero.routes.js.map