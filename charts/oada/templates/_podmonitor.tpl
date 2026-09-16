{{/* vim: set ft=helm : */}}
{{/*
   * Copyright 2024 Open Ag Data Alliance
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

{{/*
   oada.podmonitor.endpoints renders the per-component `podMetricsEndpoints`
   list. Expects the root context `$`.

   Behavior:
     - Keeps existing `app_kubernetes_io_*` labels via labelmap (back-compat).
     - Adds canonical low-cardinality `release` (Helm release name, i.e.
       `app.kubernetes.io/instance`) and `component`
       (`app.kubernetes.io/component`) labels.
     - Sets `instance` to the pod name.
     - Optionally appends user-supplied relabelings and metricRelabelings
       from `.Values.podmonitor`.
*/}}
{{- define "oada.podmonitor.endpoints" -}}
- port: prometheus
  interval: {{ .Values.podmonitor.interval | default "30s" }}
  relabelings:
    - action: labelmap
      regex: __meta_kubernetes_pod_label_app_kubernetes_io_(.+)
      replacement: app_kubernetes_io_${1}
    - sourceLabels: [__meta_kubernetes_pod_label_app_kubernetes_io_instance]
      targetLabel: release
    - sourceLabels: [__meta_kubernetes_pod_label_app_kubernetes_io_component]
      targetLabel: component
    - action: replace
      sourceLabels: [__meta_kubernetes_pod_name]
      targetLabel: instance
    {{- with .Values.podmonitor.relabelings }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  {{- with .Values.podmonitor.metricRelabelings }}
  metricRelabelings:
    {{- toYaml . | nindent 4 }}
  {{- end }}
{{- end -}}
