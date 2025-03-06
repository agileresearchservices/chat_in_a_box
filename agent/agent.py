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

def verify_tool_relevance(query: str, tool_name: str):
    """
    Ask the LLM to verify if a specific tool is relevant for the given query.
    Returns True if the tool is relevant, False otherwise.
    """
    response = client.chat(
        model='phi4-mini',
        messages=[
            {'role': 'system', 'content': 'You are a helpful assistant that determines if a specific tool is relevant for a user query. Output a JSON object with a single "relevant" boolean field indicating if the tool should be used for this query. Reply ONLY with the JSON object and nothing else.'},
            {'role': 'user', 'content': f'Query: "{query}"\nTool: {{"name": "{tool_name}", "description": "Get current weather data for a specified city. ONLY use for weather-related queries."}}\nIs this tool relevant for this query? Return a JSON object with a "relevant" field set to true or false.'}
        ]
    )
    
    content = response['message']['content']
    try:
        # Try to extract JSON from the response
        # First, find JSON block if surrounded by markdown code fences
        if '```json' in content and '```' in content.split('```json', 1)[1]:
            content = content.split('```json', 1)[1].split('```', 1)[0].strip()
        elif '```' in content and '```' in content.split('```', 1)[1]:
            content = content.split('```', 1)[1].split('```', 1)[0].strip()
            
        # Parse the JSON
        result = json.loads(content)
        return result.get('relevant', False)
    except (json.JSONDecodeError, KeyError, IndexError):
        # If we can't parse JSON, use a fallback method
        return "weather" in query.lower()

def handle_query(query: str):
    print(f"Processing query: {query}")
    # First, make the initial call with tools
    response = client.chat(
        model='llama3.2:latest',
        messages=[
            {'role': 'system', 'content': 'Only use tools when they are directly relevant to the user\'s query. For questions not related to weather, do not use the weather tool.'},
            {'role': 'user', 'content': query}
        ],
        tools=tools
    )
    message = response.get('message', {})
    print(f"Initial response: {message}")

    # Check if a tool call is present
    if 'tool_calls' in message and message['tool_calls']:
        tool_call = message['tool_calls'][0]
        tool_name = tool_call.get('function', {}).get('name')
        print(f"Tool call detected: {tool_name}")
        
        # If the model tried to use a tool, verify if it's relevant
        if tool_name == 'get_weather_for_city':
            is_tool_relevant = verify_tool_relevance(query, tool_name)
            print(f"Tool relevance check: {is_tool_relevant}")
            
            if is_tool_relevant:
                # Tool is relevant, process the call
                arguments = tool_call.get('function', {}).get('arguments')
                # Ensure arguments are in dict form
                if not isinstance(arguments, dict):
                    arguments = json.loads(arguments)
                return get_weather_for_city(arguments['city'])
            else:
                # Tool isn't relevant, get a direct answer instead
                print("Tool not relevant, getting direct answer...")
                follow_up = client.chat(
                    model='llama3.2:latest',
                    messages=[
                        {'role': 'system', 'content': 'Provide a direct, informative answer to the question without using any tools.'},
                        {'role': 'user', 'content': query}
                    ]
                )
                return follow_up.get('message', {}).get('content', 'No direct answer available.')
    else:
        print("No tool call in response")
    
    # No tool call made, return the model's direct answer
    return message.get('content', 'No tool call made.')

if __name__ == '__main__':
    print("Weather query response:")
    print(handle_query("What is the weather in Paris?"))
    
    print("\nNon-weather query response:")
    print(handle_query("Is json better than jsonl?"))