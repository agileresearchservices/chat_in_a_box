#!/bin/bash
# Startup script for the reranker FastAPI service using uvicorn

# Activate virtual environment from the project root
source ../.venv/bin/activate

uvicorn main:app --host 0.0.0.0 --port 8005
