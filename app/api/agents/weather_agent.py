from pydantic_ai import Agent
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from collections.abc import Sequence
import httpx
import json
import os
import logging

# Configure logging to write to a file
logging.basicConfig(filename='logs/app.log', level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')

# Define the input model with proper type annotations
class WeatherInput(BaseModel):
    """Input parameters for weather API request"""
    city: str
    timeframe: Optional[str] = "now"  # now, today, tomorrow, week

# Define the output model with proper type annotations
class WeatherOutput(BaseModel):
    """Output format for weather API response"""
    location: str  
    temperature: int
    temperatureUnit: str
    shortForecast: str
    detailedForecast: str
    timeframe: str

class WeatherAgent(Agent):
    """
    Agent for handling weather queries using the National Weather Service API.
    
    Capabilities:
    - Geocoding city names to latitude/longitude
    - Retrieving current weather conditions
    - Natural language understanding of location and time (now, today, tomorrow)
    - Formatter for user-friendly weather responses
    """

    def __init__(self):
        super().__init__()
        # Register the get_weather tool
        self.tools = [self.get_weather]
    
    async def get_weather(self, input: WeatherInput) -> WeatherOutput:
        """
        Get weather information for a specific city.
        
        Args:
            input: WeatherInput containing city and optional timeframe
            
        Returns:
            WeatherOutput with weather data for the specified location
        """
        try:
            base_url = os.environ.get('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
            weather_api_endpoint = f"{base_url}/api/weather"
            
            # Prepare the request payload
            payload = {
                "city": input.city,
                "timeframe": input.timeframe
            }
            
            logging.info(f"Calling weather API for {input.city}, timeframe: {input.timeframe}")
            
            # Make the API request
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    weather_api_endpoint,
                    json=payload,
                    headers={'Content-Type': 'application/json'},
                    timeout=10.0
                )
                
                # Check if the request was successful
                if response.status_code != 200:
                    error_message = f"Weather API request failed with status code {response.status_code}"
                    logging.error(error_message)
                    raise Exception(error_message)
                
                # Parse the response
                data = response.json()
                
                if not data.get("success"):
                    error_message = f"Weather API returned error: {data.get('error', 'Unknown error')}"
                    logging.error(error_message)
                    raise Exception(error_message)
                
                # Extract the weather data
                weather_data = data.get("data", {})
                
                # Create and return the WeatherOutput object
                return WeatherOutput(
                    location=weather_data.get("location", "Unknown location"),
                    temperature=weather_data.get("temperature", 0),
                    temperatureUnit=weather_data.get("temperatureUnit", "F"),
                    shortForecast=weather_data.get("shortForecast", ""),
                    detailedForecast=weather_data.get("detailedForecast", ""),
                    timeframe=weather_data.get("timeframe", input.timeframe)
                )
                
        except Exception as e:
            error_message = f"Error retrieving weather data: {str(e)}"
            logging.error(error_message)
            raise Exception(error_message)

    async def process(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> str:
        """
        Process a weather query using the weather API.
        
        Args:
            query: User's natural language query about weather
            parameters: Optional additional parameters
            
        Returns:
            Formatted weather response
        """
        try:
            # Extract the city name from the query
            city = self.extract_city(query)
            
            # Extract timeframe from the query (now, today, tomorrow, week)
            timeframe = self.extract_timeframe(query)
            
            # Override with explicit parameters if provided
            if parameters:
                if 'city' in parameters:
                    city = parameters['city']
                if 'timeframe' in parameters:
                    timeframe = parameters['timeframe']
            
            # Handle case where no city is found
            if not city or city.lower() == "unknown":
                return "No weather data available. Please specify a valid city name."
            
            logging.info(f"Extracted city: {city}, timeframe: {timeframe}")
            
            # Create the input model
            weather_input = WeatherInput(city=city, timeframe=timeframe)
            
            # Get weather data using the tool
            weather_data = await self.get_weather(weather_input)
            
            # Format the response
            return self.format_weather_response(weather_data)
            
        except Exception as e:
            logging.error(f"Error in WeatherAgent.process: {str(e)}")
            return f"I'm sorry, I couldn't get the weather information: {str(e)}"
    
    def extract_city(self, query: str) -> str:
        """
        Extract city name from the query string.
        
        Simple extraction based on common patterns:
        - "weather in [City]"
        - "what's the weather like in [City]"
        - "how's the weather in [City]"
        
        Args:
            query: User's natural language query
            
        Returns:
            Extracted city name or empty string if not found
        """
        import re
        
        # List of patterns to try for extracting city
        patterns = [
            r'(?:weather|temperature|forecast|rain|sunny|cloudy|snow)(?:\s+(?:like|for|in|at|near|of))?\s+(?:in\s+)?([A-Za-z\s]+)(?:\?|$|,|\.|!)',
            r'(?:in|at|near|for)\s+([A-Za-z\s]+)(?:\?|$|,|\.|!)',
            r'(?:what\'s|what is|how\'s|how is)(?:\s+the)?\s+(?:weather|temperature|forecast)(?:\s+(?:like|in|at|near))?\s+(?:in\s+)?([A-Za-z\s]+)(?:\?|$|,|\.|!)',
        ]
        
        # Try each pattern
        for pattern in patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                city = match.group(1).strip()
                # Filter out common non-city words and time-related phrases
                time_related_words = ['right now', 'now', 'today', 'tomorrow', 'tonight', 'this evening', 'next week', 'right', 'currently']
                
                # Clean city name by removing time-related words
                for word in time_related_words:
                    if word in city.lower():
                        city = city.lower().replace(word, '').strip()
                
                if city.lower() not in ['like', 'now', 'today', 'tomorrow', 'the', '']:
                    return city
        
        # If no pattern matched, try to extract the last noun phrase
        words = query.split()
        if len(words) > 0:
            # Simple heuristic: return the last word that's not a question mark
            last_word = words[-1].rstrip('?.,!')
            if last_word.lower() not in ['like', 'weather', 'now', 'today', 'tomorrow']:
                return last_word
        
        return ""
    
    def extract_timeframe(self, query: str) -> str:
        """
        Extract timeframe from the query string.
        
        Args:
            query: User's natural language query
            
        Returns:
            Timeframe: "now", "today", "tomorrow", or "week"
        """
        query_lower = query.lower()
        
        if "tomorrow" in query_lower:
            return "tomorrow"
        elif "today" in query_lower:
            return "today"
        elif "week" in query_lower or "forecast" in query_lower:
            return "week"
        else:
            return "now"  # Default to current weather
    
    def format_weather_response(self, weather: WeatherOutput) -> str:
        """
        Format the weather data into a natural language response that will trigger
        the weather card display in the UI.
        
        Args:
            weather: Weather data from the API
            
        Returns:
            Formatted weather information as a string with specific patterns
            that trigger the weather card parser
        """
        # Format beginning with the required prefix to match weather card parser
        response = f"Making weather request for city: '{weather.location.split(',')[0]}'\n\n"
        
        # Add the weather information header - required for parser to detect
        response += f"Here's the weather for {weather.location}:\n"
        
        # Add temperature with the required emoji and format
        response += f"🌡️ Temperature: {weather.temperature}°{weather.temperatureUnit} {weather.shortForecast.lower()}\n"
        
        # Add detailed forecast
        response += f"Detailed Forecast: {weather.detailedForecast}"
            
        return response
