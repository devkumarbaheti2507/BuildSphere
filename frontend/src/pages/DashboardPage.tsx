import { useState } from "react";
import type {
  Notification,
  PlatformHealth,
  ProjectSummary,
} from "@buildsphere/shared-types";
import { navigate } from "../navigation";

export function DashboardPage({
  projects,
  health,
  notifications,
  onMarkNotificationRead,
}: {
  projects: ProjectSummary[];
  health?: PlatformHealth;
  notifications: Notification[];
  onMarkNotificationRead: (notificationId: string) => Promise<void>;
}) {
  const unread = notifications.filter((item) => !item.readAt);
  const [busyNotificationId, setBusyNotificationId] = useState<string>();
  const [notificationError, setNotificationError] = useState("");
  const markRead = async (notificationId: string) => {
    setBusyNotificationId(notificationId);
    setNotificationError("");
    try {
      await onMarkNotificationRead(notificationId);
    } catch {
      setNotificationError("The notification could not be marked as read.");
    } finally {
      setBusyNotificationId(undefined);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="section-label">Workspace overview</p>
          <h1>Dashboard</h1>
        </div>
        <button
          className="primary-button"
          onClick={() => navigate("/projects/new")}
        >
          + Create project
        </button>
      </div>
      <section className="stat-grid" aria-label="Workspace statistics">
        <div className="stat">
          <span>Projects</span>
          <strong>{projects.length}</strong>
          <small>
            {projects.filter((project) => project.status === "active").length}{" "}
            active
          </small>
        </div>
        <div className="stat">
          <span>Platform health</span>
          <strong className={health?.status === "ok" ? "good" : "warn"}>
            {health?.status ?? "Checking"}
          </strong>
          <small>
            {health?.services.filter((service) => service.status === "ok")
              .length ?? 0}{" "}
            services available
          </small>
        </div>
        <div className="stat">
          <span>Unread events</span>
          <strong>{unread.length}</strong>
          <small>Recent platform activity</small>
        </div>
      </section>
      <section className="content-band">
        <div className="band-heading">
          <h2>Projects</h2>
          <span>{projects.length} total</span>
        </div>
        {projects.length === 0 ? (
          <div className="empty-state">
            <h3>No projects yet</h3>
            <p>Your first configured delivery workspace will appear here.</p>
            <button
              className="secondary-button"
              onClick={() => navigate("/projects/new")}
            >
              Create project
            </button>
          </div>
        ) : (
          <div className="data-table">
            <div className="table-row table-head">
              <span>Name</span>
              <span>Architecture</span>
              <span>Tools</span>
              <span>Status</span>
            </div>
            {projects.map((project) => (
              <button
                className="table-row"
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <span>
                  <strong>{project.name}</strong>
                  <small>{project.description || "No description"}</small>
                </span>
                <span>{project.architectureType}</span>
                <span>{project.toolSelections.length}</span>
                <span className={`status ${project.status}`}>
                  {project.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="content-band">
        <div className="band-heading">
          <h2>Recent notifications</h2>
          <span>{unread.length} unread</span>
        </div>
        {notificationError && (
          <p className="form-error" role="alert">
            {notificationError}
          </p>
        )}
        {notifications.length === 0 ? (
          <p className="quiet">No events have been recorded.</p>
        ) : (
          <div className="notification-list">
            {notifications.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className={item.readAt ? "notification read" : "notification"}
              >
                <span className="event-dot" />
                <div className="notification-copy">
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </div>
                {!item.readAt && (
                  <button
                    className="small-button notification-action"
                    onClick={() => void markRead(item.id)}
                    disabled={Boolean(busyNotificationId)}
                  >
                    {busyNotificationId === item.id
                      ? "Marking..."
                      : "Mark read"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
