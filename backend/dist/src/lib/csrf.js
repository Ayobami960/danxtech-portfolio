import { createHmac } from "node:crypto";
import { env } from "../config/env.js";
import { constantTimeEqual, randomToken } from "./crypto.js";
const sign = (nonce) => createHmac("sha256", env.csrfSecret).update(nonce).digest("base64url");
export const createCsrfToken = () => {
    const nonce = randomToken(32);
    return `${nonce}.${sign(nonce)}`;
};
export const isValidCsrfToken = (token) => {
    const separator = token.lastIndexOf(".");
    if (separator <= 0)
        return false;
    const nonce = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    return constantTimeEqual(signature, sign(nonce));
};
//# sourceMappingURL=csrf.js.map