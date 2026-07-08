import { promises as fs } from "node:fs";
import path from "node:path";
import { ApiError } from "@buildsphere/service-core";

const allowedPrompts = [
  "architecture",
  "docker",
  "kubernetes",
  "optimization",
  "review",
  "security",
] as const;
export class PromptLoader {
  constructor(private readonly promptsDirectory: string) {}
  list(): readonly string[] {
    return allowedPrompts;
  }
  async load(name: string): Promise<string> {
    if (!allowedPrompts.includes(name as (typeof allowedPrompts)[number])) {
      throw new ApiError(
        404,
        "PROMPT_NOT_FOUND",
        "The requested prompt does not exist",
      );
    }
    return fs.readFile(path.join(this.promptsDirectory, `${name}.md`), "utf8");
  }
}
