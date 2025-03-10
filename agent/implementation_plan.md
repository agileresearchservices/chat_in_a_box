# Comprehensive Weather Agent Implementation Plan with Next.js and PydanticAI

## Overview
This plan details how to integrate weather agent capabilities into Chat-in-a-Box using Next.js architecture and PydanticAI. We'll leverage Next.js API routes, React components, and TypeScript to create a modular, maintainable solution. PydanticAI will be explicitly used for agent and tool management, ensuring seamless integration with existing components.

## Implementation Components

### 1. Weather Service Module
- Port the Python geocoding and NWS API functionality to TypeScript.
- Use PydanticAI for agent and tool management, ensuring compatibility with existing systems.
- Implement error handling and request caching.

### 2. Weather API Route
- Create a dedicated API route that accepts city parameters.
- Validate inputs and handle error states.
- Call weather service functions and return structured responses.

### 3. Tool Definition System
- Define a standard tool interface structure using PydanticAI.
- Register the weather tool with metadata similar to the example.
- Create a tool selection mechanism that integrates with existing query analysis.

### 4. Chat API Enhancement
- Add tool detection logic to the chat API route.
- Implement function calling capabilities with PydanticAI, ensuring compatibility with the current chat flow.
- Route appropriate queries to the weather tool.
- Integrate tool responses into the chat stream.

### 5. UI Components
- Create a specialized component for rendering weather information.
- Include weather icons and formatting.
- Implement responsive design for weather data.

## Implementation Steps

### Step 1: Create Weather Service
- Build the geocoding service using OpenStreetMap API.
- Implement NWS API integration for US weather data.
- Add caching with SWR or React Query.
- Write comprehensive error handling.

### Step 2: Create Weather API Route
- Define the request/response interface.
- Implement input validation.
- Connect to weather service.
- Add appropriate CORS and rate limiting.

### Step 3: Tool Definition
- Use PydanticAI to define the tools registry and interface.
- Define the weather tool with appropriate function schema.
- Implement tool selection logic based on query intent.

### Step 4: Chat Integration
- Update the chat API to detect weather-related queries.
- Add function calling to Ollama API parameters using PydanticAI.
- Process function call responses and tool outputs.
- Merge tool responses into the chat stream.

### Step 5: UI Enhancement
- Create specialized component for weather responses.
- Add weather icons and visual formatting.
- Implement responsive design for weather information.
- Add loading states for weather data retrieval.

## Technical Considerations
- Use TypeScript interfaces for all data structures.
- Implement proper error handling and fallbacks.
- Add appropriate caching strategies.
- Ensure responsive design for all screen sizes.
- Consider internationalization for non-US locations in the future.

## Installation Instructions
- Install PydanticAI with the following command:
  ```bash
  pip install 'pydantic-ai[logfire]'
  ```
- Follow the [Logfire setup docs](https://ai.pydantic.dev/logfire/) to configure Logfire.

## File Structure
```typescript
// lib/tools/weather/types.ts - TypeScript interfaces for weather data
// lib/tools/weather/geocoding.ts - City to coordinates conversion service
// lib/tools/weather/nws-api.ts - Weather data retrieval from NWS API
// lib/tools/weather/index.ts - Main weather service exports
// app/api/tools/weather/route.ts - Next.js API endpoint
// lib/tools/types.ts - Tool interface definitions
// lib/tools/registry.ts - Tool registration system
// lib/tools/weather/tool.ts - Weather tool implementation
// app/api/chat/route.ts - Updates to existing chat API
// lib/chat/tool-detection.ts - Query analysis for tool routing
// lib/chat/function-calling.ts - Function calling implementation
// components/chat/message-types/WeatherMessage.tsx - Weather display component
// components/chat/message-types/index.ts - Export for message type components
// components/ui/WeatherIcon.tsx - Weather condition icons
// tests/lib/tools/weather.test.ts - Service unit tests
// tests/lib/tools/registry.test.ts - Tool registry tests
// tests/api/tools/weather.test.ts - API route tests
// tests/api/chat-with-tools.test.ts - End-to-end tests
```

## Implementation Details

### Data Interfaces

```typescript
// Example type definitions
export interface LocationData {
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  error?: string;
}

export interface WeatherData {
  temperature: number;
  conditions: string;
  forecast: string;
  location: string;
  timestamp: string;
  error?: string;
}
```

### API Route Handler

```typescript
// Route handler example
export async function POST(req: Request) {
  const { city } = await req.json();
  
  if (!city || typeof city !== 'string') {
    return Response.json({ error: 'Valid city parameter required' }, { status: 400 });
  }
  
  try {
    const weatherData = await getWeatherForCity(city);
    return Response.json({ weather: weatherData });
  } catch (error) {
    console.error('Weather API error:', error);
    return Response.json({ error: 'Failed to fetch weather data' }, { status: 500 });
  }
}
```

### Tool Definition

```typescript
// Example tool definition
export const weatherTool: Tool = {
  name: 'get_weather_for_city',
  description: 'Get the current weather conditions for a specific US city.',
  parameters: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'The name of the city in the US to get weather for.'
      }
    },
    required: ['city']
  },
  execute: async (params: any) => {
    const { city } = params;
    return getWeatherForCity(city);
  }
};
```

### Chat API Integration

```typescript
// Example chat API enhancement with function calling
// Addition to existing app/api/chat/route.ts file
const messages = [...previousMessages, { role: 'user', content: prompt }];

// Add tools if query seems to need them
const toolsToInclude = detectRequiredTools(prompt);
const params = toolsToInclude.length > 0 ? 
  { 
    messages, 
    tools: toolsToInclude.map(t => t.definition),
    tool_choice: "auto" 
  } : 
  { messages };

// Make enhanced Ollama call with possible function calling
const response = await ollama.chat({ model, ...params });

// Handle potential tool calls in response
if (response.tool_calls && response.tool_calls.length > 0) {
  // Execute the tool and get results
  const toolResults = await executeToolCall(response.tool_calls[0]);
  
  // Add tool results to conversation
  messages.push({
    role: 'assistant',
    content: '',
    tool_calls: response.tool_calls
  });
  
  messages.push({
    role: 'tool',
    tool_call_id: response.tool_calls[0].id,
    content: JSON.stringify(toolResults)
  });
  
  // Get final response with tool results incorporated
  const finalResponse = await ollama.chat({
    model,
    messages
  });
  
  return finalResponse;
}

return response;
```

### UI Component

```typescript
// Example WeatherMessage component
export function WeatherMessage({ data }: { data: WeatherData }) {
  return (
    <div className="rounded-lg bg-blue-50 p-4 shadow-sm">
      <div className="flex items-center">
        <WeatherIcon condition={data.conditions} className="h-10 w-10" />
        <div className="ml-3">
          <h4 className="font-medium">{data.location}</h4>
          <div className="text-2xl font-bold">{data.temperature}°F</div>
          <div className="text-gray-600">{data.conditions}</div>
        </div>
      </div>
      <p className="mt-2 text-sm">{data.forecast}</p>
    </div>
  );
}
```

### Tool Detection Implementation

```typescript
// Example tool detection logic
export function detectRequiredTools(query: string): Tool[] {
  const weatherKeywords = [
    "weather", "temperature", "forecast", "rain", "snow", 
    "sunny", "cloudy", "storm", "cold", "hot", "degrees"
  ];
  
  // Check if query contains weather related keywords
  const isWeatherQuery = weatherKeywords.some(keyword => 
    query.toLowerCase().includes(keyword)
  );
  
  // Check for city patterns (similar to Python example)
  const cityIndicators = ["in ", "at ", "for ", "of "];
  const hasExplicitCity = cityIndicators.some(indicator => 
    query.toLowerCase().includes(indicator)
  );
  
  if (isWeatherQuery && hasExplicitCity) {
    return [weatherTool];
  }
  
  return [];
}
```

## Testing Strategy

### Unit Tests
- Test geocoding service with mock API responses
- Validate weather data parsing
- Ensure proper error handling for API failures
- Verify tool detection logic accuracy

### Integration Tests
- Test complete tool execution flow
- Verify chat API properly detects weather queries
- Ensure proper streaming of tool responses

## Deployment Considerations

- Update environment variables for API keys if needed
- Ensure proper error logging for production environment
- Add monitoring for weather API usage and reliability
- Consider rate limiting for external APIs to prevent abuse

This implementation plan will create a fully integrated weather agent capability that maintains the existing RAG functionality while adding specialized tool execution.

### Technology Stack required: ai.pydantic.dev
from __future__ import annotations as _annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Any

import logfire
from devtools import debug
from httpx import AsyncClient

from pydantic_ai import Agent, ModelRetry, RunContext

# 'if-token-present' means nothing will be sent (and the example will work) if you don't have logfire configured
logfire.configure(send_to_logfire='if-token-present')


@dataclass
class Deps:
    client: AsyncClient
    weather_api_key: str | None
    geo_api_key: str | None


weather_agent = Agent(
    'openai:gpt-4o',
    # 'Be concise, reply with one sentence.' is enough for some models (like openai) to use
    # the below tools appropriately, but others like anthropic and gemini require a bit more direction.
    system_prompt=(
        'Be concise, reply with one sentence.'
        'Use the `get_lat_lng` tool to get the latitude and longitude of the locations, '
        'then use the `get_weather` tool to get the weather.'
    ),
    deps_type=Deps,
    retries=2,
    instrument=True,
)


@weather_agent.tool
async def get_lat_lng(
    ctx: RunContext[Deps], location_description: str
) -> dict[str, float]:
    """Get the latitude and longitude of a location.

    Args:
        ctx: The context.
        location_description: A description of a location.
    """
    if ctx.deps.geo_api_key is None:
        # if no API key is provided, return a dummy response (London)
        return {'lat': 51.1, 'lng': -0.1}

    params = {
        'q': location_description,
        'api_key': ctx.deps.geo_api_key,
    }
    with logfire.span('calling geocode API', params=params) as span:
        r = await ctx.deps.client.get('https://geocode.maps.co/search', params=params)
        r.raise_for_status()
        data = r.json()
        span.set_attribute('response', data)

    if data:
        return {'lat': data[0]['lat'], 'lng': data[0]['lon']}
    else:
        raise ModelRetry('Could not find the location')


@weather_agent.tool
async def get_weather(ctx: RunContext[Deps], lat: float, lng: float) -> dict[str, Any]:
    """Get the weather at a location.

    Args:
        ctx: The context.
        lat: Latitude of the location.
        lng: Longitude of the location.
    """
    if ctx.deps.weather_api_key is None:
        # if no API key is provided, return a dummy response
        return {'temperature': '21 °C', 'description': 'Sunny'}

    params = {
        'apikey': ctx.deps.weather_api_key,
        'location': f'{lat},{lng}',
        'units': 'metric',
    }
    with logfire.span('calling weather API', params=params) as span:
        r = await ctx.deps.client.get(
            'https://api.tomorrow.io/v4/weather/realtime', params=params
        )
        r.raise_for_status()
        data = r.json()
        span.set_attribute('response', data)

    values = data['data']['values']
    # https://docs.tomorrow.io/reference/data-layers-weather-codes
    code_lookup = {
        1000: 'Clear, Sunny',
        1100: 'Mostly Clear',
        1101: 'Partly Cloudy',
        1102: 'Mostly Cloudy',
        1001: 'Cloudy',
        2000: 'Fog',
        2100: 'Light Fog',
        4000: 'Drizzle',
        4001: 'Rain',
        4200: 'Light Rain',
        4201: 'Heavy Rain',
        5000: 'Snow',
        5001: 'Flurries',
        5100: 'Light Snow',
        5101: 'Heavy Snow',
        6000: 'Freezing Drizzle',
        6001: 'Freezing Rain',
        6200: 'Light Freezing Rain',
        6201: 'Heavy Freezing Rain',
        7000: 'Ice Pellets',
        7101: 'Heavy Ice Pellets',
        7102: 'Light Ice Pellets',
        8000: 'Thunderstorm',
    }
    return {
        'temperature': f'{values["temperatureApparent"]:0.0f}°C',
        'description': code_lookup.get(values['weatherCode'], 'Unknown'),
    }


async def main():
    async with AsyncClient() as client:
        # create a free API key at https://www.tomorrow.io/weather-api/
        weather_api_key = os.getenv('WEATHER_API_KEY')
        # create a free API key at https://geocode.maps.co/
        geo_api_key = os.getenv('GEO_API_KEY')
        deps = Deps(
            client=client, weather_api_key=weather_api_key, geo_api_key=geo_api_key
        )
        result = await weather_agent.run(
            'What is the weather like in London and in Wiltshire?', deps=deps
        )
        debug(result)
        print('Response:', result.data)


if __name__ == '__main__':
    asyncio.run(main())