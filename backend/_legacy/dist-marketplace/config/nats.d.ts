import { type NatsConnection } from "nats";
export declare const getNats: () => Promise<NatsConnection>;
export declare const disconnectNats: () => Promise<void>;
