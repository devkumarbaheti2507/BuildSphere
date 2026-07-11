import type {
  GeneratedFile,
  ManifestValidationResult,
} from "@buildsphere/shared-types";

export const selectKubernetesManifests = (
  files: Pick<GeneratedFile, "path" | "content">[],
): Pick<GeneratedFile, "path" | "content">[] => {
  const yamlFiles = files.filter((file) => /\.ya?ml$/i.test(file.path));
  const kubernetesFiles = yamlFiles.filter((file) =>
    /^kubernetes\//i.test(file.path.replaceAll("\\", "/")),
  );
  return kubernetesFiles.length
    ? kubernetesFiles
    : yamlFiles.filter(
        (file) => !/^helm\//i.test(file.path.replaceAll("\\", "/")),
      );
};

export const validateKubernetesManifests = (
  files: Pick<GeneratedFile, "path" | "content">[],
): ManifestValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const manifests = selectKubernetesManifests(files);
  if (!manifests.length) errors.push("No Kubernetes YAML files were provided.");

  const kinds = new Set<string>();
  for (const file of manifests) {
    const kind = /^kind:\s*([^\s#]+)/m.exec(file.content)?.[1];
    if (!/^apiVersion:\s*[^\s#]+/m.test(file.content))
      errors.push(`${file.path}: apiVersion is required.`);
    if (!kind) errors.push(`${file.path}: kind is required.`);
    else kinds.add(kind);
    if (
      !/^metadata:\s*$/m.test(file.content) ||
      !/^\s{2}name:\s*[^\s#]+/m.test(file.content)
    ) {
      errors.push(`${file.path}: metadata.name is required.`);
    }
    if (/{{\s*[^}]+\s*}}/.test(file.content))
      errors.push(`${file.path}: unresolved template placeholders remain.`);
    if (kind === "Deployment") {
      if (!/labels:\s*\n/m.test(file.content))
        errors.push(`${file.path}: deployment labels are required.`);
      if (!/readinessProbe:/m.test(file.content))
        warnings.push(`${file.path}: add a readiness probe before deployment.`);
      if (!/livenessProbe:/m.test(file.content))
        warnings.push(`${file.path}: add a liveness probe before deployment.`);
      if (!/resources:/m.test(file.content))
        warnings.push(`${file.path}: add resource requests and limits.`);
    }
    if (kind === "Secret" && /stringData:|data:/m.test(file.content)) {
      warnings.push(
        `${file.path}: verify that secret values are placeholders and are not committed credentials.`,
      );
    }
  }
  for (const requiredKind of ["Namespace", "Deployment", "Service"]) {
    if (!kinds.has(requiredKind))
      errors.push(`A ${requiredKind} manifest is required.`);
  }
  if (!kinds.has("Ingress"))
    warnings.push(
      "No Ingress manifest was provided; external HTTP routing will require separate configuration.",
    );
  return { valid: errors.length === 0, errors, warnings };
};
