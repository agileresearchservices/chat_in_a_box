import { nlpService } from '@/app/services/nlp.service';

async function testNLP() {
  try {
    const testCases = [
      "John visited New York last summer and loved the city. The weather was amazing!",
      "Sarah is meeting Tom at 15:30 in San Francisco on December 15th, 2024.",
      "Please contact me at john.doe@example.com or call 123-456-7890.",
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

testNLP();
