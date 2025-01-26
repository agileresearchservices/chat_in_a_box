import axios from 'axios';

async function testEmbedding() {
  try {
    console.log('Attempting to embed text...');
    const response = await axios.post('http://localhost:11434/api/embeddings', {
      model: 'nomic-embed-text',
      prompt: 'Hello, world!'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Full response:', response.data);
    console.log('Embedding length:', response.data.embedding.length);
  } catch (error) {
    console.error('Error in embedding test:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
  }
}

testEmbedding();
