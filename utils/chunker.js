import { SentenceSplitter } from 'llamaindex';

const chunkText = async (text, chunkSize = 256, chunkOverlap = 20) => {
  try {
    // Create a text splitter with specified chunk size and overlap
    const splitter = new SentenceSplitter({
      chunkSize,
      chunkOverlap
    });
    
    // Split the text into chunks
    const chunks = splitter.splitText(text);
    
    return chunks;
  } catch (error) {
    console.error('Error chunking text with LLamaIndex:', error);
    throw error;
  }
};

export default chunkText;
