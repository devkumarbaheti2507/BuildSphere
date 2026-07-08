import type { Notification, UserSummary } from "@buildsphere/shared-types";
import { navigate } from "../navigation";

interface Props {
  user: UserSummary;
  pathname: string;
  notifications: Notification[];
  onLogout: () => void;
  children: React.ReactNode;
}

const links = [
  ["/dashboard", "Dashboard"],
  ["/projects/new", "Create project"],
  ["/templates", "Templates"],
  ["/settings", "Settings"],
] as const;

export function AppShell({
  user,
  pathname,
  notifications,
  onLogout,
  children,
}: Props) {
  const unread = notifications.filter(
    (notification) => !notification.readAt,
  ).length;
  return (
    <div className="shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("/dashboard")}>
          BuildSphere
        </button>
        <nav aria-label="Primary navigation">
          {links.map(([path, label]) => (
            <button
              key={path}
              className={pathname === path ? "nav-link active" : "nav-link"}
              onClick={() => navigate(path)}
            >
              <span className="nav-mark" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-block">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
          </div>
          <button className="text-button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>Developer workspace</span>
          <button
            className="notification-button"
            onClick={() => navigate("/dashboard")}
            aria-label={`${unread} unread notifications`}
          >
            Notifications <b>{unread}</b>
          </button>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
