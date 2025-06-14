# Kaneo Helm Chart

This Helm chart deploys [Kaneo](https://kaneo.app) - an open source project management platform focused on simplicity and efficiency.

## Introduction

This chart bootstraps a Kaneo deployment on a Kubernetes cluster using the Helm package manager. It deploys both the API backend and Web frontend components, along with a PostgreSQL database, with optional ingress resources.

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

### PostgreSQL Database parameters

| Name                                | Description                                                                                                        | Value                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `postgresql.enabled`                | Deploy PostgreSQL as part of this chart                                                                           | `true`                          |
| `postgresql.image.repository`       | PostgreSQL image repository                                                                                        | `postgres`                      |
| `postgresql.image.tag`              | PostgreSQL image tag                                                                                               | `16-alpine`                     |
| `postgresql.image.pullPolicy`       | PostgreSQL image pull policy                                                                                      | `IfNotPresent`                  |
| `postgresql.auth.database`          | PostgreSQL database name                                                                                           | `kaneo`                         |
| `postgresql.auth.username`          | PostgreSQL username                                                                                                | `kaneo_user`                    |
| `postgresql.auth.password`          | PostgreSQL password                                                                                                | `kaneo_password`                |
| `postgresql.auth.existingSecret`    | Name of existing secret containing PostgreSQL credentials                                                          | `""`                            |
| `postgresql.persistence.enabled`    | Enable persistence for PostgreSQL data                                                                             | `true`                          |
| `postgresql.persistence.size`       | PostgreSQL PVC size                                                                                                | `8Gi`                           |
| `postgresql.persistence.storageClass` | PostgreSQL PVC storage class                                                                                     | `""`                            |
| `postgresql.persistence.accessMode` | PostgreSQL PVC access mode                                                                                         | `ReadWriteOnce`                 |
| `postgresql.service.type`           | PostgreSQL service type                                                                                            | `ClusterIP`                     |
| `postgresql.service.port`           | PostgreSQL service port                                                                                            | `5432`                          |
| `postgresql.resources`              | Resource requests and limits for PostgreSQL container                                                              | `{}`                            |

### API Backend parameters

| Name                                | Description                                                                                                        | Value                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
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
| `api.env.disableRegistration`       | Disable new user registration                                                                                      | `false`                         |
| `api.env.database.external.enabled` | Use external PostgreSQL database (set postgresql.enabled to false)                                               | `false`                         |
| `api.env.database.external.host`    | External PostgreSQL host                                                                                          | `""`                            |
| `api.env.database.external.port`    | External PostgreSQL port                                                                                          | `5432`                          |
| `api.env.database.external.database` | External PostgreSQL database name                                                                                | `kaneo`                         |
| `api.env.database.external.username` | External PostgreSQL username                                                                                     | `kaneo_user`                    |
| `api.env.database.external.password` | External PostgreSQL password                                                                                     | `""`                            |
| `api.resources`                     | Resource requests and limits for the API container (optional, disabled by default)                                | `{}`                            |

### Web Frontend parameters

| Name                                | Description                                                                                                        | Value                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `web.image.repository`              | Web image repository                                                                                               | `ghcr.io/usekaneo/web`          |
| `web.image.tag`                     | Web image tag                                                                                                      | `latest`                        |
| `web.image.pullPolicy`              | Web image pull policy                                                                                              | `IfNotPresent`                  |
| `web.service.type`                  | Web service type                                                                                                   | `ClusterIP`                     |
| `web.service.port`                  | Web service port                                                                                                   | `80`                            |
| `web.service.targetPort`            | Web container port                                                                                                 | `80`                            |
| `web.env`                           | Environment variables for the Web container                                                                        | See `values.yaml`               |
| `web.resources`                     | Resource requests and limits for the Web container (optional, disabled by default)                                 | `{}`                            |

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
    nginx.ingress.kubernetes.io/rewrite-target: /$1
  hosts:
    - host: your-domain.com
      paths:
        - path: /?(.*)
          pathType: Prefix
          service: web
          port: 80
        - path: /api/?(.*)
          pathType: Prefix
          service: api
          port: 1337
```

### Production Configuration with TLS

```yaml
# values.yaml
replicaCount: 1

# PostgreSQL configuration
postgresql:
  auth:
    password: "your-secure-db-password"
  persistence:
    size: 20Gi
    storageClass: "managed-premium"
  resources:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 100m
      memory: 128Mi

# API configuration
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

# Web configuration
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
    nginx.ingress.kubernetes.io/rewrite-target: /$1
  hosts:
    - host: your-domain.com
      paths:
        - path: /
          pathType: Prefix
          service: web
          port: 80
        - path: /api/?(.*)
          pathType: Prefix
          service: api
          port: 1337
  tls:
    - secretName: kaneo-tls
      hosts:
        - your-domain.com
```

### Using External PostgreSQL Database

If you prefer to use an external PostgreSQL database instead of the bundled one:

```yaml
# values.yaml
# Disable bundled PostgreSQL
postgresql:
  enabled: false

api:
  env:
    jwtAccess: "your-secure-jwt-secret"
    database:
      external:
        enabled: true
        host: "your-postgres-host.com"
        port: 5432
        database: "kaneo"
        username: "kaneo_user"
        password: "your-db-password"
```

### Using an Existing Secret for Sensitive Data

For production environments, it's recommended to store sensitive data like the JWT access token and database credentials in Kubernetes Secrets:

```bash
# Create a Secret for sensitive data
kubectl create secret generic kaneo-secrets \
  --namespace kaneo \
  --from-literal=jwt-access="your-secure-jwt-secret" \
  --from-literal=postgres-password="your-secure-db-password"
```

Then reference these secrets in your values:

```yaml
# values.yaml
postgresql:
  auth:
    existingSecret: "kaneo-secrets"
    secretKeys:
      userPasswordKey: "postgres-password"

api:
  env:
    existingSecret:
      enabled: true
      name: "kaneo-secrets"
      key: "jwt-access"
```

## Database Management

### PostgreSQL Configuration

The chart deploys PostgreSQL 16 (Alpine) by default with the following configuration:
- Database name: `kaneo`
- Username: `kaneo_user`
- Default password: `kaneo_password` (change this in production!)
- Persistent storage: 8Gi (configurable)

### Backup and Recovery

For production deployments, consider implementing regular database backups:

```bash
# Example backup command
kubectl exec -it deployment/my-kaneo-postgresql -- pg_dump -U kaneo_user kaneo > kaneo-backup.sql
```

### Migration from SQLite

If you're migrating from a previous SQLite-based installation, you'll need to:
1. Export your data from SQLite
2. Deploy the new PostgreSQL-based chart
3. Import your data into PostgreSQL

Contact the Kaneo community on [Discord](https://discord.gg/rU4tSyhXXU) for migration assistance.

## Architecture

This chart deploys the following components:

1. **API Backend**: Handles all business logic and database operations
2. **Web Frontend**: Serves the user interface
3. **PostgreSQL Database**: Stores all application data with proper relational integrity

The API and Web components are deployed in the same pod for simplified connectivity, while PostgreSQL runs in a separate pod for better resource isolation and management.

## Production Environment

For production deployments, you should:

1. Set secure passwords for JWT and PostgreSQL
2. Use an Ingress controller to expose the application
3. Configure TLS for secure access
4. Set appropriate resource limits and requests
5. Enable persistent storage with appropriate storage classes
6. Consider using external PostgreSQL for better scalability

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /$1
  hosts:
    - host: your-domain.com
      paths:
        - path: /?(.*)
          pathType: Prefix
          service: web
          port: 80
        - path: /api/?(.*)
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

1. Use secure JWT_ACCESS and PostgreSQL passwords, preferably stored in Kubernetes Secrets
2. Enable TLS for ingress or Gateway API
3. Enable and set resource limits to prevent resource exhaustion
4. Use a dedicated storage class for the PostgreSQL database
5. Consider using a network policy to restrict traffic between components
6. Regularly update PostgreSQL and application images

### Registration Control

By default, user registration is enabled. To disable new user registration:

```yaml
api:
  env:
    disableRegistration: true
```

This will prevent new users from registering while still allowing existing users to log in. The registration option will be hidden from the login page.
