import { OpenAPIObject } from 'openapi3-ts/oas30';

const swaggerConfig: OpenAPIObject = {
  openapi: '3.0.0',
  info: {
    title: 'Chat in a Box API',
    version: '1.0.0',
    description: 'AI-powered document chat and retrieval system',
    contact: {
      name: 'Agile Research Services',
      email: 'support@agileresearchservices.com'
    },
    license: {
      name: 'MIT License'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000/api',
      description: 'Local development server'
    }
  ],
  components: {
    schemas: {
      ChatRequest: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'User input for AI processing',
            minLength: 1,
            maxLength: 4096
          },
          messages: {
            type: 'array',
            description: 'Conversation context',
            items: {
              type: 'object',
              properties: {
                role: {
                  type: 'string',
                  enum: ['user', 'assistant', 'system']
                },
                content: { type: 'string' }
              }
            }
          }
        },
        required: ['prompt']
      },
      EmbeddingRequest: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text to generate embeddings',
            minLength: 1
          }
        },
        required: ['text']
      },
      SearchRequest: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Semantic search query',
            minLength: 1
          }
        },
        required: ['query']
      }
    }
  },
  paths: {
    '/chat': {
      delete: {
        summary: 'Clear Conversation Memory',
        description: 'Reset conversation context',
        tags: ['Conversation Management'],
        responses: {
          '200': {
            description: 'Memory cleared successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: 'Chat with AI',
        description: 'Initiate AI conversation with optional context',
        tags: ['AI Conversation'],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChatRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Streaming AI response',
            content: {
              'text/event-stream': {
                schema: {
                  type: 'string',
                  description: 'Streamed text response'
                }
              }
            }
          }
        }
      }
    },
    '/embed': {
      post: {
        summary: 'Generate Text Embeddings',
        description: 'Convert text to vector representations',
        tags: ['Text Processing'],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EmbeddingRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Generated embeddings',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'number' }
                }
              }
            }
          }
        }
      }
    },
    '/search': {
      post: {
        summary: 'Semantic Document Search',
        description: 'Find semantically relevant documents',
        tags: ['Document Retrieval'],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SearchRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      content: { type: 'string' },
                      score: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'AI Conversation',
      description: 'Interact with AI chat system'
    },
    {
      name: 'Text Processing',
      description: 'Generate text embeddings'
    },
    {
      name: 'Document Retrieval',
      description: 'Search documents by semantic similarity'
    },
    {
      name: 'Conversation Management',
      description: 'Manage conversation state'
    }
  ]
};

export default swaggerConfig;
