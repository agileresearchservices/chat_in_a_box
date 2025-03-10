import { z } from 'zod';
import logger from '@/utils/logger';

// Constants
const USER_AGENT = 'ChatInABox WeatherTool/1.0';
const NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/search';
const NWS_API_BASE_URL = 'https://api.weather.gov';

// Type definitions
export interface LocationData {
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  display_name: string;
}

export interface WeatherData {
  location: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  detailedForecast: string;
}

// Nominatim API response types
interface NominatimLocation {
  lat: string;
  lon: string;
  type?: string;
  importance?: number;
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

// Input validation schemas
export const weatherQuerySchema = z.object({
  city: z.string().min(1, 'City name is required')
});

export type WeatherQuery = z.infer<typeof weatherQuerySchema>;

/**
 * Geocode a city name to geographic coordinates using Nominatim API
 * @param city Name of the city to geocode
 * @returns Location data including coordinates and address details
 */
async function geocodeCity(city: string): Promise<LocationData> {
  logger.info('Geocoding city:', { city });
  
  // List of search formats to try
  const searchFormats = [
    (c: string) => c.replace(/,\s*USA$/i, '').trim(), // Remove USA suffix
    (c: string) => `${c}, USA`,  // Add USA suffix
    (c: string) => `${c}, United States`, // Add full country name
    (c: string) => c.split(',')[0].trim(), // Try just the city name
  ];

  let lastError: Error | null = null;

  // Try each search format
  for (const format of searchFormats) {
    try {
      const searchQuery = format(city);
      
      const params = new URLSearchParams({
        q: searchQuery,
        format: 'json',
        limit: '5',
        addressdetails: '1',
        countrycodes: 'us'
      });

      const response = await fetch(`${NOMINATIM_API_URL}?${params}`, {
        headers: { 'User-Agent': USER_AGENT }
      });

      if (!response.ok) {
        throw new Error(`Geocoding request failed: ${response.statusText}`);
      }

      const results: NominatimLocation[] = await response.json();
      
      if (results.length === 0) {
        continue; // Try next format if no results
      }

      // Find the first result that is definitely in the US
      for (const result of results) {
        const isUS = result.address?.country === 'United States' || 
                    result.address?.country_code?.toLowerCase() === 'us' ||
                    result.address?.country === 'USA';
                    
        if (isUS) {
          return {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            city: result.address?.city || result.address?.town || result.address?.village || city,
            region: result.address?.state || '',
            country: 'United States',
            display_name: result.display_name || ''
          };
        }
      }
    } catch (err) {
      // Type guard for Error objects
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      logger.error('Geocoding attempt failed:', { 
        city,
        searchFormat: format(city),
        error: error.message 
      });
    }
  }

  // If we get here, all formats failed
  throw new Error(`Could not find US location: ${city}${lastError ? `. Last error: ${lastError.message}` : ''}`);
}

/**
 * Get grid points from the National Weather Service API
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @returns Forecast URL for the location
 */
async function getGridPoints(latitude: number, longitude: number): Promise<string> {
  logger.info('Getting grid points:', { latitude, longitude });

  try {
    const response = await fetch(
      `${NWS_API_BASE_URL}/points/${latitude},${longitude}`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!response.ok) {
      throw new Error(`Grid points request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const forecastUrl = data.properties?.forecast;

    if (!forecastUrl) {
      throw new Error('No forecast URL found in grid points response');
    }

    return forecastUrl;
  } catch (error) {
    logger.error('Grid points error:', { error, latitude, longitude });
    throw error;
  }
}

/**
 * Get weather information for a US city
 * @param city Name of the city
 * @returns Weather information including temperature and forecast
 */
export async function getWeatherForCity(query: WeatherQuery): Promise<WeatherData> {
  const { city } = query;
  
  // Step 1: Get coordinates
  const location = await geocodeCity(city);
  
  if (location.country !== 'United States') {
    throw new Error(`Weather service only available for US locations. '${city}' appears to be in ${location.country}`);
  }

  // Step 2: Get grid points and forecast URL
  const forecastUrl = await getGridPoints(location.latitude, location.longitude);

  // Step 3: Get forecast data
  const response = await fetch(forecastUrl, {
    headers: { 'User-Agent': USER_AGENT }
  });

  if (!response.ok) {
    throw new Error(`Forecast request failed: ${response.statusText}`);
  }

  const data = await response.json();
  const currentPeriod = data.properties?.periods?.[0];

  if (!currentPeriod) {
    throw new Error(`No forecast data available for ${city}`);
  }

  // Format response
  return {
    location: `${location.city}, ${location.region}`,
    temperature: currentPeriod.temperature,
    temperatureUnit: currentPeriod.temperatureUnit || 'F',
    shortForecast: currentPeriod.shortForecast || 'No forecast available',
    detailedForecast: currentPeriod.detailedForecast || 'No detailed forecast available'
  };
}
