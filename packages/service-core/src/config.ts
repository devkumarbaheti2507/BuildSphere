import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const resolveBuildSphereRoot = (moduleUrl: string): string => {
  const configuredRoot = process.env.BUILDSPHERE_ROOT?.trim();
  return configuredRoot
    ? path.resolve(configuredRoot)
    : path.resolve(path.dirname(fileURLToPath(moduleUrl)), "..", "..", "..");
};

export const loadEnvironment = (...candidatePaths: string[]): void => {
  const environmentFile = candidatePaths.find(existsSync);
  if (environmentFile) {
    process.loadEnvFile(environmentFile);
  }
};

export const requiredEnvironment = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
};
