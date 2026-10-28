import Stripe from "stripe";
import { env } from "./env.js";
// `new Stripe("")` throws, which would crash the process at import time when
// Stripe is not configured. Every caller checks `env.stripeSecretKey` first and
// answers 503, so a placeholder key keeps the API booting without payments.
export const stripe = new Stripe(env.stripeSecretKey ?? "sk_test_not_configured");
//# sourceMappingURL=stripe.js.map