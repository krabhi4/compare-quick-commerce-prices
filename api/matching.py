import re
from rapidfuzz import fuzz
from api.models import PlatformProduct, GroupedProduct

NOISE_WORDS: set[str] = {
    "fresh",
    "pouch",
    "pack",
    "tetra",
    "organic",
    "premium",
    "original",
    "natural",
    "pure",
    "classic",
    "rich",
    "daily",
    "best",
    "instant",
    "super",
    "regular",
    "bottle",
    "box",
    "can",
    "jar",
    "carton",
    "plastic",
    "combo",
    "offer",
    "special",
}

KNOWN_BRANDS: list[str] = [
    "amul",
    "britannia",
    "mother dairy",
    "nestle",
    "parle",
    "nandini",
    "tata",
    "aashirvaad",
    "fortune",
    "saffola",
    "dabur",
    "lays",
    "doritos",
    "haldirams",
    "haldiram",
    "epigamia",
    "country delight",
    "coca cola",
    "pepsi",
    "thums up",
    "sprite",
    "frooti",
    "cadbury",
    "dairy milk",
    "kitkat",
    "oreo",
    "maggi",
    "sunfeast",
    "marico",
    "surf excel",
    "ariel",
    "vim",
    "dettol",
    "colgate",
    "close up",
    "head & shoulders",
    "pantene",
    "dove",
    "nivea",
    "godrej",
    "lizol",
    "harpic",
    "everest",
    "mdh",
    "catch",
    "mtr",
    "act ii",
    "bingo",
    "kurkure",
    "kwality walls",
    "havmor",
    "vadilal",
    "heritage",
    "gokul",
    "govind",
]


def clean_name(name: str) -> str:
    cleaned = name.lower()
    cleaned = re.sub(r"\(.*?\)", "", cleaned)
    cleaned = re.sub(r"[^\w\s\.]", " ", cleaned)
    words = cleaned.split()
    filtered_words = [word for word in words if word not in NOISE_WORDS and not word.isdigit()]
    return " ".join(filtered_words).strip()


def extract_brand(name: str) -> str | None:
    lowered = name.lower()
    for brand in KNOWN_BRANDS:
        pattern = r"\b" + re.escape(brand) + r"\b"
        if re.search(pattern, lowered):
            return brand
    return None


def normalize_quantity(text: str | None) -> str | None:
    if not text:
        return None

    lowered = text.lower().strip()
    lowered = lowered.replace(" ", "")

    multiplier_match = re.search(r"(\d+)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|l|ltr|litre|litres|ml)", lowered)
    if multiplier_match:
        count = int(multiplier_match.group(1))
        unit_val = float(multiplier_match.group(2))
        unit = multiplier_match.group(3)
        total = count * unit_val
        if unit in ["kg"]:
            return f"{int(total * 1000)}g"
        if unit in ["l", "ltr", "litre", "litres"]:
            return f"{int(total * 1000)}ml"
        if unit in ["g", "gm", "gms"]:
            return f"{int(total)}g"
        if unit in ["ml"]:
            return f"{int(total)}ml"

    single_match = re.search(r"(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|l|ltr|litre|litres|ml|piece|pieces|pc|pcs)", lowered)
    if single_match:
        val = float(single_match.group(1))
        unit = single_match.group(2)
        if unit in ["kg"]:
            return f"{int(val * 1000)}g"
        if unit in ["l", "ltr", "litre", "litres"]:
            return f"{int(val * 1000)}ml"
        if unit in ["g", "gm", "gms"]:
            return f"{int(val)}g"
        if unit in ["ml"]:
            return f"{int(val)}ml"
        if unit in ["piece", "pieces", "pc", "pcs"]:
            return f"{int(val)}pcs"

    return text.strip()


def is_product_match(
    first_cleaned: str,
    first_brand: str | None,
    first_quantity: str | None,
    second_cleaned: str,
    second_brand: str | None,
    second_quantity: str | None,
) -> bool:
    if first_brand and second_brand and first_brand != second_brand:
        return False

    similarity_score = fuzz.token_sort_ratio(first_cleaned, second_cleaned)

    same_brand = bool(first_brand and second_brand and first_brand == second_brand)
    same_quantity = bool(first_quantity and second_quantity and first_quantity == second_quantity)

    if similarity_score >= 90 and (same_brand or not first_brand or not second_brand):
        if first_quantity and second_quantity and not same_quantity:
            return False
        return True

    if similarity_score >= 75 and same_brand and same_quantity:
        return True

    if similarity_score >= 70 and same_brand:
        return True

    return False


def build_grouped_product(normalized_name: str, products: list[PlatformProduct]) -> GroupedProduct:
    cheapest = min(products, key=lambda item: item.price)
    brand = extract_brand(products[0].name)
    quantity = normalize_quantity(products[0].quantity or products[0].name)

    return GroupedProduct(
        normalized_name=normalized_name,
        brand=brand,
        quantity=quantity,
        cheapest_price=cheapest.price,
        cheapest_platform=cheapest.platform,
        platforms=products,
    )


def group_products(raw_products: list[PlatformProduct]) -> list[GroupedProduct]:
    groups: list[dict] = []

    for product in raw_products:
        cleaned = clean_name(product.name)
        brand = extract_brand(product.name)
        quantity = normalize_quantity(product.quantity or product.name)

        matched_group = None
        for group in groups:
            if is_product_match(
                group["cleaned"],
                group["brand"],
                group["quantity"],
                cleaned,
                brand,
                quantity,
            ):
                matched_group = group
                break

        if matched_group:
            existing_platforms = [p.platform for p in matched_group["products"]]
            if product.platform in existing_platforms:
                for idx, existing in enumerate(matched_group["products"]):
                    if existing.platform == product.platform and product.price < existing.price:
                        matched_group["products"][idx] = product
            else:
                matched_group["products"].append(product)
        else:
            groups.append(
                {
                    "cleaned": cleaned,
                    "brand": brand,
                    "quantity": quantity,
                    "primary_name": product.name,
                    "products": [product],
                }
            )

    grouped_results: list[GroupedProduct] = []
    for group in groups:
        grouped = build_grouped_product(group["primary_name"], group["products"])
        grouped_results.append(grouped)

    grouped_results.sort(key=lambda item: item.cheapest_price)
    return grouped_results
