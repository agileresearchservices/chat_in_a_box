#!/bin/bash
set -e

echo "=== Solr Data Loading Tool ==="

# Wait for Solr to be available
echo "Waiting for Solr to start..."
until $(curl --output /dev/null --silent --head --fail http://localhost:8983/solr/admin/info/system); do
  printf '.'
  sleep 2
done
echo "✓ Solr is up and running!"

# Wait for catalog collection to be available
echo "Waiting for catalog collection to be available..."
until $(curl --output /dev/null --silent --head --fail http://localhost:8983/solr/catalog/admin/ping); do
  printf '.'
  sleep 2
done
echo "✓ Collection 'catalog' is available!"

# Process and load CSV data
echo "Processing and loading data from CSV..."
echo "  - Creating a cleaned CSV file with proper field names"

# Clean up any previous attempts
rm -f cleaned_catalog.csv

# Process the CSV file with AWK to:
# 1. Add an 'id' field (required by Solr)
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

# Load data into Solr
echo "  - Loading data into Solr..."
RESPONSE=$(curl -s -X POST -H 'Content-type:application/csv' --data-binary @cleaned_catalog.csv \
  "http://localhost:8983/solr/catalog/update/csv?commit=true&f.Title.split=false&f.Description.split=false")

# Check if the loading was successful
if [[ $RESPONSE == *"status\":0"* ]]; then
  echo "✓ Data loading successful!"
else
  echo "✗ Error loading data:"
  echo "$RESPONSE"
  exit 1
fi

# Verify document count
echo "Verifying document count..."
COUNT=$(curl -s 'http://localhost:8983/solr/catalog/select?q=*:*&rows=0' | grep -o '"numFound":[0-9]*' | cut -d':' -f2)

if [ -z "$COUNT" ]; then
  echo "✗ Could not retrieve document count"
  exit 1
elif [ "$COUNT" -eq 0 ]; then
  echo "✗ No documents were loaded"
  exit 1
else
  echo "✓ Successfully loaded $COUNT documents"
fi

echo "=== Setup Complete ==="
echo "Solr catalog collection is ready for use!"
echo "Access the Solr Admin UI at: http://localhost:8983/solr/"
echo "Query example: http://localhost:8983/solr/catalog/select?q=*:*"
echo ""
