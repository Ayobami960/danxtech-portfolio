import { env } from "../config/env.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
const normalize = (address) => address.trim().replace(/^::ffff:/, "");
/**
 * When ADMIN_IP_ALLOWLIST is set, only those addresses can reach the admin
 * router and the login endpoint. Empty/absent list disables the check.
 */
export const adminIpAllowlist = (request, _response, next) => {
    if (env.adminIpAllowlist.length === 0) {
        next();
        return;
    }
    const remote = request.ip ? normalize(request.ip) : undefined;
    const allowed = remote
        ? env.adminIpAllowlist.some((entry) => normalize(entry) === remote)
        : false;
    if (!allowed) {
        next(new AppError(403, ERROR_CODES.FORBIDDEN, "This address is not allowed to access the admin area."));
        return;
    }
    next();
};
//# sourceMappingURL=admin-ip.js.map