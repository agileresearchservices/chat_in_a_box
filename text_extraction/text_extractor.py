# Standard library and third-party imports for text processing
import os
import magic  # File type detection
from docx import Document  # Optional: Word document handling
from pathlib import Path
from typing import List, Dict, Generator, Optional
from tqdm import tqdm  # Progress bar for long-running tasks
import psycopg2  # PostgreSQL database connection
import hashlib  # Generating unique identifiers
from dotenv import load_dotenv  # Environment variable management
import requests  # HTTP requests for Tika and embedding services
from requests.adapters import HTTPAdapter  # Connection pooling
import concurrent.futures  # Parallel processing

# Load environment variables from .env file
load_dotenv()

class TextExtractor:
    """
    Advanced Text Extraction and Embedding Utility

    A comprehensive tool for processing text documents from various sources:
    - Supports multiple file formats via Apache Tika
    - Generates vector embeddings using Ollama
    - Stores processed documents in PostgreSQL with vector support

    Key Features:
    - Recursive directory scanning
    - Concurrent text extraction and embedding
    - Robust error handling
    - Configurable chunking and embedding strategies

    Supported File Types:
    - Plain text (.txt)
    - PDF documents
    - Microsoft Word documents (.docx)
    - Extensible to other formats via Tika

    Design Principles:
    - Modular architecture
    - High performance through parallel processing
    - Flexible configuration via environment variables
    """
    
    def __init__(self, supported_extensions: List[str] = None):
        """
        Initialize TextExtractor with configurable settings

        Args:
            supported_extensions (List[str], optional): List of file extensions 
                to process. Defaults to ['.txt', '.pdf', '.docx'].

        Configuration:
        - Sets up file type detection
        - Initializes HTTP session with connection pooling
        - Prepares for database and file processing
        """
        self.supported_extensions = supported_extensions or [
            '.txt', '.pdf', '.docx', '.doc', '.rtf', '.odt',
            '.html', '.htm', '.xml', '.json', '.md',
            '.ppt', '.pptx', '.xls', '.xlsx', '.epub',
            '.java', '.py', '.csv', '.pptm', '.xlsm', '.docm',
            '.ods', '.odp', '.odg', '.odf', '.ipynb', '.adoc'
        ]

        self.mime = magic.Magic(mime=True)  # MIME type detection
        self.db_connection = None
        
        # Robust HTTP session with high connection pool
        self.session = requests.Session()
        self.session.mount("http://", HTTPAdapter(pool_connections=100, pool_maxsize=100))
    
    def extract_with_tika(self, file_path: str) -> str:
        """
        Extract text from a file using Apache Tika server

        Leverages Tika's powerful text extraction capabilities across multiple file formats.

        Args:
            file_path (str): Path to the file to be processed

        Returns:
            str: Extracted plain text content

        Raises:
            requests.exceptions.RequestException: If Tika server communication fails
        """
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
        """
        Process a single file and extract its text content

        Handles potential extraction errors gracefully.

        Args:
            file_path (str): Path to the file to be processed

        Returns:
            Dict[str, str]: Extracted text content or error information
        """
        file_path = str(file_path)
        try:
            content = self.extract_with_tika(file_path)
        except Exception as e:
            return {"error": f"Error processing {file_path}: {str(e)}"}
        return {"content": content, "file_path": file_path, "file_type": "tika"}
    
    def process_directory(self, directory_path: str) -> Generator[Dict[str, str], None, None]:
        """
        Recursively process files in a directory with advanced filtering

        Features:
        - Skips hidden files and directories
        - Excludes log files
        - Uses concurrent processing for high performance
        - Provides progress tracking

        Args:
            directory_path (str): Path to the directory to process

        Yields:
            Dict[str, str]: Processed file information

        Raises:
            ValueError: If the directory does not exist
        """
        directory = Path(directory_path)
        if not directory.exists():
            raise ValueError(f"Directory not found: {directory_path}")
        
        # Advanced file filtering
        files = [
            f for f in directory.rglob("*")
            if f.is_file() and f.stat().st_size > 0 
            and not any(part.startswith('.') for part in f.parts) 
            and not f.name.endswith('.log')
            and f.suffix.lower() in self.supported_extensions
        ]
        
        # Concurrent file processing with progress tracking
        with concurrent.futures.ThreadPoolExecutor(max_workers=32) as executor:
            futures = {executor.submit(self.extract_text, str(f)): f for f in files}
            for future in tqdm(concurrent.futures.as_completed(futures), total=len(futures), desc="Extracting files"):
                yield future.result()

    def embed_text(self, text: str) -> Optional[List[float]]:
        """
        Generate vector embedding for a text chunk using Ollama

        Args:
            text (str): Text chunk to embed

        Returns:
            Optional[List[float]]: Vector embedding or None if generation fails

        Notes:
        - Uses 'nomic-embed-text' model
        - Handles embedding generation errors
        """
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
        Advanced text processing pipeline

        Workflow:
        1. Chunk text into semantic segments
        2. Generate embeddings for each chunk concurrently
        3. Insert/update chunks in PostgreSQL database
        4. Support conflict resolution for idempotent processing

        Args:
            text (str): Full text content
            file_path (str): Source file path
            file_type (str): Type of source file

        Returns:
            List[Dict]: Processed and inserted document chunks
        """
        # Configurable chunking parameters from environment
        chunk_size = int(os.getenv('CHUNK_SIZE', '1800'))
        chunk_overlap = int(os.getenv('CHUNK_OVERLAP', '200'))
        min_chunk_length = int(os.getenv('MIN_CHUNK_LENGTH', '100'))
        sentence_split = os.getenv('SENTENCE_SPLIT', 'True').lower() == 'true'
        chunks = self.chunk_text(text, chunk_size, chunk_overlap, min_chunk_length, sentence_split)
        
        # Concurrent embedding generation
        embedded_chunks = [None] * len(chunks)
        with concurrent.futures.ThreadPoolExecutor(max_workers=32) as executor:
            futures = {executor.submit(self.embed_text, chunk): idx for idx, chunk in enumerate(chunks)}
            for future in tqdm(concurrent.futures.as_completed(futures), total=len(chunks), desc=f"Embedding {file_path}"):
                idx = futures[future]
                embedded_chunks[idx] = future.result()

        # Prepare batch database insertion
        batch_insert_data = []
        for chunk_index, (chunk, embedding) in enumerate(zip(chunks, embedded_chunks)):
            if embedding is None:
                continue
            
            # Convert embedding to PostgreSQL-compatible format
            embedding_str = '[' + ','.join(map(str, embedding)) + ']'
            
            # Generate unique identifiers
            parent_id = hashlib.md5(file_path.encode()).hexdigest()
            chunk_id = f"{parent_id}-{chunk_index}"
            
            batch_insert_data.append((chunk_id, file_path, file_type, chunk, embedding_str, parent_id))

        # Batch database insertion with upsert
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

                # Return processed data
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

    def chunk_text(
        self, 
        text: str, 
        max_length: int = 3600, 
        overlap: int = 400, 
        min_chunk_length: int = 100,
        sentence_split: bool = True
    ) -> List[str]:
        """
        Intelligently chunk text with advanced semantic and sentence-aware strategies.

        Ensures semantic continuity and prevents mid-sentence splits.

        Args:
            text (str): Full text to be chunked
            max_length (int, optional): Maximum chunk size. Defaults to 3600.
            overlap (int, optional): Number of characters to overlap between chunks. Defaults to 400.
            min_chunk_length (int, optional): Minimum acceptable chunk length. Defaults to 100.
            sentence_split (bool, optional): Whether to split at sentence boundaries. Defaults to True.

        Returns:
            List[str]: List of text chunks optimized for embedding

        Raises:
            ValueError: If chunk parameters are invalid
        """
        import re
        import logging

        # Validate input parameters
        if max_length <= overlap:
            raise ValueError("CHUNK_SIZE must be larger than CHUNK_OVERLAP.")
        if overlap < 0:
            raise ValueError("CHUNK_OVERLAP must be non-negative.")
        if min_chunk_length <= 0:
            raise ValueError("MIN_CHUNK_LENGTH must be positive.")

        # Remove extra whitespaces and normalize text
        text = re.sub(r'\s+', ' ', text.strip())

        # If sentence splitting is enabled, use sentence boundaries
        if sentence_split:
            # Split text into sentences, handling various punctuation
            sentences = re.split(r'(?<=[.!?])\s+', text)
        else:
            # Treat the entire text as a single "sentence"
            sentences = [text]

        chunks = []
        current_chunk = []
        current_length = 0

        for sentence in sentences:
            # If adding this sentence would exceed max_length, finalize current chunk
            if current_length + len(sentence) > max_length:
                if current_chunk:
                    chunks.append(' '.join(current_chunk))
                    current_chunk = []
                    current_length = 0

            current_chunk.append(sentence)
            current_length += len(sentence) + 1  # +1 for space

            # If chunk is full or we've processed all sentences, finalize
            if current_length >= max_length or sentence == sentences[-1]:
                chunks.append(' '.join(current_chunk))
                current_chunk = []
                current_length = 0

        # Apply overlap to chunks
        overlapped_chunks = []
        for i in range(len(chunks)):
            start = max(0, i - 1)
            end = min(len(chunks), i + 2)
            overlapped_chunk = ' '.join(chunks[start:end]).strip()
            
            # Trim to max_length
            if len(overlapped_chunk) > max_length:
                overlapped_chunk = overlapped_chunk[:max_length]
            
            # Skip very short chunks
            if len(overlapped_chunk) >= min_chunk_length:
                overlapped_chunks.append(overlapped_chunk)

        # Log chunk information
        logging.info(f"Text Chunking Summary: "
                     f"Total Chunks={len(overlapped_chunks)}, "
                     f"Max Length={max_length}, "
                     f"Overlap={overlap}")

        return overlapped_chunks

    def connect_to_db(self):
        """
        Establish a connection to PostgreSQL database

        Uses connection string from environment variables.
        Provides connection status feedback.
        """
        self.db_connection = psycopg2.connect(dsn=os.getenv('DATABASE_URL'))
        print('Connected to the database.')

# Main execution block for standalone script usage
if __name__ == '__main__':
    import argparse
    
    # Command-line argument parsing
    parser = argparse.ArgumentParser(description='Process text files for embedding and storage.')
    parser.add_argument('--directory', type=str, default='data',
                        help='Directory to process files from (default: data)')
    args = parser.parse_args()
    
    # Text extraction and embedding workflow
    extractor = TextExtractor()
    extractor.connect_to_db()
    
    # Step 1: Extract text from files
    results = list(extractor.process_directory(args.directory))

    # Step 2: Process and embed extracted text
    for result in results:
        if 'error' not in result:
            extractor.process_text_content(
                text=result['content'], 
                file_path=result['file_path'], 
                file_type=result['file_type']
            )

    # Cleanup database connection
    extractor.db_connection.close()
    print('Database connection closed.')