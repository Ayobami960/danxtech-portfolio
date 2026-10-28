import type { Response } from "express";
export declare const addNotificationClient: (userId: string, response: Response) => () => void;
export declare const addAgencyNotificationClient: (agencyId: string, response: Response) => () => void;
export declare const emitNotification: (userId: string, notification: unknown) => void;
export declare const emitAgencyNotification: (agencyId: string, notification: unknown) => void;
