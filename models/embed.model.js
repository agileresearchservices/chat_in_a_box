import { PrismaClient } from '@prisma/client';
import processChunk from '../processes/embed-process.js';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export const createEmbed = async (text) => {
  try {
    const embeddings = await processChunk(text);
    
    // Bulk create embeddings
    const createdEmbeddings = await Promise.all(
      embeddings.map(async (item) => {
        return prisma.docs.create({
          data: {
            doc_id: uuidv4(),
            content: item.text,
            embedding: item.embedding
          }
        });
      })
    );
    
    return createdEmbeddings;
  } catch (error) {
    console.error('Error creating embeddings:', error);
    throw error;
  }
};

export default prisma;
