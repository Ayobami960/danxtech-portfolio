export type AdminUser = {
  id: string;
  email: string;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type Paginated<T> = {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
};

export type HeroStat = { value: string; label: string };
export type HeroSocial = {
  platform: "github" | "linkedin" | "twitter" | "email";
  url: string;
};

export type Hero = {
  id: string;
  nameParts: string[];
  typingPhrases: string[];
  intro: string;
  location: string;
  isAvailable: boolean;
  availabilityLabel: string;
  stats: HeroStat[];
  socials: HeroSocial[];
  updatedAt: string;
};

export type AboutMetric = { value: string; label: string };
export type AboutPrinciple = { icon: string; title: string; body: string };
export type About = {
  id: string;
  paragraphs: string[];
  tags: string[];
  metrics: AboutMetric[];
  principles: AboutPrinciple[];
  updatedAt: string | null;
};

export type Credential = {
  id: string;
  kind: "degree" | "certification";
  title: string;
  issuer: string;
  period: string | null;
  detail: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  id: string;
  contactEmail: string;
  phone: string;
  location: string;
  updatedAt: string | null;
};

export type ProjectImage = {
  id: string;
  url: string | null;
  /** Cloudinary public_id, used to delete the image. */
  fileId: string | null;
  sortOrder: number;
};

/** Metadata of the PDF attached to a project (its bytes live in Cloudinary). */
export type ProjectDocument = {
  url: string;
  publicId: string | null;
  name: string;
  sizeBytes: number;
};

export type Project = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  accentColor: string;
  tech: string[];
  stats: string[];
  liveUrl: string | null;
  githubUrl: string | null;
  coverImage: string | null;
  document: ProjectDocument | null;
  featured: boolean;
  published: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  gallery: ProjectImage[];
};

export type ProjectInput = {
  title: string;
  description: string;
  icon: string;
  accentColor: string;
  tech: string[];
  stats: string[];
  liveUrl: string | null;
  githubUrl: string | null;
  published: boolean;
  /** `null` removes the attached PDF; omitted leaves it untouched. */
  document?: ProjectDocument | null;
};

export type SkillGroup = {
  id: string;
  title: string;
  icon: string;
  items: string[];
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Experience = {
  id: string;
  type: "engineering" | "security";
  role: string;
  company: string;
  period: string;
  isCurrent: boolean;
  color: string;
  highlights: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SecurityFocus = {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  skills: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type OwaspItem = {
  id: string;
  code: string;
  name: string;
  covered: boolean;
  sortOrder: number;
};

export type SecurityStat = {
  id: string;
  icon: string;
  label: string;
  value: string;
  sortOrder: number;
};

export type ResumeInfo =
  | { available: false }
  | {
      available: true;
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      downloadCount: number;
      uploadedAt: string;
      updatedAt: string;
    };

export type Stats = {
  messages: { unread: number; total: number };
  conversations: { unread: number; open: number; total: number };
  projects: { published: number; draft: number; total: number };
  resume: { available: boolean; downloadCount: number; updatedAt: string | null };
  hero: { updatedAt: string | null };
  lastContentUpdate: string | null;
  storageDriver: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  userEmail: string | null;
};

export type InviteStatus = "none" | "active" | "expired" | "revoked";

export type Conversation = {
  id: string;
  visitorName: string;
  visitorEmail: string;
  subject: string | null;
  status: "new" | "open" | "closed" | "archived";
  starred: boolean;
  isSpam: boolean;
  unreadForAdmin: number;
  unreadForVisitor: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  visitorLastSeenAt: string | null;
  adminLastSeenAt: string | null;
  inviteExpiresAt: string | null;
  inviteSentAt: string | null;
  inviteRevokedAt: string | null;
  visitorVerifiedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  invite: {
    status: InviteStatus;
    expiresAt: string | null;
    sentAt: string | null;
  };
};

export type ChatMessage = {
  id: string;
  seq: number;
  conversationId: string;
  sender: "visitor" | "admin" | "system";
  body: string;
  imageUrl: string | null;
  clientMsgId: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export type MessagePage = {
  data: ChatMessage[];
  meta: { hasMore: boolean; oldestSeq: number | null; newestSeq: number | null };
};

export type InviteResult = {
  link: string;
  expiresAt: string;
  emailSent: boolean;
  conversation: Conversation | null;
};

export type TwoFactorStatus = {
  enabled: boolean;
  configured: boolean;
  recoveryCodesRemaining: number;
};

export type SessionInfo = {
  id: string;
  device: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  current: boolean;
};
