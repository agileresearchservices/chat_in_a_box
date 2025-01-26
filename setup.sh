#!/bin/bash

# Navigate to the project root directory
cd "$(dirname "$0")"

# Run docker compose
docker compose up --build -d

# Wait for docker container to be ready
docker compose exec postgres bash -c 'until pg_isready -h localhost; do echo "Waiting for PostgreSQL..."; sleep 2; done'

# Run Prisma DB Push
npx prisma db push

