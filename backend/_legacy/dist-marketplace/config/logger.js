/*
 * Minimal structured logger used by background jobs and controllers.
 *
 * The call shape matches what the modules already use:
 *   logger.info({ message, eventName, attributes })
 *
 * Output goes to the console (the rest of the project logs that way) so no
 * logging SDK is required to boot the service.
 */
const write = (level, entry) => {
    const line = {
        level,
        timestamp: new Date().toISOString(),
        ...entry,
    };
    if (level === "error")
        console.error(line);
    else if (level === "warn")
        console.warn(line);
    else
        console.log(line);
};
export const logger = {
    info: async (entry) => write("info", entry),
    warn: async (entry) => write("warn", entry),
    error: async (entry) => write("error", entry),
};
//# sourceMappingURL=logger.js.map