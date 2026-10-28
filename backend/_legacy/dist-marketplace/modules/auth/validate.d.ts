import type { RequestHandler } from "express";
import type { ZodType } from "zod";
export declare const validate: (schema: ZodType) => RequestHandler;
