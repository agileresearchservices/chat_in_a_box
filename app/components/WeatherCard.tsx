/**
 * Weather Card Component Module
 * 
 * This module provides a React component for displaying weather information in a visually appealing card format.
 * It supports various weather conditions and provides appropriate icons based on the weather state and time of day.
 * 
 * @module WeatherCard
 */

'use client'

import React from 'react';
import { 
  SunIcon, 
  MoonIcon, 
  CloudIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/solid';
import { BoltIcon } from '@heroicons/react/24/solid';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

/**
 * Weather Data Interface
 * 
 * Defines the structure of weather data required by the WeatherCard component.
 * 
 * @interface WeatherData
 * @property {string} location - The name of the location (city, state)
 * @property {number} temperature - The current temperature value
 * @property {string} temperatureUnit - The unit of temperature measurement (F/C)
 * @property {string} shortForecast - A brief description of the weather conditions
 * @property {string} detailedForecast - A detailed weather forecast description
 * @property {string} [timeframe] - Optional timeframe of the forecast (now, today, tonight, etc.)
 * @property {boolean} [isError] - Optional flag indicating if there was an error fetching weather data
 */
export interface WeatherData {
  location: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  detailedForecast: string;
  timeframe?: string;
  isError?: boolean;
}

/**
 * Weather Card Props Interface
 * 
 * @interface WeatherCardProps
 * @property {WeatherData} data - The weather data to display in the card
 */
interface WeatherCardProps {
  data: WeatherData;
}

/**
 * Get Weather Icon Function
 * 
 * Determines and returns the appropriate weather icon based on the forecast conditions
 * and time of day. Icons are selected based on a priority order of weather conditions.
 * 
 * Priority order:
 * 1. Clear/Sunny conditions
 * 2. Cloudy conditions
 * 3. Rain
 * 4. Snow
 * 5. Thunderstorms
 * 6. Fog/Mist
 * 7. Default to clear/sunny
 * 
 * @param {WeatherData} data - The weather data containing forecast information
 * @param {boolean} isNight - Flag indicating if it's nighttime
 * @returns {JSX.Element} The appropriate weather icon component
 */
function getWeatherIcon(data: WeatherData, isNight: boolean): JSX.Element {
  const lowerForecast = data.shortForecast.toLowerCase();
  const lowerDetailed = (data.detailedForecast || '').toLowerCase();
  
  // Debug logging to see what we're working with
  console.log('Weather icon debug:', { 
    forecast: data.shortForecast, 
    lowerForecast,
    detailedForecast: data.detailedForecast,
    isNight
  });

  // Primary weather condition checks - in order of priority
  if (lowerForecast.includes('sunny') || lowerForecast.includes('clear') || 
      lowerDetailed.includes('sunny') || lowerDetailed.includes('clear')) {
    console.log(' SELECTED: Clear/Sunny icon');
    return isNight ? 
      <MoonIcon className="h-16 w-16 text-blue-800" aria-hidden="true" /> : 
      <SunIcon className="h-16 w-16 text-yellow-500" aria-hidden="true" />;
  }
  
  if (lowerForecast.includes('cloud') || lowerForecast.includes('partly') ||
      lowerDetailed.includes('cloud') || lowerDetailed.includes('partly')) {
    console.log(' SELECTED: Cloudy icon');
    return <CloudIcon className={`h-16 w-16 ${isNight ? 'text-blue-700' : 'text-blue-500'}`} aria-hidden="true" />;
  }
  
  if (lowerForecast.includes('rain') || lowerForecast.includes('shower') || lowerForecast.includes('drizzle') ||
      lowerDetailed.includes('rain') || lowerForecast.includes('shower')) {
    console.log(' SELECTED: Rain icon');
    return <div className="relative">
      <CloudIcon className="h-16 w-16 text-gray-500" aria-hidden="true" />
      <div className="absolute bottom-0 left-6 w-4 h-6 bg-blue-400 rounded-b-full"></div>
      <div className="absolute bottom-0 left-10 w-4 h-4 bg-blue-400 rounded-b-full"></div>
    </div>;
  }
  
  if (lowerForecast.includes('snow') || lowerForecast.includes('flurries') ||
      lowerDetailed.includes('snow')) {
    console.log(' SELECTED: Snow icon');
    return <div className="relative">
      <CloudIcon className="h-16 w-16 text-gray-400" aria-hidden="true" />
      <div className="absolute bottom-0 left-6 w-2 h-2 bg-white border border-gray-200 rounded-full"></div>
      <div className="absolute bottom-2 left-10 w-2 h-2 bg-white border border-gray-200 rounded-full"></div>
      <div className="absolute bottom-4 left-8 w-2 h-2 bg-white border border-gray-200 rounded-full"></div>
    </div>;
  }
  
  if (lowerForecast.includes('thunder') || lowerForecast.includes('storm') || lowerForecast.includes('lightning') ||
      lowerDetailed.includes('thunder') || lowerDetailed.includes('storm')) {
    console.log(' SELECTED: Storm icon');
    return <div className="relative">
      <CloudIcon className="h-16 w-16 text-gray-600" aria-hidden="true" />
      <div className="absolute bottom-0 right-6 w-1 h-6 bg-yellow-400 transform rotate-12"></div>
    </div>;
  }
  
  if (lowerForecast.includes('fog') || lowerForecast.includes('mist') || lowerForecast.includes('haze') ||
      lowerDetailed.includes('fog') || lowerDetailed.includes('mist')) {
    console.log(' SELECTED: Fog icon');
    return <div className="relative">
      <CloudIcon className="h-16 w-16 text-gray-400 opacity-70" aria-hidden="true" />
    </div>;
  }
  
  // Default to sun/moon if no specific condition matches
  console.log(' DEFAULT: No specific condition matched, using clear/sunny icon');
  return isNight ? 
    <MoonIcon className="h-16 w-16 text-blue-800" aria-hidden="true" /> : 
    <SunIcon className="h-16 w-16 text-yellow-500" aria-hidden="true" />;
}

/**
 * Weather Card Component
 * 
 * Displays weather information in a visually appealing card format.
 */
const WeatherCard: React.FC<WeatherCardProps> = ({ data }) => {
  const { location, temperature, temperatureUnit, shortForecast, detailedForecast, isError } = data;
  const isNight = shortForecast.toLowerCase().includes('night');

  // Error state card display
  if (isError) {
    return (
      <div className="bg-gradient-to-br from-red-50 to-orange-100 rounded-lg shadow-md overflow-hidden max-w-md mx-auto">
        {/* Error Header */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 p-4 text-white">
          <h2 className="text-xl font-semibold">Weather Error</h2>
          <div className="text-sm opacity-90">
            {location !== 'Unknown' ? location : 'Location Required'}
          </div>
        </div>
        
        {/* Error Content */}
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-16 w-16 text-orange-500" aria-hidden="true" />
            </div>
            <div className="text-right">
              <div className="text-lg font-medium text-red-700">{shortForecast}</div>
            </div>
          </div>
          
          {/* Details */}
          <div className="mt-4 p-3 bg-white bg-opacity-60 rounded-lg">
            <p className="text-sm text-gray-600">{detailedForecast}</p>
          </div>
        </div>
      </div>
    );
  }

  // Regular weather card display
  return (
    <div className="bg-gradient-to-br from-blue-50 to-sky-100 rounded-lg shadow-md overflow-hidden max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4 text-white">
        <h2 className="text-xl font-semibold">{location}</h2>
        <div className="text-sm opacity-90">Current Weather</div>
      </div>
      
      {/* Weather Content */}
      <div className="p-5">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            {getWeatherIcon(data, isNight)}
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{temperature}°{temperatureUnit}</div>
            <div className="text-gray-600">{shortForecast}</div>
          </div>
        </div>
        
        {/* Details */}
        <div className="mt-4 p-3 bg-white bg-opacity-60 rounded-lg">
          <h3 className="text-gray-700 font-medium mb-2">Detailed Forecast</h3>
          <p className="text-sm text-gray-600">{detailedForecast}</p>
        </div>
      </div>
    </div>
  );
};

export default WeatherCard;
