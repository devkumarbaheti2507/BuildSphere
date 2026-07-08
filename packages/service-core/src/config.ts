import { existsSync } from "node:fs";
import process from "node:process";

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
