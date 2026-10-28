/**
 * How the public client reacts to a content-update event.
 *
 * - "refetch" (default): show the overlay, then refresh the affected data
 *   in place with `router.refresh()` — no page reload, scroll position kept.
 * - "reload": show the same overlay for about a second, then hard-reload the
 *   page. Allegedly the safest option when client state is out of sync.
 *
 * Override with NEXT_PUBLIC_UPDATE_MODE in the client environment.
 */
export type UpdateMode = "refetch" | "reload";

const configured = process.env.NEXT_PUBLIC_UPDATE_MODE;

export const UPDATE_MODE: UpdateMode = configured === "reload" ? "reload" : "refetch";
