import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

const requestDurationBuckets = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10,
];

type RequestLabel = "method" | "route" | "status_code";
type InFlightLabel = "method";

export interface CompletedHttpRequest {
  durationSeconds: number;
  method: string;
  route: string;
  statusCode: number;
}

export class ServiceMetrics {
  readonly contentType: string;
  private readonly registry: Registry;
  private readonly requests: Counter<RequestLabel>;
  private readonly requestDuration: Histogram<RequestLabel>;
  private readonly requestsInFlight: Gauge<InFlightLabel>;

  constructor(service: string) {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ service });
    this.contentType = this.registry.contentType;

    collectDefaultMetrics({
      prefix: "buildsphere_",
      register: this.registry,
    });

    this.requests = new Counter({
      name: "buildsphere_http_requests_total",
      help: "Total completed HTTP requests.",
      labelNames: ["method", "route", "status_code"],
      registers: [this.registry],
    });
    this.requestDuration = new Histogram({
      name: "buildsphere_http_request_duration_seconds",
      help: "HTTP request duration in seconds.",
      labelNames: ["method", "route", "status_code"],
      buckets: requestDurationBuckets,
      registers: [this.registry],
    });
    this.requestsInFlight = new Gauge({
      name: "buildsphere_http_requests_in_flight",
      help: "HTTP requests currently being processed.",
      labelNames: ["method"],
      registers: [this.registry],
    });
  }

  begin(method: string): void {
    this.requestsInFlight.inc({ method });
  }

  complete(request: CompletedHttpRequest): void {
    const labels = {
      method: request.method,
      route: request.route,
      status_code: String(request.statusCode),
    };
    this.requestsInFlight.dec({ method: request.method });
    this.requests.inc(labels);
    this.requestDuration.observe(labels, request.durationSeconds);
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }
}

export type AdditionalMetrics = () => Promise<string> | string;

const appendMetrics = (base: string, additional: string): string => {
  const output = [base.trimEnd(), additional.trim()].filter(Boolean).join("\n");
  return `${output}\n`;
};

export const metricsHandler =
  (
    metrics: ServiceMetrics,
    additionalMetrics?: AdditionalMetrics,
  ): RequestHandler =>
  (_request: Request, response: Response, next: NextFunction) => {
    Promise.all([
      metrics.render(),
      Promise.resolve(additionalMetrics?.() ?? ""),
    ])
      .then(([base, additional]) => {
        response.setHeader("content-type", metrics.contentType);
        response.setHeader("cache-control", "no-store");
        response.send(appendMetrics(base, additional));
      })
      .catch(next);
  };
