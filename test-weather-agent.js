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

// Define valid cities and invalid cities for validation
const VALID_CITIES = ['New York', 'Los Angeles', 'Chicago', 'Miami', 'Dallas', 'Seattle', 'Boston', 'Portland'];
const INVALID_CITIES = ['InvalidCityName'];

// Helper function to test a single query against the weather API and agent
async function testQuery(query) {
  console.log(`\nQuery: "${query}"`);
  
  // Extract city from query using improved regex patterns
  let cityMatch = query.match(/\b(?:in|at|for|of)\s+([^?.,]*?)(?:\s+right\s+now)?(?=\?|$|,)/i);
  if (!cityMatch) {
    // Try alternative pattern
    cityMatch = query.match(/\b(?:weather|temperature|forecast)\s+(?:in|at|for|of)\s+([^?.,]*?)(?:\s+right\s+now)?(?=\?|$|,)/i);
  }
  const city = cityMatch ? cityMatch[1].trim() : 'unknown';
  
  console.log(`Entities: City="${city}"`);
  
  // Track checklist for validation
  const checkList = [];
  if (city !== 'unknown') {
    checkList.push({ name: 'City', value: city });
  }
  
  let apiSuccess = false;
  let agentSuccess = false;
  let agentData = '';
  
  try {
    // First, test the weather API directly with city
    console.log("Testing direct weather API...");
    const weatherResponse = await fetch('http://localhost:3000/api/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city })
    });
    
    let weatherData = null;
    if (weatherResponse.ok) {
      weatherData = await weatherResponse.json();
      console.log(`✓ Weather API: ${JSON.stringify(weatherData)}`);
      apiSuccess = true;
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
              agentData = lastResponse.message.content;
              console.log(`✓ Agent response: ${agentData}`);
              agentSuccess = true;
            } else {
              console.log("❌ Response missing expected content structure");
              console.log("Last line: " + lastLine);
            }
          } catch (parseError) {
            console.log(`❌ JSON parse error: ${parseError.message}`);
            console.log("Response: " + text);
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
    
    // Validate agent response
    let passed = false;
    
    if (agentSuccess) {
      // Whether we expect weather data based on the city
      const shouldHaveWeatherData = VALID_CITIES.some(validCity => 
        city.toLowerCase().includes(validCity.toLowerCase()));
      const isInvalidCity = INVALID_CITIES.some(invalidCity => 
        city.toLowerCase().includes(invalidCity.toLowerCase()));
      
      // Check if response matches expectations
      if (shouldHaveWeatherData && !isInvalidCity) {
        // Should have weather data
        const hasTemperature = /\b\d+\s*[°℃℉]\b/i.test(agentData) || 
                              /\btemperature\b/i.test(agentData);
        const hasWeatherCondition = /\b(sunny|cloudy|rainy|clear|overcast|rain|snow|fog|mist|drizzle|storm|thunder|wind|windy)\b/i.test(agentData);
        
        if (hasTemperature || hasWeatherCondition) {
          passed = true;
          console.log("✓ Response contains expected weather information");
        } else {
          console.log("❌ FAILED: Response should contain weather information");
          passed = false;
        }
      } 
      else if (isInvalidCity || city === 'unknown') {
        // Should indicate no weather data found or error
        const hasErrorMessage = /\b(couldn['']t find|no weather data|invalid|not found|unknown|unable|sorry)\b/i.test(agentData);
        
        if (hasErrorMessage) {
          passed = true;
          console.log("✓ Response correctly indicates no data available");
        } else {
          console.log("❌ FAILED: Response should indicate no data available for invalid city");
          passed = false;
        }
      }
      else {
        // Ambiguous case - accept either response
        passed = true;
        console.log("✓ Ambiguous query handled acceptably");
      }
      
      // Print any checking details
      if (checkList.length > 0) {
        console.log(`Location checks: ${checkList.map(check => `${check.name} ${passed ? '✓' : '❌'}`).join(', ')}`);
      }
    } else {
      console.log("❌ FAILED: Could not evaluate agent response");
      passed = false;
    }
    
    return passed;
    
  } catch (error) {
    console.log(`❌ Test error: ${error.message}`);
    return false;
  }
}

async function testWeatherAgent() {
  console.log('===== Testing Weather Agent =====\n');
  
  let passCount = 0;
  let failCount = 0;
  let failedTests = [];
  
  for (const query of TEST_QUERIES) {
    try {
      const passed = await testQuery(query);
      if (passed) {
        passCount++;
      } else {
        failCount++;
        failedTests.push(query);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      failCount++;
      failedTests.push(query);
    }
    
    console.log('------------------------------------------------------------\n');
  }
  
  console.log('\n===== Weather Agent Test Results =====');
  console.log(`Total tests: ${TEST_QUERIES.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  
  if (failCount > 0) {
    console.log(`Total failed tests: ${failCount}`);
    console.log('\n❌ ' + failCount + ' tests failed.');
  } else {
    console.log('\n✓ All tests passed!');
  }
}

// Run the tests
await testWeatherAgent();
