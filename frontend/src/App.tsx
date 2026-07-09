import { useEffect, useState } from "react";
import type {
  AuthSession,
  Notification,
  PlatformHealth,
  ProjectSummary,
} from "@buildsphere/shared-types";
import { api } from "./api";
import { AppShell } from "./components/AppShell";
import { navigate, projectIdFromPath } from "./navigation";
import { AuthPage } from "./pages/AuthPage";
import { CreateProjectPage } from "./pages/CreateProjectPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GitHubCallbackPage } from "./pages/GitHubCallbackPage";
import { ProjectPage } from "./pages/ProjectPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TemplatesPage } from "./pages/TemplatesPage";

const sessionKey = "buildsphere.session";
const savedSession = (): AuthSession | undefined => {
  try {
    const value = sessionStorage.getItem(sessionKey);
    return value ? (JSON.parse(value) as AuthSession) : undefined;
  } catch {
    sessionStorage.removeItem(sessionKey);
    return undefined;
  }
};

export function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [session, setSession] = useState<AuthSession | undefined>(savedSession);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [health, setHealth] = useState<PlatformHealth>();

  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  useEffect(() => {
    if (!session) return;
    void api
      .projects(session.accessToken)
      .then(setProjects)
      .catch(() => undefined);
    void api
      .notifications(session.accessToken)
      .then(setNotifications)
      .catch(() => undefined);
    void api
      .health(session.accessToken)
      .then(setHealth)
      .catch(() => undefined);
  }, [session, pathname]);

  const authenticated = (next: AuthSession) => {
    sessionStorage.setItem(sessionKey, JSON.stringify(next));
    setSession(next);
    navigate("/dashboard");
  };
  const logout = () => {
    if (session) void api.logout(session.refreshToken).catch(() => undefined);
    sessionStorage.removeItem(sessionKey);
    setSession(undefined);
    setProjects([]);
    setNotifications([]);
    navigate("/login");
  };

  if (!session && pathname === "/auth/github/callback")
    return <GitHubCallbackPage onAuthenticated={authenticated} />;
  if (!session)
    return (
      <AuthPage
        mode={pathname === "/signup" ? "signup" : "login"}
        onAuthenticated={authenticated}
      />
    );
  const projectId = projectIdFromPath(pathname);
  let page: React.ReactNode;
  if (pathname === "/" || pathname === "/dashboard" || pathname === "/projects")
    page = (
      <DashboardPage
        projects={projects}
        health={health}
        notifications={notifications}
      />
    );
  else if (pathname === "/projects/new")
    page = <CreateProjectPage token={session.accessToken} />;
  else if (projectId)
    page = <ProjectPage token={session.accessToken} projectId={projectId} />;
  else if (pathname === "/templates") page = <TemplatesPage />;
  else if (pathname === "/settings") page = <SettingsPage />;
  else
    page = (
      <div className="empty-state">
        <h1>Page not found</h1>
        <button
          className="primary-button"
          onClick={() => navigate("/dashboard")}
        >
          Return to dashboard
        </button>
      </div>
    );

  return (
    <AppShell
      user={session.user}
      pathname={pathname}
      notifications={notifications}
      onLogout={logout}
    >
      {page}
    </AppShell>
  );
}
