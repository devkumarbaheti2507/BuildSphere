import { useEffect, useState } from "react";
import type { Notification } from "@buildsphere/shared-types";

interface Props {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (notificationId: string) => Promise<void>;
}

const eventLabel = (type: Notification["type"]): string =>
  type.replaceAll(".", " / ");

export function NotificationCenter({
  notifications,
  onClose,
  onMarkRead,
}: Props) {
  const unread = notifications.filter((notification) => !notification.readAt);
  const [busyId, setBusyId] = useState<string>();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const markRead = async (notificationId: string) => {
    setBusyId(notificationId);
    setError("");
    try {
      await onMarkRead(notificationId);
    } catch {
      setError("The notification could not be marked as read.");
    } finally {
      setBusyId(undefined);
    }
  };

  const markAllRead = async () => {
    setBulkBusy(true);
    setError("");
    try {
      for (const notification of unread) {
        await onMarkRead(notification.id);
      }
    } catch {
      setError(
        "Some notifications could not be marked as read. Completed updates were kept.",
      );
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div
      className="notification-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        id="notification-center"
        className="notification-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-center-title"
      >
        <header className="notification-center-header">
          <div>
            <p className="section-label">Activity</p>
            <h2 id="notification-center-title">Notifications</h2>
          </div>
          <button
            className="notification-close"
            onClick={onClose}
            aria-label="Close notifications"
            title="Close notifications"
            autoFocus
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </header>
        <div className="notification-center-summary" aria-live="polite">
          <span>
            <strong>{unread.length}</strong> unread
          </span>
          <button
            className="text-button"
            onClick={() => void markAllRead()}
            disabled={unread.length === 0 || bulkBusy || Boolean(busyId)}
          >
            {bulkBusy ? "Marking..." : "Mark all read"}
          </button>
        </div>
        {error && (
          <p className="notification-center-error" role="alert">
            {error}
          </p>
        )}
        {notifications.length === 0 ? (
          <div className="notification-center-empty">
            <h3>No notifications</h3>
            <p>Project and delivery activity will appear here.</p>
          </div>
        ) : (
          <div className="notification-center-list">
            {notifications.map((notification) => (
              <article
                className={
                  notification.readAt
                    ? "notification-center-item read"
                    : "notification-center-item unread"
                }
                key={notification.id}
              >
                <div className="notification-center-meta">
                  <span>{notification.readAt ? "Read" : "Unread"}</span>
                  <time dateTime={notification.createdAt}>
                    {new Date(notification.createdAt).toLocaleString()}
                  </time>
                </div>
                <h3>{notification.title}</h3>
                <p>{notification.message}</p>
                <footer>
                  <span>{eventLabel(notification.type)}</span>
                  {!notification.readAt && (
                    <button
                      className="small-button"
                      onClick={() => void markRead(notification.id)}
                      disabled={bulkBusy || Boolean(busyId)}
                    >
                      {busyId === notification.id ? "Marking..." : "Mark read"}
                    </button>
                  )}
                </footer>
              </article>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
