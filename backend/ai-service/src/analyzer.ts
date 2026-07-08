import type { SuggestionDraft } from "./repository.js";
import { analyzeWithRules, type AnalysisInput } from "./rules.js";

export interface SuggestionAnalyzer {
  readonly mode: "rules" | "mock" | "external";
  analyze(projectId: string, input: AnalysisInput): Promise<SuggestionDraft[]>;
}

export class RuleSuggestionAnalyzer implements SuggestionAnalyzer {
  readonly mode = "rules" as const;
  async analyze(
    projectId: string,
    input: AnalysisInput,
  ): Promise<SuggestionDraft[]> {
    return analyzeWithRules(projectId, input);
  }
}

export class MockSuggestionAnalyzer implements SuggestionAnalyzer {
  readonly mode = "mock" as const;
  async analyze(projectId: string): Promise<SuggestionDraft[]> {
    return [
      {
        projectId,
        category: "testing",
        severity: "medium",
        confidence: 0.8,
        title: "Add API contract tests",
        description:
          "Contract tests help detect breaking changes between independently deployed services.",
        recommendedAction:
          "Test the request and response shapes used between the gateway and each service.",
      },
      {
        projectId,
        category: "observability",
        severity: "low",
        confidence: 0.76,
        title: "Define service-level indicators",
        description:
          "Health checks show availability but do not describe user-visible reliability.",
        recommendedAction:
          "Track request success rate and latency for the most important API workflows.",
      },
    ];
  }
}
