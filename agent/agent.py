import json
import ollama

# Simulated weather function tool
def get_weather_for_city(city: str) -> str:
    return f"The weather in {city} is sunny with a temperature of 25°C."

# Define the tool metadata
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather_for_city",
            "description": "Get current weather data for a specified city. ONLY use this for weather-related queries.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "Name of the city."
                    }
                },
                "required": ["city"]
            }
        }
    }
]

client = ollama.Client()

def handle_query(query: str):
    print(f"Processing query: {query}")
    # First, make the initial call with tools
    response = client.chat(
        model='nemotron-mini',
        messages=[
            {'role': 'system', 'content': 'Only use tools when they are directly relevant to the user\'s query. For questions not related to weather, do not use the weather tool.'},
            {'role': 'user', 'content': query}
        ],
        tools=tools
    )
    message = response.get('message', {})

    # Check if a tool call is present in the tool_calls field or content
    tool_call = None
    if 'tool_calls' in message and message['tool_calls']:
        tool_call = message['tool_calls'][0]
    elif 'content' in message and '<toolcall>' in message['content']:
        # Extract tool call from content
        content = message['content']
        tool_call_start = content.find('<toolcall>') + len('<toolcall>')
        tool_call_end = content.find('</toolcall>')
        tool_call_json = content[tool_call_start:tool_call_end].strip()
        tool_call = json.loads(tool_call_json)

    if tool_call:
        tool_name = tool_call.get('function', {}).get('name')
        print(f"Tool call detected: {tool_name}")

        # Execute the tool function directly
        if tool_name == 'get_weather_for_city':
            arguments = tool_call.get('function', {}).get('arguments')
            # Ensure arguments are in dict form
            if not isinstance(arguments, dict):
                arguments = json.loads(arguments)
            return get_weather_for_city(arguments['city'])
    else:
        print("No tool call in response")
        
    # If no tool call made, return a direct answer
    follow_up = client.chat(
        model='nemotron-mini',
        messages=[
            {'role': 'system', 'content': 'Provide a direct, informative answer to the question.'},
            {'role': 'user', 'content': query}
        ]
    )
    return follow_up.get('message', {}).get('content', 'No direct answer available.')

if __name__ == '__main__':
    print("Weather query response:")
    print(handle_query("What is the weather in Paris?"))
    
    print("\nNon-weather query response:")
    print(handle_query("Is json better than jsonl?"))