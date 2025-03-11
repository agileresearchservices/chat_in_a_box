/**
 * NLP Service Test Suite
 * 
 * This file contains test cases for the NLP service, validating:
 * - Entity recognition (people, cities, dates, contact info)
 * - Sentiment analysis
 * - Part-of-speech tagging
 * - Error handling
 */

import { nlpService } from '@/app/services/nlp.service';

/**
 * Test function for NLP service capabilities
 * Runs a series of test cases covering different NLP features
 * 
 * Test cases include:
 * 1. Multiple entities and sentiment (people, cities, sentiment)
 * 2. Date and time recognition with multiple entities
 * 3. Contact information (email, phone)
 * 4. Multiple locations with sentiment analysis
 */
async function testNLP() {
  try {
    // Test cases covering various NLP features
    const testCases = [
      // Test case 1: Multiple entities and sentiment
      "John visited New York last summer and loved the city. The weather was amazing!",
      
      // Test case 2: Date, time, and multiple entities
      "Sarah is meeting Tom at 15:30 in San Francisco on December 15th, 2024.",
      
      // Test case 3: Contact information
      "Please contact me at john.doe@example.com or call 123-456-7890.",
      
      // Test case 4: Multiple locations with sentiment
      "I really enjoyed my trip to Los Angeles, but Chicago was even better!"
    ];

    for (const text of testCases) {
      console.log('\nTesting NLP analysis with text:', text);
      const result = await nlpService.analyze(text);
      console.log('\nAnalysis Result:');
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error testing NLP service:', error);
  }
}

// Run the test suite
testNLP();
