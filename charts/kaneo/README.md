# Kaneo Helm Chart

This Helm chart deploys [Kaneo](https://kaneo.app) - open source project management that works for you, not against you.

## Introduction

This chart bootstraps a Kaneo deployment on a Kubernetes cluster using the Helm package manager. It deploys both the API backend and Web frontend components, along with a PostgreSQL database, with optional ingress or Gateway API resources.

## Prerequisites

- Kubernetes 1.23+
- Helm 3.2.0+
- PV provisioner support in the underlying infrastructure (if persistence is enabled)

## Quick Start

### Basic Installation

Install directly from GHCR:

```bash
helm install kaneo oci://ghcr.io/usekaneo/charts/kaneo \
  --namespace kaneo \
  --create-namespace

# Access locally
kubectl port-forward svc/kaneo-kaneo 5173:5173 -n kaneo
```

Open [http://localhost:5173](http://localhost:5173) and you're ready to go.

### Production Setup with Ingress

For real deployments, you'll want proper ingress:

```bash
helm install kaneo oci://ghcr.io/usekaneo/charts/kaneo \
  --namespace kaneo \
  --create-namespace \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set "ingress.hosts[0].host=pm.yourcompany.com"
```

### Production Setup with Gateway API

If your cluster already has Gateway API CRDs and a `Gateway` configured, you can expose Kaneo with an `HTTPRoute`:

```bash
helm install kaneo oci://ghcr.io/usekaneo/charts/kaneo \
  --namespace kaneo \
  --create-namespace \
  --set gateway.enabled=true \
  --set "gateway.parentRefs[0].name=main-gateway" \
  --set "gateway.parentRefs[0].namespace=gateway-system" \
  --set "gateway.parentRefs[0].sectionName=https" \
  --set "gateway.hostnames[0]=pm.yourcompany.com"
```

## Installing the Chart

To install the published chart with the release name `my-kaneo`:

```bash
helm install my-kaneo oci://ghcr.io/usekaneo/charts/kaneo
```

To install from a local checkout instead:

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

When CPU autoscaling is enabled, set `kaneo.resources.requests.cpu`; Kubernetes cannot calculate CPU utilization without a CPU request.

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

### Kaneo application parameters

| Name                                | Description                                                                                                        | Value                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `kaneo.image.repository`            | Kaneo image repository                                                                                             | `ghcr.io/usekaneo/kaneo`        |
| `kaneo.image.tag`                   | Kaneo image tag. Defaults to `Chart.appVersion` when empty                                                         | `""`                            |
| `kaneo.image.pullPolicy`            | Kaneo image pull policy                                                                                            | `IfNotPresent`                  |
| `kaneo.service.type`                | Kaneo service type                                                                                                 | `ClusterIP`                     |
| `kaneo.service.port`                | Kaneo service port                                                                                                 | `5173`                          |
| `kaneo.service.targetPort`          | Kaneo container port                                                                                               | `5173`                          |
| `kaneo.env`                         | Environment variables for the Kaneo container                                                                      | See `values.yaml`               |
| `kaneo.env.clientUrl`               | Public URL of the Kaneo instance                                                                                   | `""`                            |
| `kaneo.env.corsOrigins`             | Allowed CORS origins as a comma-separated string or YAML list                                                      | `[]`                            |
| `kaneo.env.authSecret`              | Better Auth secret, ignored if existingSecret is enabled                                                           | `change_me_to_at_least_32_characters_long_string` |
| `kaneo.env.existingSecret.enabled`  | Whether to use an existing secret for `AUTH_SECRET`                                                                | `false`                         |
| `kaneo.env.existingSecret.name`     | Name of the existing secret containing `AUTH_SECRET`                                                               | `""`                            |
| `kaneo.env.existingSecret.key`      | Key in the existing secret that contains `AUTH_SECRET`                                                             | `auth-secret`                   |
| `kaneo.env.disableRegistration`     | Disable new user registration                                                                                      | `false`                         |
| `kaneo.env.disablePasswordRegistration` | Disable password-based account creation while keeping social/OIDC registration available                        | `false`                         |
| `kaneo.env.disableEmailOtpSignIn`   | Use email/password sign-in instead of verification codes when SMTP is configured                                   | `false`                         |
| `kaneo.env.database.external.enabled` | Use external PostgreSQL database (set postgresql.enabled to false)                                               | `false`                         |
| `kaneo.env.database.external.host`  | External PostgreSQL host                                                                                           | `""`                            |
| `kaneo.env.database.external.port`  | External PostgreSQL port                                                                                           | `5432`                          |
| `kaneo.env.database.external.database` | External PostgreSQL database name                                                                               | `kaneo`                         |
| `kaneo.env.database.external.username` | External PostgreSQL username                                                                                    | `kaneo_user`                    |
| `kaneo.env.database.external.password` | External PostgreSQL password                                                                                    | `""`                            |
| `kaneo.extraEnv`                    | Additional Kubernetes EnvVar entries appended to the Kaneo container                                               | `[]`                            |
| `kaneo.resources`                   | Resource requests and limits for the Kaneo container (optional, disabled by default)                               | `{}`                            |

### Ingress parameters

| Name                                | Description                                                                                                        | Value                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `ingress.enabled`                   | Enable ingress                                                                                                     | `false`                         |
| `ingress.className`                 | Ingress class name                                                                                                 | `""`                            |
| `ingress.annotations`               | Ingress annotations                                                                                                | `{}`                            |
| `ingress.hosts`                     | Ingress hosts configuration                                                                                        | See `values.yaml`               |
| `ingress.tls`                       | Ingress TLS configuration                                                                                          | `[]`                            |

### Gateway API parameters

| Name                                | Description                                                                                                        | Value                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `gateway.enabled`                   | Enable Gateway API `HTTPRoute` creation                                                                            | `false`                         |
| `gateway.annotations`               | Annotations added to the `HTTPRoute`                                                                               | `{}`                            |
| `gateway.labels`                    | Extra labels added to the `HTTPRoute`                                                                              | `{}`                            |
| `gateway.parentRefs`                | Parent Gateway listener references for attaching the `HTTPRoute`                                                   | `[]`                            |
| `gateway.hostnames`                 | Hostnames exposed by the `HTTPRoute`                                                                               | `[]`                            |
| `gateway.rules`                     | Gateway API routing rules mapping paths to the chart services                                                      | See `values.yaml`               |

## Configuration Examples

### Minimal Configuration

```yaml
# values.yaml
kaneo:
  env:
    authSecret: "your-secure-auth-secret-at-least-32-characters"
    clientUrl: "https://your-domain.com"

ingress:
  enabled: true
  className: nginx
  annotations: {}
  hosts:
    - host: your-domain.com
      paths:
        - path: /
          pathType: Prefix
          service: kaneo
          port: 5173
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

# Kaneo configuration
kaneo:
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 200m
      memory: 256Mi
  env:
    authSecret: "your-secure-auth-secret-at-least-32-characters"
    clientUrl: "https://your-domain.com"

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: your-domain.com
      paths:
        - path: /
          pathType: Prefix
          service: kaneo
          port: 5173
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

kaneo:
  env:
    authSecret: "your-secure-auth-secret-at-least-32-characters"
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

For production environments, it's recommended to store sensitive data like the auth secret and database credentials in Kubernetes Secrets:

When `postgresql.auth.existingSecret` is used with bundled PostgreSQL, the password is expanded by Kubernetes into `DATABASE_URL` at runtime and must be URL-safe. If your password contains reserved URI characters such as `@`, `:`, `/`, `#`, `%`, or spaces, use an external database and provide the complete connection URI through `kaneo.env.database.external.existingSecret`.

```bash
# Create a Secret for sensitive data
kubectl create secret generic kaneo-secrets \
  --namespace kaneo \
  --from-literal=auth-secret="your-secure-auth-secret-at-least-32-characters" \
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

kaneo:
  env:
    existingSecret:
      enabled: true
      name: "kaneo-secrets"
      key: "auth-secret"
```

## Database Management

### PostgreSQL Configuration

The chart deploys PostgreSQL 16 (Alpine) by default with the following configuration:
- Database name: `kaneo`
- Username: `kaneo_user`
- Default password: `kaneo_password` (change this in production!)
- Persistent storage: 8Gi (configurable)

The bundled PostgreSQL deployment is intended for development, trials, and small self-hosted installs. For production environments, use an external managed PostgreSQL database by setting `postgresql.enabled=false` and configuring `kaneo.env.database.external`.

Bundled PostgreSQL credentials are only applied when PostgreSQL initializes an empty data directory. If a PVC already exists, changing `postgresql.auth.password` or `postgresql.auth.existingSecret` updates the Pod environment but does not rotate the password inside the existing database. For local retesting with a new password, uninstall the release and delete the test PVC before reinstalling:

```bash
helm uninstall kaneo -n kaneo-test
kubectl delete pvc kaneo-postgresql-data -n kaneo-test --ignore-not-found
```

To preserve data, rotate the password inside PostgreSQL first, then update the Helm values to match.

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

1. **Kaneo application**: Serves the web UI and API from the combined Kaneo image
2. **PostgreSQL Database**: Stores all application data with proper relational integrity

The Kaneo application and PostgreSQL run in separate pods for resource isolation and simpler database lifecycle management.

## Production Environment

For production deployments, you should:

1. Set secure values for `AUTH_SECRET` and PostgreSQL passwords
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
  hosts:
    - host: your-domain.com
      paths:
        - path: /
          pathType: Prefix
          service: kaneo
          port: 5173
  tls:
    - secretName: kaneo-tls
      hosts:
        - your-domain.com
```

## Using Gateway API

As an alternative to Ingress, the chart can create an `HTTPRoute` for the Kubernetes Gateway API:

```yaml
# values.yaml
gateway:
  enabled: true
  parentRefs:
    - name: main-gateway
      namespace: gateway-system
      sectionName: https
  hostnames:
    - kaneo.example.com
```

By default the chart creates one Gateway API rule:

1. `/` goes to the Kaneo service

If you need custom matching or multiple backend references, override `gateway.rules` directly. Each `backendRefs` entry follows the same pattern as ingress and uses the chart-specific `service` field (`kaneo`), which is expanded to the release-specific Service name.

## Security

For production deployments, consider the following security recommendations:

1. Use secure `AUTH_SECRET` and PostgreSQL passwords, preferably stored in Kubernetes Secrets
2. Enable TLS for ingress or Gateway API
3. Enable and set resource limits to prevent resource exhaustion
4. Use a dedicated storage class for the PostgreSQL database
5. Consider using a network policy to restrict traffic between components
6. Regularly update PostgreSQL and application images

### Registration Control

By default, user registration is enabled. To disable new user registration:

```yaml
kaneo:
  env:
    disableRegistration: true
```

This will prevent new users from registering while still allowing existing users to log in. The registration option will be hidden from the login page.
