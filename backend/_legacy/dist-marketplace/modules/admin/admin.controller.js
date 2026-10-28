import { timingSafeEqual } from "crypto";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { getAdminAccounts, getAdminContracts, getAdminJobPosts, getAdminOverviewActivity, getAdminOverviewTotals, getAdminProposals, getAdminTransactions, getRedisKeyValue, getSystemHealth, scanRedisKeys, } from "./admin.service.js";
import { getStream } from "@oneminutelogs/express";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const parsePagination = (request) => {
    const rawLimit = Number(request.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;
    const rawOffset = Number(request.query.offset);
    const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;
    return { limit, offset };
};
const passwordsMatch = (provided, expected) => {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    return (providedBuffer.length === expectedBuffer.length &&
        timingSafeEqual(providedBuffer, expectedBuffer));
};
export const loginAdminHandler = asyncHandler(async (request, response) => {
    if (!env.adminDashboardPassword) {
        throw new ApiError(503, "Admin authentication is not configured.");
    }
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    if (!passwordsMatch(password, env.adminDashboardPassword)) {
        await logger.warn({
            message: "Admin sign-in failed",
            eventName: "auth.login.failed",
            attributes: {
                "auth.method": "password",
                "auth.failure_kind": "invalid_credentials",
                "client.address": request.ip ?? "unknown",
            },
        });
        throw new ApiError(401, "Incorrect password.");
    }
    await logger.info({
        message: "Admin signed in",
        eventName: "auth.login.succeeded",
        attributes: {
            "auth.method": "password",
            "client.address": request.ip ?? "unknown",
        },
    });
    response.status(200).json({ success: true, message: "Password verified." });
});
export const getOverviewHandler = asyncHandler(async (_request, response) => {
    const data = await getAdminOverviewTotals();
    response.status(200).json({
        success: true,
        message: "Platform overview retrieved.",
        data,
    });
});
export const getOverviewActivityHandler = asyncHandler(async (request, response) => {
    const data = await getAdminOverviewActivity(parsePagination(request));
    response.status(200).json({
        success: true,
        message: "Recent activity retrieved.",
        data,
    });
});
export const getAccountsHandler = asyncHandler(async (request, response) => {
    const data = await getAdminAccounts(parsePagination(request));
    response
        .status(200)
        .json({ success: true, message: "Accounts retrieved.", data });
});
export const getJobPostsHandler = asyncHandler(async (request, response) => {
    const data = await getAdminJobPosts(parsePagination(request));
    response
        .status(200)
        .json({ success: true, message: "Job posts retrieved.", data });
});
export const getProposalsHandler = asyncHandler(async (request, response) => {
    const data = await getAdminProposals(parsePagination(request));
    response
        .status(200)
        .json({ success: true, message: "Proposals retrieved.", data });
});
export const getContractsHandler = asyncHandler(async (request, response) => {
    const data = await getAdminContracts(parsePagination(request));
    response
        .status(200)
        .json({ success: true, message: "Contracts retrieved.", data });
});
export const getTransactionsHandler = asyncHandler(async (request, response) => {
    const data = await getAdminTransactions(parsePagination(request));
    response
        .status(200)
        .json({ success: true, message: "Transactions retrieved.", data });
});
export const getSystemHealthHandler = asyncHandler(async (_request, response) => {
    const data = await getSystemHealth();
    response
        .status(200)
        .json({ success: true, message: "System health retrieved.", data });
});
export const scanRedisKeysHandler = asyncHandler(async (request, response) => {
    const pattern = typeof request.query.pattern === "string" ? request.query.pattern : "*";
    const data = await scanRedisKeys(pattern);
    response
        .status(200)
        .json({ success: true, message: "Redis keys scanned.", data });
});
export const getRedisKeyHandler = asyncHandler(async (request, response) => {
    const key = request.params.key;
    if (typeof key !== "string" || !key) {
        throw new ApiError(400, "Redis key is required.");
    }
    const data = await getRedisKeyValue(decodeURIComponent(key));
    response
        .status(200)
        .json({ success: true, message: "Redis key retrieved.", data });
});
export const streamLogsHandler = asyncHandler(async (request, response) => {
    if (!env.oneMinuteLogsApiKey) {
        throw new ApiError(503, "Logging is not configured.");
    }
    response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
    });
    response.flushHeaders?.();
    const stream = getStream({
        apiKey: env.oneMinuteLogsApiKey,
        projectName: "OneMarketPlace",
        environment: env.nodeEnv,
    }, { limit: 50 });
    let closed = false;
    request.on("close", () => {
        closed = true;
        stream.close();
    });
    try {
        for await (const event of stream.events) {
            if (closed)
                break;
            response.write(`data: ${JSON.stringify(event)}\n\n`);
        }
    }
    catch {
    }
    finally {
        if (!closed)
            response.end();
    }
});
//# sourceMappingURL=admin.controller.js.map