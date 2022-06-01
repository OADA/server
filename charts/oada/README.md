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

Helm chart for installing the OADA server in a k8s cluster.
Supports multiple release installs and non-default namespace.

## Prerequisites

- Redpanda operator and CRD
- ArangoDB operator and CRD
- Cert manager
- At least one ingress controller

Attempt to apply all prerequisites:
`kubectl apply -k ../../k8s/support`

The above command might error on the first run.
After 2-3 times, it _should_ run without error.

**If the above does not work for you,
google how to set up the listed prerequisites for your specific k8s cluster.**

## Installation

Add the helm chart repo
`helm repo add oada https://charts.openag.io/`

Install the Helm chart:
`helm install oada oada`

See the [values.yaml](values.yaml) for various configuration options.
