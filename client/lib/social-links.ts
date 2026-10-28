import type { ComponentType } from "react";
import { Mail } from "lucide-react";
import { FaGithub, FaLinkedinIn, FaTwitter } from "react-icons/fa6";
import type { HeroSocial, HeroSocialPlatform } from "./api";

type IconComponent = ComponentType<{ size?: number | string; className?: string }>;

export type SocialLink = {
  icon: IconComponent;
  href: string;
  label: string;
};

const ICONS: Record<HeroSocialPlatform, IconComponent> = {
  github: FaGithub,
  linkedin: FaLinkedinIn,
  twitter: FaTwitter,
  email: Mail,
};

/**
 * Maps the API's social links to icon components. Empty links are dropped
 * rather than rendered as dead `#` buttons.
 */
export const toSocialLinks = (
  socials: HeroSocial[],
  contactEmail: string,
): SocialLink[] =>
  socials
    .map((social) => ({
      icon: ICONS[social.platform],
      href: social.platform === "email" ? `mailto:${contactEmail}` : social.url,
      label:
        social.platform === "email"
          ? "Email"
          : social.platform.charAt(0).toUpperCase() + social.platform.slice(1),
    }))
    .filter((social) => social.href.trim().length > 0 && social.href !== "#");
