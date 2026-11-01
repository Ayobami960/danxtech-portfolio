import { Suspense, lazy } from "react";
import { Outlet, Route, Routes } from "react-router-dom";
import LoginPage from "../features/auth/LoginPage";
import { Shell } from "../components/Shell";
import { Skeleton } from "../components/States";
import { RequireAuth } from "./RequireAuth";

const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const InboxPage = lazy(() => import("../features/inbox/InboxPage"));
const ProjectsPage = lazy(() => import("../features/projects/ProjectsPage"));
const ProjectEditorPage = lazy(() => import("../features/projects/ProjectEditorPage"));
const HeroPage = lazy(() => import("../features/hero/HeroPage"));
const AboutPage = lazy(() => import("../features/about/AboutPage"));
const ExperiencePage = lazy(() => import("../features/experience/ExperiencePage"));
const SkillsPage = lazy(() => import("../features/skills/SkillsPage"));
const SecurityPage = lazy(() => import("../features/security/SecurityPage"));
const CredentialsPage = lazy(() => import("../features/credentials/CredentialsPage"));
const ResumePage = lazy(() => import("../features/resume/ResumePage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));
const AccountPage = lazy(() => import("../features/account/AccountPage"));
const ActivityPage = lazy(() => import("../features/activity/ActivityPage"));
const NotFoundPage = lazy(() => import("./NotFoundPage"));

const RouteFallback = () => (
  <div className="space-y-4" aria-busy="true">
    <Skeleton className="h-10 w-64" />
    <Skeleton className="h-40" />
    <Skeleton className="h-40" />
  </div>
);

export const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route
      element={
        <RequireAuth>
          <Shell>
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </Shell>
        </RequireAuth>
      }
    >
      <Route index element={<DashboardPage />} />
      <Route path="/inbox" element={<InboxPage />} />
      <Route path="/inbox/:conversationId" element={<InboxPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/new" element={<ProjectEditorPage />} />
      <Route path="/projects/:id" element={<ProjectEditorPage />} />
      <Route path="/hero" element={<HeroPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/experience" element={<ExperiencePage />} />
      <Route path="/skills" element={<SkillsPage />} />
      <Route path="/security" element={<SecurityPage />} />
      <Route path="/credentials" element={<CredentialsPage />} />
      <Route path="/resume" element={<ResumePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/activity" element={<ActivityPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
);
