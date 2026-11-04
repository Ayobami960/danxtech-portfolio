import type { ReactNode } from "react";
import Navbar from "@/components/global/Navbar";
import Footer from "@/components/global/Footer";
import HeroSection from "@/components/landing-page/HeroSection";
import AboutSection from "@/components/landing-page/AboutSection2";
import SkillsSection from "@/components/landing-page/SkillsSection";
import ExperienceSection from "@/components/landing-page/ExperienceSection";
import Credentials from "@/components/landing-page/Credentials";
import ContactSection from "@/components/landing-page/ContactSection";
import ProjectsSection from "@/components/landing-page/ProjectsSection";
import SecuritySection from "@/components/landing-page/SecuritySection";
import SectionError from "@/components/ui/SectionError";
import { loadInitialContent, valueOr } from "@/lib/initial-data";
import type { About, ResumeMetadata, Settings } from "@/lib/api";

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

const EMPTY_SETTINGS: Settings = {
  contactEmail: "",
  phone: "",
  location: "",
  updatedAt: null,
};

const NOT_AVAILABLE: ResumeMetadata = { available: false };

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


export default async function Root() {
  const content = await loadInitialContent();

  const hero = content.hero.ok ? content.hero.value : null;
  const settings = valueOr(content.settings, null);
  const about = valueOr(content.about, null);
  const credentials = valueOr(content.credentials, []);
  const skills = valueOr(content.skills, []);
  const resume = valueOr(content.resume, NOT_AVAILABLE);
  const socials = hero?.socials ?? [];
  const availability = hero?.availability ?? {
    isAvailable: false,
    label: "Availability is being updated",
  };

  /* ---------------------------------- hero ----------------------------------- */
  let heroBlock: ReactNode;
  if (!content.hero.ok) {
    heroBlock = (
      <SectionError title="The introduction could not load" message={content.hero.message} />
    );
  } else if (
    content.hero.value.nameParts.length === 0 &&
    content.hero.value.intro.trim().length === 0
  ) {
    heroBlock = (
      <EmptySection
        label="Hero"
        message="The introduction has not been published yet. Upload it from the admin app."
      />
    );
  } else {
    heroBlock = (
      <HeroSection
        hero={content.hero.value}
        about={about ?? EMPTY_ABOUT}
        skills={skills}
        resume={resume}
      />
    );
  }

  /* ---------------------------------- about ---------------------------------- */
  let aboutBlock: ReactNode;
  if (!content.about.ok) {
    aboutBlock = (
      <SectionError title="The about section could not load" message={content.about.message} />
    );
  } else if (!about || about.paragraphs.length === 0) {
    aboutBlock = (
      <EmptySection label="About" message="The about section has not been written yet." />
    );
  } else {
    aboutBlock = <AboutSection about={about} credentials={credentials} />;
  }

  /* -------------------------------- experience ------------------------------- */
  let experienceBlock: ReactNode;
  if (!content.experience.ok) {
    experienceBlock = (
      <SectionError title="Experience could not load" message={content.experience.message} />
    );
  } else if (content.experience.value.length === 0) {
    experienceBlock = (
      <EmptySection label="Experience" message="No roles have been published yet." />
    );
  } else {
    experienceBlock = <ExperienceSection experience={content.experience.value} />;
  }

  /* ---------------------------------- skills --------------------------------- */
  let skillsBlock: ReactNode;
  if (!content.skills.ok) {
    skillsBlock = <SectionError title="Skills could not load" message={content.skills.message} />;
  } else if (content.skills.value.length === 0) {
    skillsBlock = <EmptySection label="Skills" message="The skill list is being updated." />;
  } else {
    skillsBlock = <SkillsSection groups={content.skills.value} />;
  }

  /* --------------------------------- security -------------------------------- */
  let securityBlock: ReactNode;
  if (!content.security.ok) {
    securityBlock = (
      <SectionError
        title="The security section could not load"
        message={content.security.message}
      />
    );
  } else {
    const security = content.security.value;
    const isEmpty =
      security.focus.length === 0 &&
      security.owasp.length === 0 &&
      security.stats.length === 0;

    securityBlock = isEmpty ? (
      <EmptySection
        label="Security"
        message="The security overview is being prepared."
      />
    ) : (
      <SecuritySection security={security} />
    );
  }

  /* --------------------------------- projects -------------------------------- */
  const projectsBlock: ReactNode = content.projects.ok ? (
    <ProjectsSection projects={content.projects.value} />
  ) : (
    <SectionError title="Projects could not load" message={content.projects.message} />
  );

  return (
    <>
      <Navbar settings={settings} socials={socials} />

      <main
        id="main"
        className="min-h-screen bg-[#0a0f1e]"
        aria-label="Portfolio content"
      >
        {heroBlock}
        {aboutBlock}
        <Credentials credentials={credentials} />
        {experienceBlock}
        {skillsBlock}
        {securityBlock}
        {projectsBlock}
        <ContactSection settings={settings ?? EMPTY_SETTINGS} availability={availability} />
      </main>

      <Footer settings={settings} socials={socials} />
    </>
  );
}
