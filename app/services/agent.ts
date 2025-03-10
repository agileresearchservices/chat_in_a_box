import logger from '@/utils/logger';

export type AgentType = 'weather' | 'search' | 'summarize';

interface AgentResponse {
  message: {
    content: string;
  };
}

/**
 * Agent Service for handling specialized queries using PydanticAI
 */
export class AgentService {
  /**
   * Executes an agent for a specific query
   * @param agentType Type of agent to use
   * @param query User's query
   * @param parameters Optional parameters for the agent
   * @returns Response stream from the agent
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

      // Add weather-specific parameters
      if (agentType === 'weather') {
        parameters = {
          ...parameters,
          weatherApiEndpoint: '/api/weather',
          requiresLocation: true,
          locationService: 'nominatim',
          weatherService: 'nws'
        };
      }

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
   * Detects if a query should be handled by a specific agent
   * @param query User's input text
   * @returns Agent type if query matches, null otherwise
   */
  public detectAgentType(query: string): AgentType | null {
    const patterns: Record<AgentType, RegExp[]> = {
      weather: [
        /weather|temperature|forecast|rain|snow|sunny|cloudy|storm|cold|hot/i,
        /what('s| is) (the weather|it) like in/i,
        /how('s| is) the weather in/i,
        /what('s| is) the temperature in/i,
        /weather (report|update|info|information) for/i,
        /weather (conditions?|forecast) (in|at|for)/i
      ],
      search: [
        /search (for|about)|find (information|details) (about|on)/i,
        /look up|tell me about|what (do you know|can you tell me) about/i
      ],
      summarize: [
        /summarize|summarise|give me a summary|brief overview|key points/i,
        /tldr|tl;dr|in (brief|short|summary)/i
      ]
    };

    for (const [type, typePatterns] of Object.entries(patterns)) {
      if (typePatterns.some(pattern => pattern.test(query))) {
        return type as AgentType;
      }
    }

    return null;
  }
}

// Export a singleton instance
export const agentService = new AgentService();
