import type { RequestHandler } from "express";
export interface AttachmentInput {
    fileId: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    attachmentType: string;
}
export declare const listConversations: RequestHandler;
export declare const openConversation: RequestHandler;
export declare const createMessage: RequestHandler;
export declare const listMessages: RequestHandler;
export declare const readConversation: RequestHandler;
