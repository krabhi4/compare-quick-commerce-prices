import asyncio
import datetime
import os
import unittest
import httpx
from api.main import app
from api.models import PlatformProduct
from api.matching import (
    clean_name,
    extract_brand,
    normalize_quantity,
    is_product_match,
    group_products,
)
from api.geo import geocode_pin
from scraper.blinkit import parse_snippets
from scraper.zepto import parse_items, grid_items
from scraper.instamart import parse_search
from scraper.flipkart import parse_page
from scraper.bigbasket import parse_products
from db.repository import (
    init_database,
    create_alert,
    get_alerts,
    delete_alert,
    update_alert_check_time,
    save_product_and_snapshot,
    get_all_tracked_products,
    get_price_history_by_normalized_name,
    save_search_record,
)


class TestMatching(unittest.TestCase):
    def test_clean_name(self):
        cleaned = clean_name("Amul Pure Fresh Milk (Toned) 500ml")
        self.assertIn("amul", cleaned)
        self.assertIn("milk", cleaned)
        self.assertNotIn("fresh", cleaned)
        self.assertNotIn("pure", cleaned)
        self.assertNotIn("toned", cleaned)

    def test_extract_brand(self):
        self.assertEqual(extract_brand("Amul Gold Milk"), "amul")
        self.assertEqual(extract_brand("Britannia Good Day"), "britannia")
        self.assertIsNone(extract_brand("Unknown Random Bread"))

    def test_normalize_quantity_multipliers(self):
        self.assertEqual(normalize_quantity("2 x 500g"), "1000g")
        self.assertEqual(normalize_quantity("4 * 250 ml"), "1000ml")
        self.assertEqual(normalize_quantity("2x1kg"), "2000g")
        self.assertEqual(normalize_quantity("2 x 1 L"), "2000ml")

    def test_normalize_quantity_singles(self):
        self.assertEqual(normalize_quantity("1 kg"), "1000g")
        self.assertEqual(normalize_quantity("500 gm"), "500g")
        self.assertEqual(normalize_quantity("1.5 ltr"), "1500ml")
        self.assertEqual(normalize_quantity("6 pcs"), "6pcs")
        self.assertIsNone(normalize_quantity(None))

    def test_is_product_match(self):
        self.assertTrue(
            is_product_match(
                "amul taaza milk",
                "amul",
                "1000ml",
                "amul taaza milk toned",
                "amul",
                "1000ml",
            )
        )
        self.assertFalse(
            is_product_match(
                "amul taaza milk",
                "amul",
                "1000ml",
                "mother dairy taaza milk",
                "mother dairy",
                "1000ml",
            )
        )
        self.assertFalse(
            is_product_match(
                "amul taaza milk",
                "amul",
                "500ml",
                "amul taaza milk",
                "amul",
                "1000ml",
            )
        )

    def test_group_products(self):
        products = [
            PlatformProduct(
                platform="blinkit",
                name="Amul Taaza Toned Milk 1L",
                price=54.0,
                quantity="1 L",
            ),
            PlatformProduct(
                platform="zepto",
                name="Amul Taaza Milk 1000ml",
                price=52.0,
                quantity="1000 ml",
            ),
            PlatformProduct(
                platform="blinkit",
                name="Amul Taaza Toned Milk 1L",
                price=56.0,
                quantity="1 L",
            ),
        ]
        groups = group_products(products)
        self.assertEqual(len(groups), 1)
        group = groups[0]
        self.assertEqual(group.cheapest_platform, "zepto")
        self.assertEqual(group.cheapest_price, 52.0)
        self.assertEqual(len(group.platforms), 2)


class TestScraperParsers(unittest.TestCase):
    def test_blinkit_parser(self):
        snippets = [
            {
                "widget_type": "product_card_snippet_type_2",
                "data": {
                    "product_id": 12345,
                    "name": {"text": "Amul Milk"},
                    "variant": {"text": "500 ml"},
                    "atc_action": {
                        "add_to_cart": {
                            "cart_item": {
                                "product_name": "Amul Milk",
                                "price": "₹30",
                                "mrp": "₹32",
                                "unit": "500 ml",
                                "inventory": 5,
                            }
                        }
                    },
                },
            }
        ]
        results = parse_snippets(snippets)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].platform, "blinkit")
        self.assertEqual(results[0].price, 30.0)
        self.assertEqual(results[0].mrp, 32.0)
        self.assertTrue(results[0].in_stock)
        self.assertEqual(results[0].product_url, "https://blinkit.com/prn/12345")

    def test_zepto_parser(self):
        items = [
            {
                "productResponse": {
                    "product": {"name": "Zepto Curd"},
                    "productVariant": {
                        "id": "var123",
                        "formattedPacksize": "400g",
                        "images": [{"path": "img.jpg"}],
                    },
                    "discountedSellingPrice": 4500,
                    "mrp": 5000,
                    "outOfStock": False,
                }
            }
        ]
        results = parse_items(items)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].platform, "zepto")
        self.assertEqual(results[0].price, 45.0)
        self.assertEqual(results[0].mrp, 50.0)
        self.assertTrue(results[0].in_stock)
        self.assertEqual(results[0].quantity, "400g")

    def test_instamart_parser(self):
        payload = {
            "data": {
                "cards": [
                    {
                        "card": {
                            "card": {
                                "gridElements": {
                                    "infoWithStyle": {
                                        "items": [
                                            {
                                                "productId": "im123",
                                                "displayName": "Butter",
                                                "inStock": True,
                                                "isAvail": True,
                                                "variations": [
                                                    {
                                                        "displayName": "Amul Butter 100g",
                                                        "price": {"offerPrice": {"units": 55, "nanos": 0}},
                                                        "quantityDescription": "100g",
                                                    }
                                                ],
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                ]
            }
        }
        results = parse_search(payload)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].platform, "instamart")
        self.assertEqual(results[0].price, 55.0)

    def test_flipkart_parser(self):
        payload = {
            "RESPONSE": {
                "slots": [
                    {
                        "widget": {
                            "data": {
                                "products": [
                                    {
                                        "productInfo": {
                                            "value": {
                                                "titles": {"title": "Sugar 1kg", "subtitle": "1 kg"},
                                                "pricing": {
                                                    "finalPrice": {"value": 48.0},
                                                    "mrp": {"value": 55.0},
                                                },
                                                "baseUrl": "/sugar/p/123",
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ]
            }
        }
        results = parse_page(payload)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].platform, "flipkart")
        self.assertEqual(results[0].price, 48.0)
        self.assertEqual(results[0].mrp, 55.0)

    def test_bigbasket_parser(self):
        payload = {
            "tabs": [
                {
                    "product_info": {
                        "products": [
                            {
                                "desc": "Tea 500g",
                                "brand": {"name": "Tata Tea"},
                                "pricing": {"discount": {"prim_price": {"sp": "250"}, "mrp": "270"}},
                                "availability": {"avail_status": "001"},
                                "w": "500g",
                                "absolute_url": "/pd/1234/tata-tea",
                            }
                        ]
                    }
                }
            ]
        }
        results = parse_products(payload)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].platform, "bigbasket")
        self.assertEqual(results[0].price, 250.0)
        self.assertEqual(results[0].mrp, 270.0)
        self.assertTrue(results[0].in_stock)


class TestGeo(unittest.IsolatedAsyncioTestCase):
    async def test_invalid_pin(self):
        self.assertIsNone(await geocode_pin("invalid"))
        self.assertIsNone(await geocode_pin("123"))
        self.assertIsNone(await geocode_pin(""))


class TestDatabaseRepository(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await init_database()

    async def test_alert_lifecycle(self):
        alert = await create_alert(
            product_query="test milk",
            target_price=40.0,
            pin="110001",
            platform="zepto",
        )
        self.assertIsNotNone(alert)
        self.assertEqual(alert.product_query, "test milk")
        self.assertEqual(alert.target_price, 40.0)

        alerts = await get_alerts(active_only=True)
        self.assertTrue(any(a.id == alert.id for a in alerts))

        await update_alert_check_time(alert.id)

        deleted = await delete_alert(alert.id)
        self.assertTrue(deleted)

    async def test_save_product_snapshot_and_history(self):
        test_prod_name = f"Test Product {datetime.datetime.now().timestamp()}"
        await save_product_and_snapshot(
            normalized_name=test_prod_name,
            platform="blinkit",
            name=test_prod_name,
            price=99.0,
            pin="110001",
            brand="amul",
            quantity="500g",
        )
        history = await get_price_history_by_normalized_name(test_prod_name)
        self.assertGreaterEqual(len(history), 1)
        self.assertEqual(history[0]["price"], 99.0)

        tracked = await get_all_tracked_products(limit=10)
        matched = [p for p in tracked if p["name"] == test_prod_name]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0]["brand"], "amul")

    async def test_save_search_record(self):
        await save_search_record(query="tea", pin="110001", results_json="[]")


class TestAPIEndpoints(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await init_database()

    async def test_endpoints(self):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/health")
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["status"], "ok")

            res = await client.get("/location")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertIn("pin", data)
            self.assertIn("lat", data)
            self.assertIn("lon", data)

            res = await client.post("/location", json={"pin": "000000"})
            self.assertEqual(res.status_code, 400)

            res = await client.get("/openapi.json")
            self.assertEqual(res.status_code, 200)

            res = await client.post(
                "/alerts",
                json={
                    "product_query": "coffee",
                    "target_price": 120.0,
                    "pin": "110001",
                },
            )
            self.assertEqual(res.status_code, 200)
            created_alert = res.json()
            self.assertEqual(created_alert["product_query"], "coffee")

            res = await client.get("/alerts")
            self.assertEqual(res.status_code, 200)

            res = await client.delete(f"/alerts/{created_alert['id']}")
            self.assertEqual(res.status_code, 200)

            res = await client.get("/history?name=nonexistent")
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["history"], [])

            res = await client.get("/history/products")
            self.assertEqual(res.status_code, 200)
            self.assertIsInstance(res.json()["products"], list)


if __name__ == "__main__":
    unittest.main()
