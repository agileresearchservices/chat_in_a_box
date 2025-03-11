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
  timeframe?: string;  
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
  city: z.string().min(1, 'City name is required'),
  timeframe: z.string().optional().default('now')  
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
 * Selects the appropriate forecast period based on the requested timeframe
 * 
 * @param periods - Array of forecast periods from the NWS API
 * @param timeframe - The requested timeframe (now, today, tomorrow, tonight, etc.)
 * @returns The selected forecast period or the current period if no match is found
 * 
 * @private
 */
function selectForecastPeriod(periods: any[], timeframe: string): any {
  logger.debug('Selecting forecast period', { timeframe, periodsAvailable: periods.length });
  
  if (!periods.length) return null;
  
  const now = new Date();
  const hours = now.getHours();
  const isDaytime = hours >= 6 && hours < 18;
  
  // Default to the current period (first in the list)
  let selectedPeriod = periods[0];
  let periodIndex = 0;
  
  switch (timeframe) {
    case 'now':
      // Current conditions (first period)
      selectedPeriod = periods[0];
      break;
      
    case 'today':
      // If it's already evening, first period might be night, so ensure we get a daytime period
      if (!isDaytime && periods.length > 1 && !periods[0].isDaytime) {
        // Look for the next daytime period
        for (let i = 1; i < periods.length; i++) {
          if (periods[i].isDaytime) {
            selectedPeriod = periods[i];
            periodIndex = i;
            break;
          }
        }
      }
      break;
      
    case 'tonight':
      // Look for the first nighttime period
      for (let i = 0; i < periods.length; i++) {
        if (!periods[i].isDaytime) {
          selectedPeriod = periods[i];
          periodIndex = i;
          break;
        }
      }
      break;
      
    case 'tomorrow':
      // Find tomorrow's daytime forecast
      // If it's currently daytime, we need to go 2 periods ahead (tonight, then tomorrow)
      // If it's currently nighttime, we need to go 1 period ahead (to tomorrow)
      const tomorrowIndex = isDaytime ? 2 : 1;
      if (periods.length > tomorrowIndex) {
        selectedPeriod = periods[tomorrowIndex];
        periodIndex = tomorrowIndex;
      }
      break;
      
    case 'week':
    case 'next_week':
      // For a weekly forecast, we'll just use a later period (3-4 days out)
      const weekIndex = Math.min(6, periods.length - 1);
      selectedPeriod = periods[weekIndex];
      periodIndex = weekIndex;
      break;
      
    case 'weekend':
    case 'next_weekend':
      // Find the weekend days (Fri, Sat, Sun)
      for (let i = 0; i < periods.length; i++) {
        const name = periods[i].name.toLowerCase();
        if (name.includes('friday') || name.includes('saturday') || name.includes('sunday')) {
          selectedPeriod = periods[i];
          periodIndex = i;
          break;
        }
      }
      break;
      
    default:
      // For any other timeframe, look for period names that contain the timeframe
      for (let i = 0; i < periods.length; i++) {
        const name = periods[i].name.toLowerCase();
        const details = periods[i].detailedForecast.toLowerCase();
        
        if (name.includes(timeframe.toLowerCase()) || details.includes(timeframe.toLowerCase())) {
          selectedPeriod = periods[i];
          periodIndex = i;
          break;
        }
      }
  }
  
  logger.info('Selected forecast period', { 
    timeframe, 
    periodName: selectedPeriod.name,
    periodIndex,
    isDaytime: selectedPeriod.isDaytime 
  });
  
  return selectedPeriod;
}

/**
 * Get weather information for a US city
 * @param query Weather query containing city name and optional timeframe
 * @returns Weather information including temperature and forecast
 */
export async function getWeatherForCity(query: WeatherQuery): Promise<WeatherData> {
  const { city, timeframe = 'now' } = query;
  
  logger.info('Getting weather for city with timeframe', { city, timeframe });
  
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
  const periods = data.properties?.periods || [];

  if (!periods.length) {
    throw new Error(`No forecast data available for ${city}`);
  }
  
  // Step 4: Select the appropriate forecast period based on the timeframe
  const selectedPeriod = selectForecastPeriod(periods, timeframe);
  
  if (!selectedPeriod) {
    throw new Error(`No forecast period available for timeframe: ${timeframe}`);
  }

  // Format response
  return {
    location: `${location.city}, ${location.region}`,
    temperature: selectedPeriod.temperature,
    temperatureUnit: selectedPeriod.temperatureUnit || 'F',
    shortForecast: selectedPeriod.shortForecast || 'No forecast available',
    detailedForecast: selectedPeriod.detailedForecast || 'No detailed forecast available',
    timeframe: timeframe  
  };
}
