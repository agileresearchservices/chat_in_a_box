# Chat in a Box: Advanced Local AI Retrieval System

## Overview

Chat in a Box is a cutting-edge Retrieval-Augmented Generation (RAG) application designed to provide powerful, local AI-driven document interaction and search capabilities. Built with a focus on privacy, performance, and flexibility, this application leverages state-of-the-art technologies to create an intelligent document retrieval and generation platform.

> For a detailed explanation of the system architecture and technology flow, see the [Application Flow Document](README_Application_Flow.md).

## Key Features

- **Local AI Inference**: Utilizes Ollama to run AI models (phi4, deepseek-r1) directly on your machine, ensuring data privacy and reducing external dependencies.
- **Advanced Vector Search**: Implements PostgreSQL with pgvector for efficient semantic document retrieval and similarity search.
- **Multi-format Document Support**: Extract and process text from various file formats including .txt, .pdf, and .docx.
- **Flexible AI Interactions**: Perform advanced document querying, generation, and reranking with local AI models.
- **US Weather Information**: Real-time weather data for US cities using the National Weather Service API with intelligent city resolution.
- **Natural Language Processing Analysis**: Analyze text for entities, parts of speech, and sentiment using Node-NLP.

## Core Capabilities

1. Semantic Document Search
2. Local AI-powered Text Generation
3. Intelligent Passage Reranking
4. Flexible Embedding Generation
5. Real-time US Weather Data
6. PydanticAI Agent System
7. Natural Language Processing Analysis

For details on how these capabilities are implemented in the processing flow, refer to the [system architecture document](README_Application_Flow.md).

## Technology Stack

- **Frontend**: Next.js (React framework)
- **Backend**: FastAPI Microservices
- **AI Inference**: Ollama with local models
- **Database**: PostgreSQL with pgvector
- **ORM**: Prisma
- **Containerization**: Docker
- **Agent System**: PydanticAI with custom agents
- **NLP**: Node-NLP for text analysis

## API Endpoints

The application provides several RESTful API endpoints:

### Chat Endpoints
- `POST /api/chat`: Send messages and receive AI responses
- `DELETE /api/chat`: Clear conversation memory

For details on how the chat processing works under the hood, see [Basic LLM Call Flow](README_Application_Flow.md#action-1-basic-llm-call-no-tool-usage).

### Search and Embedding
- `POST /api/search`: Perform semantic document search
- `POST /api/embed`: Generate text embeddings

Learn more about the [embedding generation process](README_Application_Flow.md#technology-overview) in our architecture document.

### Product Search
- `POST /api/products`: Search product catalog with advanced filtering
  ```json
  // Request
  {
    "query": "xenophone black 64gb",
    "filters": {
      "minPrice": 500,
      "maxPrice": 1000,
      "color": "Black",
      "storage": "64GB",
      "releaseYear": 2022
    },
    "size": 10,
    "page": 1
  }

  // Response
  {
    "success": true,
    "data": {
      "products": [
        {
          "id": "1",
          "skuId": "SKU1234",
          "baseId": "BASE123",
          "title": "XenoPhone Fusion - 64GB, 5.8\", Black",
          "price": 789.49,
          "description": "Perfect for professionals, featuring a stunning display and top-tier security features.",
          "stock": "333",
          "releaseYear": 2022,
          "storage": "64GB",
          "screenSize": 5.8,
          "color": "Black"
        }
      ],
      "total": 150
    }
  }
  ```

For a detailed explanation of how product search queries are processed, see our [Product Search Flow](README_Application_Flow.md#action-3-product-search).

### Agent System
- `POST /api/agents`: Execute PydanticAI agents
  ```json
  // Request
  {
    "query": "What's the weather in Boston?",
    "agentType": "weather",
    "parameters": {
      "weatherApiEndpoint": "/api/weather"
    }
  }

  // Response (streaming)
  {
    "message": {
      "content": "<think>Processing weather query using PydanticAI...</think>"
    }
  }
  {
    "message": {
      "content": "Here's the current weather for Boston, Massachusetts:\n🌡️ Temperature: 58°F\nSunny\n\nDetailed Forecast:\nSunny, with a high near 58..."
    }
  }
  ```

  ```json
  // Request
  {
    "query": "Find me a black xenophone with 64GB under $800",
    "agentType": "product",
    "parameters": {
      "baseUrl": "/api/products"
    }
  }

  // Response (streaming)
  {
    "message": {
      "content": "<think>Processing product search using PydanticAI...</think>"
    }
  }
  {
    "message": {
      "content": "I found 150 products matching your search. Here are the top 5 results:\n\n1. XenoPhone Fusion - 64GB, 5.8\", Black\n   Price: $789.49\n   In Stock: 333 units\n   Specs: 64GB, 5.8\" screen, Black\n\nFilters applied: maximum price $800.00, color Black, storage 64GB"
    }
  }
  ```

### Weather Information
- `POST /api/weather`: Get real-time weather data for US cities
  ```json
  {
    "city": "Boston"
  }

  // Response
  {
    "location": "Boston, Massachusetts",
    "temperature": 58,
    "temperatureUnit": "F",
    "shortForecast": "Sunny",
    "detailedForecast": "Sunny, with a high near 58..."
  }
  ```

For details on the weather processing flow, check out the [Weather Query Processing](README_Application_Flow.md#action-2-weather-query-processing) section.

### Natural Language Processing
- `POST /api/nlp`: Analyze text for entities, parts of speech, and sentiment
  ```json
  // Request
  {
    "text": "John visited New York last summer and loved the city."
  }

  // Response
  {
    "entities": [
      {
        "entity": "person",
        "value": "John",
        "type": "enum"
      },
      {
        "entity": "city",
        "value": "New York",
        "type": "enum"
      },
      {
        "entity": "daterange",
        "value": "last summer",
        "type": "enum"
      }
    ],
    "tokens": [
      {
        "token": "visited",
        "tag": "VBD"
      }
    ],
    "sentiment": {
      "score": 0.6,
      "comparative": 0.2,
      "vote": "positive"
    }
  }
  ```

  The NLP service provides comprehensive logging for debugging and monitoring:
  ```
  [NLP API] Received NLP analysis request
  [NLP API] Request body: { "text": "..." }
  [NLPService] Analyzing text: ...
  [NLPService] Analysis result: { ... }
  [NLP API] Analysis completed successfully
  [NLP API] Response: { ... }
  ```

### Documentation
- `GET /api/redoc`: OpenAPI/Swagger documentation

## Getting Started

### Prerequisites

- Node.js 18+
- Docker
- PostgreSQL

*Detailed installation and setup instructions coming soon.*

## Performance Optimizations

- Multi-stage Docker builds
- FP16 acceleration
- Efficient passage reranking
- Configurable AI model parameters

## Privacy and Local Processing

All AI inference and document processing happen locally, ensuring maximum data privacy and minimal external dependencies.

## Conversation Memory Management

### Intelligent Context Retention

Chat in a Box implements a sophisticated conversation memory system designed to:
- Maintain conversational context across multiple interactions
- Prevent token overflow and excessive memory consumption
- Provide AI models with relevant dialogue history

For details on how memory management integrates with the processing flow, see our [Technology Integration Points](README_Application_Flow.md#technology-integration-points) section.

#### Key Features
- **Sliding Window Memory**: Automatically manages conversation history
- **Configurable Memory Length**: Easily adjust maximum number of retained messages
- **Structured Context Injection**: Intelligently formats conversation history for AI comprehension

#### Memory Management Strategies
- Limits conversation history to a predefined number of messages
- Dynamically trims older messages to maintain context relevance
- Logs memory updates for debugging and tracking

#### Configuration
- **Default Memory Length**: 5 messages
- **Configurable via Environment Variables**: `MAX_MEMORY_LENGTH`

#### Context Preparation
When processing a new query, the system:
1. Retrieves conversation history
2. Formats messages with clear role identification
3. Injects formatted history into the AI model's system prompt
4. Combines conversation context with document-based context

This approach ensures that the AI maintains awareness of the ongoing conversation while preventing excessive memory usage.

## Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Git](https://git-scm.com/)

## Ollama Setup

Before running the development server, you'll need to install Ollama and pull the deepseek-r1 model:

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

In a new terminal, pull the deepseek-r1 model:
```bash
ollama pull deepseek-r1
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

3. Create a `.env` file in the root directory with the following content:
```bash
NEXT_PUBLIC_API_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1
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

## Reranker Service

### Overview
The Reranker microservice is a critical component of the Retrieval-Augmented Generation (RAG) application, designed to improve the relevance of retrieved documents.

### Key Features
- Implemented using FastAPI
- Utilizes FlagEmbedding for advanced reranking
- Docker containerized for easy deployment
- Supports efficient passage reranking

### Technologies
- Python
- FastAPI
- FlagEmbedding
- Docker
- Docker Compose

### Endpoint
- `/rerank`: Accepts a list of passages and reranks them based on relevance
- Uses 'BAAI/bge-reranker-large' model
- Supports FP16 acceleration
- Provides normalized scoring

### Docker Integration
The reranker service is integrated into the `docker-compose.yml`:
- Mapped to host port 8005
- Built from `./external_services/reranker-service` directory

### Usage Example
```python
# Rerank passages based on a query
passages = [...]
query = "Your search query"
reranked_passages = reranker.rerank(query, passages)
```

## TextExtractor

The `TextExtractor` is a component designed for extracting text from various file types within a directory. It supports a wide range of file formats.

### Supported File Types for Text Extraction

The application supports text extraction from the following file types:
- Text Files: `.txt`, `.text`
- Document Formats: `.pdf`, `.docx`, `.doc`, `.rtf`, `.odt`, `.ott`
- Web and Markup Languages: `.html`, `.htm`, `.xml`, `.json`, `.md`, `.markdown`
- Presentation Files: `.ppt`, `.pptx`, `.pptm`, `.odp`, `.otp`
- Spreadsheet Files: `.xls`, `.xlsx`, `.xlsm`, `.ods`, `.ots`
- Programming Source Code: `.java`, `.py`, `.cpp`, `.c`, `.js`
- Office Macro-Enabled Files: `.pptm`, `.xlsm`, `.docm`
- Open Document Formats: `.ods`, `.odp`, `.odg`, `.odf`, `.odt`
- Notebook Files: `.ipynb`, `.nb`
- Image Files: `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`
- Audio Files: `.mp3`, `.wav`, `.ogg`, `.flac`
- Video Files: `.mp4`, `.avi`, `.mov`, `.wmv`, `.flv`

Ensure your documents are in one of these formats for successful text extraction.

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

## Agent System

Chat in a Box includes a powerful agent system built with PydanticAI, enabling intelligent task handling and automation.

> For details on agent detection and processing flow, see our [Technology Integration Points](README_Application_Flow.md#technology-integration-points) and [Alternative Approaches to Agent Detection](README_Application_Flow.md#alternative-approaches-to-agent-detection).

### Available Agents

1. **Weather Agent**
   - Natural language weather queries for US cities
   - Real-time data from National Weather Service API
   - Intelligent city name extraction
   - Detailed weather information and forecasts

### Agent Features

- **Dynamic Agent Detection**: Automatically identifies appropriate agent based on query patterns
- **Streaming Responses**: Real-time response streaming with thinking indicators
- **Error Handling**: Comprehensive error handling and informative messages
- **Extensible Architecture**: Easy to add new agent types

### Agent Usage

Agents can be invoked through natural language in the chat interface:
- Weather queries: "What's the weather like in Boston?"
- Future agents: Search, summarization, and more coming soon

### Agent Architecture

The agent system is built with:
- **PydanticAI**: For structured agent handling
- **Python Virtual Environment**: Isolated execution environment
- **TypeScript Integration**: Seamless frontend integration
- **Streaming Support**: Real-time response updates

## Creating New PydanticAI Agents

The application supports extending its capabilities through custom PydanticAI agents. Follow this guide to create new agents.

### Agent Architecture

The agent system consists of three main components:
1. Python Agent Class (`/app/api/agents/[agent_name]_agent.py`)
2. TypeScript Agent Service (`/app/services/[agent_name]-agent.ts`)
3. Agent Integration (`/app/services/agent.ts`)

### Step-by-Step Guide

1. **Create Python Agent Class**
   ```python
   from typing import Dict, Any, Optional
   from .base import Agent
   
   class CustomAgent(Agent):
       def __init__(self):
           super().__init__()
           # Define patterns for query detection
           self.patterns = [
               r'your_regex_pattern_1',
               r'your_regex_pattern_2'
           ]
   
       def process(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> str:
           """
           Process the query using your agent's logic
           
           Args:
               query: User's query
               parameters: Additional parameters from the frontend
           
           Returns:
               Formatted response string
           """
           try:
               # Your agent's processing logic here
               result = "Your processed result"
               return result
           except Exception as e:
               return f"Error processing query: {str(e)}"
   ```

2. **Create TypeScript Agent Service**
   ```typescript
   export class CustomAgent {
     private readonly agentType: AgentType = 'custom';
   
     public isCustomQuery(input: string): boolean {
       const patterns = [
         /your_regex_pattern_1/i,
         /your_regex_pattern_2/i
       ];
       return patterns.some(pattern => pattern.test(input));
     }
   
     public async handleCustomQuery(input: string): Promise<Response | null> {
       try {
         // Prepare parameters for Python agent
         const parameters = {
           customParam: 'value',
           apiEndpoint: '/api/custom'
         };
   
         // Execute agent via AgentService
         const agentService = new AgentService();
         return await agentService.executeAgent(
           this.agentType,
           input,
           parameters
         );
       } catch (error) {
         console.error('Custom agent error:', error);
         return null;
       }
     }
   }
   ```

3. **Update Agent Type Definition**
   ```typescript
   // In /app/services/agent.ts
   export type AgentType = 'weather' | 'custom' | ... ;
   ```

4. **Integrate Agent Detection**
   ```typescript
   // In /app/services/agent.ts
   export class AgentService {
     private customAgent = new CustomAgent();
   
     public detectAgentType(query: string): AgentType | null {
       if (this.customAgent.isCustomQuery(query)) {
         return 'custom';
       }
       // ... other agent detections
       return null;
     }
   }
   ```

### Best Practices

1. **Query Detection**
   - Use specific regex patterns to accurately identify agent-relevant queries
   - Consider common variations in user input
   - Test patterns with various input formats

2. **Error Handling**
   - Implement comprehensive error handling in both Python and TypeScript
   - Provide informative error messages to users
   - Log errors appropriately for debugging

3. **Parameters**
   - Define clear parameter interfaces
   - Document required and optional parameters
   - Validate parameters before processing

4. **Response Format**
   - Return well-structured responses
   - Include relevant metadata when needed
   - Format responses for readability

### Example: Simple Calculator Agent

```python
# /app/api/agents/calculator_agent.py
class CalculatorAgent(Agent):
    def __init__(self):
        super().__init__()
        self.patterns = [
            r'calculate\s+([\d\s\+\-\*\/\(\)]+)',
            r'what\s+is\s+([\d\s\+\-\*\/\(\)]+)'
        ]

    def process(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> str:
        try:
            # Extract expression using patterns
            for pattern in self.patterns:
                match = re.search(pattern, query)
                if match:
                    expression = match.group(1)
                    result = eval(expression)  # Note: Use safe_eval in production
                    return f"The result of {expression} is {result}"
            return "I couldn't understand the calculation request"
        except Exception as e:
            return f"Error calculating result: {str(e)}"
```

### Testing Your Agent

1. **Unit Tests**
   ```python
   def test_custom_agent():
       agent = CustomAgent()
       result = agent.process("your test query", {"param": "value"})
       assert result == "expected output"
   ```

2. **Integration Testing**
   ```typescript
   describe('CustomAgent', () => {
     it('should detect custom queries', () => {
       const agent = new CustomAgent();
       expect(agent.isCustomQuery('your test query')).toBe(true);
     });
   });
   ```

### Deployment

1. Add your agent's Python dependencies to `requirements.txt`
2. Update the agent type in the frontend components where needed
3. Add appropriate error handling and logging
4. Document your agent's capabilities and usage

For more examples, refer to the Weather Agent implementation in the codebase.

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
### Logging and Error Handling

The application implements a robust logging and error handling strategy:
- Comprehensive logging across all components
- Type-safe error responses
- Detailed error context preservation
- Graceful error recovery mechanisms

### Microservice Architecture

The project is designed with a modular microservice approach:
- Separate services for embedding, search, and chat
- Independent scalability of components
- Clear separation of concerns
- Containerized deployment with Docker

### Security and Privacy Considerations

- Local AI inference to minimize external data exposure
- Secure environment variable management
- Configurable privacy controls
- Minimal external API dependencies

## Development Philosophy

### Code Quality Principles
- Type-safe implementations
- Comprehensive documentation
- Modular and extensible design
- Performance-focused development
- Continuous improvement and refactoring

### Continuous Integration and Deployment

While specific CI/CD pipelines are not yet implemented, the project is structured to support:
- Automated testing
- Static code analysis
- Containerized deployment
- Easy scalability and maintenance

## Contributing

We welcome contributions that align with our project's core principles:
- Maintain code quality and type safety
- Enhance performance and efficiency
- Improve user privacy and local processing capabilities
- Expand AI interaction capabilities

*Detailed contribution guidelines coming soon.*

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

## Prerequisites

Before running the application, ensure that the following services are running:

- **Reranker Service**: The FastAPI reranker service with GPU (MPS) support must be active. Start it by running the `start.sh` script inside the `external_services/reranker-service` directory.
- **npm**: Make sure npm (Node Package Manager) is installed and running for managing frontend dependencies.
- **Docker**: Ensure that Docker is running since some services are containerized (e.g. database, other workers).

Follow these steps before starting the application:

1. Activate the virtual environment and start the reranker service.
2. Verify that npm is installed and run your frontend build/start commands.
3. Ensure Docker is running and all necessary containers are up.

## Weather System
- `POST /api/weather`: Get real-time weather data for US cities
  ```json
  {
    "city": "Boston"
  }
  ```
  Response:
  ```json
  {
    "location": "Boston, Massachusetts",
    "temperature": 72,
    "temperatureUnit": "F",
    "shortForecast": "Sunny",
    "detailedForecast": "Sunny, with a high near 72. South wind 5 to 10 mph.",
    "timeframe": "now"
  }
  ```

## Weather Agent
The weather agent provides natural language processing for weather queries:
- Smart query detection and city extraction
- Support for various timeframes (now, today, tonight, tomorrow)
- Real-time data from National Weather Service API
- US-only location support with geocoding
- Comprehensive error handling

Example queries:
- "What's the weather like in Boston?"
- "Will it rain in Seattle tomorrow?"
- "How hot is it in Miami tonight?"

## API Documentation

The API documentation is available at `/api/redoc` and includes:
- OpenAPI 3.1.0 specification
- Detailed endpoint descriptions
- Request/response examples
- Error handling documentation
