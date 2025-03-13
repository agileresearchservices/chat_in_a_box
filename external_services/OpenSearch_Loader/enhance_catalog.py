#!/usr/bin/env python3
import csv
import random
import re
import os
from datetime import datetime, timedelta

# Input and output files - using existing CSV in the OpenSearch_Loader directory
INPUT_CSV = "cell_phone_catalog_expanded.csv"
OUTPUT_CSV = "cell_phone_catalog_enhanced.csv"

# Base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_PATH = os.path.join(BASE_DIR, INPUT_CSV)
OUTPUT_PATH = os.path.join(BASE_DIR, OUTPUT_CSV)

# Define brand to model mappings based on Base_ID
BRAND_MODEL_MAP = {
    "1": {"brand": "XenoPhone", "model": "Fusion"},
    "2": {"brand": "TechPhone", "model": "Lite"},
    "3": {"brand": "NextGen", "model": "ProMax"},
    "4": {"brand": "SmartCom", "model": "Quantum"},
    "5": {"brand": "UltraMobile", "model": "Edge"},
    "6": {"brand": "HyperPhone", "model": "ProMax"},
    "7": {"brand": "Galaxy", "model": "Ultra"},
    "8": {"brand": "Pixel", "model": "Pro"},
    "9": {"brand": "Apple", "model": "iPhone"},
    "10": {"brand": "XenoPhone", "model": "Lite"},
}

# Camera MP options by price tier
CAMERA_OPTIONS = {
    "budget": {"main": [12, 16, 20], "front": [8, 10]},
    "mid": {"main": [32, 48, 50], "front": [10, 12, 16]},
    "premium": {"main": [50, 64, 108], "front": [16, 20, 32]},
}

# Battery capacity options by screen size
BATTERY_OPTIONS = {
    "5.8": [3000, 3200, 3500],
    "6.1": [3500, 3700, 4000],
    "6.5": [4000, 4200, 4500],
    "6.7": [4500, 4700, 5000],
    "7.1": [5000, 5200, 5500],
}

# Processor options by price tier
PROCESSOR_OPTIONS = {
    "budget": ["MediaTek Helio P35", "Snapdragon 480", "Exynos 850"],
    "mid": ["Snapdragon 695", "MediaTek Dimensity 700", "Exynos 1280"],
    "premium": ["Snapdragon 8 Gen 1", "A15 Bionic", "MediaTek Dimensity 9000"],
}

# RAM options by storage
RAM_OPTIONS = {
    "64GB": [4, 6],
    "128GB": [6, 8],
    "256GB": [8, 12],
    "512GB": [12, 16],
    "1TB": [16, 24],
}

# OS options by brand
OS_OPTIONS = {
    "XenoPhone": ["Android 11", "Android 12", "Android 13"],
    "TechPhone": ["Android 12", "Android 13"],
    "NextGen": ["Android 10", "Android 11"],
    "SmartCom": ["Android 10", "Android 11"],
    "UltraMobile": ["Android 12", "Android 13"],
    "HyperPhone": ["Android 12", "Android 13"],
    "Galaxy": ["Android 12", "Android 13", "Android 14"],
    "Pixel": ["Android 12", "Android 13", "Android 14"],
    "Apple": ["iOS 15", "iOS 16", "iOS 17"],
}

# Category hierarchy options
CATEGORY_OPTIONS = [
    "Electronics > Mobile Phones > Smartphones",
    "Electronics > Smartphones > Android Phones",
    "Electronics > Smartphones > iOS Phones",
    "Mobile Devices > Smartphones",
    "Telecommunications > Mobile Phones",
]

# Helper function to determine price tier
def get_price_tier(price):
    if price < 400:
        return "budget"
    elif price < 800:
        return "mid"
    else:
        return "premium"

# Helper function to generate realistic ratings
def generate_rating(price_tier, release_year):
    base_rating = 3.5
    
    # Higher price tier generally means better ratings
    if price_tier == "premium":
        base_rating += 0.7
    elif price_tier == "mid":
        base_rating += 0.3
    
    # Newer products might have slightly better ratings
    year_boost = (int(release_year) - 2020) * 0.1
    
    # Add some randomness
    random_factor = random.uniform(-0.3, 0.3)
    
    final_rating = min(5.0, max(1.0, base_rating + year_boost + random_factor))
    return round(final_rating * 10) / 10  # Round to 1 decimal place

# Helper function to generate dimensions based on screen size
def generate_dimensions(screen_size):
    screen_size_float = float(screen_size.replace('"', ''))
    
    # Base dimensions for a 6" phone
    base_height = 150
    base_width = 70
    base_thickness = 8.5
    
    # Scale dimensions based on screen size
    scale_factor = screen_size_float / 6.0
    height = base_height * scale_factor
    width = base_width * scale_factor
    
    # Thickness varies less with screen size
    thickness = base_thickness + (scale_factor - 1) * 1.5
    
    return f"{round(height, 1)} x {round(width, 1)} x {round(thickness, 1)} mm"

# Helper function to generate weight based on screen size and features
def generate_weight(screen_size, battery_capacity):
    screen_size_float = float(screen_size.replace('"', ''))
    
    # Base weight for a 6" phone with 4000mAh battery
    base_weight = 180
    
    # Scale weight based on screen size
    screen_factor = (screen_size_float - 6.0) * 20
    
    # Scale weight based on battery
    battery_factor = (battery_capacity - 4000) / 500 * 10
    
    # Add some randomness
    random_factor = random.uniform(-8, 8)
    
    return round(base_weight + screen_factor + battery_factor + random_factor)

# Helper function to generate tags
def generate_tags(brand, model, color, storage, price_tier, features):
    tags = [brand, model, color, storage, price_tier]
    if features.get("5G_Compatible", False):
        tags.append("5G")
    if "water resistant" in features.get("Water_Resistant", "").lower():
        tags.append("waterproof")
    if features.get("Fast_Charging", False):
        tags.append("fast charging")
    
    return ", ".join(tags)

# Process the CSV
def enhance_catalog():
    records = []
    
    with open(INPUT_PATH, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        headers = reader.fieldnames + [
            "Brand", "Model", "Rating", "Review_Count", "Camera_MP", 
            "Battery_mAh", "Weight_g", "Dimensions", "OS", "Processor",
            "RAM", "Water_Resistant", "Wireless_Charging", "Fast_Charging",
            "5G_Compatible", "Category", "Tags", "Discount_Percentage",
            "Original_Price", "Shipping_Weight", "Availability", "Warranty"
        ]
        
        for row in reader:
            # Extract base information
            base_id = row['Base_ID']
            price = float(row['Price'])
            release_year = row['Release Year']
            storage = row['Storage']
            screen_size = row['Screen Size']
            color = row['Color']
            price_tier = get_price_tier(price)
            
            # Get brand and model information
            brand_info = BRAND_MODEL_MAP.get(base_id, {"brand": "Generic", "model": "Smartphone"})
            brand = brand_info["brand"]
            model = brand_info["model"]
            
            # Generate enhanced fields
            rating = generate_rating(price_tier, release_year)
            review_count = random.randint(10, 1000) if rating > 4.0 else random.randint(5, 200)
            
            # Camera details
            main_camera = random.choice(CAMERA_OPTIONS[price_tier]["main"])
            front_camera = random.choice(CAMERA_OPTIONS[price_tier]["front"])
            camera_mp = f"{main_camera}MP main, {front_camera}MP front"
            
            # Battery and physical specs
            battery_mah = random.choice(BATTERY_OPTIONS.get(screen_size.replace('"', ''), [4000, 4500]))
            dimensions = generate_dimensions(screen_size)
            weight_g = generate_weight(screen_size, battery_mah)
            
            # Technical specs
            os_version = random.choice(OS_OPTIONS.get(brand, ["Android 11", "Android 12"]))
            processor = random.choice(PROCESSOR_OPTIONS[price_tier])
            ram_gb = random.choice(RAM_OPTIONS.get(storage, [6, 8]))
            
            # Features
            is_water_resistant = random.choice([True, False]) if price_tier in ["mid", "premium"] else False
            water_resistant = f"IP{random.choice(['67', '68'])}" if is_water_resistant else "No"
            
            wireless_charging = "Yes" if price_tier == "premium" or (price_tier == "mid" and random.random() > 0.5) else "No"
            fast_charging = "Yes" if price_tier in ["mid", "premium"] or random.random() > 0.7 else "No"
            is_5g = "Yes" if int(release_year) >= 2021 or (int(release_year) == 2020 and price_tier == "premium") else "No"
            
            # Category and marketing
            category = random.choice(CATEGORY_OPTIONS)
            if brand == "Apple":
                category = "Electronics > Smartphones > iOS Phones"
            
            features = {
                "Water_Resistant": water_resistant,
                "Wireless_Charging": wireless_charging == "Yes",
                "Fast_Charging": fast_charging == "Yes",
                "5G_Compatible": is_5g == "Yes"
            }
            
            tags = generate_tags(brand, model, color, storage, price_tier, features)
            
            # Pricing and availability
            has_discount = random.random() > 0.7
            discount_percentage = round(random.uniform(5, 25), 1) if has_discount else 0
            original_price = price / (1 - discount_percentage/100) if has_discount else price
            original_price = round(original_price, 2)
            
            stock = int(row['Stock'])
            availability = "In Stock" if stock > 10 else ("Low Stock" if stock > 0 else "Out of Stock")
            
            shipping_weight = weight_g + random.randint(50, 150)  # packaging adds weight
            warranty = f"{random.choice([1, 2])} Year Limited Warranty"
            
            # Create enhanced record
            enhanced_row = dict(row)
            enhanced_row.update({
                "Brand": brand,
                "Model": model,
                "Rating": rating,
                "Review_Count": review_count,
                "Camera_MP": camera_mp,
                "Battery_mAh": battery_mah,
                "Weight_g": weight_g,
                "Dimensions": dimensions,
                "OS": os_version,
                "Processor": processor,
                "RAM": f"{ram_gb}GB",
                "Water_Resistant": water_resistant,
                "Wireless_Charging": wireless_charging,
                "Fast_Charging": fast_charging,
                "5G_Compatible": is_5g,
                "Category": category,
                "Tags": tags,
                "Discount_Percentage": discount_percentage,
                "Original_Price": original_price if has_discount else "",
                "Shipping_Weight": f"{shipping_weight}g",
                "Availability": availability,
                "Warranty": warranty
            })
            
            records.append(enhanced_row)
    
    # Write enhanced records to output CSV
    with open(OUTPUT_PATH, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers)
        writer.writeheader()
        writer.writerows(records)
    
    print(f"Enhanced catalog created with {len(records)} products.")
    print(f"Output saved to: {OUTPUT_PATH}")

if __name__ == "__main__":
    enhance_catalog()
