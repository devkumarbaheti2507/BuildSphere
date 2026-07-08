import type { PipelineStage } from "@buildsphere/shared-types";

export const defaultStages: PipelineStage[] = [
  {
    key: "checkout",
    name: "Checkout source",
    order: 1,
    description: "Fetch the exact source revision being built.",
    explanation: {
      what: "Copies repository files into the runner.",
      why: "Every later step must use a known source revision.",
      commonFailures: ["Repository access denied", "Revision no longer exists"],
      fixes: [
        "Check repository permissions",
        "Verify the branch or commit reference",
      ],
    },
  },
  {
    key: "install_dependencies",
    name: "Install dependencies",
    order: 2,
    description: "Restore packages from the lockfile.",
    explanation: {
      what: "Downloads the project libraries.",
      why: "Pinned dependencies make builds reproducible.",
      commonFailures: ["Registry unavailable", "Lockfile is outdated"],
      fixes: [
        "Retry the registry connection",
        "Update and commit the lockfile",
      ],
    },
  },
  {
    key: "run_tests",
    name: "Run tests",
    order: 3,
    description: "Execute automated quality checks.",
    explanation: {
      what: "Runs unit and API tests.",
      why: "Tests catch regressions before packaging.",
      commonFailures: ["Assertion failure", "Test environment missing"],
      fixes: [
        "Read the first failing assertion",
        "Configure test environment variables",
      ],
    },
  },
  {
    key: "build_application",
    name: "Build application",
    order: 4,
    description: "Compile production application assets.",
    explanation: {
      what: "Converts source code into deployable output.",
      why: "Compilation catches type and bundling errors.",
      commonFailures: ["Type error", "Missing build-time variable"],
      fixes: [
        "Correct the reported type",
        "Document and provide required variables",
      ],
    },
  },
  {
    key: "build_docker_image",
    name: "Build container image",
    order: 5,
    description: "Package the application into a Docker image.",
    explanation: {
      what: "Builds immutable runtime layers.",
      why: "The same image can run in every environment.",
      commonFailures: [
        "Dockerfile copy path is wrong",
        "Base image unavailable",
      ],
      fixes: ["Check Docker build context", "Pin a valid base image version"],
    },
  },
  {
    key: "push_artifact",
    name: "Publish artifact",
    order: 6,
    description: "Publish the versioned build artifact.",
    explanation: {
      what: "Stores the build for later deployment.",
      why: "Deployment should use a traceable immutable artifact.",
      commonFailures: [
        "Registry authentication failed",
        "Artifact tag already exists",
      ],
      fixes: ["Refresh registry credentials", "Use a commit-based tag"],
    },
  },
  {
    key: "validate_kubernetes_manifests",
    name: "Validate Kubernetes manifests",
    order: 7,
    description: "Check deployment files before release.",
    explanation: {
      what: "Checks Kubernetes document structure and required fields.",
      why: "Invalid manifests otherwise fail during deployment.",
      commonFailures: ["Required field missing", "Container port mismatch"],
      fixes: [
        "Review the validation message",
        "Keep service and deployment ports aligned",
      ],
    },
  },
];
