import { useCallback, useState, type ReactNode } from "react";
import type { Notification, UserSummary } from "@buildsphere/shared-types";
import { navigate } from "../navigation";
import { NotificationCenter } from "./NotificationCenter";

interface Props {
  user: UserSummary;
  pathname: string;
  notifications: Notification[];
  onMarkNotificationRead: (notificationId: string) => Promise<void>;
  onLogout: () => void;
  children: ReactNode;
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
  onMarkNotificationRead,
  onLogout,
  children,
}: Props) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);
  const unread = notifications.filter(
    (notification) => !notification.readAt,
  ).length;
  return (
    <>
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
              onClick={() => setNotificationsOpen(true)}
              aria-label={
                unread === 0
                  ? "Open notifications"
                  : `Open ${unread} unread notifications`
              }
              aria-expanded={notificationsOpen}
              aria-controls="notification-center"
            >
              Notifications <b>{unread}</b>
            </button>
          </header>
          <main className="page">{children}</main>
        </div>
      </div>
      {notificationsOpen && (
        <NotificationCenter
          notifications={notifications}
          onClose={closeNotifications}
          onMarkRead={onMarkNotificationRead}
        />
      )}
    </>
  );
}
