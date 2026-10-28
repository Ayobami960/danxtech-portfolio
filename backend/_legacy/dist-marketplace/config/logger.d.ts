export interface LogEntry {
    message: string;
    eventName?: string;
    attributes?: Record<string, unknown>;
}
export declare const logger: {
    info: (entry: LogEntry) => Promise<void>;
    warn: (entry: LogEntry) => Promise<void>;
    error: (entry: LogEntry) => Promise<void>;
};
