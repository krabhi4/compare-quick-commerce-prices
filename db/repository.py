import datetime
import logging
from sqlalchemy import select, delete, desc
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from api.config import settings
from db.schema import Base, Product, PriceSnapshot, Alert, Identity, SearchRecord

logger = logging.getLogger(__name__)

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_database() -> None:
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        logger.error(f"Database initialization failed: {exc}")


async def save_search_record(query: str, pin: str, results_json: str) -> None:
    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                record = SearchRecord(query=query, pin=pin, results_json=results_json)
                session.add(record)
    except Exception as exc:
        logger.error(f"Failed to save search record: {exc}")


async def save_product_and_snapshot(
    normalized_name: str,
    platform: str,
    name: str,
    price: float,
    pin: str,
    quantity: str | None = None,
    brand: str | None = None,
    image_url: str | None = None,
    product_url: str | None = None,
    mrp: float | None = None,
    in_stock: bool = True,
    logged_in: bool = False,
) -> None:
    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                stmt = select(Product).where(
                    Product.platform == platform,
                    Product.name == name,
                )
                result = await session.execute(stmt)
                product = result.scalars().first()

                if not product:
                    product = Product(
                        normalized_name=normalized_name,
                        platform=platform,
                        name=name,
                        quantity=quantity,
                        brand=brand,
                        image_url=image_url,
                        product_url=product_url,
                        in_stock=in_stock,
                    )
                    session.add(product)
                    await session.flush()
                else:
                    product.normalized_name = normalized_name
                    product.quantity = quantity or product.quantity
                    product.brand = brand or product.brand
                    product.image_url = image_url or product.image_url
                    product.product_url = product_url or product.product_url
                    product.in_stock = in_stock
                    product.updated_at = datetime.datetime.utcnow()

                snapshot = PriceSnapshot(
                    product_id=product.id,
                    price=price,
                    mrp=mrp,
                    in_stock=in_stock,
                    pin=pin,
                    logged_in=logged_in,
                )
                session.add(snapshot)
    except Exception as exc:
        logger.error(f"Failed to save product snapshot: {exc}")


async def get_price_history_by_normalized_name(normalized_name: str, limit: int = 100) -> list[dict]:
    try:
        async with AsyncSessionLocal() as session:
            stmt = (
                select(PriceSnapshot, Product)
                .join(Product, PriceSnapshot.product_id == Product.id)
                .where(Product.normalized_name == normalized_name)
                .order_by(desc(PriceSnapshot.scraped_at))
                .limit(limit)
            )
            result = await session.execute(stmt)
            rows = result.all()

            history: list[dict] = []
            for snapshot, product in rows:
                history.append(
                    {
                        "scraped_at": snapshot.scraped_at.isoformat(),
                        "platform": product.platform,
                        "product_name": product.name,
                        "price": snapshot.price,
                        "mrp": snapshot.mrp,
                        "in_stock": snapshot.in_stock,
                        "pin": snapshot.pin,
                        "logged_in": snapshot.logged_in,
                    }
                )
            return history
    except Exception as exc:
        logger.error(f"Failed to fetch price history: {exc}")
        return []


async def get_all_tracked_products(limit: int = 100) -> list[dict]:
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(Product).order_by(desc(Product.updated_at)).limit(limit)
            result = await session.execute(stmt)
            products = result.scalars().all()
            return [
                {
                    "id": p.id,
                    "normalized_name": p.normalized_name,
                    "platform": p.platform,
                    "name": p.name,
                    "quantity": p.quantity,
                    "brand": p.brand,
                    "image_url": p.image_url,
                    "product_url": p.product_url,
                    "in_stock": p.in_stock,
                    "updated_at": p.updated_at.isoformat(),
                }
                for p in products
            ]
    except Exception as exc:
        logger.error(f"Failed to fetch tracked products: {exc}")
        return []


async def create_alert(product_query: str, target_price: float, pin: str, platform: str | None = None) -> Alert | None:
    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                alert = Alert(
                    product_query=product_query,
                    platform=platform,
                    target_price=target_price,
                    pin=pin,
                    active=True,
                )
                session.add(alert)
                await session.flush()
                await session.refresh(alert)
                return alert
    except Exception as exc:
        logger.error(f"Failed to create alert: {exc}")
        return None


async def get_alerts(active_only: bool = True) -> list[Alert]:
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(Alert)
            if active_only:
                stmt = stmt.where(Alert.active == True)
            stmt = stmt.order_by(desc(Alert.created_at))
            result = await session.execute(stmt)
            return list(result.scalars().all())
    except Exception as exc:
        logger.error(f"Failed to list alerts: {exc}")
        return []


async def delete_alert(alert_id: int) -> bool:
    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                stmt = delete(Alert).where(Alert.id == alert_id)
                result = await session.execute(stmt)
                return result.rowcount > 0
    except Exception as exc:
        logger.error(f"Failed to delete alert: {exc}")
        return False


async def update_alert_check_time(alert_id: int) -> None:
    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                stmt = select(Alert).where(Alert.id == alert_id)
                result = await session.execute(stmt)
                alert = result.scalars().first()
                if alert:
                    alert.last_checked = datetime.datetime.utcnow()
    except Exception as exc:
        logger.error(f"Failed to update alert check time: {exc}")


async def get_all_identities() -> dict[str, str | None]:
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(Identity)
            result = await session.execute(stmt)
            identities = result.scalars().all()
            return {identity.platform: identity.account for identity in identities}
    except Exception as exc:
        logger.error(f"Failed to get identities: {exc}")
        return {}


async def save_identity(platform: str, account: str | None) -> None:
    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                stmt = select(Identity).where(Identity.platform == platform)
                result = await session.execute(stmt)
                identity = result.scalars().first()
                if not identity:
                    identity = Identity(platform=platform, account=account)
                    session.add(identity)
                else:
                    identity.account = account
                    identity.updated_at = datetime.datetime.utcnow()
    except Exception as exc:
        logger.error(f"Failed to save identity: {exc}")


async def remove_identity(platform: str) -> None:
    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                stmt = delete(Identity).where(Identity.platform == platform)
                await session.execute(stmt)
    except Exception as exc:
        logger.error(f"Failed to remove identity: {exc}")
