# OpenSearch Catalog Loader

This project sets up an OpenSearch instance and loads a cell phone catalog dataset into it.

## Prerequisites

- Docker
- Docker Compose
- curl
- Python 3

## Project Structure

- `docker-compose.yml`: Configuration for OpenSearch container
- `start.sh`: Script to start the OpenSearch container
- `load-data.sh`: Script to process and load data into OpenSearch
- `cell_phone_catalog_expanded.csv`: Source data file

## Getting Started

### 1. Start OpenSearch

Run the following command to start the OpenSearch container:

```bash
./start.sh
```

This will:
- Start an OpenSearch container
- Configure it with appropriate memory settings
- Disable security for easy local development
- Mount the data volume

### 2. Load Data

After OpenSearch has started, load the cell phone catalog data:

```bash
./load-data.sh
```

This will:
- Wait for OpenSearch to become available
- Create an index with appropriate mappings
- Process the CSV data file
- Convert the data to NDJSON format for OpenSearch's bulk API
- Load the data into OpenSearch
- Verify the document count

## Data Schema

The catalog index uses the following field mappings:

```json
{
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
```

## Querying Data

Once the data is loaded, you can query it using OpenSearch's REST API. Here are some example queries:

### 1. Search All Documents
```bash
curl -X GET "http://localhost:9200/catalog/_search" -H "Content-Type: application/json" -d'{
  "query": {
    "match_all": {}
  }
}'
```

### 2. Search by Title (Full-Text Search)
```bash
curl -X GET "http://localhost:9200/catalog/_search" -H "Content-Type: application/json" -d'{
  "query": {
    "match": {
      "Title": "XenoPhone"
    }
  }
}'
```

### 3. Filter by Color (Exact Match)
```bash
curl -X GET "http://localhost:9200/catalog/_search" -H "Content-Type: application/json" -d'{
  "query": {
    "term": {
      "Color": "Black"
    }
  }
}'
```

### 4. Price Range Query
```bash
curl -X GET "http://localhost:9200/catalog/_search" -H "Content-Type: application/json" -d'{
  "query": {
    "range": {
      "Price": {
        "gte": 500,
        "lte": 1000
      }
    }
  }
}'
```

### 5. Combined Query (Title Search + Color Filter)
```bash
curl -X GET "http://localhost:9200/catalog/_search" -H "Content-Type: application/json" -d'{
  "query": {
    "bool": {
      "must": [
        { "match": { "Title": "XenoPhone" } }
      ],
      "filter": [
        { "term": { "Color": "Black" } }
      ]
    }
  }
}'
```

## Stopping the Service

To stop the OpenSearch container:

```bash
docker-compose down
```

To completely remove the data volumes as well:

```bash
docker-compose down -v
