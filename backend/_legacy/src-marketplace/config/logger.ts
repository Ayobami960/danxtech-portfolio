/*
 * Minimal structured logger used by background jobs and controllers.
 *
 * The call shape matches what the modules already use:
 *   logger.info({ message, eventName, attributes })
 *
 * Output goes to the console (the rest of the project logs that way) so no
 * logging SDK is required to boot the service.
 */

export interface LogEntry {
    message: string;
    eventName?: string;
    attributes?: Record<string, unknown>;
}

type LogLevel = "info" | "warn" | "error";

const write = (level: LogLevel, entry: LogEntry): void => {
    const line = {
        level,
        timestamp: new Date().toISOString(),
        ...entry,
    };

    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
};

export const logger = {
    info: async (entry: LogEntry): Promise<void> => write("info", entry),
    warn: async (entry: LogEntry): Promise<void> => write("warn", entry),
    error: async (entry: LogEntry): Promise<void> => write("error", entry),
};
