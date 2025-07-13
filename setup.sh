#!/bin/bash

# Exit on any error
set -e

# Navigate to the project root directory
cd "$(dirname "$0")"

echo "🚀 Starting Chat in a Box setup..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Please create one based on env_sample first."
    echo "You can copy env_sample to .env and update the values:"
    echo "cp env_sample .env"
    exit 1
fi

# Validate required environment variables exist in .env
echo "✅ Checking .env file for required PostgreSQL variables..."
if ! grep -q "POSTGRES_PASSWORD=" .env || ! grep -q "POSTGRES_USER=" .env || ! grep -q "POSTGRES_DB=" .env; then
    echo "❌ Missing required PostgreSQL environment variables in .env file"
    echo "Please ensure POSTGRES_PASSWORD, POSTGRES_USER, and POSTGRES_DB are set"
    exit 1
fi

# Create and activate virtual environment
echo "🐍 Setting up Python virtual environment..."
if [ ! -d ".venv" ]; then
    python3.11 -m venv .venv
fi
source .venv/bin/activate

# Install requirements
if [ -f "requirements.txt" ]; then
    echo "📦 Installing Python requirements..."
    pip install -r requirements.txt
else
    echo "⚠️  requirements.txt not found, skipping Python installation."
fi

# Clean up any existing containers and volumes to start fresh
echo "🧹 Cleaning up existing Docker containers and volumes..."
docker compose down 2>/dev/null || true
docker volume prune -f 2>/dev/null || true

# Run docker compose
echo "🐳 Starting Docker containers..."
docker compose up --build -d

# Wait for PostgreSQL container to be ready with timeout
echo "⏳ Waiting for PostgreSQL to be ready..."
TIMEOUT=60
COUNTER=0
until docker compose exec postgres pg_isready -h localhost &>/dev/null; do
    if [ $COUNTER -ge $TIMEOUT ]; then
        echo "❌ PostgreSQL failed to start within $TIMEOUT seconds"
        echo "Checking container logs:"
        docker logs postgres --tail 20
        exit 1
    fi
    echo "Waiting for PostgreSQL... ($COUNTER/$TIMEOUT)"
    sleep 2
    ((COUNTER++))
done

echo "✅ PostgreSQL is ready!"

# Verify database connection with correct user
echo "🔐 Verifying database connection..."
if ! docker compose exec postgres psql -U "$(grep POSTGRES_USER .env | cut -d'=' -f2 | tr -d '"')" -d "$(grep POSTGRES_DB .env | cut -d'=' -f2 | tr -d '"')" -c "\q" &>/dev/null; then
    echo "❌ Failed to connect to PostgreSQL with configured credentials"
    echo "Checking container logs:"
    docker logs postgres --tail 20
    exit 1
fi

echo "✅ Database connection verified!"

# Install Node.js dependencies if package.json exists
if [ -f "package.json" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

# Run Prisma DB Push
echo "🗃️  Setting up database schema with Prisma..."
npx prisma db push

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

echo "🎉 Setup completed successfully!"
echo ""
echo "Your services are now running:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Tika: localhost:9998"
echo ""
echo "To start your Next.js application, run:"
echo "  npm run dev"
echo ""
echo "To stop the services, run:"
echo "  docker compose down"
