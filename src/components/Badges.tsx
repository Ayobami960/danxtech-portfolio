import { cn } from "../lib/cn";

// Status indicators used by entities that follow SuggestedLead semantics.
export const LeadStatusBadge = ({ status }: { status: string; label?: string }) => {
  const normalized = status.toLowerCase();
  if (normalized === "applied") {
    return (        <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
        {label ?? status.toUpperCase()}
      </span>
    );
  }
  if (status === "reviewing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber">
        Reviewing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald">
      Qualified
    </span>
  );
};

export const StageBadge = ({
  stage,
  count,
  label,
}: {
  stage: string;
  count?: number;
  label?: string;
}) => {
  const normalized = stage.toLowerCase();
  if (normalized === "screening") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
        Screening {count === undefined ? "" : `· ${count}`}
      </span>
    );
  }
  if (normalized === "technical") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber">
        Technical {count === undefined ? "" : `· ${count}`}
      </span>
    );
  }
  if (normalized === "assessment") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald">
        Assessment {count === undefined ? "" : `· ${count}`}
      </span>
    );
  }
  if (normalized === "closed-won") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald">
        Closed won
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-orange-400/30 bg-orange-20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-orange">
      Closed lost
    </span>
  );
};
