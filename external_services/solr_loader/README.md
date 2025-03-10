# Solr CSV Data Loader

A streamlined project for loading CSV data into Apache Solr 9.8.0 using Docker.

## Project Structure

- `configsets/catalog/conf/` - Solr configuration files
  - `schema.xml` - Schema definition for the catalog collection
  - `solrconfig.xml` - Solr configuration for the catalog collection
  - `stopwords.txt` - List of stopwords for text analysis
- `docker-compose.yml` - Docker Compose configuration
- `start.sh` - Script to start Solr container
- `load-data.sh` - Script to load CSV data into Solr
- `cell_phone_catalog_expanded.csv` - Sample dataset

## Quick Start

1. Start Solr:
```bash
./start.sh
```

2. Load data into Solr:
```bash
./load-data.sh
```

3. Access Solr Admin UI:
```
http://localhost:8983/solr/
```

## Query Examples

Basic query for all documents:
```
http://localhost:8983/solr/catalog/select?q=*:*
```

Query for specific phone color:
```
http://localhost:8983/solr/catalog/select?q=Color:Black
```

Query with field filtering:
```
http://localhost:8983/solr/catalog/select?q=*:*&fl=id,Title,Price
```

Full-text search in description:
```
http://localhost:8983/solr/catalog/select?q=Description:professional
```

Faceted search by color:
```
http://localhost:8983/solr/catalog/select?q=*:*&facet=true&facet.field=Color
```

## Using the Solr Admin UI

The Solr Admin UI provides a graphical interface for:

1. **Query Builder**: Build and test queries through the web interface
   - Access at: http://localhost:8983/solr/#/catalog/query

2. **Schema Browser**: Examine the field definitions and analyzers
   - Access at: http://localhost:8983/solr/#/catalog/schema

3. **Analysis Tool**: Test how text is processed by the analyzers
   - Access at: http://localhost:8983/solr/#/catalog/analysis

## Configuration Details

This project uses a precreated Solr collection with a custom schema configured for the provided CSV data. The schema includes fields for:

- SKU_ID
- Base_ID
- Title
- Price
- Description
- Stock
- Release_Year
- Storage
- Screen_Size
- Color

## Cleanup

To stop and remove all containers and volumes:
```bash
docker-compose down -v
