{{- define "buildsphere-personal-prerequisites.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "buildsphere-personal-prerequisites.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "buildsphere-personal-prerequisites.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "buildsphere-personal-prerequisites.commonLabels" -}}
app.kubernetes.io/name: {{ include "buildsphere-personal-prerequisites.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: buildsphere
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
{{- end -}}

{{- define "buildsphere-personal-prerequisites.selectorLabels" -}}
app.kubernetes.io/name: {{ include "buildsphere-personal-prerequisites.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: database
{{- end -}}

{{- define "buildsphere-personal-prerequisites.image" -}}
{{- printf "%s:%s@%s" .Values.postgresql.image.repository .Values.postgresql.image.tag .Values.postgresql.image.digest -}}
{{- end -}}

{{- define "buildsphere-personal-prerequisites.validate" -}}
{{- if empty .Values.postgresql.existingSecret -}}
{{- fail "postgresql.existingSecret must name an operator-created Secret" -}}
{{- end -}}
{{- if or (empty .Values.postgresql.image.repository) (contains "@" .Values.postgresql.image.repository) -}}
{{- fail "postgresql.image.repository must be a repository without a digest" -}}
{{- end -}}
{{- if or (empty .Values.postgresql.image.tag) (eq .Values.postgresql.image.tag "latest") -}}
{{- fail "postgresql.image.tag must be explicit and cannot be latest" -}}
{{- end -}}
{{- if not (regexMatch "^sha256:[0-9a-f]{64}$" .Values.postgresql.image.digest) -}}
{{- fail "postgresql.image.digest must be a sha256 digest" -}}
{{- end -}}
{{- if not (regexMatch "^[1-9][0-9]*(Mi|Gi|Ti)$" .Values.postgresql.persistence.size) -}}
{{- fail "postgresql.persistence.size must be a positive binary storage quantity" -}}
{{- end -}}
{{- if .Values.tls.enabled -}}
{{- if not (regexMatch "^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$" .Values.tls.email) -}}
{{- fail "tls.email must be a valid contact email when TLS is enabled" -}}
{{- end -}}
{{- if not (regexMatch "^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$" .Values.tls.host) -}}
{{- fail "tls.host must be a valid lowercase DNS hostname when TLS is enabled" -}}
{{- end -}}
{{- range $field := list "secretName" "ingressClass" "issuerName" "privateKeySecretName" "acmeServer" -}}
{{- if empty (index $.Values.tls $field) -}}
{{- fail (printf "tls.%s is required when TLS is enabled" $field) -}}
{{- end -}}
{{- end -}}
{{- if not (hasPrefix "https://" .Values.tls.acmeServer) -}}
{{- fail "tls.acmeServer must use HTTPS" -}}
{{- end -}}
{{- end -}}
{{- end -}}
