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

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/oada)](https://artifacthub.io/packages/helm/oada/oada)

Helm chart for installing the OADA server in a k8s cluster.
Supports multiple release installs and non-default namespace.

## Prerequisites

- [Cert manager][]
- [Redpanda operator][]
- [ArangoDB operator][] and [CRDs][arangodb crd]
- At least one ingress controller (e.g., [ingress-nginx][])

## Installation

Add our helm chart repo
`helm repo add oada https://charts.openag.io/`

Install the Helm chart:
`helm install my-oada oada/oada`

See the [default values](values.yaml) for various configuration options.

[cert manager]: https://artifacthub.io/packages/helm/cert-manager/cert-manager
[redpanda operator]: https://artifacthub.io/packages/helm/redpanda/redpanda-operator
[arangodb operator]: https://artifacthub.io/packages/helm/source-field/kube-arangodb
[arangodb crd]: https://artifacthub.io/packages/helm/source-field/kube-arangodb-crd
[ingress-nginx]: https://artifacthub.io/packages/helm/ingress-nginx/ingress-nginx
