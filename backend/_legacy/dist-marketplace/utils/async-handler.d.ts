import type { NextFunction, Request, RequestHandler, Response } from "express";
type AsyncRequestHandler = (request: Request, response: Response, next: NextFunction) => Promise<unknown>;
export declare const asyncHandler: (handler: AsyncRequestHandler) => RequestHandler;
export {};
