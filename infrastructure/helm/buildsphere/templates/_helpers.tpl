{{- define "buildsphere.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "buildsphere.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "buildsphere.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "buildsphere.componentName" -}}
{{- printf "%s-%s" (include "buildsphere.fullname" .root) .component | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "buildsphere.commonLabels" -}}
app.kubernetes.io/name: {{ include "buildsphere.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: buildsphere
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
{{- end -}}

{{- define "buildsphere.selectorLabels" -}}
app.kubernetes.io/name: {{ include "buildsphere.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "buildsphere.image" -}}
{{- if .root.Values.image.digestMode -}}
{{- $digest := index .root.Values.image.digests .component -}}
{{- printf "%s/%s@%s" .root.Values.image.repositoryPrefix .component $digest -}}
{{- else -}}
{{- printf "%s/%s:%s" .root.Values.image.repositoryPrefix .component .root.Values.image.tag -}}
{{- end -}}
{{- end -}}

{{- define "buildsphere.backendServices" -}}
services:
  - name: api-gateway
    port: 8080
  - name: auth-service
    port: 8081
  - name: project-service
    port: 8082
  - name: pipeline-service
    port: 8083
  - name: deployment-service
    port: 8084
  - name: monitoring-service
    port: 8085
  - name: logging-service
    port: 8086
  - name: ai-service
    port: 8087
  - name: analytics-service
    port: 8088
  - name: notification-service
    port: 8089
{{- end -}}

{{- define "buildsphere.applicationComponents" -}}
components:
  - name: api-gateway
    port: 8080
    metrics: true
    public: true
    callers:
      - monitoring-service
  - name: auth-service
    port: 8081
    metrics: true
    callers:
      - api-gateway
      - project-service
      - monitoring-service
  - name: project-service
    port: 8082
    metrics: true
    callers:
      - api-gateway
      - deployment-service
      - monitoring-service
  - name: pipeline-service
    port: 8083
    metrics: true
    callers:
      - api-gateway
      - project-service
      - monitoring-service
  - name: deployment-service
    port: 8084
    metrics: true
    callers:
      - api-gateway
      - monitoring-service
  - name: monitoring-service
    port: 8085
    metrics: true
    callers:
      - api-gateway
  - name: logging-service
    port: 8086
    metrics: true
    callers:
      - api-gateway
      - pipeline-service
      - monitoring-service
  - name: ai-service
    port: 8087
    metrics: true
    callers:
      - api-gateway
      - project-service
      - monitoring-service
  - name: analytics-service
    port: 8088
    metrics: true
    callers: []
  - name: notification-service
    port: 8089
    metrics: true
    callers:
      - api-gateway
      - project-service
      - pipeline-service
      - deployment-service
      - ai-service
      - monitoring-service
  - name: frontend
    port: 8080
    public: true
    callers: []
{{- end -}}

{{- define "buildsphere.validate" -}}
{{- if or (eq .Values.image.tag "latest") (empty .Values.image.tag) -}}
{{- fail "image.tag must be explicit and cannot be latest" -}}
{{- end -}}
{{- if .Values.image.digestMode -}}
{{- range $component := (include "buildsphere.applicationComponents" . | fromYaml).components -}}
{{- $digest := index $.Values.image.digests $component.name | default "" -}}
{{- if not (regexMatch "^sha256:[0-9a-f]{64}$" $digest) -}}
{{- fail (printf "image.digests.%s must be a sha256 digest when image.digestMode is enabled" $component.name) -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- if empty .Values.runtime.existingSecret -}}
{{- fail "runtime.existingSecret must name an operator-created Secret" -}}
{{- end -}}
{{- if and .Values.deploymentExecution.enabled (empty .Values.deploymentExecution.allowedServerHosts) -}}
{{- fail "deploymentExecution.allowedServerHosts is required when execution is enabled" -}}
{{- end -}}
{{- if and .Values.deploymentExecution.enabled (empty .Values.deploymentExecution.allowedEnvironments) -}}
{{- fail "deploymentExecution.allowedEnvironments is required when execution is enabled" -}}
{{- end -}}
{{- if gt (int .Values.availability.autoscaling.minReplicas) (int .Values.availability.autoscaling.maxReplicas) -}}
{{- fail "availability.autoscaling.minReplicas cannot exceed maxReplicas" -}}
{{- end -}}
{{- if .Values.availability.podDisruptionBudget.enabled -}}
{{- $effectiveReplicas := int .Values.replicaCount -}}
{{- if .Values.availability.autoscaling.enabled -}}
{{- $effectiveReplicas = int .Values.availability.autoscaling.minReplicas -}}
{{- end -}}
{{- if lt $effectiveReplicas 2 -}}
{{- fail "pod disruption budgets require at least two effective replicas" -}}
{{- end -}}
{{- if ge (int .Values.availability.podDisruptionBudget.minAvailable) $effectiveReplicas -}}
{{- fail "availability.podDisruptionBudget.minAvailable must be lower than the effective replica count" -}}
{{- end -}}
{{- end -}}
{{- if and .Values.networkPolicy.enabled .Values.ingress.enabled (not .Values.networkPolicy.ingressController.enabled) -}}
{{- fail "networkPolicy.ingressController must be enabled when ingress and network policy are enabled" -}}
{{- end -}}
{{- end -}}
