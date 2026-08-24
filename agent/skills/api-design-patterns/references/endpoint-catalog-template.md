# Endpoint Catalog Template

Use this template to document all API endpoints for a feature or module. This serves as the contract between frontend and backend teams.

---

## Module: [Module Name]

**Base URL:** `/v1/{resource}`
**Auth Required:** Yes / No
**Tags:** [OpenAPI tags]

---

### Endpoints

#### `GET /v1/{resource}`

**Summary:** List {resources} with pagination and filtering.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `cursor` | `string` | No | `null` | Pagination cursor from previous response |
| `limit` | `integer` | No | `20` | Items per page (1-100) |
| `sort` | `string` | No | `-created_at` | Sort field with direction prefix |
| `q` | `string` | No | `null` | Full-text search query |

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": 1,
      "field": "value",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "next_cursor": "eyJpZCI6MjB9",
  "has_more": true
}
```

**Errors:**
| Status | Code | When |
|--------|------|------|
| `401` | `UNAUTHORIZED` | Missing or invalid auth token |

---

#### `POST /v1/{resource}`

**Summary:** Create a new {resource}.

**Request Body:** `{Resource}Create`
```json
{
  "field1": "value",
  "field2": 42
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "field1": "value",
  "field2": 42,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Response Headers:**
- `Location: /v1/{resource}/1`

**Errors:**
| Status | Code | When |
|--------|------|------|
| `401` | `UNAUTHORIZED` | Missing or invalid auth token |
| `409` | `CONFLICT` | Resource with same unique field exists |
| `422` | `VALIDATION_ERROR` | Request body fails validation |

---

#### `GET /v1/{resource}/{id}`

**Summary:** Get a single {resource} by ID.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

**Response:** `200 OK`
```json
{
  "id": 1,
  "field1": "value",
  "field2": 42,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
| Status | Code | When |
|--------|------|------|
| `401` | `UNAUTHORIZED` | Missing or invalid auth token |
| `404` | `NOT_FOUND` | Resource does not exist |

---

#### `PATCH /v1/{resource}/{id}`

**Summary:** Partially update a {resource}.

**Request Body:** `{Resource}Patch` (all fields optional)
```json
{
  "field1": "new value"
}
```

**Response:** `200 OK` — Returns the full updated resource.

**Errors:**
| Status | Code | When |
|--------|------|------|
| `401` | `UNAUTHORIZED` | Missing or invalid auth token |
| `404` | `NOT_FOUND` | Resource does not exist |
| `409` | `CONFLICT` | Update conflicts with another resource |
| `422` | `VALIDATION_ERROR` | Request body fails validation |

---

#### `DELETE /v1/{resource}/{id}`

**Summary:** Delete a {resource}.

**Response:** `204 No Content` — Empty body.

**Errors:**
| Status | Code | When |
|--------|------|------|
| `401` | `UNAUTHORIZED` | Missing or invalid auth token |
| `404` | `NOT_FOUND` | Resource does not exist |

---

## Auth Requirements

| Endpoint | Auth | Roles |
|----------|------|-------|
| `GET /v1/{resource}` | Required | Any authenticated user |
| `POST /v1/{resource}` | Required | Admin, Editor |
| `GET /v1/{resource}/{id}` | Required | Any authenticated user |
| `PATCH /v1/{resource}/{id}` | Required | Admin, Owner |
| `DELETE /v1/{resource}/{id}` | Required | Admin only |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `GET /v1/{resource}` | 100 | per minute |
| `POST /v1/{resource}` | 20 | per minute |
| `PATCH /v1/{resource}/{id}` | 30 | per minute |
| `DELETE /v1/{resource}/{id}` | 10 | per minute |

Rate limit headers included in every response:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when the window resets
