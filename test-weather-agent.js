#!/usr/bin/env node

const { default: fetch } = await import('node-fetch');
const { execSync } = await import('child_process');

const TEST_QUERIES = [
  // Current weather queries
  'What\'s the weather like in New York?',
  'How\'s the weather in Los Angeles?',
  'Tell me the weather in Chicago',
  'Weather in Miami',
  'How\'s the weather in Dallas right now?',
  'What\'s the current temperature in Seattle?',
  'What\'s the weather like in Boston?',
  'Is it raining in Portland?',
  // Edge cases
  'What\'s the weather?', // Missing city
  'Weather in InvalidCityName',
];

// Helper function to test a single query against the agents API
async function testQuery(query) {
  console.log(`Query: "${query}"`);
  
  // Extract entities for logging
  const cityMatch = query.match(/\b(?:in|at|for|of)\s+([^?.,]*?)(?:\s+right\s+now)?(?:\?|$|,)/i);
  const city = cityMatch ? cityMatch[1].trim().replace(/\?$/, '') : 'unknown';
  
  console.log(`Entities: City="${city}", Timeframe="now"`);
  
  let success = false;
  
  try {
    // First, test the weather API directly with city
    console.log("Testing direct weather API...");
    const weatherResponse = await fetch('http://localhost:3000/api/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, timeframe: 'now' })
    });
    
    if (weatherResponse.ok) {
      const weatherData = await weatherResponse.json();
      console.log(`✓ Weather API: ${truncateResponse(JSON.stringify(weatherData))}`);
      success = true;
    } else {
      console.log(`❌ Weather API Error: ${weatherResponse.status} ${weatherResponse.statusText}`);
    }
    
    // Now test the agent
    console.log("\nTesting weather agent...");
    try {
      const agentResponse = await fetch('http://localhost:3000/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          agentType: "weather", 
          parameters: { weatherApiEndpoint: "/api/weather" }
        })
      });
      
      if (agentResponse.ok) {
        const text = await agentResponse.text();
        
        // Handle streaming responses by processing each line
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
          try {
            // Try to parse the last complete JSON object
            const lastLine = lines[lines.length - 1];
            const lastResponse = JSON.parse(lastLine);
            
            if (lastResponse.message && lastResponse.message.content) {
              console.log(`✓ Agent response: ${truncateResponse(lastResponse.message.content)}`);
              
              // Check if response contains current weather reference
              const containsCurrentRef = lastResponse.message.content.toLowerCase().includes('current');
              console.log(`${containsCurrentRef ? '✓' : '❌'} Response ${containsCurrentRef ? 'includes' : 'does not include'} 'current' reference`);
              
              success = true;
            } else {
              console.log("❌ Response missing expected content structure");
              console.log("Last line: " + truncateResponse(lastLine));
            }
          } catch (parseError) {
            console.log(`❌ JSON parse error: ${parseError.message}`);
            console.log("Response: " + truncateResponse(text));
          }
        } else {
          console.log("❌ Empty response");
        }
      } else {
        console.log(`❌ Agent API Error: ${agentResponse.status} ${agentResponse.statusText}`);
      }
    } catch (agentError) {
      console.log(`❌ Agent request error: ${agentError.message}`);
    }
    
  } catch (error) {
    console.log(`❌ Test error: ${error.message}`);
  }
  
  return success;
}

async function testWeatherAgent() {
  console.log('===== Testing Weather Agent with Time-Based Queries =====\n');
  
  let passCount = 0;
  let failCount = 0;
  
  for (const query of TEST_QUERIES) {
    try {
      const success = await testQuery(query);
      if (success) {
        passCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      failCount++;
    }
    
    console.log('-----------------------------------\n');
  }
  
  console.log(`===== Test Summary =====`);
  console.log(`Passed: ${passCount}/${TEST_QUERIES.length}`);
  console.log(`Failed: ${failCount}/${TEST_QUERIES.length}`);
}

function truncateResponse(response, maxLength = 150) {
  if (!response) return 'No response';
  if (response.length <= maxLength) return response;
  return response.substring(0, maxLength) + '...';
}

// Run the tests
await testWeatherAgent();
