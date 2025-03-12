/**
 * Weather Agent TypeScript Service
 * 
 * This module provides weather query detection and processing capabilities for the chat application.
 * It integrates with the PydanticAI agent system to handle weather-related queries and fetch
 * real-time weather data for US cities using the National Weather Service API.
 * 
 * @module WeatherAgent
 */

import logger from '@/utils/logger';
import { agentService, AgentType } from './agent';
import { nlpService } from './nlp.service';

/**
 * Regular expressions for detecting weather-related intents in user queries.
 * These patterns cover various ways users might ask about weather conditions.
 * 
 * Examples:
 * - "What's the weather like in Boston?"
 * - "How's the temperature in New York?"
 * - "Weather forecast for Chicago"
 */
const WEATHER_PATTERNS = [
  /weather|temperature|forecast|rain|snow|sunny|cloudy|storm|cold|hot/i,  // Basic weather terms
  /what('s| is) (the weather|it) like in/i,                              // Common question format
  /how('s| is) the weather in/i,                                         // Alternative question format
  /what('s| is) the temperature in/i,                                    // Temperature specific
  /weather (report|update|info|information) for/i,                       // Information requests
  /weather (conditions?|forecast) (in|at|for)/i                          // Forecast requests
];

/**
 * Regular expressions for extracting city names from weather queries.
 * These patterns are designed to capture city names in various query formats.
 * Used as a fallback when NLP service doesn't identify a city.
 * 
 * Examples:
 * - "in Boston" -> "Boston"
 * - "weather in New York City" -> "New York"
 * - "temperature for San Francisco tomorrow" -> "San Francisco"
 */
const CITY_PATTERNS = [
  /(?:in|at|for) ([\w\s]+?)(?:\?|$|,|\s+(?:today|now|tomorrow|tonight))/i,
  /(?:weather|temperature|forecast) (?:in|at|for) ([\w\s]+?)(?:\?|$|,|\s+(?:today|now|tomorrow|tonight))/i
];

/**
 * Interface defining the structure of weather agent responses.
 * Aligns with the PydanticAI agent response format.
 */
interface WeatherResponse {
  message: {
    content: string;  // The formatted weather information or error message
  };
}

/**
 * Represents the result of entity extraction from a weather query,
 * including location (city) information.
 */
interface EntityExtractionResult {
  city: string | null;
  timeframe: string;  // Always 'now' since we only support current conditions
}

/**
 * WeatherAgent class
 * 
 * Handles the detection and processing of weather-related queries in the chat application.
 * Integrates with the PydanticAI agent system for executing weather queries and the
 * National Weather Service API for fetching real-time weather data.
 * 
 * Key Features:
 * - Smart weather query detection using regex patterns
 * - Intelligent city name extraction using NLP service with regex fallback
 * - Integration with PydanticAI agent system
 * - Real-time US weather data retrieval
 * - Comprehensive error handling and logging
 */
export class WeatherAgent {
  /** Identifies this agent type in the PydanticAI agent system */
  private readonly agentType: AgentType = 'weather';

  /**
   * Analyzes user input to determine if it contains a weather-related query
   * 
   * @param input - The user's raw input text
   * @returns true if the input matches any weather-related patterns
   * 
   * @example
   * ```typescript
   * const agent = new WeatherAgent();
   * const isWeather = agent.isWeatherQuery("What's the weather like in Boston?");
   * // Returns: true
   * ```
   */
  public isWeatherQuery(input: string): boolean {
    return WEATHER_PATTERNS.some(pattern => pattern.test(input));
  }

  /**
   * Extracts city entity from a weather-related query using NLP service.
   * Falls back to regex patterns if NLP doesn't identify the entity.
   * 
   * @param input - The user's raw input text
   * @returns A Promise resolving to an object containing city and timeframe (always 'now')
   * 
   * @example
   * Input: "What's the weather like in New York City?"
   * Output: { city: "New York", timeframe: "now" }
   * 
   * @private
   */
  private async extractEntities(input: string): Promise<EntityExtractionResult> {
    try {
      logger.info('Extracting entities with NLP service', { input });
      
      // Use NLP service to analyze the text and extract entities
      const nlpResult = await nlpService.analyze(input);
      
      // Debug output of all entities found
      logger.debug('NLP analysis result', { 
        entities: nlpResult.entities,
        input 
      });
      
      // Extract city entities
      const cityEntities = nlpResult.entities.filter(entity => entity.entity === 'city');
      
      // Initialize result
      const result: EntityExtractionResult = {
        city: null,
        timeframe: 'now'  // Always set to 'now' as we only support current conditions
      };
      
      // Process city entities
      if (cityEntities.length > 0) {
        result.city = cityEntities[0].value;
        logger.info('City extracted by NLP service', { 
          input,
          extractedCity: result.city,
          allCitiesFound: cityEntities.map(e => e.value)
        });
      } else {
        // Fall back to regex extraction for city
        result.city = this.extractCityWithRegex(input);
      }
      
      logger.info('Entity extraction complete', { 
        input, 
        city: result.city, 
        timeframe: result.timeframe 
      });
      
      return result;
    } catch (error) {
      logger.error('Error extracting entities with NLP', {
        error: error instanceof Error ? error.message : String(error),
        input
      });
      
      // Fall back to regex extraction on error
      return {
        city: this.extractCityWithRegex(input),
        timeframe: 'now'
      };
    }
  }

  /**
   * Extracts a city name from a weather-related query using regex patterns.
   * Used as a fallback when NLP service doesn't identify a city.
   * 
   * @param input - The user's raw input text
   * @returns The cleaned city name or null if no city is found
   * 
   * @private
   */
  private extractCityWithRegex(input: string): string | null {
    for (const pattern of CITY_PATTERNS) {
      const match = input.match(pattern);
      if (match && match[1]) {
        // Clean up and normalize the extracted city name
        const extractedCity = match[1].trim()
          .replace(/\s+/g, ' ')     // Normalize multiple spaces to single space
          .replace(/^the\s+/i, '')  // Remove leading "the" (e.g., "the Boston")
          .replace(/\s+city$/i, ''); // Remove trailing "city" (e.g., "New York City" -> "New York")
        
        logger.info('City extracted by regex fallback', { 
          input, 
          extractedCity,
          pattern: pattern.toString()
        });
        
        return extractedCity;
      }
    }
    
    logger.info('No city found by regex patterns', { input });
    return null;
  }

  /**
   * Processes a weather query by extracting the city and executing the PydanticAI agent
   * 
   * @param input - The user's raw input text
   * @returns A Promise resolving to a Response object or null if query can't be handled
   * 
   * @throws Will throw an error if weather data fetching fails
   * 
   * @example
   * ```typescript
   * const agent = new WeatherAgent();
   * const response = await agent.handleWeatherQuery("What's the weather in Boston?");
   * ```
   */
  public async handleWeatherQuery(input: string): Promise<Response | null> {
    try {
      logger.info('Processing weather query', { input });
      
      // Extract city and time entities from the query
      const { city, timeframe } = await this.extractEntities(input);
      
      if (!city) {
        logger.info('No city found in weather query after NLP and regex extraction', { input });
        return null;
      }

      logger.info('Successfully extracted entities for weather query', { 
        input,
        extractedCity: city,
        timeframe: 'now',
        extractionMethod: 'nlp+regex'
      });

      // Execute weather query through PydanticAI agent system
      return await agentService.executeAgent(this.agentType, input, {
        city,                           // Extracted city name
        timeframe: 'now',               // Always use current conditions
        weatherApiEndpoint: '/api/weather',  // Internal API endpoint
        requiresLocation: true,         // Indicates geocoding is needed
        locationService: 'nominatim',   // Service for city->coordinates
        weatherService: 'nws'           // National Weather Service API
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

// Export a singleton instance for use throughout the application
export const weatherAgent = new WeatherAgent();
