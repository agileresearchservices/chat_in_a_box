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
 * WeatherAgent class
 * 
 * Handles the detection and processing of weather-related queries in the chat application.
 * Integrates with the PydanticAI agent system for executing weather queries and the
 * National Weather Service API for fetching real-time weather data.
 * 
 * Key Features:
 * - Smart weather query detection using regex patterns
 * - Intelligent city name extraction from natural language
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
   * Extracts a city name from a weather-related query using regex patterns
   * 
   * @param input - The user's raw input text
   * @returns The cleaned city name or null if no city is found
   * 
   * @example
   * Input: "What's the weather like in New York City?"
   * Output: "New York"
   * 
   * @private
   */
  private extractCity(input: string): string | null {
    for (const pattern of CITY_PATTERNS) {
      const match = input.match(pattern);
      if (match && match[1]) {
        // Clean up and normalize the extracted city name
        return match[1].trim()
          .replace(/\s+/g, ' ')     // Normalize multiple spaces to single space
          .replace(/^the\s+/i, '')  // Remove leading "the" (e.g., "the Boston")
          .replace(/\s+city$/i, ''); // Remove trailing "city" (e.g., "New York City" -> "New York")
      }
    }
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
      // Extract city name from the query
      const city = this.extractCity(input);
      
      if (!city) {
        logger.info('No city found in weather query', { input });
        return null;
      }

      logger.info('Processing weather query', { 
        input,
        extractedCity: city 
      });

      // Execute weather query through PydanticAI agent system
      return await agentService.executeAgent(this.agentType, input, {
        city,                           // Extracted city name
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
