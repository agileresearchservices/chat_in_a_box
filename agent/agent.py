import json
import ollama
import requests
from typing import Dict, Optional, Any

# Helper function to geocode a city name to coordinates using Nominatim API
def geocode_city(city: str) -> Dict[str, Any]:
    """
    Convert a city name to geographic coordinates using Nominatim API.
    
    Args:
        city: Name of the city to geocode
        
    Returns:
        Dictionary with latitude, longitude, city name, region (state/province), and country
    """
    print(f"Geocoding city: {city}")
    
    # Ensure we're looking for US cities by appending USA
    search_query = f"{city}, USA"
    
    # Nominatim API endpoint
    url = "https://nominatim.openstreetmap.org/search"
    
    # Parameters
    params = {
        "q": search_query,
        "format": "json",
        "limit": 1,  # Get only the top result
        "addressdetails": 1  # Include address details
    }
    
    # Headers (Nominatim requires a User-Agent)
    headers = {
        "User-Agent": "ChatInABox WeatherTool/1.0"
    }
    
    try:
        # Make the request
        response = requests.get(url, params=params, headers=headers)
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
        return {"error": f"Error during geocoding: {str(e)}"}
    except (ValueError, KeyError, TypeError) as e:
        return {"error": f"Error parsing geocoding response: {str(e)}"}

# Helper function to get grid points for coordinates from NWS API
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
        url = f"https://api.weather.gov/points/{latitude},{longitude}"
        
        # Headers (User-Agent is required by NWS API)
        headers = {
            "User-Agent": "ChatInABox WeatherTool/1.0",
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

# Helper function to get weather forecast from NWS API
def get_forecast(forecast_url: str) -> Optional[Dict[str, Any]]:
    """
    Get the weather forecast from the provided NWS forecast URL.
    """
    try:
        headers = {"User-Agent": "ChatInABox WeatherTool/1.0"}
        response = requests.get(forecast_url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error getting forecast: {e}")
        return None

# Main weather function - gets weather for a specified city
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
        response = requests.get(forecast_url)
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

# Define the tool metadata
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather_for_city",
            "description": "Get current weather data for a specified city in the United States. ONLY use this for weather-related queries.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "Name of the city in the United States."
                    }
                },
                "required": ["city"]
            }
        }
    }
]

client = ollama.Client()

def handle_query(query: str):
    """
    Handle a user query by determining if it's weather-related and responding appropriately.
    
    Args:
        query: The user's query string
        
    Returns:
        A response string that either contains weather information or a general answer
    """
    print(f"Processing query: {query}")
    
    # Make the initial call with tools
    response = client.chat(
        model='nemotron-mini',
        messages=[
            {
                'role': 'system', 
                'content': 'You are a helpful assistant that can answer various questions. If a user asks about weather in a specific city, use the get_weather_for_city tool to provide real-time weather data. For non-weather queries, provide a direct answer based on your knowledge without using any tools.'
            },
            {'role': 'user', 'content': query}
        ],
        tools=tools
    )
    message = response.get('message', {})
    print(f"LLM response content: {message.get('content', '')}")

    # Check if a tool call is present in different possible formats
    tool_call = None
    tool_name = None
    tool_args = {}
    
    # Format 1: Standard tool_calls field
    if 'tool_calls' in message and message['tool_calls']:
        tool_call = message['tool_calls'][0]
        print(f"Found tool call in tool_calls format: {tool_call}")
        
        # Extract tool name and arguments
        if 'function' in tool_call:
            function_data = tool_call.get('function', {})
            tool_name = function_data.get('name')
            args_raw = function_data.get('arguments', '{}')
            
            # Parse arguments
            if isinstance(args_raw, str):
                try:
                    tool_args = json.loads(args_raw)
                except json.JSONDecodeError:
                    print(f"Error parsing arguments: {args_raw}")
                    tool_args = {}
            else:
                tool_args = args_raw
    
    # Format 2: Tool call embedded in content
    elif 'content' in message and '<toolcall>' in message['content']:
        content = message['content']
        try:
            tool_call_start = content.find('<toolcall>') + len('<toolcall>')
            tool_call_end = content.find('</toolcall>')
            tool_call_json = content[tool_call_start:tool_call_end].strip()
            tool_call = json.loads(tool_call_json)
            print(f"Found tool call in content: {tool_call}")
            
            # Extract tool name and arguments from different possible formats
            if 'functionName' in tool_call:
                tool_name = tool_call.get('functionName')
                args_raw = tool_call.get('arguments', '{}')
            elif 'function' in tool_call:
                function_data = tool_call.get('function', {})
                if isinstance(function_data, dict):
                    tool_name = function_data.get('name')
                    args_raw = function_data.get('arguments', '{}')
                else:
                    tool_name = function_data
                    args_raw = {}
            elif 'type' in tool_call and tool_call.get('type') == 'function':
                # The model might be using a simplified format
                tool_name = 'get_weather_for_city'  # If we know there's only one function
                args_raw = tool_call.get('arguments', {})
            
            # Parse arguments
            if isinstance(args_raw, str):
                try:
                    tool_args = json.loads(args_raw)
                except json.JSONDecodeError:
                    print(f"Error parsing arguments: {args_raw}")
                    tool_args = {}
            else:
                tool_args = args_raw
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Error parsing tool call JSON: {e}")
    
    print(f"Extracted tool name: {tool_name}")
    print(f"Extracted arguments: {tool_args}")
    
    # Process the tool call if found
    if tool_name == 'get_weather_for_city':
        print(f"Tool call detected: {tool_name}")
        
        # Extract city from arguments
        city = tool_args.get('city', '')
        
        # If no city specified, try to extract from the query
        if not city:
            # Simple extraction for queries like "weather in New York"
            for pattern in ["in ", "at ", "for "]:
                if pattern in query.lower():
                    parts = query.lower().split(pattern, 1)
                    if len(parts) > 1:
                        city_candidate = parts[1].strip().split()[0].capitalize()
                        if len(city_candidate) > 2:  # Avoid single letters or short words
                            city = city_candidate
                            break
        
        print(f"Getting weather for city: '{city}'")
        weather_result = get_weather_for_city(city)
        
        # Format the response nicely with the weather result
        return weather_result
    else:
        print("No weather tool call detected")
    
    # If no weather tool call was made, return a direct answer
    # First, check if we got a response in the content field
    content = message.get('content', '')
    if content and '<toolcall>' not in content:
        return content
    
    # If we have content with a toolcall, extract just the text part
    if content and '<toolcall>' in content:
        clean_content = content.split('<toolcall>')[0].strip()
        if clean_content:
            return clean_content
    
    # If we couldn't get a good response, make a follow-up call for a direct answer
    follow_up = client.chat(
        model='nemotron-mini',
        messages=[
            {'role': 'system', 'content': 'Provide a direct, informative answer to the question.'},
            {'role': 'user', 'content': query}
        ]
    )
    return follow_up.get('message', {}).get('content', 'I could not find an answer to your question.')

if __name__ == '__main__':
    # Test with different types of queries
    print("\n=== Weather for Boston ===")
    print(handle_query("What's the weather in Boston?"))

    print("\n=== Non-weather query ===")
    print(handle_query("Write a hello world python script."))