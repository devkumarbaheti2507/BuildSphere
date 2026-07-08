import { randomUUID } from "node:crypto";
import type { Suggestion, SuggestionStatus } from "@buildsphere/shared-types";
import type { DatabasePool } from "@buildsphere/service-core/database";

export type SuggestionDraft = Omit<Suggestion, "id" | "status" | "createdAt">;
export interface SuggestionRepository {
  replaceForProject(
    ownerId: string,
    projectId: string,
    drafts: SuggestionDraft[],
  ): Promise<Suggestion[]>;
  list(ownerId: string, projectId: string): Promise<Suggestion[]>;
  updateStatus(
    ownerId: string,
    suggestionId: string,
    status: SuggestionStatus,
  ): Promise<Suggestion | undefined>;
}

interface SuggestionRow {
  id: string;
  project_id: string;
  category: Suggestion["category"];
  severity: Suggestion["severity"];
  title: string;
  description: string;
  recommended_action: string;
  confidence: number;
  status: SuggestionStatus;
  created_at: Date | string;
}
const mapSuggestion = (row: SuggestionRow): Suggestion => ({
  id: row.id,
  projectId: row.project_id,
  category: row.category,
  severity: row.severity,
  title: row.title,
  description: row.description,
  recommendedAction: row.recommended_action,
  confidence: row.confidence,
  status: row.status,
  createdAt:
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
});

export class PostgresSuggestionRepository implements SuggestionRepository {
  constructor(private readonly database: DatabasePool) {}
  async replaceForProject(
    ownerId: string,
    projectId: string,
    drafts: SuggestionDraft[],
  ): Promise<Suggestion[]> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM suggestions WHERE owner_id = $1 AND project_id = $2 AND status = 'open'",
        [ownerId, projectId],
      );
      const results: Suggestion[] = [];
      for (const draft of drafts) {
        const result = await client.query<SuggestionRow>(
          `INSERT INTO suggestions
           (id, owner_id, project_id, category, severity, title, description, recommended_action, confidence, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open') RETURNING *`,
          [
            randomUUID(),
            ownerId,
            projectId,
            draft.category,
            draft.severity,
            draft.title,
            draft.description,
            draft.recommendedAction,
            draft.confidence,
          ],
        );
        results.push(mapSuggestion(result.rows[0]));
      }
      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async list(ownerId: string, projectId: string): Promise<Suggestion[]> {
    const result = await this.database.query<SuggestionRow>(
      "SELECT * FROM suggestions WHERE owner_id = $1 AND project_id = $2 ORDER BY created_at DESC",
      [ownerId, projectId],
    );
    return result.rows.map(mapSuggestion);
  }
  async updateStatus(
    ownerId: string,
    suggestionId: string,
    status: SuggestionStatus,
  ): Promise<Suggestion | undefined> {
    const result = await this.database.query<SuggestionRow>(
      "UPDATE suggestions SET status = $3 WHERE owner_id = $1 AND id = $2 RETURNING *",
      [ownerId, suggestionId, status],
    );
    return result.rows[0] ? mapSuggestion(result.rows[0]) : undefined;
  }
}

export class InMemorySuggestionRepository implements SuggestionRepository {
  private readonly suggestions = new Map<
    string,
    Suggestion & { ownerId: string }
  >();
  async replaceForProject(
    ownerId: string,
    projectId: string,
    drafts: SuggestionDraft[],
  ): Promise<Suggestion[]> {
    for (const [id, suggestion] of this.suggestions) {
      if (
        suggestion.ownerId === ownerId &&
        suggestion.projectId === projectId &&
        suggestion.status === "open"
      )
        this.suggestions.delete(id);
    }
    return drafts.map((draft) => {
      const suggestion = {
        id: randomUUID(),
        ownerId,
        ...draft,
        status: "open" as const,
        createdAt: new Date().toISOString(),
      };
      this.suggestions.set(suggestion.id, suggestion);
      const { ownerId: _ownerId, ...publicSuggestion } = suggestion;
      return publicSuggestion;
    });
  }
  async list(ownerId: string, projectId: string): Promise<Suggestion[]> {
    return [...this.suggestions.values()]
      .filter(
        (item) => item.ownerId === ownerId && item.projectId === projectId,
      )
      .map(({ ownerId: _ownerId, ...suggestion }) =>
        structuredClone(suggestion),
      );
  }
  async updateStatus(
    ownerId: string,
    suggestionId: string,
    status: SuggestionStatus,
  ): Promise<Suggestion | undefined> {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion || suggestion.ownerId !== ownerId) return undefined;
    suggestion.status = status;
    const { ownerId: _ownerId, ...publicSuggestion } = suggestion;
    return structuredClone(publicSuggestion);
  }
}
