import type { LogLevel, PipelineLog } from "@buildsphere/shared-types";

export interface LogWriteInput {
  ownerId: string;
  executionId: string;
  stageKey: string;
  level: LogLevel;
  message: string;
}
export interface LogWriter {
  append(input: LogWriteInput): Promise<void>;
}

export class HttpLogWriter implements LogWriter {
  constructor(
    private readonly baseUrl: string,
    private readonly internalToken: string,
  ) {}
  async append(input: LogWriteInput): Promise<void> {
    const response = await fetch(`${this.baseUrl}/internal/logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-service-token": this.internalToken,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok)
      throw new Error(`Logging service returned ${response.status}`);
  }
}

export class InMemoryLogWriter implements LogWriter {
  readonly entries: LogWriteInput[] = [];
  async append(input: LogWriteInput): Promise<void> {
    this.entries.push(structuredClone(input));
  }
}
