# Pydantic v2 Schema Examples

Concrete schema examples following the API design patterns conventions. Use these as templates when designing new API contracts.

---

## User Schemas

### UserCreate (POST request body)

```python
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Schema for creating a new user. No id or timestamps."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)
    role: str = Field(default="member", pattern=r"^(admin|editor|member)$")
```

### UserUpdate (PUT request body — full replace)

```python
class UserUpdate(BaseModel):
    """Schema for full user update. All writable fields required."""

    email: EmailStr
    display_name: str = Field(min_length=1, max_length=100)
    role: str = Field(pattern=r"^(admin|editor|member)$")
    is_active: bool
```

### UserPatch (PATCH request body — partial update)

```python
class UserPatch(BaseModel):
    """Schema for partial user update. All fields Optional."""

    email: EmailStr | None = None
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    role: str | None = Field(default=None, pattern=r"^(admin|editor|member)$")
    is_active: bool | None = None
```

**Usage in route:**
```python
@router.patch("/users/{user_id}", response_model=UserResponse)
async def patch_user(user_id: int, data: UserPatch, ...):
    # model_dump(exclude_unset=True) only includes fields the client sent
    update_data = data.model_dump(exclude_unset=True)
    # update_data might be {"display_name": "New Name"} — only what was sent
```

### UserResponse (GET response)

```python
from datetime import datetime


class UserResponse(BaseModel):
    """Schema for user in API responses. Includes id and timestamps."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str  # Note: EmailStr not needed in response
    display_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # Note: hashed_password is NEVER included in response
```

### UserListResponse (paginated list)

```python
class UserListResponse(BaseModel):
    """Paginated list of users with cursor-based pagination."""

    items: list[UserResponse]
    next_cursor: str | None = None
    has_more: bool
```

### UserFilter (query parameters)

```python
class UserFilter(BaseModel):
    """Query parameters for filtering users."""

    role: str | None = None
    is_active: bool | None = None
    q: str | None = Field(default=None, description="Search by name or email")
    created_after: datetime | None = None
    created_before: datetime | None = None
```

---

## Error Schemas

### ErrorResponse

```python
class FieldError(BaseModel):
    """Individual field-level error."""

    field: str
    message: str
    code: str


class ErrorResponse(BaseModel):
    """Standard error response format for all API errors."""

    detail: str
    code: str
    field_errors: list[FieldError] = []
```

**Example error response (422 Validation Error):**
```json
{
  "detail": "Validation failed",
  "code": "VALIDATION_ERROR",
  "field_errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "INVALID_FORMAT"
    },
    {
      "field": "password",
      "message": "Must be at least 8 characters",
      "code": "TOO_SHORT"
    }
  ]
}
```

**Example error response (404 Not Found):**
```json
{
  "detail": "User with id 42 not found",
  "code": "NOT_FOUND",
  "field_errors": []
}
```

---

## Pagination Schemas

### CursorPagination (cursor-based)

```python
import base64
import json

from pydantic import BaseModel, Field
from typing import Generic, TypeVar

T = TypeVar("T")


class CursorPage(BaseModel, Generic[T]):
    """Generic cursor-based pagination response."""

    items: list[T]
    next_cursor: str | None = None
    has_more: bool


class CursorParams(BaseModel):
    """Query parameters for cursor-based pagination."""

    cursor: str | None = None
    limit: int = Field(default=20, ge=1, le=100)
```

**Cursor encoding helper:**
```python
def encode_cursor(last_id: int) -> str:
    return base64.urlsafe_b64encode(json.dumps({"id": last_id}).encode()).decode()

def decode_cursor(cursor: str) -> dict:
    return json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
```

### OffsetPagination (offset-based)

```python
class OffsetPage(BaseModel, Generic[T]):
    """Generic offset-based pagination response."""

    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class OffsetParams(BaseModel):
    """Query parameters for offset-based pagination."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
```

---

## Nested Resource Schemas

### Order with Items

```python
class OrderItemResponse(BaseModel):
    """Single item within an order."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price_cents: int
    total_price_cents: int


class OrderResponse(BaseModel):
    """Order with nested items."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    status: str
    items: list[OrderItemResponse]
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    created_at: datetime
    updated_at: datetime


class OrderCreate(BaseModel):
    """Create order with items in a single request."""

    items: list[OrderItemCreate] = Field(min_length=1)
    shipping_address_id: int


class OrderItemCreate(BaseModel):
    """Single item to add to an order."""

    product_id: int
    quantity: int = Field(ge=1, le=999)
```

---

## Schema Conversion Patterns

### ORM to Response

```python
# In the route handler or service:
user = await repo.get_by_id(user_id)
if user is None:
    raise NotFoundError(f"User {user_id} not found")

# Convert ORM model to Pydantic response
response = UserResponse.model_validate(user)
```

### Partial Update with PATCH

```python
# Get only the fields the client actually sent
update_data = patch_schema.model_dump(exclude_unset=True)

# Apply updates to the ORM model
for field, value in update_data.items():
    setattr(user, field, value)

await session.flush()
```

### Discriminated Union for Polymorphic Responses

```python
from typing import Annotated, Literal, Union
from pydantic import Discriminator, Tag


class EmailNotification(BaseModel):
    type: Literal["email"] = "email"
    recipient: EmailStr
    subject: str
    body: str


class PushNotification(BaseModel):
    type: Literal["push"] = "push"
    device_token: str
    title: str
    body: str


Notification = Annotated[
    Union[
        Annotated[EmailNotification, Tag("email")],
        Annotated[PushNotification, Tag("push")],
    ],
    Discriminator("type"),
]
```
