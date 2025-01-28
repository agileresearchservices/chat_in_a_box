import os
import magic
import PyPDF2
from docx import Document
from pathlib import Path
from typing import List, Dict, Generator
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

    def process_text_content(self, text: str, file_path: str, file_type: str) -> List[Dict]:
        """Process text content into chunks and embed."""
        # Chunker Configuration
        chunk_size = int(os.getenv('CHUNK_SIZE', '1800'))
        chunk_overlap = int(os.getenv('CHUNK_OVERLAP', '200'))
        chunks = self.chunk_text(text, chunk_size, chunk_overlap)
        #print(f"Processing {len(chunks)} chunks...")
        
        results = []
        for chunk_index, chunk in enumerate(chunks):
            try:
                #print('Attempting to embed text:', chunk)
                embedding = self.embed_text(chunk)
                if embedding is None:
                    continue
                #print('Embedding received, length:', len(embedding))
                
                # Convert embedding array to a Postgres array literal
                embedding_str = '[' + ','.join(map(str, embedding)) + ']'
                
                # Insert or update in database
                try:
                    # Generate MD5 hash with chunk index
                    parent_id = hashlib.md5(file_path.encode()).hexdigest()
                    chunk_id = f"{parent_id}-{chunk_index}"
                    
                    query = """
                    INSERT INTO docs (id, source, type, chunk, embedding, parent_id)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        source = EXCLUDED.source,
                        type = EXCLUDED.type,
                        chunk = EXCLUDED.chunk,
                        embedding = EXCLUDED.embedding,
                        parent_id = EXCLUDED.parent_id
                    RETURNING *;
                    """
                    values = (chunk_id, file_path, file_type, chunk, embedding_str, parent_id)
                    with self.db_connection.cursor() as cursor:
                        cursor.execute(query, values)
                        result = cursor.fetchone()
                        #print('Document created/updated with ID:', result[0])
                        results.append(result)
                        self.db_connection.commit()
                except Exception as db_error:
                    print('Error inserting/updating document into database:', db_error)
                    # Rollback the transaction to prevent blocking future insertions
                    self.db_connection.rollback()
            except Exception as e:
                print('Error embedding text:', e)
        return results

    def embed_text(self, text: str) -> List[float]:
        """Integrate with the existing embed API to generate embeddings."""
        try:
            response = requests.post('http://localhost:3000/api/embed', json={'text': text})
            response.raise_for_status()
            embeddings = response.json().get('embedding', [])  # Extract embedding list
            if not embeddings:
                print('No embedding found in API response')
                return None
            return embeddings
        except requests.exceptions.RequestException as e:
            print('Error calling embed API:', e)
            return []

    def chunk_text(self, text: str, max_length: int, overlap: int) -> List[str]:
        """Chunk text into smaller parts."""
        # Simple chunking logic
        return [text[i:i+max_length] for i in range(0, len(text), max_length - overlap)]

    def connect_to_db(self):
        """Connect to the PostgreSQL database using credentials from .env."""
        self.db_connection = psycopg2.connect(dsn=os.getenv('DATABASE_URL'))
        print('Connected to the database.')

if __name__ == '__main__':
    import argparse
    import json
    
    parser = argparse.ArgumentParser(description='Process some files.')
    parser.add_argument('--directory', type=str, default='data',
                        help='Directory to process files from (default: data)')
    args = parser.parse_args()
    
    extractor = TextExtractor()
    extractor.connect_to_db()
    results = list(extractor.process_directory(args.directory))
    for result in results:
        if 'error' not in result:
            extractor.process_text_content(result['content'], result['file_path'], result['file_type'])
    extractor.db_connection.close()
    print('Database connection closed.')
