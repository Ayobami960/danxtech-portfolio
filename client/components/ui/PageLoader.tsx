import LoadingSpinner from "./LoadingSpinner";

/** Full-viewport loading state for an initial page load or a route change. */
export default function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-[#0a0f1e] px-6!">
      <LoadingSpinner label={label} size={32} />
      <p
        aria-hidden
        className="font-mono text-xs uppercase tracking-[0.25em] text-[#7c8fa6]"
      >
        {label}
      </p>
    </div>
  );
}
