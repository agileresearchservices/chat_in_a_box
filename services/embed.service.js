import axios from 'axios';

const ollamaEmbedService = async (text) => {
  try {
    console.log('Attempting to embed text:', text);
    
    const response = await axios.post('http://localhost:11434/api/embeddings', {
      model: 'nomic-embed-text',
      prompt: text
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Embedding response received:', response.data);
    
    // Verify the response structure
    if (!response.data || !response.data.embedding) {
      throw new Error('Invalid embedding response');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error in Ollama embedding service:', error.message);
    
    // Log more details if it's an axios error
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    
    throw error;
  }
};

export default ollamaEmbedService;
