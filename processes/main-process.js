import fs from 'fs/promises';
import chunkText from '../utils/chunker.js';
import ollamaEmbedService from '../services/embed.service.js';
import prisma from '../models/embed.model.js';
import { v4 as uuidv4 } from 'uuid';

const mainProcess = async () => {
  console.log('Starting main process...');
  try {
    console.log('Reading text file...');
    const text = await fs.readFile('sample_text.txt', 'utf8');
    console.log('Text read successfully:', text);

    console.log('Chunking text...');
    const chunks = chunkText(text, 256, 20);
    console.log('Chunks created:', await chunks);
    
    console.log(`Processing ${(await chunks).length} chunks...`);
    const results = [];
    for (const chunk of await chunks) {
      console.log('Processing chunk:', chunk);
      try {
        const response = await ollamaEmbedService(chunk);
        console.log('Embedding response received');
        
        console.log('Attempting to create docs entry...');
        const createdDoc = await prisma.docs.create({
          data: {
            doc_id: uuidv4(),
            content: chunk,
            embedding: response.embedding  // Use the embedding directly
          }
        });
        console.log('Chunk embedded and saved:', createdDoc.id);
        results.push(createdDoc);
      } catch (chunkError) {
        console.error('Error processing chunk:', chunkError);
        console.error('Chunk error stack:', chunkError.stack);
      }
    }
    
    console.log('Embedding process completed successfully');
    console.log(`Created ${results.length} embedding entries`);
  } catch (error) {
    console.error('Error in main embedding process:', error);
    console.error(error.stack);
  } finally {
    console.log('Main process finished. Closing connections...');
    await prisma.$disconnect();
  }
};

// Immediately invoke the process
mainProcess().catch(console.error);
