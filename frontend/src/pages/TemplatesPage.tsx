import { useEffect, useState } from "react";
import type { TemplateMetadata } from "@buildsphere/shared-types";
import { api } from "../api";

export function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  useEffect(() => {
    void api.templates().then(setTemplates);
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="section-label">Generation catalog</p>
          <h1>Templates</h1>
        </div>
      </div>
      <div className="template-table">
        <div className="table-row table-head">
          <span>Template</span>
          <span>Category</span>
          <span>Output</span>
        </div>
        {templates.map((template) => (
          <div className="table-row" key={template.key}>
            <span>
              <strong>{template.displayName}</strong>
              <small>{template.description}</small>
            </span>
            <span>{template.category}</span>
            <code>{template.outputPath}</code>
          </div>
        ))}
      </div>
    </>
  );
}
