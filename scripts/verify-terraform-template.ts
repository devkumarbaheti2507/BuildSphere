import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type {
  GenerationVariables,
  ToolSelection,
} from "@buildsphere/shared-types";
import { TemplateCatalogService } from "../backend/project-service/src/template-catalog.js";

const terraformBin = process.env.TERRAFORM_BIN ?? "terraform";

const variables: GenerationVariables = {
  projectName: "Terraform Verification",
  serviceName: "terraform-verification",
  containerPort: 8080,
  imageName: "terraform-verification-service",
  imageTag: "latest",
  namespace: "terraform-verification",
  replicas: 2,
  host: "terraform-verification.local",
  dbName: "terraform_verification",
  dbUser: "app_user",
  dbPassword: "replace_me",
  awsRegion: "us-east-1",
  environment: "development",
};
const selections: ToolSelection[] = [
  { category: "deployment", toolKey: "kubernetes", config: {} },
  {
    category: "infrastructure",
    toolKey: "terraform-aws-eks",
    config: {},
  },
];

const runTerraform = (fixtureRoot: string, args: string[]) => {
  const result = spawnSync(terraformBin, args, {
    cwd: fixtureRoot,
    env: { ...process.env, TF_IN_AUTOMATION: "true" },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `${terraformBin} ${args.join(" ")} exited with ${result.status}`,
  );
};

const main = async (): Promise<void> => {
  const repoRoot = process.env.INIT_CWD ?? path.resolve(process.cwd(), "../..");
  const fixtureRoot = await mkdtemp(
    path.join(tmpdir(), "buildsphere-terraform-validation-"),
  );

  try {
    const rendered = await new TemplateCatalogService(repoRoot).render(
      variables,
      selections,
    );
    const terraformFiles = rendered.filter((file) =>
      file.path.startsWith("terraform/"),
    );
    assert.equal(terraformFiles.length, 9);

    for (const file of terraformFiles) {
      assert.doesNotMatch(file.content, /{{\s*[a-zA-Z][a-zA-Z0-9]*\s*}}/);
      assert.doesNotMatch(
        file.content,
        /(?:access_key|secret_key|session_token)\s*=/i,
      );
      const relativePath = file.path.slice("terraform/".length);
      assert.ok(relativePath && !relativePath.includes(".."));
      const outputPath = path.join(fixtureRoot, relativePath);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, file.content, "utf8");
    }

    runTerraform(fixtureRoot, ["fmt", "-check", "-recursive"]);
    runTerraform(fixtureRoot, [
      "init",
      "-backend=false",
      "-input=false",
      "-no-color",
    ]);
    runTerraform(fixtureRoot, ["validate", "-no-color"]);
    console.log(`Terraform generation verified with ${terraformBin}.`);
  } finally {
    if (process.env.KEEP_TERRAFORM_FIXTURE === "1") {
      console.log(`Terraform fixture retained at ${fixtureRoot}.`);
    } else {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
