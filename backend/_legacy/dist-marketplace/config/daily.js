import { env } from "./env.js";
const DAILY_API_BASE = "https://api.daily.co/v1";
// Rooms auto-expire this many seconds after creation as a safety net for
// abandoned meetings that never get an explicit "ended" webhook.
const ROOM_TTL_SECONDS = 60 * 60 * 6;
const dailyRequest = async (path, init = {}) => {
    if (!env.dailyApiKey) {
        throw new Error("DAILY_API_KEY is missing from the environment.");
    }
    const response = await fetch(`${DAILY_API_BASE}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${env.dailyApiKey}`,
            "Content-Type": "application/json",
            ...init.headers,
        },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        const message = body?.info ??
            body?.error ??
            `Daily API request failed (${response.status}).`;
        throw new Error(message);
    }
    return body;
};
export const createDailyRoom = (roomName) => dailyRequest("/rooms", {
    method: "POST",
    body: JSON.stringify({
        name: roomName,
        privacy: "public",
        properties: {
            exp: Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
            eject_at_room_exp: true,
            enable_chat: false,
        },
    }),
});
//# sourceMappingURL=daily.js.map