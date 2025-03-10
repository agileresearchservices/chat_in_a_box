import logger from '@/utils/logger';
import { agentService, AgentType } from './agent';

// Weather-related intent patterns
const WEATHER_PATTERNS = [
  /weather|temperature|forecast|rain|snow|sunny|cloudy|storm|cold|hot/i,
  /what('s| is) (the weather|it) like in/i,
  /how('s| is) the weather in/i,
  /what('s| is) the temperature in/i,
  /weather (report|update|info|information) for/i,
  /weather (conditions?|forecast) (in|at|for)/i
];

// City extraction patterns
const CITY_PATTERNS = [
  /(?:in|at|for) ([\w\s]+?)(?:\?|$|,|\s+(?:today|now|tomorrow|tonight))/i,
  /(?:weather|temperature|forecast) (?:in|at|for) ([\w\s]+?)(?:\?|$|,|\s+(?:today|now|tomorrow|tonight))/i
];

interface WeatherResponse {
  message: {
    content: string;
  };
}

/**
 * Weather Agent Service
 * 
 * Analyzes user input for weather-related queries and handles them appropriately.
 * Uses pattern matching and NLP techniques to identify weather intents and extract city names.
 */
export class WeatherAgent {
  private readonly agentType: AgentType = 'weather';

  /**
   * Determines if the input is a weather-related query
   * @param input User's input text
   * @returns boolean indicating if this is a weather query
   */
  public isWeatherQuery(input: string): boolean {
    return WEATHER_PATTERNS.some(pattern => pattern.test(input));
  }

  /**
   * Extracts city name from a weather query
   * @param input User's input text
   * @returns The extracted city name or null if no city found
   */
  private extractCity(input: string): string | null {
    for (const pattern of CITY_PATTERNS) {
      const match = input.match(pattern);
      if (match && match[1]) {
        // Clean up the extracted city name
        return match[1].trim()
          .replace(/\s+/g, ' ')  // Normalize spaces
          .replace(/^the\s+/i, '')  // Remove leading "the"
          .replace(/\s+city$/i, ''); // Remove trailing "city"
      }
    }
    return null;
  }

  /**
   * Handles a weather query by extracting the city and fetching weather data
   * @param input User's input text
   * @returns A formatted response string or null if query can't be handled
   */
  public async handleWeatherQuery(input: string): Promise<Response | null> {
    try {
      const city = this.extractCity(input);
      
      if (!city) {
        logger.info('No city found in weather query', { input });
        return null;
      }

      logger.info('Processing weather query', { 
        input,
        extractedCity: city 
      });

      // Execute the weather query using the agent service
      return await agentService.executeAgent(this.agentType, input, {
        city,
        weatherApiEndpoint: '/api/weather',
        requiresLocation: true,
        locationService: 'nominatim',
        weatherService: 'nws'
      });

    } catch (error) {
      logger.error('Error handling weather query', { 
        error: error instanceof Error ? error.message : String(error),
        input 
      });
      throw error;
    }
  }
}

// Export a singleton instance
export const weatherAgent = new WeatherAgent();
