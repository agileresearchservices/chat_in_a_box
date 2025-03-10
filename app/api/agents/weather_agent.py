from pydantic_ai import Agent
from typing import Optional, Dict, Any
from collections.abc import Sequence
import httpx
import json
import asyncio
import os
import re

class WeatherAgent(Agent):
    """
    PydanticAI agent for handling weather queries using the existing weather service.
    
    Integrates with:
    - Weather Service (/app/services/weather.service.ts)
    - Weather API Route (/app/api/weather/route.ts)
    
    Features:
    - Uses existing geocoding via Nominatim API
    - Real-time weather data from National Weather Service API
    - US-only location support
    - Error handling and logging
    """
    
    def __init__(self):
        super().__init__()
        self.city_patterns = [
            r'(?:in|at|for) ([\w\s]+?)(?:\?|$|,|\s+(?:today|now|tomorrow|tonight))',
            r'(?:weather|temperature|forecast) (?:in|at|for) ([\w\s]+?)(?:\?|$|,|\s+(?:today|now|tomorrow|tonight))'
        ]
    
    def extract_city(self, query: str) -> Optional[str]:
        """Extract city name from query using regex patterns."""
        for pattern in self.city_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match and match.group(1):
                # Clean up the extracted city name
                city = match.group(1).strip()
                city = re.sub(r'\s+', ' ', city)  # Normalize spaces
                city = re.sub(r'^the\s+', '', city, flags=re.IGNORECASE)  # Remove leading "the"
                city = re.sub(r'\s+city$', '', city, flags=re.IGNORECASE)  # Remove trailing "city"
                return city
        return None
    
    def process(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> str:
        """
        Process a weather query using the existing weather service.
        
        Args:
            query: The user's weather query
            parameters: Additional parameters including city name and API endpoints
            
        Returns:
            Formatted weather response
        """
        # Extract city from query if not provided in parameters
        city = parameters.get('city') if parameters else None
        if not city:
            city = self.extract_city(query)
            
        if not city:
            return "I couldn't understand which city you're asking about. Please specify a city name."
            
        base_url = os.environ.get('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
        weather_api_endpoint = f"{base_url}{parameters.get('weatherApiEndpoint', '/api/weather')}"
        
        try:
            # Create an event loop to run async code in sync context
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            async def fetch_weather():
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        weather_api_endpoint,
                        json={'city': city},
                        headers={'Content-Type': 'application/json'}
                    )
                    
                    if response.status_code == 404:
                        return f"I couldn't find weather information for {city}. This service only works for US cities."
                        
                    response.raise_for_status()
                    data = response.json()
                    
                    if not data.get('data'):
                        return f"Sorry, I couldn't get weather information for {city}. Please try again later."
                    
                    weather_data = data['data']
                    # Format the response using the existing structure
                    return f"""Here's the current weather for {weather_data['location']}:
🌡️ Temperature: {weather_data['temperature']}°{weather_data['temperatureUnit']}
{weather_data['shortForecast']}

Detailed Forecast:
{weather_data['detailedForecast']}"""
            
            # Run the async function in the event loop
            result = loop.run_until_complete(fetch_weather())
            loop.close()
            return result
                
        except httpx.HTTPError as e:
            return f"Sorry, I encountered an error getting weather information: {str(e)}"
        except Exception as e:
            return f"An unexpected error occurred: {str(e)}"
