{{/*
   * Copyright 2022 Open Ag Data Alliance
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */}}

{{/* Common labels */}}
{{- define "oada.chart.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/component: backend
app.kubernetes.io/part-of: oada
{{- end -}}

{{/* domain to use */}}
{{- define "oada.domain" -}}
  {{ default (list "localhost") .Values.oada.domains | mustFirst }}
{{- end -}}

{{/* Whether to deploy an ArangoDB cluster with this release */}}
{{- define "oada.arango.deploy" -}}
  {{ empty .Values.arangodb.connection | and (.Capabilities.APIVersions.Has "database.arangodb.com/v1") }}
{{- end -}}

{{/* ArangoDB connection to use */}}
{{- define "oada.arango.connection" -}}
  {{- $connection := print "http://arangodb-" .Release.Name ":8529" -}}
  {{ .Values.arangodb.connection | default $connection }}
{{- end -}}

{{/* ArangoDB root password Secret */}}
{{- define "oada.arango.rootPassword" -}}
  arangodb-root-password-{{ .Release.Name }}
{{- end -}}

{{/* Whether to deploy a Kafka/Redpanda cluster with this release */}}
{{- define "oada.kafka.deploy" -}}
  {{ empty .Values.kafka.brokers | and (.Capabilities.APIVersions.Has "redpanda.vectorized.io/v1alpha1") }}
{{- end -}}

{{/* Kafka/Redpanda brokers to use */}}
{{- define "oada.kafka.brokers" -}}
  {{- $brokers := print "redpanda-" .Release.Name ":9092" -}}
  {{ .Values.kafka.brokers | join "," | default $brokers }}
{{- end -}}

{{/* Whether to add Prometheus monitors */}}
{{- define "oada.prometheus" -}}
  {{ .Values.prometheus | default (.Capabilities.APIVersions.Has "monitoring.coreos.com/v1") }}
{{- end -}}

{{/* TLS secret */}}
{{- define "oada.tls" -}}
  tls-{{ .Release.Name }}
{{- end -}}

{{- define "oada.dashboard.yaml" -}}
{{- $tags := .tags | default list -}}
{{- $rest := omit . "tags" -}}
tags: {{ append $tags "oada" | toJson }}
{{ $rest | toYaml }}
{{- end -}}

{{- define "oada.dashboard" -}}
{{- include "oada.dashboard.yaml" . | fromYaml | toPrettyJson -}}
{{- end -}}
