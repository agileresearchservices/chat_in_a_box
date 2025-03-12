# Chat in a Box: System Architecture and Technology Flow

This document outlines the technology stack and processing flow for the three main actions in the Chat in a Box application: Basic LLM Conversation, Weather Queries, and Product Search. For general information, features, and setup instructions, please refer to the [main README](README.md).

## Technology Overview

Chat in a Box integrates multiple cutting-edge technologies:

| Technology | Component | Purpose |
|------------|-----------|---------|
| **Vectors & Embeddings** | Ollama (nomic-embed-text) | Generation of semantic embeddings for query understanding |
| **Hybrid Search** | PostgreSQL | Vector storage and similarity search for relevant context |
| **Weather API** | National Weather Service | Real-time US weather data retrieval |
| **Product Search** | OpenSearch | Full-text and structured search across product catalog |
| **NLP** | node-nlp | Entity recognition and filter extraction from natural language |
| **Reranker** | Custom implementation | Post-processing and prioritization of search results |
| **DeepseekR1** | Reasoning model | Advanced reasoning capabilities for complex queries |
| **Ollama** | Local model hosting | Provides all inference locally without external dependencies |
| **Swagger** | OpenAPI integration | API documentation and interface specification |
| **Agents** | PydanticAI | Structured agent system for specialized query handling |
| **Memory Management** | ConversationMemory | Context retention across multiple interactions |

For details on setting up these components in your environment, see the [Getting Started](README.md#getting-started) section in the main README.

## Action 1: Basic LLM Call (No Tool Usage)

When a user submits a query that doesn't require specialized tools, the system follows this process:

1. **Initial Processing**
   - The frontend sends the user query to the API service
   - The agent detection system evaluates whether the query requires specialized handling
   - For basic queries, no agent is triggered

2. **Vector Embedding Generation**
   - The text is sent to the embedding service (`/api/embed`)
   - Ollama with `nomic-embed-text` model generates a 768-dimensional embedding vector
   - The embedding process is configured with specific inference parameters:
     ```
     temperature: 0.2, contextWindow: 65536, topK: 20, topP: 0.6, repeatPenalty: 1.2
     ```

3. **Semantic Search**
   - The generated embedding is used to search for relevant context in PostgreSQL
   - A similarity threshold of 0.5 is applied to filter results
   - The search returns context chunks with similarity scores
   - Example log: `Initial vector search results {"query":"Describe Lucille using only a single sentence"}`

4. **Response Generation**
   - The original query and retrieved context are sent to the LLM
   - DeepseekR1 reasoning model processes the enhanced context
   - Ollama handles all inference locally
   - The model generates a comprehensive response
   - The response is streamed back to the user

5. **Memory Management**
   - The conversation is tracked by the ConversationMemory system
   - Example log: `ConversationMemory singleton initialized {"maxMemoryLength":2}`
   - This context is preserved for future interactions

## Action 2: Weather Query Processing

When a user asks about weather, the system activates specialized components:

1. **Query Detection**
   - The `AgentService` analyzes the query for weather-related patterns
   - Weather intents are detected using regex patterns:
     ```
     weather|temperature|forecast|rain|snow|sunny|cloudy|storm|cold|hot
     what('s| is) (the weather|it) like in
     how('s| is) the weather in
     ```
   - Upon detection, the weather agent is activated

2. **NLP Entity Extraction**
   - The query is processed by the NLP service to extract the city name
   - The service identifies named entities, particularly locations
   - Custom entity recognition finds cities and related context
   - Part-of-speech tagging helps identify location references
   - This handles complex queries like "What's the weather like in New York today?"

3. **Geocoding**
   - The city name is sent to the Weather Service
   - Nominatim API converts the city name to geographic coordinates
   - Multiple search formats are tried for reliability:
     ```
     (c: string) => c.replace(/,\s*USA$/i, '').trim()
     (c: string) => `${c}, USA`
     (c: string) => `${c}, United States`
     (c: string) => c.split(',')[0].trim()
     ```
   - US-specific location filtering is applied for accuracy

4. **Weather Data Retrieval**
   - The coordinates are used to query the National Weather Service API
   - First, grid points are obtained from `/points/{latitude},{longitude}`
   - Then, the forecast URL is extracted and queried
   - The weather data includes temperature, forecast, and detailed conditions
   - The `selectForecastPeriod` function determines which timeframe to return (now, today, tomorrow)

5. **Response Formatting**
   - The PydanticAI agent formats the weather data into a user-friendly response
   - The Python agent (`WeatherAgent`) runs in a dedicated process
   - Information is organized to highlight key details first
   - Streaming response shows the agent's thinking process
   - The final response includes location, temperature, and forecast details

For API documentation and example queries, see the [Weather Information](README.md#weather-information) section in the main README.

## Action 3: Product Search

When users look for products, the system leverages advanced search capabilities:

1. **Intent Detection**
   - The query is analyzed by the AgentService for product-related patterns:
     ```
     find (me )?a (phone|device|xenophone)
     search for (a )?(phone|device|xenophone)
     looking for (a )?(phone|device|xenophone)
     ```
   - When matched, the product agent is activated with appropriate parameters
   - The agent is configured with the OpenSearch endpoint and catalog index

2. **NLP-based Filter Extraction**
   - The NLP service analyzes the query to extract product attributes:
     - Price ranges ("under $500", "between $300 and $800")
     - Storage capacities ("64GB", "1TB")
     - Colors ("black", "blue")
     - Screen sizes ("large screen" → ≥6.0")
   - These attributes are transformed into structured filters

3. **OpenSearch Query Construction**
   - The extracted filters are used to build a complex OpenSearch query
   - The query includes:
     - Full-text search on Title/Description for brand/model
     - Exact keyword matching for Storage and Color
     - Float range queries for Price
     - Integer sorting for Release_Year
     - Float filtering for Screen_Size

4. **Query Execution and Fallback Strategies**
   - The query is sent to OpenSearch via the catalog index
   - If no results are found, fallback strategies are employed:
     - Relaxing filters while keeping essential ones
     - Using alternative search terms
     - Returning default products for generic queries
   - This ensures users always receive relevant results

5. **Result Reranking and Enhancement**
   - Results are processed by a reranker to improve relevance
   - The reranker considers:
     - Text similarity to original query
     - Feature matching to requested attributes
     - Price considerations for "around $X" queries
     - Sort by recency for "latest" requests
   - The final results are formatted with:
     - Context-aware headers
     - Emoji indicators
     - Detailed stock status
     - Filter-specific messaging

6. **Response Generation**
   - The PydanticAI product agent composes a natural language response
   - Results are presented in a structured yet conversational format
   - The agent provides explanations for search decisions
   - Filter-specific "no results" messages help guide users
   - The response is streamed back with thinking process visible

For details on the Product Search API and examples, refer to the [Product Search](README.md#product-search) section in the main README.

## Technology Integration Points

The system's architecture enables seamless integration between components:

1. **Agent Framework**
   - PydanticAI provides the structure for specialized agents
   - Agent execution is handled via Python subprocess communication
   - TypeScript frontend and Python backend use a structured messaging format
   - Streaming responses show the agent reasoning process

   For information on creating custom agents, see the [Creating New PydanticAI Agents](README.md#creating-new-pydanticai-agents) guide.

2. **Memory System**
   - ConversationMemory maintains context across interactions
   - Memory is initialized with a configurable length (currently 2)
   - Clear methods allow for conversation reset
   - Memory is shared between regular LLM and agent interactions

   For more details, see the [Conversation Memory Management](README.md#conversation-memory-management) section.

3. **Error Handling and Fallbacks**
   - Each component implements robust error handling
   - Weather service tries multiple geocoding formats
   - Product search implements multi-step fallback strategies
   - Detailed logging provides visibility into system operation

4. **Documentation**
   - Swagger/OpenAPI specifications document all API endpoints
   - JSDoc comments provide detailed code documentation
   - Logging throughout the application captures operation details
   - API routes include comprehensive documentation

This architecture enables a flexible, robust system that can handle various user needs while maintaining a consistent, high-quality user experience.

## Alternative Approaches to Agent Detection

The current system uses regex patterns to determine which agent to trigger, which can be brittle. Here are alternative approaches that could improve robustness:

### 1. Embedding-Based Intent Classification (Interesting, but the vector DB has nothing to do with products or weather search)
Instead of regex, use the same embedding model already in the system to classify intents

### 2. Fine-Tuned Classification Model (Easy if you have labled data)
Train a small, specialized model just for intent classification

### 3. Zero-Shot Classification with LLM (I tried this and it seemed pretty good but not perfect of course)
Leverage the LLM to perform zero-shot classification

### 4. Hybrid LLM tool call + Zero-Shot Classification with LLM + Regex fallback (Heavy but effective)
Use multiple approaches together to get the best bet of tool identification and usage.
