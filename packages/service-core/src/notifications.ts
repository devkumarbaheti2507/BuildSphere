import type { NotificationType } from "@buildsphere/shared-types";
import type { Logger } from "pino";

export interface NotificationEvent {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPublisher {
  publish(event: NotificationEvent): Promise<void>;
}

export class NoopNotificationPublisher implements NotificationPublisher {
  async publish(_event: NotificationEvent): Promise<void> {}
}

export class HttpNotificationPublisher implements NotificationPublisher {
  constructor(
    private readonly baseUrl: string,
    private readonly internalToken: string,
    private readonly logger: Logger,
  ) {}

  async publish(event: NotificationEvent): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/internal/notifications`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-service-token": this.internalToken,
        },
        body: JSON.stringify({ ...event, metadata: event.metadata ?? {} }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok)
        this.logger.warn(
          { statusCode: response.status, eventType: event.type },
          "Notification was not stored",
        );
    } catch (error) {
      this.logger.warn(
        { error, eventType: event.type },
        "Notification service is unavailable",
      );
    }
  }
}
