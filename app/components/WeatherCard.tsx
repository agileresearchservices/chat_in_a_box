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

// Define weather condition interface
export interface WeatherData {
  location: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  detailedForecast: string;
  timeframe?: string;
  isError?: boolean;
}

// Props for the WeatherCard component
interface WeatherCardProps {
  data: WeatherData;
}

/**
 * Helper function to get the appropriate weather icon
 * based on the forecast and time of day
 */
function getWeatherIcon(forecast: string, isNight: boolean): JSX.Element {
  const lowerForecast = forecast.toLowerCase();
  
  // Weather condition checks
  const isClear = lowerForecast.includes('clear') || lowerForecast.includes('sunny');
  const isCloudy = lowerForecast.includes('cloud') || lowerForecast.includes('partly');
  const isRainy = lowerForecast.includes('rain') || lowerForecast.includes('shower') || lowerForecast.includes('drizzle');
  const isSnowy = lowerForecast.includes('snow') || lowerForecast.includes('flurries');
  const isStormy = lowerForecast.includes('thunder') || lowerForecast.includes('storm') || lowerForecast.includes('lightning');
  const isFoggy = lowerForecast.includes('fog') || lowerForecast.includes('mist') || lowerForecast.includes('haze');
  
  // Icon selection based on conditions and time of day
  if (isClear) {
    return isNight ? 
      <MoonIcon className="h-16 w-16 text-blue-800" aria-hidden="true" /> : 
      <SunIcon className="h-16 w-16 text-yellow-500" aria-hidden="true" />;
  }
  
  if (isCloudy) {
    // Since we don't have CloudSun and CloudMoon icons, we'll customize with the basic cloud
    return <CloudIcon className={`h-16 w-16 ${isNight ? 'text-blue-700' : 'text-blue-500'}`} aria-hidden="true" />;
  }
  
  if (isRainy) {
    // Use Cloud icon with blue styling for rain
    return <div className="relative">
      <CloudIcon className="h-16 w-16 text-gray-500" aria-hidden="true" />
      <div className="absolute bottom-0 left-6 w-4 h-6 bg-blue-400 rounded-b-full"></div>
      <div className="absolute bottom-0 left-10 w-4 h-4 bg-blue-400 rounded-b-full"></div>
    </div>;
  }
  
  if (isSnowy) {
    // Cloud with styled snow indicator
    return <div className="relative">
      <CloudIcon className="h-16 w-16 text-gray-400" aria-hidden="true" />
      <div className="absolute bottom-0 left-6 w-2 h-2 bg-white border border-gray-200 rounded-full"></div>
      <div className="absolute bottom-2 left-10 w-2 h-2 bg-white border border-gray-200 rounded-full"></div>
      <div className="absolute bottom-4 left-8 w-2 h-2 bg-white border border-gray-200 rounded-full"></div>
    </div>;
  }
  
  if (isStormy) {
    return <div className="relative">
      <CloudIcon className="h-16 w-16 text-gray-600" aria-hidden="true" />
      <BoltIcon className="absolute bottom-0 left-8 h-8 w-8 text-yellow-400" aria-hidden="true" />
    </div>;
  }
  
  if (isFoggy) {
    // Cloud with fog styling
    return <div className="relative">
      <CloudIcon className="h-16 w-16 text-gray-300" aria-hidden="true" />
      <div className="absolute -bottom-1 left-4 w-12 h-1 bg-gray-300 rounded-full"></div>
      <div className="absolute -bottom-3 left-2 w-14 h-1 bg-gray-300 rounded-full"></div>
    </div>;
  }
  
  // Default to cloud icon if no specific condition is matched
  return <CloudIcon className="h-16 w-16 text-gray-500" aria-hidden="true" />;
}

/**
 * Weather Card Component
 * 
 * Displays weather information in a visually appealing card
 */
const WeatherCard: React.FC<WeatherCardProps> = ({ data }) => {
  const { location, temperature, temperatureUnit, shortForecast, detailedForecast, timeframe, isError } = data;
  const isNight = shortForecast.toLowerCase().includes('night') || 
                  timeframe === 'tonight';

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
        <div className="text-sm opacity-90">
          {timeframe === 'now' ? 'Current Weather' : 
           timeframe === 'today' ? 'Today\'s Forecast' :
           timeframe === 'tomorrow' ? 'Tomorrow\'s Forecast' :
           timeframe === 'week' ? 'Weekly Forecast' :
           timeframe === 'tonight' ? 'Tonight\'s Forecast' :
           timeframe ? `${timeframe} Forecast` : 'Weather Forecast'}
        </div>
      </div>
      
      {/* Weather Content */}
      <div className="p-5">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            {getWeatherIcon(shortForecast, isNight)}
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
