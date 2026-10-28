import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-8xl font-bold text-ink-200 mb-4">404</h1>
      <h2 className="font-display text-2xl font-bold text-ink-900 mb-2">Page not found</h2>
      <p className="text-ink-500 font-body mb-8 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/"
        className="px-6 py-3 bg-ember-600 hover:bg-ember-700 text-white font-sans font-semibold rounded-xl transition-colors">
        Back to Home
      </Link>
    </div>
  );
}
