import { Suspense } from "react";
import Navbar from "@/components/global/Navbar";
import Footer from "@/components/global/Footer";
import HeroSection from "@/components/landing-page/HeroSection";
import AboutSection from "@/components/landing-page/AboutSection2";
import SkillsSection from "@/components/landing-page/SkillsSection";
import ExperienceSection from "@/components/landing-page/ExperienceSection";
import ContactSection from "@/components/landing-page/ContactSection";
import ProjectsSection from "@/components/landing-page/ProjectsSection";
import SecuritySection from "@/components/landing-page/SecuritySection";
import SectionError from "@/components/ui/SectionError";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  errorMessage,
  fetchAbout,
  fetchCredentials,
  fetchExperience,
  fetchHero,
  fetchProjects,
  fetchResume,
  fetchSecurity,
  fetchSettings,
  fetchSkills,
} from "@/lib/api";
import type {
  About,
  CredentialItem,
  Hero,
  ResumeMetadata,
  Settings,
  SkillGroup,
} from "@/lib/api";

// Content is tagged per section; admin mutations revalidate exactly what
// changed. This window is only the safety net when the webhook is unavailable.
export const revalidate = 60;

const EMPTY_ABOUT: About = {
  paragraphs: [],
  tags: [],
  metrics: [],
  principles: [],
  updatedAt: null,
};

const NOT_AVAILABLE: ResumeMetadata = { available: false };

/** Failed-but-optional request: the block renders without it. */
const optional = async <T,>(task: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await task;
  } catch {
    return fallback;
  }
};

/**
 * Awaited data or a message to show: JSX is never built inside a try/catch,
 * because a render error would escape it anyway.
 */
type BlockResult<T> = { ok: true; value: T } | { ok: false; message: string };

const load = async <T,>(task: () => Promise<T>): Promise<BlockResult<T>> => {
  try {
    return { ok: true, value: await task() };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
};

const EmptySection = ({
  label,
  message,
}: {
  label: string;
  message: string;
}) => (
  <div className="mx-auto max-w-3xl px-6! py-20! text-center">
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#7c8fa6]">{label}</p>
    <p className="mt-3 text-sm text-[#8fa1b8]">{message}</p>
  </div>
);

/** Suspense fallback: the shared spinner holding the section's place. */
const SectionLoader = ({ label }: { label: string }) => (
  <div className="flex min-h-[40vh] items-center justify-center bg-[#0a0f1e] px-6!">
    <LoadingSpinner label={`Loading ${label}`} size={28} />
  </div>
);

/* ------------------------------- navigation -------------------------------- */

async function NavBlock() {
  const [settings, hero] = await Promise.all([
    optional<Settings | null>(fetchSettings(), null),
    optional<Hero | null>(fetchHero(), null),
  ]);

  return <Navbar settings={settings} socials={hero?.socials ?? []} />;
}

/* ---------------------------------- hero ----------------------------------- */

async function HeroBlock() {
  let hero: Hero;
  try {
    hero = await fetchHero();
  } catch (error) {
    return (
      <SectionError
        title="The introduction could not load"
        message={errorMessage(error)}
      />
    );
  }

  if (hero.nameParts.length === 0 && hero.intro.trim().length === 0) {
    return (
      <EmptySection
        label="Hero"
        message="The introduction has not been published yet. Upload it from the admin app."
      />
    );
  }

  const [about, skills, resume] = await Promise.all([
    optional<About>(fetchAbout().then((value) => value ?? EMPTY_ABOUT), EMPTY_ABOUT),
    optional<SkillGroup[]>(fetchSkills(), []),
    optional<ResumeMetadata>(fetchResume(), NOT_AVAILABLE),
  ]);

  return <HeroSection hero={hero} about={about} skills={skills} resume={resume} />;
}

/* ---------------------------------- about ---------------------------------- */

async function AboutBlock() {
  const result = await load(async () => {
    const [about, credentials] = await Promise.all([
      fetchAbout(),
      optional<CredentialItem[]>(fetchCredentials(), []),
    ]);
    return { about, credentials };
  });

  if (!result.ok) {
    return <SectionError title="The about section could not load" message={result.message} />;
  }

  const { about, credentials } = result.value;
  if (!about || about.paragraphs.length === 0) {
    return (
      <EmptySection
        label="About"
        message="The about section has not been written yet."
      />
    );
  }

  return <AboutSection about={about} credentials={credentials} />;
}

/* -------------------------------- experience ------------------------------- */

async function ExperienceBlock() {
  const result = await load(async () => {
    const [experience, credentials] = await Promise.all([
      fetchExperience(),
      optional<CredentialItem[]>(fetchCredentials(), []),
    ]);
    return { experience, credentials };
  });

  if (!result.ok) {
    return <SectionError title="Experience could not load" message={result.message} />;
  }

  const { experience, credentials } = result.value;
  if (experience.length === 0 && credentials.length === 0) {
    return (
      <EmptySection
        label="Experience"
        message="No roles have been published yet."
      />
    );
  }

  return <ExperienceSection experience={experience} credentials={credentials} />;
}

/* ---------------------------------- skills --------------------------------- */

async function SkillsBlock() {
  const result = await load(fetchSkills);

  if (!result.ok) {
    return <SectionError title="Skills could not load" message={result.message} />;
  }

  if (result.value.length === 0) {
    return <EmptySection label="Skills" message="The skill list is being updated." />;
  }

  return <SkillsSection groups={result.value} />;
}

/* --------------------------------- security -------------------------------- */

async function SecurityBlock() {
  const result = await load(fetchSecurity);

  if (!result.ok) {
    return <SectionError title="The security section could not load" message={result.message} />;
  }

  const security = result.value;
  const isEmpty =
    security.focus.length === 0 &&
    security.owasp.length === 0 &&
    security.stats.length === 0;

  if (isEmpty) {
    return (
      <EmptySection
        label="Security"
        message="The security overview is being prepared."
      />
    );
  }

  return <SecuritySection security={security} />;
}

/* --------------------------------- projects -------------------------------- */

async function ProjectsBlock() {
  const result = await load(fetchProjects);

  if (!result.ok) {
    return <SectionError title="Projects could not load" message={result.message} />;
  }

  return <ProjectsSection projects={result.value} />;
}

/* --------------------------------- contact --------------------------------- */

async function ContactBlock() {
  const [settings, hero] = await Promise.all([
    optional<Settings | null>(fetchSettings(), null),
    optional<Hero | null>(fetchHero(), null),
  ]);

  const availability = hero?.availability ?? {
    isAvailable: false,
    label: "Availability is being updated",
  };

  return (
    <ContactSection
      settings={
        settings ?? { contactEmail: "", phone: "", location: "", updatedAt: null }
      }
      availability={availability}
    />
  );
}

/* ---------------------------------- footer --------------------------------- */

async function FooterBlock() {
  const [settings, hero] = await Promise.all([
    optional<Settings | null>(fetchSettings(), null),
    optional<Hero | null>(fetchHero(), null),
  ]);

  return <Footer settings={settings} socials={hero?.socials ?? []} />;
}

/* ----------------------------------- page ---------------------------------- */

export default function Root() {
  return (
    <>
      <Suspense
        fallback={
          <div className="flex h-16 items-center justify-center bg-[#0a0f1e]">
            <LoadingSpinner label="Loading navigation" />
          </div>
        }
      >
        <NavBlock />
      </Suspense>

      <main
        id="main"
        className="min-h-screen bg-[#0a0f1e]"
        aria-label="Portfolio content"
      >
        {/* Each block streams in behind the shared spinner, and a failure in
            one block never blocks the others. */}
        <Suspense fallback={<SectionLoader label="the introduction" />}>
          <HeroBlock />
        </Suspense>

        <Suspense fallback={<SectionLoader label="the about section" />}>
          <AboutBlock />
        </Suspense>

        <Suspense fallback={<SectionLoader label="experience" />}>
          <ExperienceBlock />
        </Suspense>

        <Suspense fallback={<SectionLoader label="skills" />}>
          <SkillsBlock />
        </Suspense>

        <Suspense fallback={<SectionLoader label="security" />}>
          <SecurityBlock />
        </Suspense>

        <Suspense fallback={<SectionLoader label="projects" />}>
          <ProjectsBlock />
        </Suspense>

        <Suspense fallback={<SectionLoader label="contact" />}>
          <ContactBlock />
        </Suspense>
      </main>

      <Suspense
        fallback={
          <div className="flex h-24 items-center justify-center border-t border-white/5 bg-[#0a0f1e]">
            <LoadingSpinner label="Loading footer" />
          </div>
        }
      >
        <FooterBlock />
      </Suspense>
    </>
  );
}
