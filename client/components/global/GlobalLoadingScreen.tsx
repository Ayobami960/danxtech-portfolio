type Props = {
  /** Announced to assistive tech. Every route uses the same label on purpose. */
  label?: string;
};

/**
 * The single full-page loading UI for the client application.
 *
 * It is rendered by the route-level loading boundaries while a page's initial
 * data is being fetched, and by the chat page while its initial session is
 * opening. Sections never render their own loader; they wait for this screen
 * to finish and then appear whole.
 */
export default function GlobalLoadingScreen({ label = "Loading" }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="global-loader-screen flex min-h-screen w-full flex-col items-center justify-center bg-[#0a0f1e] px-6!"
    >
      <div aria-hidden className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-white/8" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-[#8b5cf6] border-t-[#3b82f6] motion-reduce:animate-none" />
        <span className="absolute inset-3 rounded-full bg-[#0e1528]" />
        <span className="font-grotesk relative text-2xl font-bold tracking-tight text-white">
          DK<span className="text-[#f0a500]">.</span>
        </span>
      </div>

      <p className="font-grotesk mt-6 text-base font-medium text-[#e6edf7]">{label}</p>
      <p className="font-mono mt-2 text-center text-[10px] uppercase tracking-[0.3em] text-[#5f7189]">
        Adetoye Daniel Kehinde
      </p>

      <div
        aria-hidden
        className="mt-6 h-0.5 w-40 overflow-hidden rounded-full bg-white/8 sm:w-48"
      >
        <span className="global-loader-sweep block h-full w-1/2 rounded-full bg-linear-to-r from-transparent via-[#3b82f6] to-transparent" />
      </div>
    </div>
  );
}
