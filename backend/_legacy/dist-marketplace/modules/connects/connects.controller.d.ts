import type { RequestHandler } from "express";
export declare const getAvailableConnects: RequestHandler;
export declare const getLoggedInFreelancerConnectsHistory: RequestHandler;
export declare const buyConnects: RequestHandler;
export declare const connectsWebhook: RequestHandler;
/**
 * Credits a paid Checkout Session that the webhook has not processed yet.
 * Stripe redirects the buyer here with the session id, so a missed or
 * misconfigured webhook no longer leaves a paid purchase uncredited. The
 * credit itself stays idempotent because the session id is the payment id.
 */
export declare const confirmConnectsPurchase: RequestHandler;
/**
 * Runs the Connects reconciliation safety net on demand, for hosts without a
 * long-running process (Vercel Cron, for example). Disabled until one of the
 * accepted secrets is configured, and then only for a matching caller.
 *
 * Registered for both GET and POST: Vercel Cron always issues a GET.
 */
export declare const reconcileConnectsPurchases: RequestHandler;
