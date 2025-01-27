import { Client } from 'pg';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { join } from 'path';
import ollamaEmbedService from '@/services/embed.service';
import chunkText from '../utils/chunker.js';
import { v4 as uuidv4 } from 'uuid';

// Create a connection pool
const pool = new Client({
  connectionString: process.env.DATABASE_URL
});

const processTextContent = async (text) => {
  const chunks = chunkText(text.content, 256, 20);
  console.log(`Processing ${(await chunks).length} chunks...`);
  
  const results = [];
  for (const chunk of await chunks) {
    try {
      console.log('Attempting to embed text:', chunk);
      
      const { embedding } = await ollamaEmbedService(chunk);
      console.log('Embedding received, length:', embedding.length);
      
      // Convert embedding array to a Postgres array literal
      const embeddingStr = `[${embedding.join(',')}]`;
      
      // Use pg to insert with vector type
      const query = {
        text: `
          INSERT INTO docs (doc_id, source, type, chunk, embedding)
          VALUES ($1, $2, $3, $4, $5::vector)
          RETURNING *
        `,
        values: [
          uuidv4(),
          text.file_path,
          text.file_type,
          chunk,
          embeddingStr
        ]
      };
      
      const { rows } = await pool.query(query);
      console.log('Document created with ID:', rows[0].id);
      results.push(rows[0]);
    } catch (chunkError) {
      console.error('Error processing chunk:', chunkError);
    }
  }
  return results;
};

const runPythonExtractor = async (directory) => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [
      'services/text_extractor.py',
      '--directory',
      directory
    ]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}\n${errorOutput}`));
      } else {
        resolve(output);
      }
    });
  });
};

const mainProcess = async () => {
  console.log('Starting main process...');
  try {
    const directory = 'data';
    console.log(`Processing directory: ${directory}`);
    
    const extractedTexts = await runPythonExtractor(directory);
    const results = [];
    
    for (const text of JSON.parse(extractedTexts)) {
      if (text.error) {
        console.error('Error in file:', text.error);
        continue;
      }
      const processedResults = await processTextContent(text);
      results.push(...processedResults);
    }
    
    console.log('Embedding process completed successfully');
    console.log(`Created ${results.length} embedding entries`);
  } catch (error) {
    console.error('Error in main embedding process:', error);
    console.error(error.stack);
  } finally {
    console.log('Main process finished. Closing connections...');
    await pool.end();
  }
};

// Immediately invoke the process
mainProcess().catch(console.error);