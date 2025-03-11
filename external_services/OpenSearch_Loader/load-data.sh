#!/bin/bash
set -e

echo "=== OpenSearch Data Loading Tool ==="

# Wait for OpenSearch to be available
echo "Waiting for OpenSearch to start..."
until $(curl --output /dev/null --silent --head --fail http://localhost:9200); do
  printf '.'
  sleep 2
done
echo "✓ OpenSearch is up and running!"

# Create index with mappings
echo "Setting up catalog index..."
curl -X DELETE http://localhost:9200/catalog 2>/dev/null || true
sleep 2
curl -X PUT "http://localhost:9200/catalog" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  },
  "mappings": {
    "properties": {
      "SKU": { "type": "keyword" },
      "SKU_ID": { "type": "keyword" },
      "Base_ID": { "type": "keyword" },
      "Title": { "type": "text" },
      "Price": { "type": "float" },
      "Description": { "type": "text" },
      "Stock": { "type": "keyword" },
      "Release_Year": { "type": "integer" },
      "Storage": { "type": "keyword" },
      "Screen_Size": { "type": "float" },
      "Color": { "type": "keyword" }
    }
  }
}'
echo ""
echo "✓ Catalog index created"

# Process and load CSV data
echo "Processing and loading data from CSV..."
echo "  - Creating a cleaned CSV file with proper field names"

# Clean up any previous attempts
rm -f cleaned_catalog.csv
rm -f bulk_data.ndjson

# Process the CSV file with AWK to:
# 1. Add an id field 
# 2. Fix field names with spaces to use underscores (to match schema)
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
}' cell_phone_catalog_expanded.csv > cleaned_catalog.csv

echo "✓ CSV processing complete"

# Convert CSV to NDJSON for OpenSearch bulk API
echo "  - Converting CSV to NDJSON format..."

python3 -c '
import csv
import json
import sys

with open("cleaned_catalog.csv", "r") as f:
    reader = csv.DictReader(f)
    with open("bulk_data.ndjson", "w") as out:
        for row in reader:
            # Create the action line for bulk API
            action = {"index": {"_index": "catalog", "_id": row["id"]}}
            out.write(json.dumps(action) + "\n")
            
            # Convert numeric fields
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
                try:
                    row["Screen_Size"] = float(row["Screen_Size"])
                except ValueError:
                    row["Screen_Size"] = 0
            
            # Handle any null values
            for key in row:
                if not row[key]:
                    if key in ["Price", "Release_Year", "Screen_Size"]:
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
echo "OpenSearch catalog index is ready for use!"
echo "Access OpenSearch at: http://localhost:9200/"
echo ""
echo "Example queries:"
echo "1. Search all documents:"
echo "   curl -X GET \"http://localhost:9200/catalog/_search\" -H \"Content-Type: application/json\" -d'{\"query\": {\"match_all\": {}}}'"
echo ""
echo "2. Search by title:"
echo "   curl -X GET \"http://localhost:9200/catalog/_search\" -H \"Content-Type: application/json\" -d'{\"query\": {\"match\": {\"Title\": \"XenoPhone\"}}}'"
echo ""
echo "3. Filter by color:"
echo "   curl -X GET \"http://localhost:9200/catalog/_search\" -H \"Content-Type: application/json\" -d'{\"query\": {\"term\": {\"Color\": \"Black\"}}}'"
echo ""
