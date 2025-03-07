"""
Weather API Integration Module for Chat-in-a-Box Agent.

This module provides functionality to retrieve real-time weather data from the National 
Weather Service API for US cities. It includes geocoding, grid point retrieval, and 
forecast data parsing. It is designed to integrate with an AI agent system.

Usage:
    Call handle_query() with a user query to automatically detect and process
    weather-related queries for US cities.
"""

import json
import ollama
import requests
from typing import Dict, Optional, Any, Tuple, List, Union, cast
from functools import lru_cache

# Constants
USER_AGENT = "ChatInABox WeatherTool/1.0"
NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search"
NWS_API_BASE_URL = "https://api.weather.gov"
MODEL_NAME = "nemotron-mini"

@lru_cache(maxsize=100)
def geocode_city(city: str) -> Dict[str, Any]:
    """
    Convert a city name to geographic coordinates using Nominatim API.
    
    Args:
        city: Name of the city to geocode
        
    Returns:
        Dictionary with latitude, longitude, city name, region (state/province), and country,
        or an error dictionary with an 'error' key
    """
    print(f"Geocoding city: {city}")
    
    # Ensure we're looking for US cities by appending USA
    search_query = f"{city}, USA"
    
    # Parameters
    params = {
        "q": search_query,
        "format": "json",
        "limit": 1,  # Get only the top result
        "addressdetails": 1  # Include address details
    }
    
    # Headers (Nominatim requires a User-Agent)
    headers = {
        "User-Agent": USER_AGENT
    }
    
    try:
        # Make the request
        response = requests.get(NOMINATIM_API_URL, params=params, headers=headers)
        response.raise_for_status()  # Raise an exception for HTTP errors
        
        # Parse response
        data = response.json()
        
        # Check if we got any results
        if not data:
            return {"error": f"No location found for '{city}'"}
        
        # Extract location data from first result
        location = data[0]
        address = location.get("address", {})
        
        # Extract relevant data
        result = {
            "latitude": float(location.get("lat", 0)),
            "longitude": float(location.get("lon", 0)),
            "city": address.get("city") or address.get("town") or address.get("village") or city,
            "region": address.get("state", "Unknown"),
            "country": address.get("country", "Unknown"),
            "display_name": location.get("display_name", "Unknown")
        }
        
        # If country is unknown but display_name contains "United States", set country to "United States"
        if result["country"] == "Unknown" and "United States" in result["display_name"]:
            result["country"] = "United States"
        
        print(f"Location data: {result}")
        
        return result
        
    except requests.exceptions.RequestException as e:
        error_result = {"error": f"Error during geocoding: {str(e)}"}
        return error_result
    except (ValueError, KeyError, TypeError) as e:
        error_result = {"error": f"Error parsing geocoding response: {str(e)}"}
        return error_result

def get_grid_points(latitude: float, longitude: float) -> Optional[Dict[str, Any]]:
    """
    Get grid points from the National Weather Service API for the given coordinates.
    
    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate
        
    Returns:
        Dictionary containing grid points data or None if an error occurs
    """
    try:
        print(f"Getting grid points for coordinates: {latitude}, {longitude}")
        
        # NWS API endpoint for points
        url = f"{NWS_API_BASE_URL}/points/{latitude},{longitude}"
        
        # Headers (User-Agent is required by NWS API)
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json"
        }
        
        # Make the request
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        # Parse response
        data = response.json()
        
        # Extract and return the relevant data
        if "properties" not in data:
            print("No properties found in grid points response")
            return None
            
        properties = data["properties"]
        forecast_url = properties.get("forecast")
        
        if not forecast_url:
            print("No forecast URL found in grid points response")
            return None
            
        print(f"Found forecast URL: {forecast_url}")
        return {"forecast": forecast_url}
        
    except requests.exceptions.RequestException as e:
        print(f"Error getting grid points: {e}")
        return None
    except (ValueError, KeyError, TypeError) as e:
        print(f"Error parsing grid points response: {e}")
        return None

def get_weather_for_city(city: str) -> str:
    """
    Get weather information for a city using the National Weather Service API.
    
    Args:
        city: Name of the city to get weather information for
        
    Returns:
        A string containing weather information or an error message
    """
    if not city:
        return "Please provide a city name to check the weather."
    
    # Step 1: Convert city name to coordinates
    print(f"Geocoding city: {city}")
    location_data = geocode_city(city)
    if "error" in location_data:
        return f"Could not find location information for '{city}'. {location_data['error']}"
    
    # Step 2: Validate this is a US location (NWS API only works for US)
    if location_data.get("country") != "United States":
        return f"The National Weather Service API only works for US locations. '{city}' appears to be in {location_data.get('country', 'an unsupported country')}."
    
    # Step 3: Get grid points for the location
    latitude = location_data["latitude"]
    longitude = location_data["longitude"]
    grid_data = get_grid_points(latitude, longitude)
    
    if not grid_data:
        return f"Could not get weather grid information for {city} (coordinates: {latitude}, {longitude})."
    
    # Step 4: Extract forecast URL from grid points
    forecast_url = grid_data.get("forecast")
    if not forecast_url:
        return f"Could not find forecast URL for {city}."
    
    # Step 5: Get forecast data
    try:
        headers = {"User-Agent": USER_AGENT}
        response = requests.get(forecast_url, headers=headers)
        response.raise_for_status()
        forecast_data = response.json()
        
        # Step 6: Extract and format relevant weather information
        properties = forecast_data.get("properties", {})
        periods = properties.get("periods", [])
        
        if not periods:
            return f"No forecast periods found for {city}."
        
        # Get the current period
        current_period = periods[0]
        
        # Extract details
        temperature = current_period.get("temperature")
        temperature_unit = current_period.get("temperatureUnit", "F")
        forecast = current_period.get("shortForecast", "No forecast available")
        detailed_forecast = current_period.get("detailedForecast", "No detailed forecast available")
        
        # Format the location name nicely
        location_name = f"{location_data.get('city')}, {location_data.get('region')}"
        
        # Construct a nice response
        weather_info = f"🌡️ Current Weather for {location_name}:\n\n"
        weather_info += f"Temperature: {temperature}°{temperature_unit}\n"
        weather_info += f"Conditions: {forecast}\n"
        weather_info += f"\nDetailed Forecast:\n{detailed_forecast}"
        
        return weather_info
        
    except requests.exceptions.RequestException as e:
        return f"Error retrieving forecast data for {city}: {str(e)}"
    except (ValueError, KeyError, TypeError) as e:
        return f"Error parsing forecast data for {city}: {str(e)}"

# Define the tool metadata for the LLM
tools = [
    {
        'function': {
            'name': 'get_weather_for_city',
            'description': 'Get the current weather conditions for a specific US city. This tool MUST NOT be used unless the user explicitly specifies a city name. If no city is mentioned, ask the user to specify a city instead of guessing.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'city': {
                        'type': 'string',
                        'description': 'The name of the city in the US to get weather for. Do not hallucinate or guess this value if the user has not explicitly mentioned a city.'
                    }
                },
                'required': ['city']
            }
        }
    }
]

# Initialize Ollama client
client = ollama.Client()

def handle_weather_query(query: str) -> str:
    """
    Handle a weather-related query by extracting the city and getting weather information.
    
    Args:
        query: The user's query string
        
    Returns:
        A response string containing weather information or an error message
    """
    # Check if query has a city name before proceeding
    city_indicators = ["in ", "at ", "for ", "of "]
    has_explicit_city = any(indicator in query.lower() for indicator in city_indicators)
    
    if not has_explicit_city:
        return "I'd be happy to provide weather information, but I need to know which city you're asking about. Could you please specify a city name?"
    
    # Extract city from query
    city = ""
    for pattern in city_indicators:
        if pattern in query.lower():
            parts = query.lower().split(pattern, 1)
            if len(parts) > 1:
                city_candidate = parts[1].strip().split()[0].capitalize()
                if len(city_candidate) > 2:
                    city = city_candidate
                    break
    
    if not city:
        return "Could not determine the city from your query. Please specify a city name."
    
    return get_weather_for_city(city)

def handle_query(query: str) -> str:
    """
    Handle a user query by determining if it's weather-related and responding appropriately.
    
    Args:
        query: The user's query string
        
    Returns:
        A response string that either contains weather information or a general answer
    """
    print(f"Processing query: {query}")
    
    weather_keywords = ["weather", "temperature", "forecast", "rain", "snow", "sunny", "cloudy", "storm", "cold", "hot", "degrees"]
    is_likely_weather_query = any(keyword in query.lower() for keyword in weather_keywords)
    
    if is_likely_weather_query:
        return handle_weather_query(query)
    
    print("Query appears non-weather related, making direct call to LLM")
    direct_response = client.chat(
        model=MODEL_NAME,
        messages=[
            {
                'role': 'system',
                'content': 'You are a helpful AI assistant with broad knowledge. Answer this question thoroughly and accurately based on your general knowledge.'
            },
            {'role': 'user', 'content': query}
        ],
        options={
            "temperature": 0.7,
            "top_p": 0.9
        }
    )
    return direct_response.get('message', {}).get('content', 'I could not generate a response to your question.')

if __name__ == '__main__':
    # Test with different types of queries
    print("\n=== Weather for Boston ===")
    print(handle_query("What's the weather in Boston?"))

    print("\n=== Vague weather query ===")
    print(handle_query("Is it cold outside?"))

    print("\n=== Non-weather query ===")
    print(handle_query("When should I plant tomatoes?"))

    print("\n=== Technical query ===")
    print(handle_query("How do I reset my iphone for trade in?"))

