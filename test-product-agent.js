#!/usr/bin/env node

const { default: fetch } = await import('node-fetch');

const TEST_QUERIES = [
  // Basic text search
  'Show me phones with 128GB storage',
  'Find phones with large screens',
  'Show me the latest phones',
  
  // Price filters
  'Find phones under $500',
  'Show me phones between $800 and $1200',
  'Find phones over $1000',
  'Show me phones around $750',
  
  // Color filters
  'Find black phones',
  'Show me phones in gold color',
  'Find silver phones under $600',
  
  // Storage filters
  'Find 256GB phones',
  'Show me phones with 512GB storage',
  'Find 128GB phones under $700',
  
  // Combined filters
  'Find black phones with 256GB storage',
  'Show me gold phones under $1000',
  'Find phones with 512GB storage around $1200',
  
  // Edge cases
  'Find phones',  // No filters
  'Show me phones with 1TB storage',  // Unusual storage size
  'Find phones under $100',  // Very low price
  'Show me phones in rainbow color',  // Invalid color
];

// Helper function to test a single query against the agents API
async function testQuery(query) {
  console.log(`Query: "${query}"`);
  
  // Extract entities for logging
  const priceMatch = query.match(/(?:under|over|around|about)\s+\$?(\d+)|between\s+\$?(\d+)\s+and\s+\$?(\d+)/i);
  const price = priceMatch ? priceMatch[0].trim() : 'no price filter';
  
  const colorMatch = query.match(/(?:in\s+)?(black|white|blue|red|green|yellow|purple|pink|gold|silver)(?:\s+(?:phone|color))?/i);
  const color = colorMatch ? colorMatch[1].trim() : 'no color filter';
  
  const storageMatch = query.match(/(\d+)\s*(?:gb|tb)/i);
  const storage = storageMatch ? storageMatch[0].trim() : 'no storage filter';
  
  console.log(`Filters: Price="${price}", Color="${color}", Storage="${storage}"`);
  
  let success = false;
  
  try {
    // First, test the products API directly
    console.log("Testing direct products API...");
    const searchParams = {
      query: query,
      filters: {}
    };
    
    // Add filters based on extracted entities
    if (priceMatch) {
      if (priceMatch[2] && priceMatch[3]) {
        searchParams.filters.minPrice = parseFloat(priceMatch[2]);
        searchParams.filters.maxPrice = parseFloat(priceMatch[3]);
      } else if (query.includes('under') || query.includes('less than')) {
        searchParams.filters.maxPrice = parseFloat(priceMatch[1]);
      } else if (query.includes('over') || query.includes('more than')) {
        searchParams.filters.minPrice = parseFloat(priceMatch[1]);
      } else if (query.includes('around') || query.includes('about')) {
        const target = parseFloat(priceMatch[1]);
        searchParams.filters.minPrice = target * 0.8;
        searchParams.filters.maxPrice = target * 1.2;
      }
    }
    
    if (colorMatch) {
      searchParams.filters.color = colorMatch[1].charAt(0).toUpperCase() + colorMatch[1].slice(1);
    }
    
    if (storageMatch) {
      searchParams.filters.storage = storageMatch[0].toUpperCase();
    }
    
    const productsResponse = await fetch('http://localhost:3000/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchParams)
    });
    
    if (productsResponse.ok) {
      const productsData = await productsResponse.json();
      console.log(`✓ Products API: Found ${productsData.data.total} products`);
      console.log(`Sample: ${truncateResponse(JSON.stringify(productsData.data.products[0]))}`);
      success = true;
    } else {
      console.log(`❌ Products API Error: ${productsResponse.status} ${productsResponse.statusText}`);
    }
    
    // Now test the agent
    console.log("\nTesting product agent...");
    try {
      const agentResponse = await fetch('http://localhost:3000/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          agentType: "product"
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
              
              // Verify filter presence in response
              const response = lastResponse.message.content.toLowerCase();
              const checks = [];
              
              if (priceMatch) {
                const hasPrice = response.includes('$');
                checks.push(`Price ${hasPrice ? '✓' : '❌'}`);
              }
              
              if (colorMatch) {
                const hasColor = response.includes(color.toLowerCase());
                checks.push(`Color ${hasColor ? '✓' : '❌'}`);
              }
              
              if (storageMatch) {
                const hasStorage = response.includes(storage.toLowerCase());
                checks.push(`Storage ${hasStorage ? '✓' : '❌'}`);
              }
              
              if (checks.length > 0) {
                console.log(`Filter checks: ${checks.join(', ')}`);
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

async function testProductAgent() {
  console.log('===== Testing Product Agent with Search Filters =====\n');
  
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
await testProductAgent();
