-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Modify the docs table to use the vector type
ALTER TABLE docs 
ALTER COLUMN embedding TYPE vector USING embedding::vector;
