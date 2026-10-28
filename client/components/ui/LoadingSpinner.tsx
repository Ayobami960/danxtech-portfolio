import { Loader2 } from "lucide-react";

type Props = {
  /** Announced to assistive tech; also used as the visible label by PageLoader. */
  label?: string;
  size?: number;
  className?: string;
  /**
   * Announce the spinner itself. Turn this off when a surrounding block
   * already owns the live region, so the message is not read twice.
   */
  announce?: boolean;
};

/**
 * The single spinner used for initial loads, route changes, section fallbacks
 * and content-update refetches, so the loading experience stays consistent.
 */
export default function LoadingSpinner({
  label = "Loading",
  size = 24,
  className = "",
  announce = true,
}: Props) {
  const inner = (
    <>
      <Loader2
        aria-hidden
        size={size}
        className="animate-spin motion-reduce:animate-none"
      />
      <span className="sr-only">{label}</span>
    </>
  );

  const classes = `inline-flex items-center justify-center text-[#3b82f6] ${className}`;

  return announce ? (
    <span role="status" aria-live="polite" className={classes}>
      {inner}
    </span>
  ) : (
    <span className={classes}>{inner}</span>
  );
}
