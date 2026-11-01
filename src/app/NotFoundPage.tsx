import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="window-card mx-auto mt-10 max-w-lg p-8 text-center">
      <div className="font-mono text-xs uppercase tracking-[0.2em] text-[#3b82f6]">
        404
      </div>
      <h2 className="mt-2 font-grotesk text-2xl font-bold text-white">
        This page does not exist
      </h2>
      <p className="mt-2 text-sm text-[#7c8fa6]">
        The link may be outdated, or the record was removed.
      </p>
      <Link to="/" className="btn btn-primary mt-6">
        Back to dashboard
      </Link>
    </div>
  );
}
