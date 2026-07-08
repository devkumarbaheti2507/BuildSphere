import { randomUUID } from "node:crypto";
import type { Notification, NotificationType } from "@buildsphere/shared-types";
import type { DatabasePool } from "@buildsphere/service-core/database";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}
export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<Notification>;
  list(userId: string): Promise<Notification[]>;
  markRead(
    userId: string,
    notificationId: string,
  ): Promise<Notification | undefined>;
}
interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  read_at: Date | string | null;
  created_at: Date | string;
}
const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const mapNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  title: row.title,
  message: row.message,
  metadata: row.metadata,
  readAt: row.read_at ? iso(row.read_at) : undefined,
  createdAt: iso(row.created_at),
});

export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly database: DatabasePool) {}
  async create(input: CreateNotificationInput): Promise<Notification> {
    const result = await this.database.query<NotificationRow>(
      `INSERT INTO notifications (id, user_id, type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        randomUUID(),
        input.userId,
        input.type,
        input.title,
        input.message,
        JSON.stringify(input.metadata),
      ],
    );
    return mapNotification(result.rows[0]);
  }
  async list(userId: string): Promise<Notification[]> {
    const result = await this.database.query<NotificationRow>(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY (read_at IS NOT NULL), created_at DESC",
      [userId],
    );
    return result.rows.map(mapNotification);
  }
  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<Notification | undefined> {
    const result = await this.database.query<NotificationRow>(
      "UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE user_id = $1 AND id = $2 RETURNING *",
      [userId, notificationId],
    );
    return result.rows[0] ? mapNotification(result.rows[0]) : undefined;
  }
}

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly notifications = new Map<string, Notification>();
  async create(input: CreateNotificationInput): Promise<Notification> {
    const notification = {
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.notifications.set(notification.id, notification);
    return structuredClone(notification);
  }
  async list(userId: string): Promise<Notification[]> {
    return [...this.notifications.values()]
      .filter((item) => item.userId === userId)
      .sort(
        (a, b) =>
          Number(Boolean(a.readAt)) - Number(Boolean(b.readAt)) ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .map((item) => structuredClone(item));
  }
  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<Notification | undefined> {
    const notification = this.notifications.get(notificationId);
    if (!notification || notification.userId !== userId) return undefined;
    notification.readAt ??= new Date().toISOString();
    return structuredClone(notification);
  }
}
