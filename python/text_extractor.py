import os
import magic
from docx import Document
from pathlib import Path
from typing import List, Dict, Generator, Optional
from tqdm import tqdm
import psycopg2
import hashlib
from dotenv import load_dotenv
import requests
from requests.adapters import HTTPAdapter
import concurrent.futures

load_dotenv()

class TextExtractor:
    """A component for extracting text from various file types in a directory."""
    
    def __init__(self, supported_extensions: List[str] = None):
        self.supported_extensions = supported_extensions or ['.txt', '.pdf', '.docx']
        self.mime = magic.Magic(mime=True)
        self.db_connection = None
        self.session = requests.Session()
        self.session.mount("http://", HTTPAdapter(pool_connections=100, pool_maxsize=100))
    
    def extract_with_tika(self, file_path: str) -> str:
        """Extract text using Apache Tika."""
        with open(file_path, 'rb') as f:
            response = self.session.put(
                "http://localhost:9998/tika",
                headers={"Accept": "text/plain"},
                data=f,
                timeout=60
            )
            response.raise_for_status()
            return response.text
    
    def extract_text(self, file_path: str) -> Dict[str, str]:
        """Extract text from a single file using Apache Tika."""
        file_path = str(file_path)
        try:
            content = self.extract_with_tika(file_path)
        except Exception as e:
            return {"error": f"Error processing {file_path}: {str(e)}"}
        return {"content": content, "file_path": file_path, "file_type": "tika"}
    
    def process_directory(self, directory_path: str) -> Generator[Dict[str, str], None, None]:
        """Process all supported files in a directory."""
        directory = Path(directory_path)
        if not directory.exists():
            raise ValueError(f"Directory not found: {directory_path}")
        
        files = [
            f for f in directory.rglob("*")
            if f.is_file() and f.stat().st_size > 0 and not any(part.startswith('.') for part in f.parts) and not f.name.endswith('.log')
        ]
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=32) as executor:
            futures = {executor.submit(self.extract_text, str(f)): f for f in files}
            for future in tqdm(concurrent.futures.as_completed(futures), total=len(futures), desc="Extracting files"):
                yield future.result()

    def embed_text(self, text: str) -> Optional[List[float]]:
        """Single-chunk embedding call to Ollama (or any other) endpoint."""
        try:
            response = requests.post(
                "http://localhost:11434/api/embeddings",
                json={
                    "model": "nomic-embed-text",
                    "prompt": text
                },
                timeout=30
            )
            response.raise_for_status()
            return response.json().get("embedding")
        except Exception as e:
            print(f"Error generating embedding: {e}")
            return None

    def process_text_content(self, text: str, file_path: str, file_type: str) -> List[Dict]:
        """
        Process text content by chunking it, embedding each chunk with a progress bar,
        and inserting the results into the database.
        """
        chunk_size = int(os.getenv('CHUNK_SIZE', '1800'))
        chunk_overlap = int(os.getenv('CHUNK_OVERLAP', '200'))
        chunks = self.chunk_text(text, chunk_size, chunk_overlap)
        
        embedded_chunks = [None] * len(chunks)
        with concurrent.futures.ThreadPoolExecutor(max_workers=32) as executor:
            futures = {executor.submit(self.embed_text, chunk): idx for idx, chunk in enumerate(chunks)}
            for future in tqdm(concurrent.futures.as_completed(futures), total=len(chunks), desc=f"Embedding {file_path}"):
                idx = futures[future]
                embedded_chunks[idx] = future.result()

        # Prepare batch insert data
        batch_insert_data = []
        for chunk_index, (chunk, embedding) in enumerate(zip(chunks, embedded_chunks)):
            if embedding is None:
                continue
            
            embedding_str = '[' + ','.join(map(str, embedding)) + ']'
            
            parent_id = hashlib.md5(file_path.encode()).hexdigest()
            chunk_id = f"{parent_id}-{chunk_index}"
            
            batch_insert_data.append((chunk_id, file_path, file_type, chunk, embedding_str, parent_id))

        if batch_insert_data:
            try:
                query = """
                INSERT INTO docs (id, source, type, chunk, embedding, parent_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    source = EXCLUDED.source,
                    type = EXCLUDED.type,
                    chunk = EXCLUDED.chunk,
                    embedding = EXCLUDED.embedding,
                    parent_id = EXCLUDED.parent_id
                """
                with self.db_connection.cursor() as cursor:
                    cursor.executemany(query, batch_insert_data)
                    self.db_connection.commit()

                # Return the inserted data as a pseudo-result
                return [
                    {
                        'id': data[0], 
                        'source': data[1], 
                        'type': data[2], 
                        'chunk': data[3], 
                        'embedding': data[4], 
                        'parent_id': data[5]
                    } 
                    for data in batch_insert_data
                ]
            except Exception as db_error:
                print('Error inserting/updating documents into database:', db_error)
                self.db_connection.rollback()
        
        return []

    def chunk_text(self, text: str, max_length: int, overlap: int) -> List[str]:
        """Chunk text into smaller parts with overlap."""
        if max_length <= overlap:
            raise ValueError("CHUNK_SIZE must be larger than CHUNK_OVERLAP.")

        chunks = []
        start = 0
        while start < len(text):
            end = start + max_length
            chunks.append(text[start:end])
            start += (max_length - overlap)
        return chunks

    def connect_to_db(self):
        """Connect to the PostgreSQL database using credentials from .env."""
        self.db_connection = psycopg2.connect(dsn=os.getenv('DATABASE_URL'))
        print('Connected to the database.')

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Process some files.')
    parser.add_argument('--directory', type=str, default='data',
                        help='Directory to process files from (default: data)')
    args = parser.parse_args()
    
    extractor = TextExtractor()
    extractor.connect_to_db()
    
    # Step 1: Extract text from files (progress bar on # of files)
    results = list(extractor.process_directory(args.directory))

    # Step 2: For each file's text, chunk and embed (progress bar on chunks)
    for result in results:
        if 'error' not in result:
            extractor.process_text_content(
                text=result['content'], 
                file_path=result['file_path'], 
                file_type=result['file_type']
            )

    extractor.db_connection.close()
    print('Database connection closed.')