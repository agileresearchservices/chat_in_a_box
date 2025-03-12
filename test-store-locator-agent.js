#!/usr/bin/env node

const { default: fetch } = await import('node-fetch');

const TEST_QUERIES = [
  // Basic location search
  'Find stores in New York',
  'Show me stores in California',
  'Where are your stores in Texas',
  
  // City-specific searches
  'Stores in Chicago',
  'Find stores in Seattle',
  'Show me stores in Miami',
  'Locate stores in Boston',
  'Where are your stores in Dallas',
  
  // State-specific searches
  'Find stores in FL',
  'Show me stores in CA',
  'Stores in NY',
  'List all stores in TX',
  
  // ZIP code searches
  'Find stores near 90210',
  'Show me stores in ZIP 10001',
  'Stores in 02108 area',
  'Find stores in 75001 ZIP code',
  
  // Combined filters
  'Find stores in Seattle, WA',
  'Show me stores in Austin, Texas',
  'Stores in Miami, FL 33101',
  'Locate stores in ZIP 60601 in Chicago',
  
  // Edge cases
  'Find stores',  // No location
  'Show me all stores',  // Generic query
  'Stores nearest to me',  // Current location
  'Find stores in InvalidCity',  // Invalid city
  'Show me stores in ZZ',  // Invalid state
  'Stores in 00000',  // Invalid ZIP
  'Where is your closest store',  // No specific location
  'Do you have stores in Antarctica',  // Invalid location
  'Find stores on Mars',  // Very invalid location
  'Show me stores in the midwest'  // Region
];

// Helper function to test a single query against the store locator
async function testQuery(query) {
  console.log(`Query: "${query}"`);
  
  // Extract location entities for logging
  const cityMatch = query.match(/(?:in|near|at)\s+([A-Za-z\s]+)(?:,|\s+(?:[A-Z]{2}|[A-Za-z]+)|\s+\d{5}|\s*$)/i);
  const city = cityMatch ? cityMatch[1].trim() : 'no city specified';
  
  const stateMatch = query.match(/(?:in|near|at)\s+(?:[A-Za-z\s]+,\s+)?([A-Z]{2}|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\s+Hampshire|New\s+Jersey|New\s+Mexico|New\s+York|North\s+Carolina|North\s+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\s+Island|South\s+Carolina|South\s+Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\s+Virginia|Wisconsin|Wyoming)(?:\s+\d{5}|\s*$)/i);
  const state = stateMatch ? stateMatch[1].trim() : 'no state specified';
  
  const zipMatch = query.match(/(?:near|in|at)\s+(?:ZIP|zipcode|zip code|zip|postal code|postal|)\s*(\d{5})(?:\s+|\s*$)/i) || 
                   query.match(/(\d{5})(?:\s+area|\s+zip|\s+zipcode|\s+zip code|\s+region|\s*$)/i);
  const zip = zipMatch ? zipMatch[1].trim() : 'no ZIP specified';
  
  console.log(`Location: City="${city}", State="${state}", ZIP="${zip}"`);
  
  let success = false;
  
  try {
    // First, test the stores API directly
    console.log("Testing direct stores API...");
    const searchParams = {
      query: query,
      filters: {}
    };
    
    // Add filters based on extracted entities
    if (cityMatch && city !== 'no city specified') {
      searchParams.filters.city = city;
    }
    
    if (stateMatch && state !== 'no state specified') {
      searchParams.filters.state = state;
    }
    
    if (zipMatch && zip !== 'no ZIP specified') {
      searchParams.filters.zip = zip;
    }
    
    const storesResponse = await fetch('http://localhost:3000/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchParams)
    });
    
    if (storesResponse.ok) {
      const storesData = await storesResponse.json();
      console.log(`✓ Stores API: Found ${storesData.data.total} stores`);
      if (storesData.data.stores && storesData.data.stores.length > 0) {
        console.log(`Sample: ${truncateResponse(JSON.stringify(storesData.data.stores[0]))}`);
      }
      success = true;
    } else {
      console.log(`❌ Stores API Error: ${storesResponse.status} ${storesResponse.statusText}`);
    }
    
    // Now test the store locator agent
    console.log("\nTesting store locator agent...");
    try {
      const agentResponse = await fetch('http://localhost:3000/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          agentType: "store-locator"
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
              
              // Verify location presence in response
              const response = lastResponse.message.content.toLowerCase();
              const checks = [];
              
              if (cityMatch && city !== 'no city specified') {
                const hasCity = response.includes(city.toLowerCase());
                checks.push(`City ${hasCity ? '✓' : '❌'}`);
              }
              
              if (stateMatch && state !== 'no state specified') {
                const hasState = response.includes(state.toLowerCase());
                checks.push(`State ${hasState ? '✓' : '❌'}`);
              }
              
              if (zipMatch && zip !== 'no ZIP specified') {
                const hasZip = response.includes(zip);
                checks.push(`ZIP ${hasZip ? '✓' : '❌'}`);
              }
              
              if (checks.length > 0) {
                console.log(`Location checks: ${checks.join(', ')}`);
              }
              
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

async function testStoreLocatorAgent() {
  console.log('===== Testing Store Locator Agent =====\n');
  
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
      console.log(`❌ Unexpected error: ${error.message}`);
      failCount++;
    }
    
    console.log('\n' + '-'.repeat(60) + '\n');
  }
  
  console.log('===== Store Locator Agent Test Results =====');
  console.log(`Total tests: ${TEST_QUERIES.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  
  if (failCount === 0) {
    console.log('\n✅ All tests passed!');
  } else {
    console.log(`\n❌ ${failCount} tests failed.`);
  }
}

// Helper function to truncate long responses for better output readability
function truncateResponse(response, maxLength = 150) {
  if (typeof response !== 'string') return 'Invalid response';
  if (response.length <= maxLength) return response;
  return response.substring(0, maxLength) + '...';
}

// Run the tests
await testStoreLocatorAgent();
