<!--
 Copyright 2022 Open Ag Data Alliance

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->

# OADA Helm chart

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/oada)](https://artifacthub.io/packages/helm/oada/oada)

Helm chart for installing the OADA server in a k8s cluster.
Supports multiple release installs and non-default namespace.

## Prerequisites

- [Cert manager][]
- [Redpanda operator][]
- [ArangoDB operator][] and [CRDs][arangodb crd]
- At least one ingress controller (e.g., [ingress-nginx][])

## Prometheus discovery

PodMonitors are emitted for each OADA component and each configured
`oada.externalServices` entry when `prometheus` is truthy. Each monitor
already targets only its own pods via the chart-supplied selector. Every
scraped series carries:

- `release` — the Helm release name (`app.kubernetes.io/instance`),
  e.g. `oada`. Names match the Helm concept, not a k8s `Deployment` resource.
- `component` — the OADA component (`app.kubernetes.io/component`),
  e.g. `http-handler`, `shares`, `fl-sync`. Naming matches the source
  label, not a k8s `Service` resource.
- `instance` — the pod name.
- `app_kubernetes_io_*` — the canonical `app.kubernetes.io/*` labels
  mapped through (kept for back-compat with existing dashboards).

`Values.podmonitor` lets you override:

- `podmonitor.interval` — scrape interval (default `30s`).
- `podmonitor.relabelings` — extra relabel rules appended after the defaults.
- `podmonitor.metricRelabelings` — post-scrape rules (e.g. to drop
  `go_*` / `process_*`).

Example:

```yaml
prometheus: true
podmonitor:
  interval: 15s
  metricRelabelings:
    - sourceLabels: [__name__]
      regex: "go_.*|process_.*"
      action: drop
```

## Installation

Add our helm chart repo `helm repo add oada https://charts.openag.io/`

Install the Helm chart:
`helm install my-oada oada/oada`

See the [default values](values.yaml) for various configuration options.

## Bundled Grafana dashboards

When `grafana.enabled` is true, this chart ships dashboard ConfigMaps from
`grafana/*-dashboard.json`, including:

- `oada-prod-up-dashboard.json` for `up{app_kubernetes_io_part_of=~"oada"}`
  availability across OADA deployments.

[cert manager]: https://artifacthub.io/packages/helm/cert-manager/cert-manager
[redpanda operator]: https://artifacthub.io/packages/helm/redpanda/redpanda-operator
[arangodb operator]: https://artifacthub.io/packages/helm/source-field/kube-arangodb
[arangodb crd]: https://artifacthub.io/packages/helm/source-field/kube-arangodb-crd
[ingress-nginx]: https://artifacthub.io/packages/helm/ingress-nginx/ingress-nginx
