# OpenSearch Catalog and Store Loader

This project sets up an OpenSearch instance with Dashboards and loads cell phone catalog and store location datasets into it.

## Prerequisites

- Docker
- Docker Compose
- curl
- Python 3

## Project Structure

- `docker-compose.yml`: Configuration for OpenSearch and OpenSearch Dashboards containers
- `start.sh`: Script to start the OpenSearch services
- `load-data.sh`: Script to process and load catalog data into OpenSearch
- `load-stores.sh`: Script to process and load store location data into OpenSearch
- `cell_phone_catalog_expanded.csv`: Source data file for catalog
- `fictional_stores.csv`: Source data file for store locations

## Getting Started

### 1. Start OpenSearch and OpenSearch Dashboards

Run the following command to start the OpenSearch containers:

```bash
./start.sh
```

This will:
- Start an OpenSearch container
- Start an OpenSearch Dashboards container
- Configure them with appropriate settings
- Disable security for easy local development
- Mount the data volume

### 2. Load Catalog Data

After OpenSearch has started, load the cell phone catalog data:

```bash
./load-data.sh
```

This will:
- Wait for OpenSearch to become available
- Create a "catalog" index with appropriate mappings
- Process the CSV data file
- Convert the data to NDJSON format for OpenSearch's bulk API
- Load the data into OpenSearch
- Verify the document count

### 3. Load Store Data

Load the store location data:

```bash
./load-stores.sh
```

This will:
- Create a "stores" index with appropriate mappings
- Process the CSV data file
- Convert the data to NDJSON format for OpenSearch's bulk API
- Load the data into OpenSearch
- Verify the document count

## Accessing OpenSearch Dashboards

OpenSearch Dashboards provides a user-friendly interface for:
- Visualizing your data
- Creating dashboards
- Running ad-hoc queries
- Monitoring cluster health

Access OpenSearch Dashboards at:
```
http://localhost:5601/
```

### Setting up Index Patterns in Dashboards

1. Navigate to OpenSearch Dashboards at http://localhost:5601/
2. Go to Stack Management > Index Patterns
3. Click "Create index pattern"
4. Enter "catalog" or "stores" as the index pattern name
5. Select a time field (if available) or skip this step
6. Click "Create index pattern"

Once created, you can explore your data using Discover, Visualize, and Dashboard features.

## Data Schemas

### Catalog Index

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

### Stores Index

The stores index uses the following field mappings:

```json
{
  "Store_Number": { "type": "keyword" },
  "Store_Name": { "type": "text" },
  "Address": { "type": "text" },
  "City": { "type": "keyword" },
  "State": { "type": "keyword" },
  "ZIP_Code": { "type": "keyword" },
  "Phone_Number": { "type": "keyword" }
}
```

## Querying Data

Once the data is loaded, you can query it using OpenSearch's REST API.

### Catalog Queries

Here are some example queries for the catalog:

#### 1. Search All Documents
```bash
curl -X GET "http://localhost:9200/catalog/_search" -H "Content-Type: application/json" -d'{
  "query": {
    "match_all": {}
  }
}'
```

#### 2. Search by Title (Full-Text Search)
```bash
curl -X GET "http://localhost:9200/catalog/_search" -H "Content-Type: application/json" -d'{
  "query": {
    "match": {
      "Title": "XenoPhone"
    }
  }
}'
```

#### 3. Filter by Color (Exact Match)
```bash
curl -X GET "http://localhost:9200/catalog/_search" -H "Content-Type: application/json" -d'{
  "query": {
    "term": {
      "Color": "Black"
    }
  }
}'
```

#### 4. Price Range Query
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

### Store Queries

Here are some example queries for the stores:

#### 1. Search All Stores
```bash
curl -X GET "http://localhost:9200/stores/_search" -H "Content-Type: application/json" -d'{
  "query": {
    "match_all": {}
  }
}'
```

#### 2. Search by State (Exact Match)
```bash
curl -X GET "http://localhost:9200/stores/_search" -H "Content-Type: application/json" -d'{
  "query": {
    "term": {
      "State": "CA"
    }
  }
}'
```

#### 3. Search by City (Full-Text Search)
```bash
curl -X GET "http://localhost:9200/stores/_search" -H "Content-Type: application/json" -d'{
  "query": {
    "match": {
      "City": "New York"
    }
  }
}'
```

#### 4. Combined Query (City + State)
```bash
curl -X GET "http://localhost:9200/stores/_search" -H "Content-Type: application/json" -d'{
  "query": {
    "bool": {
      "must": [
        { "match": { "City": "Seattle" } }
      ],
      "filter": [
        { "term": { "State": "WA" } }
      ]
    }
  }
}'
```

## Stopping the Service

To stop the OpenSearch containers:

```bash
docker-compose down
```

To completely remove the data volumes as well:

```bash
docker-compose down -v
```
