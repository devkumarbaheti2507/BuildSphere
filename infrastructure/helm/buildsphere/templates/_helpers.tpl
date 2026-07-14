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
{{- printf "%s/%s:%s" .root.Values.image.repositoryPrefix .component .root.Values.image.tag -}}
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

{{- define "buildsphere.validate" -}}
{{- if or (eq .Values.image.tag "latest") (empty .Values.image.tag) -}}
{{- fail "image.tag must be explicit and cannot be latest" -}}
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
{{- end -}}
