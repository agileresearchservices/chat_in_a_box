import os
import magic
import PyPDF2
from docx import Document
from pathlib import Path
from typing import List, Dict, Generator
from tqdm import tqdm

class TextExtractor:
    """A component for extracting text from various file types in a directory."""
    
    def __init__(self, supported_extensions: List[str] = None):
        self.supported_extensions = supported_extensions or ['.txt', '.pdf', '.docx']
        self.mime = magic.Magic(mime=True)
    
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

if __name__ == '__main__':
    import argparse
    import json
    
    parser = argparse.ArgumentParser(description='Extract text from files in a directory')
    parser.add_argument('--directory', required=True, help='Directory to process')
    args = parser.parse_args()
    
    extractor = TextExtractor()
    results = list(extractor.process_directory(args.directory))
    print(json.dumps(results))
