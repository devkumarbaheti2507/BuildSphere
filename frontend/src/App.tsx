import { useEffect, useState } from "react";
import type {
  AuthSession,
  Notification,
  PlatformHealth,
  ProjectSummary,
} from "@buildsphere/shared-types";
import { api, SESSION_UNAUTHORIZED_EVENT } from "./api";
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

let sessionRefresh: Promise<AuthSession> | undefined;
const refreshSession = (refreshToken: string): Promise<AuthSession> => {
  if (!sessionRefresh) {
    sessionRefresh = api
      .refresh(refreshToken)
      .finally(() => (sessionRefresh = undefined));
  }
  return sessionRefresh;
};

interface SessionState {
  session?: AuthSession;
  ready: boolean;
}

const orderNotifications = (items: Notification[]): Notification[] =>
  [...items].sort((left, right) => {
    const readOrder =
      Number(Boolean(left.readAt)) - Number(Boolean(right.readAt));
    return (
      readOrder ||
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });

export function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [sessionState, setSessionState] = useState<SessionState>(() => {
    const session = savedSession();
    return { session, ready: !session };
  });
  const { session, ready: sessionReady } = sessionState;
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [health, setHealth] = useState<PlatformHealth>();

  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  useEffect(() => {
    const requireAuthentication = () =>
      setSessionState((current) =>
        current.session ? { ...current, ready: false } : current,
      );
    window.addEventListener(SESSION_UNAUTHORIZED_EVENT, requireAuthentication);
    return () =>
      window.removeEventListener(
        SESSION_UNAUTHORIZED_EVENT,
        requireAuthentication,
      );
  }, []);
  useEffect(() => {
    if (!session || sessionReady) return;
    let active = true;
    void refreshSession(session.refreshToken)
      .then((next) => {
        if (!active) return;
        sessionStorage.setItem(sessionKey, JSON.stringify(next));
        setSessionState({ session: next, ready: true });
      })
      .catch(() => {
        if (!active) return;
        sessionStorage.removeItem(sessionKey);
        setSessionState({ ready: true });
        setProjects([]);
        setNotifications([]);
        setHealth(undefined);
        navigate("/login");
      });
    return () => {
      active = false;
    };
  }, [session, sessionReady]);
  useEffect(() => {
    if (!session || !sessionReady) return;
    void api
      .projects(session.accessToken)
      .then(setProjects)
      .catch(() => undefined);
    void api
      .notifications(session.accessToken)
      .then((items) => setNotifications(orderNotifications(items)))
      .catch(() => undefined);
    void api
      .health(session.accessToken)
      .then(setHealth)
      .catch(() => undefined);
  }, [session, sessionReady, pathname]);

  const authenticated = (next: AuthSession) => {
    sessionStorage.setItem(sessionKey, JSON.stringify(next));
    setSessionState({ session: next, ready: true });
    navigate("/dashboard");
  };
  const logout = () => {
    if (session) void api.logout(session.refreshToken).catch(() => undefined);
    sessionStorage.removeItem(sessionKey);
    setSessionState({ ready: true });
    setProjects([]);
    setNotifications([]);
    setHealth(undefined);
    navigate("/login");
  };
  const markNotificationRead = async (notificationId: string) => {
    if (!session) return;
    const updated = await api.markNotificationRead(
      session.accessToken,
      notificationId,
    );
    setNotifications((current) =>
      orderNotifications(
        current.map((notification) =>
          notification.id === updated.id ? updated : notification,
        ),
      ),
    );
  };

  if (session && !sessionReady)
    return <main className="loading-state">Restoring session...</main>;

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
        onMarkNotificationRead={markNotificationRead}
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
      onMarkNotificationRead={markNotificationRead}
      onLogout={logout}
    >
      {page}
    </AppShell>
  );
}
