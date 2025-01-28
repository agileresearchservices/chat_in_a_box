import os
import magic
import PyPDF2
from docx import Document
from pathlib import Path
from typing import List, Dict, Generator, Optional
from tqdm import tqdm
import psycopg2
import hashlib
from dotenv import load_dotenv
import requests

load_dotenv()

class TextExtractor:
    """A component for extracting text from various file types in a directory."""
    
    def __init__(self, supported_extensions: List[str] = None):
        self.supported_extensions = supported_extensions or ['.txt', '.pdf', '.docx']
        self.mime = magic.Magic(mime=True)
        self.db_connection = None
    
    def get_file_type(self, file_path: str) -> str:
        """Determine file type using python-magic."""
        return self.mime.from_file(file_path)
    
    def extract_from_txt(self, file_path: str) -> str:
        """Extract text from a plain text file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def extract_from_pdf(self, file_path: str) -> str:
        """Extract text from a PDF file."""
        text = []
        with open(file_path, 'rb') as f:
            pdf_reader = PyPDF2.PdfReader(f)
            for page in pdf_reader.pages:
                text.append(page.extract_text())
        return '\n'.join(text)
    
    def extract_from_docx(self, file_path: str) -> str:
        """Extract text from a Word document."""
        doc = Document(file_path)
        return '\n'.join([paragraph.text for paragraph in doc.paragraphs])
    
    def extract_text(self, file_path: str) -> Dict[str, str]:
        """Extract text from a single file."""
        file_path = str(file_path)
        file_type = self.get_file_type(file_path)
        extension = Path(file_path).suffix.lower()
        
        if extension not in self.supported_extensions:
            return {"error": f"Unsupported file type: {extension}"}
        
        try:
            if file_type.startswith('text/'):
                content = self.extract_from_txt(file_path)
            elif file_type == 'application/pdf':
                content = self.extract_from_pdf(file_path)
            elif file_type.startswith('application/vnd.openxmlformats-officedocument.wordprocessingml'):
                content = self.extract_from_docx(file_path)
            else:
                return {"error": f"Unsupported MIME type: {file_type}"}
            
            return {
                "content": content,
                "file_path": file_path,
                "file_type": file_type
            }
        except Exception as e:
            return {"error": f"Error processing {file_path}: {str(e)}"}
    
    def process_directory(self, directory_path: str) -> Generator[Dict[str, str], None, None]:
        """Process all supported files in a directory."""
        directory = Path(directory_path)
        if not directory.exists():
            raise ValueError(f"Directory not found: {directory_path}")
        
        files = [
            f for f in directory.rglob("*")
            if f.is_file() and f.suffix.lower() in self.supported_extensions
        ]
        
        for file_path in tqdm(files, desc="Processing files"):
            yield self.extract_text(str(file_path))

    def embed_text(self, text: str) -> Optional[List[float]]:
        """Single-chunk embedding call to Ollama (or any other) endpoint."""
        try:
            # Adjust the endpoint, model, and JSON payload to match your environment
            response = requests.post(
                "http://localhost:11434/api/embeddings",
                json={
                    "model": "nomic-embed-text",  # Example model
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
        
        embedded_chunks = []
        
        # Show a progress bar for each chunk so you know it's embedding
        for chunk in tqdm(chunks, desc=f"Embedding {file_path}"):
            embedding = self.embed_text(chunk)
            embedded_chunks.append(embedding)
        
        # Prepare batch insert data
        batch_insert_data = []
        for chunk_index, (chunk, embedding) in enumerate(zip(chunks, embedded_chunks)):
            if embedding is None:
                continue
            
            # Convert embedding array to a Postgres array literal, e.g. [0.123,0.456,...]
            embedding_str = '[' + ','.join(map(str, embedding)) + ']'
            
            # Generate MD5 hash with chunk index
            parent_id = hashlib.md5(file_path.encode()).hexdigest()
            chunk_id = f"{parent_id}-{chunk_index}"
            
            batch_insert_data.append((chunk_id, file_path, file_type, chunk, embedding_str, parent_id))
        
        # Batch insert into DB
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