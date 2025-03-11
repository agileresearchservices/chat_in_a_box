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
    - Time-based forecast selection (today, tomorrow, tonight)
    - Error handling and logging
    """
    
    def __init__(self):
        super().__init__()
        # Define time patterns first to identify and remove them from city extraction
        self.time_patterns = [
            r'\b(?:today|now|current(?:ly)?)\b',
            r'\b(?:tomorrow|tmrw)\b',
            r'\b(?:tonight|this evening|evening|later today)\b',
            r'\b(?:this|next)\s+(?:week|weekend)\b',
            r'\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b'
        ]
        
        # Combined time pattern for pre-filtering
        self.combined_time_pattern = r'\b(?:today|now|current(?:ly)?|tomorrow|tmrw|tonight|this evening|evening|later today|this\s+(?:week|weekend)|next\s+(?:week|weekend)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b'
        
        # Words that shouldn't be included in city names
        self.filter_words = [
            'like', 'about', 'tell', 'how', 'what', 'when', 'where', 'is', 'will', 
            'would', 'should', 'could', 'can', 'me', 'for', 'the', 'going', 'to', 'be'
        ]
        self.filter_words_pattern = r'\b(?:' + '|'.join(self.filter_words) + r')\b'
        
        # Phrases before city names that should be removed
        self.city_prefix_patterns = [
            r'weather\s+(?:like\s+)?(?:in|at|for|of)\s+',
            r'temperature\s+(?:like\s+)?(?:in|at|for|of)\s+',
            r'forecast\s+(?:like\s+)?(?:in|at|for|of)\s+',
            r'(?:what|how)(?:\'s|\s+is)\s+(?:the\s+)?(?:weather|forecast|temperature)\s+(?:like\s+)?(?:in|at|for|of)\s+',
            r'(?:what|how)\s+(?:will|is|are)\s+(?:the\s+)?(?:weather|forecast|temperature)\s+(?:like\s+)?(?:in|at|for|of)\s+',
            r'(?:will|is|are)\s+(?:it|there)\s+(?:going\s+to\s+be)?\s+(?:rain|snow|sunny|cloudy|windy)\s+(?:in|at)\s+'
        ]
        
        # More precise city extraction patterns that exclude common false positives
        self.city_patterns = [
            # Match cities after "in", "at", "for", or "of"
            r'(?:^|\s+)(?:in|at|for|of)\s+([a-zA-Z\s.-]+?)(?:,|\s+(?:and|or|\?|$|today|now|tomorrow|tonight|this|next))',
            
            # Match cities in "weather in X" pattern
            r'(?:weather|forecast|temperature)(?:\s+(?:(?:is|for|in|at|of)))+\s+([a-zA-Z\s.-]+?)(?:,|\s+(?:and|or|\?|$|today|now|tomorrow|tonight|this|next))',
            
            # Match cities in question patterns
            r'(?:what|how)(?:\'s|\s+is)\s+(?:the\s+)?(?:weather|forecast|temperature)\s+(?:like\s+)?(?:in|at|for|of)\s+([a-zA-Z\s.-]+?)(?:,|\s+(?:and|or|\?|$|today|now|tomorrow|tonight|this|next))'
        ]
        
        self.time_mappings = {
            'today': 'today',
            'now': 'now',
            'currently': 'now',
            'current': 'now',
            'tomorrow': 'tomorrow',
            'tmrw': 'tomorrow',
            'tonight': 'tonight',
            'this evening': 'tonight',
            'evening': 'tonight',
            'later today': 'tonight',
            'this week': 'week',
            'next week': 'next_week',
            'this weekend': 'weekend',
            'next weekend': 'next_weekend',
            'monday': 'monday',
            'tuesday': 'tuesday',
            'wednesday': 'wednesday',
            'thursday': 'thursday',
            'friday': 'friday',
            'saturday': 'saturday',
            'sunday': 'sunday'
        }
    
    def clean_city_name(self, city: str) -> str:
        """Clean a potential city name by removing common non-city words and patterns."""
        if not city:
            return ""
            
        # Clean up the city name
        city = city.strip()
        city = re.sub(r'[\\\/]+', '', city)  # Remove slashes
        city = re.sub(r'\s+', ' ', city)  # Normalize spaces
        city = re.sub(r'^the\s+', '', city, flags=re.IGNORECASE)  # Remove leading "the"
        city = re.sub(r'\s+city$', '', city, flags=re.IGNORECASE)  # Remove trailing "city"
        
        # Remove time words from city
        for time_pattern in self.time_patterns:
            city = re.sub(time_pattern, '', city, flags=re.IGNORECASE)
            
        # Remove filter words that shouldn't be part of city names
        city = re.sub(self.filter_words_pattern, '', city, flags=re.IGNORECASE)
        
        # Normalize spaces again after all the replacements
        city = re.sub(r'\s+', ' ', city).strip()
            
        return city
        
    def extract_city(self, query: str) -> Optional[str]:
        """
        Extract city name from query using regex patterns.
        Pre-filters time references to avoid including them in city names.
        """
        # Special handling for common multi-word city names that were having issues
        if re.search(r'\bnew\s+york\b', query, re.IGNORECASE):
            return "New York"
        if re.search(r'\blos\s+angeles\b', query, re.IGNORECASE):
            return "Los Angeles"
        if re.search(r'\bsan\s+francisco\b', query, re.IGNORECASE):
            return "San Francisco"
        if re.search(r'\blas\s+vegas\b', query, re.IGNORECASE):
            return "Las Vegas"
        
        # First, try to handle specific common patterns
        for prefix_pattern in self.city_prefix_patterns:
            match = re.search(prefix_pattern + r'([a-zA-Z\s.-]{2,25}?)(?:[,\s]|$)', query, re.IGNORECASE)
            if match and match.group(1):
                city = self.clean_city_name(match.group(1))
                if city and len(city) > 1:
                    return city
        
        # Try explicit patterns for city extraction
        for pattern in self.city_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match and match.group(1):
                city = self.clean_city_name(match.group(1))
                if city and len(city) > 1:
                    return city
                    
        # Check for multi-word city patterns in a more general way
        multiword_city_pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b'
        match = re.search(multiword_city_pattern, query)
        if match and match.group(1):
            city = self.clean_city_name(match.group(1))
            if city and len(city) > 1:
                return city
        
        # If all pattern matching failed, try a simpler approach
        # Look for the first word after "in", "at", or "for"
        prepositions = ['in', 'at', 'for']
        for prep in prepositions:
            prep_match = re.search(r'\b' + prep + r'\s+([a-zA-Z\s.-]{2,25}?)(?:[,\s]|$)', query, re.IGNORECASE)
            if prep_match and prep_match.group(1):
                city = self.clean_city_name(prep_match.group(1))
                if city and len(city) > 1:
                    return city
        
        # Last resort - look for capitalized words that might be city names
        # This is less reliable but can catch simple "Weather in Miami" type queries
        words = query.split()
        for word in words:
            # Check if word is capitalized and not a common word to exclude
            if (word[0].isupper() if word else False) and len(word) > 2:
                if not re.search(self.filter_words_pattern, word, re.IGNORECASE):
                    return word
                    
        # Try to find consecutive capitalized words that might be a multi-word city name
        capitalized_words = []
        for i, word in enumerate(words):
            if (word[0].isupper() if word and len(word) > 0 else False) and len(word) > 1:
                if i > 0 and len(capitalized_words) > 0 and words[i-1] in capitalized_words:
                    capitalized_words.append(word)
                elif len(capitalized_words) == 0:
                    capitalized_words.append(word)
                    
        if len(capitalized_words) > 1:
            potential_city = " ".join(capitalized_words)
            if not re.search(self.filter_words_pattern, potential_city, re.IGNORECASE):
                return potential_city
            
        return None
    
    def extract_timeframe(self, query: str) -> Optional[str]:
        """Extract time reference from query using regex patterns."""
        query_lower = query.lower()
        
        # First try direct matches for common time phrases
        for time_key, time_value in self.time_mappings.items():
            if time_key in query_lower:
                return time_value
        
        # Then try regex patterns for more complex time references
        for pattern in self.time_patterns:
            match = re.search(pattern, query_lower)
            if match:
                time_phrase = match.group(0)
                # Try to find a mapping for this time phrase
                for time_key, time_value in self.time_mappings.items():
                    if time_key in time_phrase:
                        return time_value
                # If no mapping found, return the matched phrase as is
                return time_phrase
        
        # Default to current conditions if no time reference found
        return 'now'
    
    def process(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> str:
        """
        Process a weather query using the existing weather service.
        
        Args:
            query: The user's weather query
            parameters: Additional parameters including city name, timeframe, and API endpoints
            
        Returns:
            Formatted weather response
        """
        # Extract city and timeframe from query if not provided in parameters
        city = parameters.get('city') if parameters else None
        timeframe = parameters.get('timeframe') if parameters else None
        
        if not city:
            city = self.extract_city(query)
            if not city:
                return "I couldn't understand which city you're asking about. Please specify a city name."
        
        # Extract timeframe if not provided
        if not timeframe:
            timeframe = self.extract_timeframe(query)
            
        base_url = os.environ.get('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
        weather_api_endpoint = f"{base_url}{parameters.get('weatherApiEndpoint', '/api/weather')}"
        
        try:
            # Create an event loop to run async code in sync context
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            async def fetch_weather():
                async with httpx.AsyncClient() as client:
                    # Log the request parameters for debugging
                    print(f"Making weather request for city: '{city}', timeframe: '{timeframe}'")
                    
                    # Send both city and timeframe to the weather API
                    response = await client.post(
                        weather_api_endpoint,
                        json={'city': city, 'timeframe': timeframe},
                        headers={'Content-Type': 'application/json'}
                    )
                    
                    if response.status_code == 404:
                        return f"I couldn't find weather information for {city}. This service only works for US cities."
                    
                    # Handle other error codes with more details
                    if response.status_code >= 400:
                        # First, try to parse the response as JSON
                        try:
                            error_data = response.json()
                            
                            # Check for specific error messages about invalid/not found locations
                            if 'errorMessage' in error_data and 'Could not find US location' in error_data['errorMessage']:
                                return f"I couldn't find weather information for '{city}'. Please make sure you've entered a valid US city name."
                                
                            if 'error' in error_data:
                                error_msg = error_data['error']
                                if 'find' in error_msg.lower() and 'location' in error_msg.lower():
                                    return f"I couldn't find weather information for '{city}'. Please make sure you've entered a valid US city name."
                                return f"Sorry, I couldn't get weather information for {city} with timeframe '{timeframe}'. Error: {error_msg}"
                        except json.JSONDecodeError:
                            # If not JSON, try to check the raw response text
                            error_text = response.text
                            if 'Could not find US location' in error_text or 'No location found' in error_text:
                                return f"I couldn't find weather information for '{city}'. Please make sure you've entered a valid US city name."
                            
                            return f"Sorry, I couldn't get weather information for {city} with timeframe '{timeframe}'. The weather service returned an error."
                        
                    response.raise_for_status()
                    data = response.json()
                    
                    if not data.get('data'):
                        return f"Sorry, I couldn't get weather information for {city}. Please try again later."
                    
                    weather_data = data['data']
                    
                    # Format the response based on the timeframe requested
                    time_description = ""
                    if timeframe == 'now':
                        time_description = "current"
                    elif timeframe == 'today':
                        time_description = "today's"
                    elif timeframe == 'tomorrow':
                        time_description = "tomorrow's"
                    elif timeframe == 'tonight':
                        time_description = "tonight's"
                    elif timeframe == 'week' or timeframe == 'next_week':
                        time_description = "this week's"
                    elif timeframe == 'weekend' or timeframe == 'next_weekend':
                        time_description = "weekend"
                    else:
                        # For any other timeframe or unknown values, default to "current"
                        # This ensures we always have a time descriptor in the response
                        time_description = timeframe if timeframe else "current"
                    
                    # Format the response using the existing structure with timeframe context
                    return f"""Here's the {time_description} weather for {weather_data['location']}:
🌡️ Temperature: {weather_data['temperature']}°{weather_data['temperatureUnit']}
{weather_data['shortForecast']}

Detailed Forecast:
{weather_data['detailedForecast']}"""
            
            # Run the async function in the event loop
            result = loop.run_until_complete(fetch_weather())
            loop.close()
            return result
                
        except httpx.HTTPError as e:
            status_code = None
            if hasattr(e, 'response') and e.response:
                status_code = e.response.status_code
                
            error_detail = str(e)
            if 'Could not find US location' in error_detail:
                return f"I couldn't find weather information for '{city}'. Please make sure you've entered a valid US city name."
            
            # Provide more specific error messages based on error type
            if 'Cannot connect' in error_detail or 'Connection refused' in error_detail:
                return f"Sorry, I can't connect to the weather service right now. Please try again later."
            elif status_code == 500:
                return f"Sorry, the weather service is experiencing internal issues. This might be due to an invalid city name or an issue with the National Weather Service API."
            else:
                return f"Sorry, I encountered an error getting weather information: {error_detail}"
        except Exception as e:
            error_msg = str(e)
            if 'Could not find US location' in error_msg:
                return f"I couldn't find weather information for '{city}'. Please make sure you've entered a valid US city name."
            return f"An unexpected error occurred: {error_msg}"
