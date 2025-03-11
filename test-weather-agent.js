// Test script for Weather Agent with NLP integration
// Run with: node test-weather-agent.js

import { execSync } from 'child_process';

// Test queries with different city formats
const testQueries = [
  "What\\'s the weather like in New York?",
  "Temperature in San Francisco",
  "Will it rain in Chicago tomorrow?",
  "Boston weather forecast",
  "How hot is it in Los Angeles today?",
  "Is it snowing in Seattle?"
];

// Execute curl command for each test query
testQueries.forEach((query, index) => {
  console.log(`\n\n===== TEST QUERY ${index + 1}: "${query}" =====`);
  try {
    // Send request to NLP endpoint to see city extraction
    const nlpResult = execSync(
      `curl -s -X POST http://localhost:3000/api/nlp -H "Content-Type: application/json" -d '{"text": "${query.replace(/'/g, "\\'")}"}'`,
      { encoding: 'utf-8' }
    );
    
    console.log("NLP Service Extraction Result:");
    console.log(nlpResult);
    
    // Try the agent endpoint
    console.log("\nAgent Execution Result (may fail if weather API has issues):");
    try {
      const agentResult = execSync(
        `curl -s -X POST http://localhost:3000/api/agents -H "Content-Type: application/json" -d '{"query": "${query.replace(/'/g, "\\'")}", "agentType": "weather", "parameters": {"weatherApiEndpoint": "/api/weather", "requiresLocation": true, "locationService": "nominatim", "weatherService": "nws"}}'`,
        { encoding: 'utf-8' }
      );
      console.log(agentResult);
    } catch (error) {
      console.log("Agent execution failed with error. This is expected if the weather API endpoint is not functioning.");
    }
  } catch (error) {
    console.error(`Error processing query "${query}":`, error.message);
  }
  console.log("===== END TEST =====\n");
});

console.log("\nTest summary:");
console.log("The NLP results show which cities were detected by the NLP service.");
console.log("If the NLP service successfully extracted the city, the Weather Agent should use that.");
console.log("If the weather API returns errors, that's independent of the NLP integration.");
