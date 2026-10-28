import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live chat · Adetoye Daniel Kehinde",
  description: "Private live chat with Adetoye Daniel Kehinde.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0a0f1e]">{children}</div>;
}
