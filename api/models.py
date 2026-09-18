from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    pin: str = Field(default="110001")
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    platforms: list[str] | None = Field(default=None)


class PlatformProduct(BaseModel):
    platform: str
    name: str
    price: float
    mrp: float | None = None
    quantity: str | None = None
    in_stock: bool = True
    product_url: str | None = None
    image_url: str | None = None
    eta: str | None = None


class GroupedProduct(BaseModel):
    normalized_name: str
    brand: str | None = None
    quantity: str | None = None
    cheapest_price: float
    cheapest_platform: str
    platforms: list[PlatformProduct]


class SearchResponse(BaseModel):
    query: str
    pin: str
    total_groups: int
    cached: bool = False
    results: list[GroupedProduct]


class PriceHistoryItem(BaseModel):
    scraped_at: str
    platform: str
    product_name: str
    price: float
    mrp: float | None = None
    in_stock: bool = True
    pin: str
    logged_in: bool = False


class PriceHistoryResponse(BaseModel):
    normalized_name: str
    history: list[PriceHistoryItem]


class TrackedProductItem(BaseModel):
    id: int
    normalized_name: str
    platform: str
    name: str
    quantity: str | None = None
    brand: str | None = None
    image_url: str | None = None
    product_url: str | None = None
    in_stock: bool = True
    updated_at: str


class TrackedProductsResponse(BaseModel):
    products: list[TrackedProductItem]


class AlertCreateRequest(BaseModel):
    product_query: str = Field(..., min_length=1)
    platform: str | None = None
    target_price: float = Field(..., gt=0)
    pin: str = Field(..., min_length=6, max_length=6)


class AlertResponse(BaseModel):
    id: int
    product_query: str
    platform: str | None = None
    target_price: float
    pin: str
    active: bool
    created_at: str
    last_checked: str | None = None


class LocationUpdateRequest(BaseModel):
    pin: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)


class LocationResponse(BaseModel):
    pin: str
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class HealthResponse(BaseModel):
    status: str
    version: str
