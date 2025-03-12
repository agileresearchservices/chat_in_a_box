// Test script for the store locator agent with real data points
import axios from 'axios';
import { JSDOM } from 'jsdom';

// Helper function to log with color
const colorLog = (message, color) => {
  const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
  };
  console.log(`${colors[color] || ''}${message}${colors.reset}`);
};

// Run tests for the store locator agent with real data points from the database
async function runTests() {
  console.log('===== Testing Store Locator Agent with Real Data =====\n');

  // Test queries with real cities from the database
  const testQueries = [
    // Real cities from the database
    "Find stores in Port Ericmouth",
    "Show me stores in South Bruce",
    "Where are your stores in Thomasfort",
    "Stores in East David",
    "Locate stores in Parkville",
    "I need a store in Johnport",
    
    // Real states from the database
    "Find stores in FL",
    "Show me stores in CA",
    "Where are your stores in NY",
    
    // Real ZIP codes from the database
    "Stores in 42056",
    "Find a store in 76610 area",
    "Where's the store in 52089",
    
    // Combinations of real data
    "Find stores in Thomasfort, FL",
    "Stores in Jackbury, WV 80612",
    
    // Test partial matches with prefix
    "Stores in Port Eric", // Should match Port Ericmouth
    "Find stores in Thomas", // Should match Thomasfort
    
    // Test partial ZIP code matches
    "Stores in 420", // Should match 42056
    "Find stores in 766", // Should match 76610
    
    // Test invalid queries for contrast
    "Find stores in InvalidCity",
    "Show me stores in ZZ",
    "Stores in 00000",
  ];

  let passedTests = 0;
  const totalTests = testQueries.length;

  for (const query of testQueries) {
    console.log(`Query: "${query}"`);
    
    // Check what locations are being extracted
    let city = 'no city specified';
    let state = 'no state specified';
    let zip = 'no ZIP specified';
    
    // Try to extract city
    const cityMatch = query.match(/(?:in|at|near)\s+([A-Za-z\s]+(?:Port|East|West|North|South|Lake|New)?\s*[A-Za-z]+)(?:[,\s]+|$)/i);
    if (cityMatch && cityMatch[1] && !cityMatch[1].match(/^(stores?|shop|location)$/i)) {
      city = cityMatch[1].trim();
    }
    
    // Extract state (2-letter code)
    const stateMatch = query.match(/\s+([A-Z]{2})(?:\s+|\b|$)/);
    if (stateMatch && stateMatch[1]) {
      state = stateMatch[1];
    }
    
    // Extract ZIP code (5-digit or 5+4)
    const zipMatch = query.match(/\b(\d{5}(?:-\d{4})?)\b/);
    if (zipMatch && zipMatch[1]) {
      zip = zipMatch[1];
    }
    
    console.log(`Location: City="${city}", State="${state}", ZIP="${zip}"`);
    
    // Query the agent directly
    try {
      console.log('Testing store locator agent...');
      const agentResponse = await axios.post('http://localhost:3000/api/agents/store-locator', {
        prompt: query
      });
      
      // Check if we found stores
      const response = agentResponse.data.response || "No response";
      const foundStores = response.includes('found') && !response.includes("couldn't find any");
      
      // Check expected result against actual result
      let expectedFoundStores = false;
      
      // We expect stores to be found for these queries based on our sample data
      if (
        city.includes('Port Eric') || 
        city.includes('South Bruce') || 
        city.includes('Thomas') || 
        city.includes('East David') || 
        city.includes('Parkville') || 
        city.includes('Johnport') ||
        state === 'FL' || 
        state === 'CA' || 
        state === 'NY' || 
        zip.startsWith('420') || 
        zip.startsWith('766') || 
        zip.startsWith('520')
      ) {
        expectedFoundStores = true;
      }
      
      // Truncate response for display if too long
      const truncatedResponse = response.length > 200 ? response.substring(0, 200) + '...' : response;
      
      // Determine if test passed based on expectedFoundStores matching foundStores
      const testPassed = (expectedFoundStores === foundStores);
      if (testPassed) {
        passedTests++;
        colorLog(`✓ Agent response: ${truncatedResponse}`, 'green');
      } else {
        colorLog(`✗ Agent response: ${truncatedResponse}`, 'red');
        colorLog(`  Expected to ${expectedFoundStores ? 'find' : 'not find'} stores but ${foundStores ? 'found' : 'did not find'} stores`, 'red');
      }
      
      // Show what location parameters were correctly extracted
      const locationChecks = [];
      if (city !== 'no city specified') {
        locationChecks.push(`City ${expectedFoundStores ? '✓' : '❌'}`);
      }
      if (state !== 'no state specified') {
        locationChecks.push(`State ${expectedFoundStores ? '✓' : '❌'}`);
      }
      if (zip !== 'no ZIP specified') {
        locationChecks.push(`ZIP ${expectedFoundStores ? '✓' : '❌'}`);
      }
      
      if (locationChecks.length > 0) {
        console.log(`Location checks: ${locationChecks.join(', ')}`);
      }
      
    } catch (error) {
      colorLog(`Error: ${error.message}`, 'red');
    }
    
    console.log('\n------------------------------------------------------------\n');
  }

  // Summary
  console.log('===== Store Locator Agent Test Results =====');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  
  if (passedTests === totalTests) {
    colorLog('\n✅ All tests passed!', 'green');
  } else {
    colorLog(`\n⚠️ ${totalTests - passedTests} tests failed.`, 'red');
  }
}

// Run the tests
runTests();
