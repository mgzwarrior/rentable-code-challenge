# Simulated PMS Integration API

Base URL: `https://kpsaflrfjmhwomxiqrtiplvqem0hfmec.lambda-url.us-east-2.on.aws/api/simulated-pms-integration-api`

## Tenants

Returns tenant records from the property management system.

**Endpoint:** `GET /tenants/`

### Parameters

| Parameter | Description |
|-----------|-------------|
| includeLedgers | When `true`, includes the tenant's ledger in the response. |

### Response

Returns an array of tenant objects.

```json
[
    {
        "tenant_id": 123,
        "name": "Jane Doe",
        "unit": "987",
        "ledger": [...]
    }
]
```

### Tenant Fields

| Field | Description |
|-------|-------------|
| tenant_id | The tenant's identifier in the PMS |
| name | Full name |
| unit | Unit code |

### Ledger Entry Fields

| Field | Description |
|-------|-------------|
| id | Transaction identifier |
| date | Date of the transaction |
| amount | Dollar amount |
| type | Transaction type |
| description | Description of the transaction |

## Observed Behavior

The sections above are the provider's description. Everything below was
observed in live responses on 2026-10-11 (200 tenants, 4,424 ledger
entries). It is not guaranteed by the provider and should be re-checked
if the API changes. `import_transactions` and the ledger balance rely on
these observations.

### Request

- `includeLedgers` defaults to off. The `ledger` key is absent, not
  empty, unless the value is `true` (case-insensitive). `1` and `yes`
  are not accepted.
- All tenants are returned in one response, ordered by `tenant_id`.
  There is no pagination. The response with ledgers is about 520 KB.

### Tenant fields

| Field | Observed type | Notes |
|-------|---------------|-------|
| tenant_id | integer | Unique |
| name | string | |
| unit | string | |
| ledger | array | Never empty when present; 6 to 51 entries |

### Ledger entry fields

| Field | Observed type | Notes |
|-------|---------------|-------|
| id | string | Digits only. Unique across all tenants, not just within a ledger |
| date | string | `YYYY-MM-DD`. No time or time zone |
| amount | number | At most two decimal places. Can be negative |
| type | string | Only `charge` or `payment` |
| description | string | Up to 40 characters |

Entries are ordered by `date`. `id` order does not match date order.

### Amount sign

`amount` is not signed by `type`: a charge and a payment are both
positive. Negative amounts occur on both types:

- Negative `charge` (132 entries): a credit, such as "Utility Credit",
  "Rent Concession" or "Late Fee Waived".
- Negative `payment` (81 entries): a reversal, always "Returned
  Payment" (NSF).

This reading comes from the descriptions and is an interpretation. The
balance is calculated as charges minus payments with signs kept, so a
positive balance is the amount the tenant owes.
