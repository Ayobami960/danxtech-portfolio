import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import UpdateOverlay from "@/components/ui/UpdateOverlay";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  weight: ["300", "400", "500", "600", "700"],
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Adetoye Daniel Kehinde – Software Engineer",
  description:
    "Full-stack software engineer specialising in scalable systems, AI integration, and high-performance web applications.",
  keywords: ["software engineer", "full-stack", "React", "Next.js", "Node.js", "AI", "Nigeria"],
  openGraph: {
    title: "Adetoye Daniel Kehinde – Software Engineer",
    description: "Building scalable full-stack applications with AI integration.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body suppressHydrationWarning style={{ fontFamily: "var(--font-inter), sans-serif" }}>
        {children}
        <UpdateOverlay />
      </body>
    </html>
  );
}
