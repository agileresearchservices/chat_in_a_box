#!/bin/bash
set -e

echo "=== OpenSearch Stores Data Loading Tool ==="

# Wait for OpenSearch to be available
echo "Waiting for OpenSearch to start..."
until $(curl --output /dev/null --silent --head --fail http://localhost:9200); do
  printf '.'
  sleep 2
done
echo "✓ OpenSearch is up and running!"

# Create index with mappings
echo "Setting up stores index..."
curl -X DELETE http://localhost:9200/stores 2>/dev/null || true
sleep 2
curl -X PUT "http://localhost:9200/stores" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "analysis": {
      "analyzer": {
        "lowercase_analyzer": {
          "type": "custom",
          "tokenizer": "keyword",
          "filter": ["lowercase"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "Store_Number": { "type": "keyword" },
      "Store_Name": { "type": "text" },
      "Address": { "type": "text" },
      "City": { 
        "type": "text",
        "fields": {
          "keyword": { "type": "keyword" },
          "lowercase": { 
            "type": "text",
            "analyzer": "lowercase_analyzer"
          }
        }
      },
      "State": { 
        "type": "text",
        "fields": {
          "keyword": { "type": "keyword" },
          "lowercase": { 
            "type": "text",
            "analyzer": "lowercase_analyzer"
          }
        }
      },
      "ZIP_Code": { "type": "keyword" },
      "Phone_Number": { "type": "keyword" }
    }
  }
}'
echo ""
echo "✓ Stores index created"

# Process and load CSV data
echo "Processing and loading data from CSV..."
echo "  - Creating a cleaned CSV file with proper field names"

# Clean up any previous attempts
rm -f cleaned_stores.csv
rm -f stores_bulk_data.ndjson

# Process the CSV file with AWK to:
# 1. Replace spaces with underscores in headers (to match schema)
# 2. Use Store Number as the document ID
awk -F, 'NR==1 {
  gsub(/"/, "", $0);
  # Replace spaces with underscores in header
  gsub("Store Number", "Store_Number", $0);
  gsub("Store Name", "Store_Name", $0);
  gsub("ZIP Code", "ZIP_Code", $0);
  gsub("Phone Number", "Phone_Number", $0);
  print $0
} 
NR>1 {
  print $0
}' fictional_stores.csv > cleaned_stores.csv

echo "✓ CSV processing complete"

# Convert CSV to NDJSON for OpenSearch bulk API
echo "  - Converting CSV to NDJSON format..."

python3 -c '
import csv
import json
import sys

with open("cleaned_stores.csv", "r") as f:
    reader = csv.DictReader(f)
    with open("stores_bulk_data.ndjson", "w") as out:
        for row in reader:
            # Create the action line for bulk API using Store_Number as ID
            action = {"index": {"_index": "stores", "_id": row["Store_Number"]}}
            out.write(json.dumps(action) + "\n")
            
            # Handle any null values
            for key in row:
                if not row[key]:
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
  --data-binary @stores_bulk_data.ndjson)

# Save response for debugging
echo "$RESPONSE" > stores_bulk_response.json

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
    echo "Check stores_bulk_response.json for details"
    exit 1
fi

# Verify document count
echo "Verifying document count..."
sleep 2  # Give OpenSearch a moment to refresh
curl -X POST "http://localhost:9200/stores/_refresh" > /dev/null
COUNT_RESPONSE=$(curl -s 'http://localhost:9200/stores/_count')
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
echo "OpenSearch stores index is ready for use!"
echo "Access OpenSearch at: http://localhost:9200/"
echo ""
echo "Example queries:"
echo "1. Search all stores:"
echo "   curl -X GET \"http://localhost:9200/stores/_search\" -H \"Content-Type: application/json\" -d'{\"query\": {\"match_all\": {}}}'"
echo ""
echo "2. Search by store name:"
echo "   curl -X GET \"http://localhost:9200/stores/_search\" -H \"Content-Type: application/json\" -d'{\"query\": {\"match\": {\"Store_Name\": \"Electronics\"}}}'"
echo ""
echo "3. Filter by state:"
echo "   curl -X GET \"http://localhost:9200/stores/_search\" -H \"Content-Type: application/json\" -d'{\"query\": {\"term\": {\"State\": \"CA\"}}}'"
echo ""
