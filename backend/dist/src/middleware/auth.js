import { ACCESS_COOKIE } from "../config/constants.js";
import { readCookie } from "../lib/cookies.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { unauthorized } from "../lib/errors.js";
import { findAdminById } from "../repositories/admin.repository.js";
const readAccessToken = (authorization) => {
    if (!authorization)
        return null;
    const [scheme, token] = authorization.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token)
        return null;
    return token;
};
/**
 * Deny-by-default guard. Mounted once at the top of the admin router so a new
 * admin route can never be public by accident.
 */
export const requireAuth = (request, _response, next) => {
    void (async () => {
        try {
            const token = readCookie(request, ACCESS_COOKIE) ??
                readAccessToken(request.get("authorization"));
            if (!token) {
                throw unauthorized();
            }
            const payload = await verifyAccessToken(token);
            const admin = await findAdminById(payload.sub);
            if (!admin) {
                throw unauthorized("Session is no longer valid.");
            }
            request.admin = admin;
            next();
        }
        catch (error) {
            next(error);
        }
    })();
};
//# sourceMappingURL=auth.js.map