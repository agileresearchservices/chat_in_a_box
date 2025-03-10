import { NextResponse } from 'next/server';
import { getWeatherForCity, weatherQuerySchema } from '@/app/services/weather.service';
import logger from '@/utils/logger';
import { createSuccessResponse, createErrorResponse } from '@/utils/api-response';

/**
 * Weather Information API Route
 * 
 * This route handler provides real-time weather data from the National Weather Service API
 * for US cities. It includes geocoding, grid point retrieval, and forecast data parsing.
 * 
 * Key Features:
 * - City name to coordinate conversion via Nominatim API
 * - Real-time weather data from National Weather Service
 * - US-specific weather information
 * 
 * Workflow:
 * 1. Receive city name via POST request
 * 2. Validate input
 * 3. Convert city to coordinates
 * 4. Fetch weather data
 * 5. Return formatted weather information
 * 
 * Error Handling:
 * - Returns 400 if input validation fails
 * - Returns 404 if city not found or not in US
 * - Returns 500 for other errors
 * 
 * @route POST /api/weather
 * @param {string} city - The name of the US city to get weather for
 * @returns {NextResponse} JSON response containing weather information
 */
export async function POST(req: Request) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const query = weatherQuerySchema.parse(body);

    logger.info('Processing weather request:', { 
      city: query.city 
    });

    // Get weather data
    const weatherData = await getWeatherForCity(query);

    logger.debug('Weather data retrieved:', weatherData);

    // Return successful response
    return createSuccessResponse(weatherData);
  } catch (error: unknown) {
    // Handle validation errors
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Invalid input: ' + error.message, 400);
      }

      // Handle city not found or non-US location
      if (error.message.includes('No location found') || 
          error.message.includes('outside the United States')) {
        return createErrorResponse(error.message, 404);
      }

      // Log error details
      logger.error('Weather API error:', { 
        errorType: error.constructor.name,
        errorMessage: error.message
      });

      // Return generic error for other cases
      return createErrorResponse('Failed to get weather information');
    }

    // Handle non-Error objects
    logger.error('Weather API error:', { 
      errorType: 'Unknown',
      errorMessage: String(error)
    });
    return createErrorResponse('An unexpected error occurred');
  }
}
