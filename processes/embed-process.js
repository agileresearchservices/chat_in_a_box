import pkg from 'chunker';
const { chunk } = pkg;
import ollamaEmbedService from '../services/embed.service.js';

const chunkSize = 256;

const processChunk = async (text) => {
  try {
    const chunks = chunk(text, chunkSize);
    const embeddings = [];
    
    for (const chunkText of chunks) {
      const embedding = await ollamaEmbedService(chunkText);
      embeddings.push({ text: chunkText, embedding });
    }
    
    return embeddings;
  } catch (error) {
    console.error('Error processing chunk:', error);
    throw error;
  }
};

export default processChunk;
