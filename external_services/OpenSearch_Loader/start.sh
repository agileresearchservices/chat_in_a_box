#!/bin/bash
set -e

echo "=== OpenSearch Catalog Startup ==="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "✗ Docker is not running. Please start Docker and try again."
  exit 1
fi

echo "Starting OpenSearch container..."
docker-compose down -v > /dev/null 2>&1 || true
docker-compose up -d

echo "Waiting for OpenSearch to initialize..."
sleep 10

# Check container status
CONTAINER_STATUS=$(docker-compose ps -q opensearch)
if [ -z "$CONTAINER_STATUS" ]; then
  echo "✗ Failed to start OpenSearch container"
  exit 1
fi

echo "✓ OpenSearch container started successfully"
echo ""
echo "To load data, run:"
echo "  ./load-data.sh"
echo ""
echo "To access OpenSearch:"
echo "  http://localhost:9200/"
echo ""
echo "To stop OpenSearch:"
echo "  docker-compose down"
echo ""
