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

## Querying Data

Once the data is loaded, you can query it using OpenSearch's REST API:

- Basic search: `http://localhost:9200/catalog/_search?q=*`
- Field search: `http://localhost:9200/catalog/_search?q=Brand:Apple`
- Advanced search using JSON:
  ```
  curl -X GET "http://localhost:9200/catalog/_search" -H "Content-Type: application/json" -d'
  {
    "query": {
      "match": {
        "Brand": "Samsung"
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
```
