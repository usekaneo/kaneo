# ElseTasks License Portal (MVP)

This folder documents the license control plane. Runtime APIs live in the main API:

- `GET /api/license/status`
- `POST /api/license/activate`
- `POST /api/license/generate` (authenticated)

## Offline key generation

```bash
../../scripts/generate-license-keys.sh local 10
../../scripts/generate-license-keys.sh cloud_monthly 5
```

Store issued keys in a spreadsheet or CRM until a full portal UI ships.

## Redeem (Cloud)

1. Customer pays for Cloud SKU.
2. Operator runs `scripts/provision-customer.sh <slug>`.
3. Customer opens `https://<slug>.<domain>/setup` and configures brand.
