#!/bin/bash
set -e

echo "=== Solr Catalog Startup ==="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "✗ Docker is not running. Please start Docker and try again."
  exit 1
fi

echo "Starting Solr container..."
docker-compose down -v > /dev/null 2>&1 || true
docker-compose up -d

echo "Waiting for Solr to initialize..."
sleep 5

# Check container status
CONTAINER_STATUS=$(docker-compose ps -q solr)
if [ -z "$CONTAINER_STATUS" ]; then
  echo "✗ Failed to start Solr container"
  exit 1
fi

echo "✓ Solr container started successfully"
echo ""
echo "To load data, run:"
echo "  ./load-data.sh"
echo ""
echo "To access Solr Admin UI:"
echo "  http://localhost:8983/solr/"
echo ""
echo "To stop Solr:"
echo "  docker-compose down"
echo ""
