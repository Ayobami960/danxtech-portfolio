/**
 * `has_session=1` is set by the API only after a FULL authentication (password,
 * or password + 2FA). It is deliberately readable by JavaScript — it carries no
 * authority, it only tells the app whether asking `/auth/me` is worth a request.
 *
 * Without it, a logged-out visitor's boot would produce two expected 401/403
 * responses (and a refresh attempt) on every load. A pending 2FA challenge never
 * sets it: that is not a session.
 */
const HINT_COOKIE = "has_session";

export const hasSessionHint = (): boolean =>
  typeof document !== "undefined" &&
  document.cookie
    .split("; ")
    .some((entry) => entry === `${HINT_COOKIE}=1`);

/** Only called once the server has confirmed the session is dead. */
export const clearSessionHint = (): void => {
  if (typeof document === "undefined") return;
  document.cookie = `${HINT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
};
