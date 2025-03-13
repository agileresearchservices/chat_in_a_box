#!/bin/bash
set -e

echo "=== OpenSearch Enhanced Data Loading Tool ==="

# Wait for OpenSearch to be available
echo "Waiting for OpenSearch to start..."
until $(curl --output /dev/null --silent --head --fail http://localhost:9200); do
  printf '.'
  sleep 2
done
echo "✓ OpenSearch is up and running!"

# Create index with mappings including all new fields
echo "Setting up enhanced catalog index..."
curl -X DELETE http://localhost:9200/catalog 2>/dev/null || true
sleep 2
curl -X PUT "http://localhost:9200/catalog" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "analysis": {
      "analyzer": {
        "tag_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "trim"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "SKU_ID": { "type": "keyword" },
      "Base_ID": { "type": "keyword" },
      "Title": { "type": "text" },
      "Price": { "type": "float" },
      "Description": { "type": "text" },
      "Stock": { "type": "integer" },
      "Release_Year": { "type": "integer" },
      "Storage": { "type": "keyword" },
      "Screen_Size": { "type": "float" },
      "Color": { "type": "keyword" },
      
      "Brand": { "type": "keyword" },
      "Model": { "type": "keyword" },
      "Rating": { "type": "float" },
      "Review_Count": { "type": "integer" },
      "Camera_MP": { "type": "text" },
      "Battery_mAh": { "type": "integer" },
      "Weight_g": { "type": "integer" },
      "Dimensions": { "type": "text" },
      "OS": { "type": "keyword" },
      "Processor": { "type": "keyword" },
      "RAM": { "type": "keyword" },
      "Water_Resistant": { "type": "keyword" },
      "Wireless_Charging": { "type": "keyword" },
      "Fast_Charging": { "type": "keyword" },
      "5G_Compatible": { "type": "keyword" },
      "Category": { "type": "keyword", "fields": { "text": { "type": "text" } } },
      "Tags": { "type": "text", "analyzer": "tag_analyzer" },
      "Discount_Percentage": { "type": "float" },
      "Original_Price": { "type": "float" },
      "Shipping_Weight": { "type": "text" },
      "Availability": { "type": "keyword" },
      "Warranty": { "type": "text" }
    }
  }
}'
echo ""
echo "✓ Enhanced catalog index created"

# Process and load CSV data
echo "Processing and loading enhanced data from CSV..."
echo "  - Creating a cleaned CSV file with proper field names"

# Clean up any previous attempts
rm -f cleaned_catalog.csv
rm -f bulk_data.ndjson

# Process the CSV file with AWK to:
# 1. Add an id field 
# 2. Fix field names with spaces to use underscores
awk -F, 'NR==1 {
  gsub(/"/, "", $0);
  # Replace spaces with underscores in header
  gsub("Release Year", "Release_Year", $0);
  gsub("Screen Size", "Screen_Size", $0);
  print "id," $0
} 
NR>1 {
  SKU_ID = $1;
  gsub(/[^0-9]/, "", SKU_ID);
  print SKU_ID "," $0
}' cell_phone_catalog_enhanced.csv > cleaned_catalog.csv

echo "✓ CSV processing complete"

# Convert CSV to NDJSON for OpenSearch bulk API
echo "  - Converting CSV to NDJSON format..."

python3 -c '
import csv
import json
import sys
import re

def extract_number(value, default=0):
    """Extract number from a string, handling units like g, mm, etc."""
    if not value or not isinstance(value, str):
        return default
    
    # Extract numeric part from strings like "150g", "5.5mm", etc.
    match = re.search(r"(\d+(?:\.\d+)?)", value)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return default
    return default

with open("cleaned_catalog.csv", "r") as f:
    reader = csv.DictReader(f)
    with open("bulk_data.ndjson", "w") as out:
        for row in reader:
            # Create the action line for bulk API
            action = {"index": {"_index": "catalog", "_id": row["id"]}}
            out.write(json.dumps(action) + "\n")
            
            # Convert numeric fields (original fields)
            if "Price" in row and row["Price"].strip():
                try:
                    row["Price"] = float(row["Price"])
                except ValueError:
                    row["Price"] = 0
            
            if "Release_Year" in row and row["Release_Year"].strip():
                try:
                    row["Release_Year"] = int(row["Release_Year"])
                except ValueError:
                    row["Release_Year"] = 0
            
            if "Screen_Size" in row and row["Screen_Size"].strip():
                # Extract numeric part from screen size (e.g. 6.1")
                match = re.search(r"(\d+(?:\.\d+)?)", row["Screen_Size"])
                if match:
                    try:
                        row["Screen_Size"] = float(match.group(1))
                    except ValueError:
                        row["Screen_Size"] = 0
                else:
                    row["Screen_Size"] = 0
                
            if "Stock" in row and row["Stock"].strip():
                try:
                    row["Stock"] = int(row["Stock"])
                except ValueError:
                    row["Stock"] = 0
            
            # Convert numeric fields for new enhanced fields
            if "Rating" in row and row["Rating"].strip():
                try:
                    row["Rating"] = float(row["Rating"])
                except ValueError:
                    row["Rating"] = 0
            
            if "Review_Count" in row and row["Review_Count"].strip():
                try:
                    row["Review_Count"] = int(row["Review_Count"])
                except ValueError:
                    row["Review_Count"] = 0
            
            if "Battery_mAh" in row and row["Battery_mAh"].strip():
                try:
                    row["Battery_mAh"] = int(row["Battery_mAh"])
                except ValueError:
                    row["Battery_mAh"] = 0
            
            if "Weight_g" in row and row["Weight_g"].strip():
                try:
                    row["Weight_g"] = int(row["Weight_g"])
                except ValueError:
                    row["Weight_g"] = 0
            
            if "Discount_Percentage" in row and row["Discount_Percentage"].strip():
                try:
                    row["Discount_Percentage"] = float(row["Discount_Percentage"])
                except ValueError:
                    row["Discount_Percentage"] = 0
            
            if "Original_Price" in row and row["Original_Price"].strip():
                try:
                    row["Original_Price"] = float(row["Original_Price"])
                except ValueError:
                    row["Original_Price"] = 0
            else:
                row["Original_Price"] = row["Price"]  # Default to current price if no original price
                
            # Handle any null values
            for key in row:
                if not row[key]:
                    if key in ["Price", "Release_Year", "Screen_Size", "Rating", 
                              "Discount_Percentage", "Original_Price"]:
                        row[key] = 0
                    elif key in ["Review_Count", "Battery_mAh", "Weight_g", "Stock"]:
                        row[key] = 0
                    else:
                        row[key] = ""
            
            # Print the document
            out.write(json.dumps(row) + "\n")
'

echo "✓ NDJSON conversion complete"

# Load data into OpenSearch
echo "  - Loading data into OpenSearch..."

# Using curl with detailed error handling
RESPONSE=$(curl -s -X POST "http://localhost:9200/_bulk?pretty" \
  -H "Content-Type: application/x-ndjson" \
  --data-binary @bulk_data.ndjson)

# Save response for debugging
echo "$RESPONSE" > bulk_response.json

# Check if the loading was successful by parsing the JSON response
if echo "$RESPONSE" | python3 -c '
import json
import sys
try:
    response = json.load(sys.stdin)
    if not response.get("errors", True):  # Default to True if errors field not found
        sys.exit(0)
    else:
        sys.exit(1)
except Exception as e:
    sys.exit(1)
'; then
    echo "✓ Data loading successful!"
else
    echo "✗ Error loading data:"
    echo "Check bulk_response.json for details"
    exit 1
fi

# Verify document count
echo "Verifying document count..."
sleep 2  # Give OpenSearch a moment to refresh
curl -X POST "http://localhost:9200/catalog/_refresh" > /dev/null
COUNT_RESPONSE=$(curl -s 'http://localhost:9200/catalog/_count')
COUNT=$(echo "$COUNT_RESPONSE" | python3 -c '
import json
import sys
try:
    response = json.load(sys.stdin)
    print(response.get("count", 0))
except:
    print(0)
')

if [ -z "$COUNT" ] || [ "$COUNT" -eq 0 ]; then
    echo "✗ No documents were loaded"
    exit 1
else
    echo "✓ Successfully loaded $COUNT documents"
fi

echo "=== Setup Complete ==="
echo "OpenSearch enhanced catalog index is ready for use!"
echo "Access OpenSearch at: http://localhost:9200/"
echo ""
echo "Example queries:"
echo "1. Search all documents:"
echo "   curl -X GET \"http://localhost:9200/catalog/_search\" -H \"Content-Type: application/json\" -d'{\"query\": {\"match_all\": {}}}'"
echo ""
echo "2. Search by brand:"
echo "   curl -X GET \"http://localhost:9200/catalog/_search\" -H \"Content-Type: application/json\" -d'{\"query\": {\"match\": {\"Brand\": \"XenoPhone\"}}}'"
echo ""
echo "3. Filter by features:"
echo "   curl -X GET \"http://localhost:9200/catalog/_search\" -H \"Content-Type: application/json\" -d'{\"query\": {\"bool\": {\"must\": [{\"term\": {\"Wireless_Charging\": \"Yes\"}}]}}}'"
echo ""
echo "4. Search by price range:"
echo "   curl -X GET \"http://localhost:9200/catalog/_search\" -H \"Content-Type: application/json\" -d'{\"query\": {\"range\": {\"Price\": {\"gte\": 500, \"lte\": 800}}}}'"
echo ""
echo "5. Search by tags:"
echo "   curl -X GET \"http://localhost:9200/catalog/_search\" -H \"Content-Type: application/json\" -d'{\"query\": {\"match\": {\"Tags\": \"waterproof\"}}}'"
echo ""
