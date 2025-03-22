# Kaneo Helm Chart

This Helm chart deploys [Kaneo](https://kaneo.app) - an open source project management platform focused on simplicity and efficiency.

## Introduction

This chart bootstraps a Kaneo deployment on a Kubernetes cluster using the Helm package manager. It deploys both the API backend and Web frontend components, with optional ingress resources.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.2.0+
- PV provisioner support in the underlying infrastructure (if persistence is enabled)

## Installing the Chart

To install the chart with the release name `my-kaneo`:

```bash
helm install my-kaneo ./charts/kaneo
```

The command deploys Kaneo on the Kubernetes cluster with default configuration. The [Parameters](#parameters) section lists the parameters that can be configured during installation.

## Uninstalling the Chart

To uninstall/delete the `my-kaneo` deployment:

```bash
helm uninstall my-kaneo
```

## Parameters

### Global parameters

| Name                     | Description                                                                                                        | Value       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------- |
| `nameOverride`           | String to partially override the fullname template (will maintain the release name)                                | `""`        |
| `fullnameOverride`       | String to fully override the fullname template                                                                     | `""`        |
| `replicaCount`           | Number of replicas (ignored if autoscaling is enabled)                                                             | `1`         |

### Autoscaling parameters

| Name                                | Description                                                                                                        | Value       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------- |
| `autoscaling.enabled`               | Enable autoscaling for the deployment                                                                              | `false`     |
| `autoscaling.minReplicas`           | Minimum number of replicas                                                                                         | `1`         |
| `autoscaling.maxReplicas`           | Maximum number of replicas                                                                                         | `10`        |
| `autoscaling.targetCPUUtilizationPercentage` | Target CPU utilization percentage                                                                         | `80`        |

### API Backend parameters

| Name                                | Description                                                                                                        | Value                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `api.enabled`                       | Enable API deployment                                                                                             | `true`                          |
| `api.replicaCount`                  | Number of API replicas                                                                                            | `1`                             |
| `api.image.repository`              | API image repository                                                                                              | `ghcr.io/usekaneo/api`          |
| `api.image.tag`                     | API image tag                                                                                                     | `latest`                        |
| `api.image.pullPolicy`              | API image pull policy                                                                                             | `IfNotPresent`                  |
| `api.service.type`                  | API service type                                                                                                  | `ClusterIP`                     |
| `api.service.port`                  | API service port                                                                                                  | `1337`                          |
| `api.service.targetPort`            | API container port                                                                                                | `1337`                          |
| `api.env`                           | Environment variables for the API container                                                                       | See `values.yaml`               |
| `api.env.jwtAccess`                 | Secret key for JWT token generation (ignored if existingSecret is enabled)                                        | `change_me`                     |
| `api.env.existingSecret.enabled`    | Whether to use an existing secret for JWT access token                                                            | `false`                         |
| `api.env.existingSecret.name`       | Name of the existing secret containing the JWT access token                                                       | `""`                            |
| `api.env.existingSecret.key`        | Key in the existing secret that contains the JWT access token                                                     | `jwt-access`                    |
| `api.persistence.enabled`           | Enable persistence for SQLite database                                                                            | `true`                          |
| `api.persistence.mountPath`         | Path where the SQLite database will be stored                                                                     | `/app/apps/api/data`            |
| `api.persistence.dbFilename`        | Name of the SQLite database file                                                                                 | `kaneo.db`                      |
| `api.persistence.accessMode`        | PVC access mode                                                                                                   | `ReadWriteOnce`                 |
| `api.persistence.size`              | PVC size                                                                                                          | `1Gi`                           |
| `api.persistence.storageClass`      | PVC storage class                                                                                                 | `""`                            |
| `api.resources`                     | Resource requests and limits for the API container (optional, disabled by default)                                | `{}`                            |
| `api.autoscaling.enabled`           | Enable autoscaling for the API deployment                                                                         | `false`                         |
| `api.autoscaling.minReplicas`       | Minimum number of replicas                                                                                        | `1`                             |
| `api.autoscaling.maxReplicas`       | Maximum number of replicas                                                                                        | `10`                            |
| `api.autoscaling.targetCPUUtilizationPercentage` | Target CPU utilization percentage                                                                    | `80`                            |

### Web Frontend parameters

| Name                                | Description                                                                                                        | Value                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `web.enabled`                       | Enable Web deployment                                                                                              | `true`                          |
| `web.replicaCount`                  | Number of Web replicas                                                                                             | `1`                             |
| `web.image.repository`              | Web image repository                                                                                               | `ghcr.io/usekaneo/web`          |
| `web.image.tag`                     | Web image tag                                                                                                      | `latest`                        |
| `web.image.pullPolicy`              | Web image pull policy                                                                                              | `IfNotPresent`                  |
| `web.service.type`                  | Web service type                                                                                                   | `ClusterIP`                     |
| `web.service.port`                  | Web service port                                                                                                   | `80`                            |
| `web.service.targetPort`            | Web container port                                                                                                 | `80`                            |
| `web.env`                           | Environment variables for the Web container                                                                        | See `values.yaml`               |
| `web.resources`                     | Resource requests and limits for the Web container (optional, disabled by default)                                 | `{}`                            |
| `web.autoscaling.enabled`           | Enable autoscaling for the Web deployment                                                                          | `false`                         |
| `web.autoscaling.minReplicas`       | Minimum number of replicas                                                                                         | `1`                             |
| `web.autoscaling.maxReplicas`       | Maximum number of replicas                                                                                         | `10`                            |
| `web.autoscaling.targetCPUUtilizationPercentage` | Target CPU utilization percentage                                                                     | `80`                            |

### Ingress parameters

| Name                                | Description                                                                                                        | Value                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `ingress.enabled`                   | Enable ingress                                                                                                     | `false`                         |
| `ingress.className`                 | Ingress class name                                                                                                 | `""`                            |
| `ingress.annotations`               | Ingress annotations                                                                                                | `{}`                            |
| `ingress.hosts`                     | Ingress hosts configuration                                                                                        | See `values.yaml`               |
| `ingress.tls`                       | Ingress TLS configuration                                                                                          | `[]`                            |

## Configuration Examples

### Minimal Configuration

```yaml
# values.yaml
api:
  env:
    jwtAccess: "your-secure-jwt-secret"

web:
  env:
    apiUrl: "https://your-domain.com"

ingress:
  enabled: true
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
  hosts:
    - host: your-domain.com
      paths:
        - path: /
          pathType: Prefix
          service: web
          port: 80
        - path: /api(/|$)(.*)
          pathType: Prefix
          service: api
          port: 1337
```

### Production Configuration with TLS

```yaml
# values.yaml
replicaCount: 1
# Enable and configure resources for production
api:
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 200m
      memory: 256Mi
  env:
    jwtAccess: "your-secure-jwt-secret"
  persistence:
    size: 10Gi
    storageClass: "managed-premium"

web:
  resources:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 100m
      memory: 128Mi
  env:
    apiUrl: "https://your-domain.com"

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /$2
  hosts:
    - host: your-domain.com
      paths:
        - path: /
          pathType: Prefix
          service: web
          port: 80
        - path: /api(/|$)(.*)
          pathType: Prefix
          service: api
          port: 1337
  tls:
    - secretName: kaneo-tls
      hosts:
        - your-domain.com
```

### Using an Existing Secret for Sensitive Data

For production environments, it's recommended to store sensitive data like the JWT access token in a Kubernetes Secret. You can create a secret and configure the chart to use it:

```bash
# Create a Secret for the JWT access token
kubectl create secret generic kaneo-secrets \
  --namespace kaneo \
  --from-literal=jwt-access="your-secure-jwt-secret"
```

Then reference this secret in your values:

```yaml
# values.yaml
api:
  env:
    # The jwtAccess value will be ignored when existingSecret is enabled
    existingSecret:
      enabled: true
      name: "kaneo-secrets"
      key: "jwt-access"
```

## Persistence

The chart mounts a Persistent Volume for the SQLite database used by the API component. The volume is mounted at `/app/apps/api/data` in the API container.

## Single Pod Architecture

This chart deploys both the API and Web containers in a single pod. This architecture provides several benefits:

1. **Simplified Connectivity**: The web frontend can connect directly to the API via localhost, eliminating cross-origin issues
2. **Co-location**: Ensures the web and API components are always deployed together
3. **Reduced Complexity**: Simplifies the deployment and configuration

With this approach, when `web.env.apiUrl` is not set, the web container automatically connects to the API at `http://localhost:1337` without requiring any port forwarding or special configuration.

### Production Environment

For production deployments, you should:

1. Set `web.env.apiUrl` to your domain (e.g., "https://your-domain.com")
2. Use an Ingress controller to expose the application
3. Configure TLS for secure access
4. Set appropriate resource limits and requests

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /$2
  hosts:
    - host: your-domain.com
      paths:
        - path: /
          pathType: Prefix
          service: web
          port: 80
        - path: /api(/|$)(.*)
          pathType: Prefix
          service: api
          port: 1337
  tls:
    - secretName: kaneo-tls
      hosts:
        - your-domain.com
```

## Using Gateway API

As an alternative to Ingress, you can use the Kubernetes Gateway API for more advanced routing capabilities:

```yaml
# kaneo-gateway.yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: kaneo
  namespace: kaneo
spec:
  parentRefs:
  - name: main-gateway  # Your gateway name
    namespace: gateway-system  # Your gateway namespace
    sectionName: https
  hostnames:
  - "kaneo.example.com"
  rules:
  # Frontend route (root path)
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: kaneo-web
      port: 80
  # API route (api path prefix)
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: kaneo-api
      port: 1337
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /
```

Apply the Gateway configuration:

```bash
kubectl apply -f kaneo-gateway.yaml
```

## Security

For production deployments, consider the following security recommendations:

1. Use a secure JWT_ACCESS secret, preferably stored in a Kubernetes Secret
2. Enable TLS for ingress or Gateway API
3. Enable and set resource limits to prevent resource exhaustion
4. Use a dedicated storage class for the SQLite database
5. Consider using a network policy to restrict traffic between components
