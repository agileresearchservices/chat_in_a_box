#!/bin/bash

# Navigate to the project root directory
cd "$(dirname "$0")"

# Create and activate virtual environment
if [ ! -d ".venv" ]; then
    python3.11 -m venv .venv
fi
source .venv/bin/activate

# Install requirements
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    echo "requirements.txt not found, skipping installation."
fi

# Run docker compose
docker compose up --build -d

# Wait for docker container to be ready
docker compose exec postgres bash -c 'until pg_isready -h localhost; do echo "Waiting for PostgreSQL..."; sleep 2; done'

# Run Prisma DB Push
npx prisma db push

# Generate Prisma client
npx prisma generate
