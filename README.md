This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Git](https://git-scm.com/)

## Ollama Setup

Before running the development server, you'll need to install Ollama and pull the phi4 model:

### macOS

1. Install Ollama:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

2. Start Ollama:
```bash
ollama serve
```

### Windows

1. Download and install [Windows Subsystem for Linux (WSL)](https://learn.microsoft.com/en-us/windows/wsl/install)
2. Install Ollama in WSL:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

3. Start Ollama in WSL:
```bash
ollama serve
```

### Pull the Model (Both Platforms)

In a new terminal, pull the phi4 model:
```bash
ollama pull phi4
```

## Project Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd chat_in_a_box
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory with the following content:
```bash
NEXT_PUBLIC_API_URL=http://localhost:11434
OLLAMA_MODEL=phi4
```

## Docker and Database Setup

To set up the project using Docker and initialize the database, run the setup script:

```bash
./setup.sh
```

This script will:
- Start the Docker containers
- Wait for the PostgreSQL database to be ready
- Run Prisma database migrations
- Generate Prisma client

**Note**: Ensure you have Docker and Docker Compose installed before running the script.

## Prisma and Database Setup

This application uses [Prisma](https://www.prisma.io/) as the ORM for interacting with the PostgreSQL database. Additionally, it leverages the `pgvector` extension for vector storage to facilitate document and embedding retrieval, which is critical for the RAG (Retrieval-Augmented Generation) application.

### Database Requirements

- **PostgreSQL**: Ensure you have PostgreSQL installed (version 13 or higher is recommended).
- **pgvector Extension**: Install the `pgvector` extension in your PostgreSQL database to enable vector operations.

### Docker Setup for PostgreSQL with pgvector

To set up PostgreSQL with the pgvector extension using Docker, follow these steps:

1. Create a `docker-compose.yml` file in the root directory of your project with the following content:

   ```yaml
   version: '3.8'

   services:
     postgres:
       image: pgvector/pgvector:pg17
       container_name: my-postgres
       environment:
         POSTGRES_PASSWORD: <your_password_placeholder>
         POSTGRES_USER: <your_user_placeholder>
         POSTGRES_DB: <your_db_placeholder>
       ports:
         - "5432:5432"
   ```

   Replace `<your_password_placeholder>`, `<your_user_placeholder>`, and `<your_db_placeholder>` with your actual values.

2. Run the following command to start the PostgreSQL service:

   ```bash
   docker-compose up -d
   ```

This will start a PostgreSQL container with the pgvector extension, accessible on port 5432.

### Prisma Configuration

1. Install Prisma and the required dependencies:
```bash
npm install prisma @prisma/client
```

2. Initialize Prisma in the project:
```bash
npx prisma init
```

3. Update the `.env.local` file to include your database connection string:
```bash
DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<database>
```

4. Define the Prisma schema to include a model for storing documents and embeddings. For example:
```prisma
model Document {
  id        Int      @id @default(autoincrement())
  title     String
  content   String
  embedding Float[]  @pg.Vector
  createdAt DateTime @default(now())
}
```

5. Push the schema to your database:
```bash
npx prisma db push
```

6. Seed the database (if necessary) with initial data by creating a `prisma/seed.js` file and running:
```bash
npx prisma db seed
```

### Using Prisma in the Application

Prisma provides a type-safe client for database operations. Here's how it's used in this project:

- **Adding Documents**: Insert documents and their embeddings into the database.
- **Vector Search**: Leverage `pgvector` to perform similarity searches on embeddings.
- **Retrieval for RAG**: Fetch relevant documents based on embeddings for use in the RAG pipeline.

Example usage in the application:
```javascript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Adding a document
async function addDocument(title, content, embedding) {
  await prisma.document.create({
    data: { title, content, embedding },
  });
}

// Searching for similar documents
async function searchDocuments(queryEmbedding) {
  return await prisma.$queryRaw`
    SELECT *
    FROM "Document"
    ORDER BY embedding <-> ${queryEmbedding}
    LIMIT 10;
  `;
}
```

### Prisma Studio

For an easy way to view and manage your database, use Prisma Studio:
```bash
npx prisma studio
```

This setup ensures efficient storage and retrieval of data, making it a cornerstone of the RAG application's search and retrieval capabilities.

## TextExtractor

The `TextExtractor` is a component designed for extracting text from various file types within a directory. It supports `.txt`, `.pdf`, and `.docx` file formats.

### Key Features:
- **File Type Detection:** Uses `python-magic` to determine the MIME type of files.
- **Text Extraction:** Provides methods to extract text from plain text files, PDFs, and Word documents.
- **Chunking and Embedding:** Processes text content into chunks and integrates with an embedding API to generate embeddings.
- **Database Integration:** Connects to a PostgreSQL database to store extracted and processed data.

### Usage:
1. **Initialization:**
   ```python
   extractor = TextExtractor()
   ```
2. **Process a Directory:**
   ```python
   for result in extractor.process_directory('/path/to/directory'):
       print(result)
   ```
3. **Database Connection:**
   Ensure the `.env` file contains the correct `DATABASE_URL` for connecting to the PostgreSQL database.

### Methods:
- `get_file_type(file_path)`: Determines the file type.
- `extract_from_txt(file_path)`: Extracts text from a text file.
- `extract_from_pdf(file_path)`: Extracts text from a PDF.
- `extract_from_docx(file_path)`: Extracts text from a Word document.
- `process_directory(directory_path)`: Processes all supported files in a directory.
- `process_text_content(text, file_path, file_type)`: Processes text content into chunks and embeds them.
- `embed_text(text)`: Integrates with the embedding API.
- `chunk_text(text, max_length, overlap)`: Chunks text into smaller parts.
- `connect_to_db()`: Connects to the PostgreSQL database.

## Text Chunking and Embedding Features

The application now includes advanced text processing capabilities using LlamaIndex and Ollama text embeddings:

### Text Chunking
- Implemented intelligent text chunking for processing large documents
- Uses a specialized chunker utility that breaks down text while preserving context
- Configurable chunk sizes and overlap settings

### Embedding Generation
- Integration with Ollama's text embedding model for semantic understanding
- Efficient vector representation of text chunks
- Supports both document and query embedding generation

### Key Components:
- `embed.model.js`: Handles the core embedding functionality
- `embed-process.js`: Manages the embedding generation process
- `chunker.js`: Provides text chunking utilities
- `embed.service.js`: Service layer for embedding operations

### Usage Example:
```javascript
// Generate embeddings for a document
const embedService = new EmbedService();
const embedding = await embedService.generateEmbedding(textContent);

// Store document with embedding
await prisma.document.create({
  data: {
    content: textContent,
    embedding: embedding
  }
});
```

## Conversation Memory Management

### ConversationMemory Class

The `ConversationMemory` class is a crucial component of the application's conversational context management. It provides the following key functionalities:

- **Message Tracking**: Maintains a rolling history of conversation messages
- **Context Preservation**: Limits memory to the last 10 messages to prevent token overflow
- **Context Generation**: Generates a context prompt for maintaining conversational context

#### Key Methods

- `addMessage(message)`: Adds a new message to the memory, automatically trimming older messages if the memory exceeds the maximum length
- `getMemory()`: Retrieves the current conversation memory
- `getContextPrompt()`: Generates a formatted string representation of the conversation history
- `clear()`: Resets the conversation memory

This mechanism ensures that the AI maintains context across multiple interactions while preventing excessive memory usage.

## Recent Improvements

### Chat API Enhancements
- Streamlined chat API route implementation
- Improved code structure and readability
- Enhanced error handling mechanisms

### UI and UX Updates
- Refined text area sizing for better user interaction
- Improved color formatting for enhanced visual consistency
- Reduced answer redundancy in chat responses

### Error Handling
- Implemented more robust error handling strategies
- Added improved error tracking and reporting mechanisms

## Performance Optimizations
- Cleaned up unnecessary code in chat API routes
- Improved response generation efficiency
- Enhanced overall application responsiveness

## Recommended Development Practices
- Continuously monitor and refactor code for clarity
- Maintain a focus on reducing redundancy
- Prioritize error handling and user experience

### Troubleshooting
If you encounter any issues with the recent updates:
- Check the console for detailed error messages
- Verify your Ollama and PostgreSQL configurations
- Ensure all dependencies are up to date

### Future Roadmap
- Continue improving code modularity
- Enhance AI response generation
- Implement more advanced error recovery mechanisms

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Troubleshooting

- **Windows Users**: Make sure WSL is running and Ollama is started in WSL before running the application
- **Mac Users**: If you get a security warning, you may need to approve Ollama in System Settings > Security & Privacy
- If the model isn't responding, ensure Ollama is running with `ollama serve` in a separate terminal
- Check that the NEXT_PUBLIC_API_URL environment variable matches your Ollama server address
