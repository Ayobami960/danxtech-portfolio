import { addEventClient, contentVersion, removeEventClient, } from "../realtime/content-events.js";
/**
 * Public Server-Sent Events stream. It only ever carries
 * `{ type, entity, at }` — no content, no visitor or admin data.
 */
export const streamContentEvents = (request, response) => {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    // `no-transform` also tells the compression middleware not to buffer it.
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    // nginx must not buffer a stream behind a proxy.
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();
    request.socket.setTimeout(0);
    request.socket.setNoDelay(true);
    addEventClient(response);
    // `req` fires on a client abort, `res` once the response is torn down;
    // either one must drop the client or the set leaks.
    let closed = false;
    const cleanup = () => {
        if (closed)
            return;
        closed = true;
        removeEventClient(response);
        response.end();
    };
    request.on("close", cleanup);
    response.on("close", cleanup);
};
/** Cheap version probe for the client's polling fallback. */
export const contentVersionHandler = (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json({ version: contentVersion() });
};
//# sourceMappingURL=events.controller.js.map