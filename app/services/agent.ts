/**
 * PydanticAI Agent Service Module
 * 
 * Core service module for managing and coordinating PydanticAI agents in the chat application.
 * This module serves as the central hub for agent detection, execution, and coordination,
 * providing a unified interface for all agent-based functionality.
 * 
 * Key Features:
 * - Dynamic agent type detection
 * - Unified agent execution interface
 * - Streaming response handling
 * - Integrated error management
 * - Automatic parameter configuration
 * 
 * @module AgentService
 */

import logger from '@/utils/logger';

/**
 * Supported agent types in the system
 * Add new agent types here when extending the system
 */
export type AgentType = 'weather' | 'search' | 'summarize' | 'product';

/**
 * Interface defining the structure of agent responses
 * Follows the PydanticAI agent response format for consistency
 * across different agent types
 */
interface AgentResponse {
  message: {
    content: string;  // Contains either the agent's response or thinking process
  };
}

/**
 * AgentService Class
 * 
 * Central service for managing PydanticAI agents in the chat application.
 * Handles agent detection, execution, and response processing.
 * 
 * Features:
 * - Smart query routing to appropriate agents
 * - Unified execution interface for all agent types
 * - Streaming response support
 * - Automatic parameter configuration
 * - Comprehensive error handling
 * 
 * Usage:
 * ```typescript
 * const service = new AgentService();
 * const agentType = service.detectAgentType(userQuery);
 * if (agentType) {
 *   const response = await service.executeAgent(agentType, userQuery);
 * }
 * ```
 */
export class AgentService {
  /**
   * Executes a PydanticAI agent for a specific query
   * 
   * This method:
   * 1. Validates and prepares the execution parameters
   * 2. Configures agent-specific settings
   * 3. Initiates the agent execution
   * 4. Handles streaming responses
   * 
   * @param agentType - Type of agent to execute (weather, search, summarize, product)
   * @param query - User's input query
   * @param parameters - Optional configuration parameters for the agent
   * @returns Promise resolving to a streaming Response
   * 
   * @example
   * ```typescript
   * const response = await agentService.executeAgent(
   *   'weather',
   *   'What\'s the weather in Boston?',
   *   { weatherApiEndpoint: '/api/weather' }
   * );
   * ```
   * 
   * @throws Error if agent execution fails or returns an error response
   */
  public async executeAgent(
    agentType: AgentType,
    query: string,
    parameters: Record<string, any> = {}
  ): Promise<Response> {
    try {
      logger.info('Executing agent', { 
        agentType,
        queryLength: query.length 
      });

      // Configure agent-specific parameters
      if (agentType === 'weather') {
        parameters = {
          ...parameters,
          weatherApiEndpoint: '/api/weather',    // Internal weather API endpoint
          requiresLocation: true,                // Enable location processing
          locationService: 'nominatim',          // Geocoding service
          weatherService: 'nws'                  // Weather data provider
        };
      } else if (agentType === 'product') {
        parameters = {
          ...parameters,
          baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',  // Base URL for API calls
          productApiEndpoint: '/api/products',    // Internal product API endpoint
          catalogIndex: 'catalog',               // OpenSearch index name
          maxResults: 5                          // Maximum number of results to return
        };
      }

      // Execute agent via API endpoint
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          query,
          agentType,
          parameters
        })
      });

      // Handle error responses
      if (!response.ok) {
        const error = await response.json();
        logger.error('Agent execution failed', { error });
        throw new Error(error.details || error.error || 'Failed to execute agent');
      }

      return response;
    } catch (error) {
      logger.error('Error in agent execution', {
        error: error instanceof Error ? error.message : String(error),
        agentType,
        query
      });
      throw error;
    }
  }

  /**
   * Analyzes a query to determine if it should be handled by a specific agent
   * 
   * Uses pattern matching to identify query intent and route to appropriate agent.
   * Patterns are organized by agent type and designed to catch various
   * ways users might phrase their requests.
   * 
   * @param query - User's input text to analyze
   * @returns Matching agent type or null if no patterns match
   * 
   * @example
   * ```typescript
   * const query = "What's the weather like in Boston?";
   * const agentType = agentService.detectAgentType(query);
   * // Returns: 'weather'
   * ```
   */
  public detectAgentType(query: string): AgentType | null {
    // Define intent patterns for each agent type
    const patterns: Record<AgentType, RegExp[]> = {
      weather: [
        /weather|temperature|forecast|rain|snow|sunny|cloudy|storm|cold|hot/i,      // Weather conditions
        /what('s| is) (the weather|it) like in/i,                                  // Common weather questions
        /how('s| is) the weather in/i,                                             // Alternative phrasing
        /what('s| is) the temperature in/i,                                        // Temperature specific
        /weather (report|update|info|information) for/i,                           // Information requests
        /weather (conditions?|forecast) (in|at|for)/i                              // Forecast requests
      ],
      search: [
        /search (for|about)|find (information|details) (about|on)/i,               // Search requests
        /look up|tell me about|what (do you know|can you tell me) about/i          // Information queries
      ],
      summarize: [
        /summarize|summarise|give me a summary|brief overview|key points/i,        // Summarization requests
        /tldr|tl;dr|in (brief|short|summary)/i                                     // Common abbreviations
      ],
      product: [
        /find (me )?a (phone|device|xenophone)/i,                                  // Direct product requests
        /search for (a )?(phone|device|xenophone)/i,                               // Search-based requests
        /looking for (a )?(phone|device|xenophone)/i,                              // Browse-based requests
        /show me (phones|devices|xenophones)/i,                                    // Display requests
        /(phone|device|xenophone).+(under|less than|cheaper than|below|around|about|between|\$)/i,  // Price-based queries
        /(phone|device|xenophone).+(with|has|in).+(gb|tb|storage|color|black|white|blue|red)/i     // Feature-based queries
      ]
    };

    // Check each agent type's patterns for a match
    for (const [type, typePatterns] of Object.entries(patterns)) {
      if (typePatterns.some(pattern => pattern.test(query))) {
        return type as AgentType;
      }
    }

    return null;
  }
}

// Export singleton instance for application-wide use
export const agentService = new AgentService();
