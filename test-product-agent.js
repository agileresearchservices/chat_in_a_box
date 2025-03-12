#!/usr/bin/env node

const { default: fetch } = await import('node-fetch');

// Define the valid parameters for testing
const VALID_STORAGE = ['128GB', '256GB', '512GB', '1TB'];
const VALID_COLORS = ['black', 'white', 'blue', 'red', 'green', 'yellow', 'purple', 'pink', 'gold', 'silver'];
const VALID_BRANDS = ['HyperPhone', 'TechPro', 'GlobalTech', 'NexGen', 'SmartDevice'];
const INVALID_STORAGE = ['2TB', '4TB', 'very high storage capacity'];
const INVALID_COLORS = ['rainbow', 'multicolor', 'transparent'];
const INVALID_BRANDS = ['unknown brand', 'InvalidBrand'];

// Test queries with expected outcomes
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
  'Find blue phones from HyperPhone',
  'Show me black phones by HyperPhone',
  'Find red phones from HyperPhone under $600',
  'Show me gold phones from HyperPhone with 256GB storage',
  
  // Edge cases
  'Find phones',  // No filters
  'Show me phones with 1TB storage',  // Unusual storage size
  'Find phones under $100',  // Very low price
  'Show me phones in rainbow color',  // Invalid color
  'Find phones with no color specified',  // No color filter
  'Find phones with very high storage capacity',  // Unusual storage size
  'Show me phones priced exactly at $500',  // Exact price
  'Find phones with multiple colors',  // Multiple color filters
  'Show me phones with no filters',  // Completely generic query
  'Find phones from unknown brand',  // Brand not in the catalog
];

// Helper function to test a single query against API and agent
async function testQuery(query) {
  console.log(`\nQuery: "${query}"`);
  
  // Extract entities for logging with improved patterns
  const priceMatch = query.match(/(?:under|over|around|about)\s+\$?(\d+)|between\s+\$?(\d+)\s+and\s+\$?(\d+)|exactly\s+at\s+\$?(\d+)/i);
  const price = priceMatch ? priceMatch[0].trim() : 'no price filter';
  
  const colorMatch = query.match(/(?:in\s+)?(black|white|blue|red|green|yellow|purple|pink|gold|silver|rainbow|multicolor|transparent)(?:\s+(?:phone|color))?/i);
  const color = colorMatch ? colorMatch[1].trim() : 'no color filter';
  
  const storageMatch = query.match(/(\d+)\s*(?:gb|tb)/i);
  const storage = storageMatch ? storageMatch[0].trim() : 'no storage filter';
  
  const brandMatch = query.match(/(?:from|by)\s+(\w+)/i);
  const brand = brandMatch ? brandMatch[1].trim() : 'no brand filter';
  
  console.log(`Filters: Price="${price}", Color="${color}", Storage="${storage}", Brand="${brand}"`);
  
  // Track checklist for validation
  const checkList = [];
  if (price !== 'no price filter') checkList.push({ name: 'Price', value: price });
  if (color !== 'no color filter') checkList.push({ name: 'Color', value: color });
  if (storage !== 'no storage filter') checkList.push({ name: 'Storage', value: storage });
  if (brand !== 'no brand filter') checkList.push({ name: 'Brand', value: brand });
  
  let apiSuccess = false;
  let agentSuccess = false;
  let productsData = null;
  let agentResponseText = '';
  
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
      } else if (query.match(/\b(under|less than)\b/i)) {
        searchParams.filters.maxPrice = parseFloat(priceMatch[1] || priceMatch[4]);
      } else if (query.match(/\b(over|more than)\b/i)) {
        searchParams.filters.minPrice = parseFloat(priceMatch[1] || priceMatch[4]);
      } else if (query.match(/\b(around|about)\b/i)) {
        const target = parseFloat(priceMatch[1] || priceMatch[4]);
        searchParams.filters.minPrice = target * 0.8;
        searchParams.filters.maxPrice = target * 1.2;
      } else if (query.match(/\bexactly at\b/i)) {
        const exact = parseFloat(priceMatch[4]);
        searchParams.filters.minPrice = exact;
        searchParams.filters.maxPrice = exact;
      }
    }
    
    if (colorMatch) {
      searchParams.filters.color = colorMatch[1].charAt(0).toUpperCase() + colorMatch[1].slice(1);
    }
    
    if (storageMatch) {
      searchParams.filters.storage = storageMatch[0].toUpperCase();
    }
    
    if (brandMatch) {
      searchParams.filters.brand = brandMatch[1];
    }
    
    const productsResponse = await fetch('http://localhost:3000/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchParams)
    });
    
    if (productsResponse.ok) {
      productsData = await productsResponse.json();
      console.log(`✓ Products API: Found ${productsData.data.total} products`);
      if (productsData.data.products && productsData.data.products.length > 0) {
        console.log(`Sample: ${JSON.stringify(productsData.data.products[0])}`);
      } else {
        console.log("No products found for this query");
      }
      apiSuccess = true;
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
              agentResponseText = lastResponse.message.content;
              console.log(`✓ Agent response: ${agentResponseText}`);
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
    
    // Validation logic
    let passed = false;
    const responseLower = agentResponseText.toLowerCase();
    
    if (agentSuccess) {
      // Determine if agent's response should contain products
      const hasInvalidParams = (
        (colorMatch && INVALID_COLORS.includes(color.toLowerCase())) ||
        (storageMatch && INVALID_STORAGE.some(s => query.toLowerCase().includes(s.toLowerCase()))) ||
        (brandMatch && INVALID_BRANDS.some(b => query.toLowerCase().includes(b.toLowerCase()))) ||
        (priceMatch && query.toLowerCase().includes('under $100'))
      );
      
      const shouldHaveProducts = !hasInvalidParams && apiSuccess && 
                               (productsData && productsData.data.total > 0);
      
      // Check if response matches expectations
      if (shouldHaveProducts) {
        // Should have product listings
        const hasProductInfo = 
          (/\$\d+/.test(responseLower) || // Price
           /\b\d+\s*gb\b/i.test(responseLower) || // Storage
           VALID_COLORS.some(c => responseLower.includes(c)) || // Color
           VALID_BRANDS.some(b => responseLower.includes(b.toLowerCase()))); // Brand
        
        if (hasProductInfo) {
          passed = true;
          console.log("✓ Response contains expected product information");
        } else {
          console.log("❌ FAILED: Response should contain product information");
          passed = false;
        }
        
        // Validate that response contains the requested filters
        const checks = [];
        
        if (checkList.length > 0) {
          let allChecksPass = true;
          
          // Check each filter
          for (const check of checkList) {
            let passed = false;
            
            if (check.name === 'Price') {
              // For price, check if there's any price reference, as the exact format may vary
              passed = /\$\d+/.test(responseLower);
            }
            else if (check.name === 'Color') {
              // For color, check if the exact color is mentioned
              passed = responseLower.includes(check.value.toLowerCase());
            }
            else if (check.name === 'Storage') {
              // For storage, the format might vary (128GB, 128 GB, etc.)
              const storageValue = check.value.replace(/\s+/g, '').toLowerCase();
              passed = new RegExp('\\b' + storageValue + '\\b', 'i').test(responseLower);
            }
            else if (check.name === 'Brand') {
              // For brand, check if the brand is mentioned
              passed = responseLower.includes(check.value.toLowerCase());
            }
            
            checks.push(`${check.name} ${passed ? '✓' : '❌'}`);
            if (!passed) allChecksPass = false;
          }
          
          console.log(`Filter checks: ${checks.join(', ')}`);
          passed = passed && allChecksPass;
        }
      } 
      else if (hasInvalidParams || (apiSuccess && productsData && productsData.data.total === 0)) {
        // Should indicate no products found
        const hasErrorOrEmpty = 
          /\b(no products|couldn['']t find|not available|invalid|not found|no results)\b/i.test(responseLower);
        
        if (hasErrorOrEmpty) {
          passed = true;
          console.log("✓ Response correctly indicates no products available");
        } else {
          console.log("❌ FAILED: Response should indicate no products available for invalid parameters");
          passed = false;
        }
      }
      else {
        // Generic query with no specific expectations
        passed = true;
        console.log("✓ Generic query handled acceptably");
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

async function testProductAgent() {
  console.log('===== Testing Product Agent =====\n');
  
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
  
  console.log('\n===== Product Agent Test Results =====');
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
await testProductAgent();
