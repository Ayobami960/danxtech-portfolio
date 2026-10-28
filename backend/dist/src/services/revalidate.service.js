import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { broadcastContentUpdate, } from "../realtime/content-events.js";
/**
 * Ask the frontend to invalidate its cached tags. Never throws: a frontend
 * webhook outage must not fail an admin mutation.
 */
export const revalidate = async (tags) => {
    if (!env.frontendRevalidateUrl || !env.revalidateSecret) {
        return;
    }
    try {
        const response = await fetch(env.frontendRevalidateUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-revalidate-secret": env.revalidateSecret,
            },
            body: JSON.stringify({ tags }),
            signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) {
            logger.warn({ status: response.status, tags }, "Frontend revalidation webhook returned an error");
        }
    }
    catch (error) {
        logger.warn({ err: error, tags }, "Frontend revalidation webhook failed");
    }
};
/**
 * The single entry point for an admin mutation that changed public content:
 * invalidate the client's cached render first, then notify connected clients.
 *
 * The order matters. Broadcasting before the cache is busted would make the
 * client refetch the still-cached RSC payload and keep showing old content.
 * `revalidate` never throws, so a webhook outage cannot fail the mutation;
 * the event is broadcast either way.
 */
export const contentUpdated = (entity, tags) => {
    void revalidate(tags).finally(() => {
        broadcastContentUpdate(entity);
    });
};
//# sourceMappingURL=revalidate.service.js.map