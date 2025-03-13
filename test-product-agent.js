#!/usr/bin/env node

const { default: fetch } = await import('node-fetch');

// Define the valid parameters for testing
const VALID_STORAGE = ['128GB', '256GB', '512GB', '1TB'];
const VALID_COLORS = ['black', 'white', 'blue', 'red', 'green', 'yellow', 'purple', 'pink', 'gold', 'silver'];
const VALID_BRANDS = ['HyperPhone', 'TechPro', 'GlobalTech', 'NexGen', 'SmartDevice'];
const VALID_PROCESSORS = ['Snapdragon', 'Exynos', 'Bionic', 'MediaTek'];
const VALID_RAM = ['4GB', '6GB', '8GB', '12GB', '16GB'];
const VALID_CATEGORIES = ['Smartphone', 'Flagship', 'Budget', 'Midrange', 'Gaming', 'Camera'];
const VALID_FEATURES = ['water resistant', 'wireless charging', 'fast charging', '5g compatible'];

const INVALID_STORAGE = ['2TB', '4TB', 'very high storage capacity'];
const INVALID_COLORS = ['rainbow', 'multicolor', 'transparent'];
const INVALID_BRANDS = ['unknown brand', 'InvalidBrand'];
const INVALID_PROCESSORS = ['Quantum', 'Fusion8000', 'NonExistentChip'];
const INVALID_RAM = ['32GB', '64GB', 'unlimited RAM'];
const INVALID_CATEGORIES = ['Super Luxury', 'Ultra Budget', 'NonExistentCategory'];

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
  
  // New test cases for enhanced fields
  
  // Brand and model specific queries
  'Show me TechPro phones',
  'Find phones by NexGen',
  'Show me SmartDevice latest models',
  
  // Rating-based queries
  'Show me top-rated phones',
  'Find phones with at least 4 stars',
  'Show me highest-rated phones under $800',
  
  // Category specific
  'Find flagship phones',
  'Show me budget phones under $400',
  'Find gaming phones',
  
  // Feature specific 
  'Find water-resistant phones',
  'Show me phones with wireless charging',
  'Find phones with fast charging capability',
  'Show me 5G compatible phones',
  
  // Technical specs
  'Find phones with Snapdragon processor',
  'Show me phones with Bionic chip',
  'Find phones with 8GB RAM',
  'Show me phones with MediaTek processor and 12GB RAM',
  
  // Multiple feature combinations
  'Find water-resistant phones with wireless charging',
  'Show me 5G phones with fast charging under $900',
  'Find flagship phones with Snapdragon processor and 8GB RAM',
  
  // Sort orders
  'What are the cheapest phones available?',
  'Show me the most expensive flagship phones',
  'Find best-rated phones with wireless charging',
  
  // Complex queries with multiple parameters
  'Show me water-resistant phones with at least 256GB storage, 8GB RAM, and a rating above 4 stars',
  'Find 5G phones with Snapdragon processor, fast charging, and priced between $700 and $1000',
  'Show me flagship phones with wireless charging, large screen, at least 12GB RAM, and top ratings',
  
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
  'Show me phones with Quantum processor',  // Invalid processor
  'Find phones with 64GB RAM',  // Invalid RAM size
  'Show me Super Luxury phones',  // Invalid category
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
  
  // New entity extraction for enhanced fields
  const ratingMatch = query.match(/(?:at least|above|over)\s+(\d+(?:\.\d+)?)\s+stars?|(?:top|highest)[\s-]*rated/i);
  const rating = ratingMatch ? ratingMatch[0].trim() : 'no rating filter';
  
  const processorMatch = query.match(/(?:with|using)\s+(snapdragon|exynos|bionic|mediatek|quantum|fusion\d+)(?:\s+(?:processor|chip|chipset))?/i);
  const processor = processorMatch ? processorMatch[1].trim() : 'no processor filter';
  
  const ramMatch = query.match(/(\d+)\s*gb\s*ram/i);
  const ram = ramMatch ? ramMatch[0].trim() : 'no RAM filter';
  
  const categoryMatch = query.match(/\b(flagship|budget|midrange|gaming|camera|smartphone|super luxury|ultra budget)\b/i);
  const category = categoryMatch ? categoryMatch[1].trim() : 'no category filter';
  
  const featureMatches = [];
  if (/water[\s-]*(?:resistant|proof)|splash[\s-]*proof/i.test(query)) featureMatches.push('water resistant');
  if (/wireless[\s-]*charg(?:ing|er)|qi[\s-]*charg(?:ing|er)/i.test(query)) featureMatches.push('wireless charging');
  if (/fast[\s-]*charg(?:ing|er)|quick[\s-]*charg(?:ing|er)|rapid[\s-]*charg(?:ing|er)/i.test(query)) featureMatches.push('fast charging');
  if (/5g|(?:five|5)[\s-]*g|(?:fifth|5th)[\s-]*generation/i.test(query)) featureMatches.push('5G compatible');
  
  const features = featureMatches.length > 0 ? featureMatches.join(', ') : 'no feature filters';
  
  console.log(`Filters: Price="${price}", Color="${color}", Storage="${storage}", Brand="${brand}"`);
  console.log(`Advanced Filters: Rating="${rating}", Processor="${processor}", RAM="${ram}", Category="${category}", Features="${features}"`);
  
  // Track checklist for validation
  const checkList = [];
  if (price !== 'no price filter') checkList.push({ name: 'Price', value: price });
  if (color !== 'no color filter') checkList.push({ name: 'Color', value: color });
  if (storage !== 'no storage filter') checkList.push({ name: 'Storage', value: storage });
  if (brand !== 'no brand filter') checkList.push({ name: 'Brand', value: brand });
  if (rating !== 'no rating filter') checkList.push({ name: 'Rating', value: rating });
  if (processor !== 'no processor filter') checkList.push({ name: 'Processor', value: processor });
  if (ram !== 'no RAM filter') checkList.push({ name: 'RAM', value: ram });
  if (category !== 'no category filter') checkList.push({ name: 'Category', value: category });
  if (features !== 'no feature filters') {
    featureMatches.forEach(feature => {
      checkList.push({ name: 'Feature', value: feature });
    });
  }
  
  let apiSuccess = false;
  let agentSuccess = false;
  let productsData = null;
  let agentResponseText = '';
  
  try {
    // First, test the products API directly
    console.log("Testing direct products API...");
    const searchParams = {
      query: query,
      filters: {},
      sort: 'relevance'
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
    
    // Add new filters for enhanced fields
    if (ratingMatch) {
      if (ratingMatch[1]) {
        searchParams.filters.minRating = parseFloat(ratingMatch[1]);
      } else if (/(?:top|highest|best)[\s-]*rated/i.test(query)) {
        searchParams.filters.minRating = 4.0;
        searchParams.sort = 'rating_desc';
      }
    }
    
    if (processorMatch) {
      searchParams.filters.processor = processorMatch[1].charAt(0).toUpperCase() + processorMatch[1].slice(1);
    }
    
    if (ramMatch) {
      searchParams.filters.ram = ramMatch[1] + 'GB';
    }
    
    if (categoryMatch) {
      searchParams.filters.category = categoryMatch[1].charAt(0).toUpperCase() + categoryMatch[1].slice(1);
    }
    
    // Handle features
    if (featureMatches.includes('water resistant')) {
      searchParams.filters.waterResistant = true;
    }
    
    if (featureMatches.includes('wireless charging')) {
      searchParams.filters.wirelessCharging = true;
    }
    
    if (featureMatches.includes('fast charging')) {
      searchParams.filters.fastCharging = true;
    }
    
    if (featureMatches.includes('5G compatible')) {
      searchParams.filters.fiveGCompatible = true;
    }
    
    // Handle sorting options
    if (/cheapest|least[\s-]*expensive|affordable|budget/i.test(query)) {
      searchParams.sort = 'price_asc';
    } else if (/most[\s-]*expensive|premium|high[\s-]*end|luxury/i.test(query)) {
      searchParams.sort = 'price_desc';
    } else if (/best|top|highest[\s-]*(?:rated)?/i.test(query) && !ratingMatch) {
      searchParams.sort = 'rating_desc';
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
        (processorMatch && INVALID_PROCESSORS.some(p => query.toLowerCase().includes(p.toLowerCase()))) ||
        (ramMatch && INVALID_RAM.some(r => query.toLowerCase().includes(r.toLowerCase()))) ||
        (categoryMatch && INVALID_CATEGORIES.some(c => query.toLowerCase().includes(c.toLowerCase()))) ||
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
           VALID_COLORS.some(c => responseLower.includes(c.toLowerCase())) || // Color
           VALID_BRANDS.some(b => responseLower.includes(b.toLowerCase())) || // Brand
           VALID_PROCESSORS.some(p => responseLower.includes(p.toLowerCase())) || // Processor
           VALID_RAM.some(r => responseLower.includes(r.toLowerCase())) || // RAM
           VALID_CATEGORIES.some(c => responseLower.includes(c.toLowerCase())) || // Category
           VALID_FEATURES.some(f => responseLower.includes(f.toLowerCase()))); // Features
        
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
            else if (check.name === 'Rating') {
              // For rating, check if there's reference to stars or rating
              if (/top|highest|best/i.test(check.value)) {
                passed = /\b([4-5](?:\.\d+)?|[4-5]) stars?\b/i.test(responseLower) || 
                         /⭐{4,5}/.test(responseLower);
              } else {
                passed = /\b\d(?:\.\d+)? stars?\b/i.test(responseLower) ||
                         /⭐+/.test(responseLower);
              }
            }
            else if (check.name === 'Processor') {
              // For processor, check if the processor name is mentioned
              passed = responseLower.includes(check.value.toLowerCase());
            }
            else if (check.name === 'RAM') {
              // For RAM, the format might vary
              const ramValue = check.value.replace(/\s+/g, '').toLowerCase();
              passed = new RegExp('\\b' + ramValue + '\\b', 'i').test(responseLower);
            }
            else if (check.name === 'Category') {
              // For category, check if the category name is mentioned
              passed = responseLower.includes(check.value.toLowerCase());
            }
            else if (check.name === 'Feature') {
              // For features, check if the feature name is mentioned
              passed = responseLower.includes(check.value.toLowerCase());
            }
            
            checks.push(`${check.name}:${check.value} ${passed ? '✓' : '❌'}`);
            if (!passed) allChecksPass = false;
          }
          
          console.log(`Filter checks: ${checks.join(', ')}`);
          passed = passed && allChecksPass;
        }
      } 
      else if (hasInvalidParams || (apiSuccess && productsData && productsData.data.total === 0)) {
        // Should indicate no products found
        const hasErrorOrEmpty = 
          /\b(no products|couldn['']t find|not available|invalid|not found|no results|try adjusting)\b/i.test(responseLower);
        
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
    console.log('\nFailed queries:');
    failedTests.forEach((query, index) => {
      console.log(`${index + 1}. "${query}"`);
    });
    console.log('\n❌ ' + failCount + ' tests failed.');
  } else {
    console.log('\n✓ All tests passed!');
  }
}

// Run the tests
await testProductAgent();
