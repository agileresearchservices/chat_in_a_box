import fs from 'fs/promises';
import { spawn } from 'child_process';
import chunkText from '../utils/chunker.js';
import ollamaEmbedService from '../services/embed.service.js';
import prisma from '../models/embed.model.js';
import { v4 as uuidv4 } from 'uuid';

const processTextContent = async (text) => {
  const chunks = chunkText(text.content, 256, 20);
  console.log(`Processing ${(await chunks).length} chunks...`);
  
  const results = [];
  for (const chunk of await chunks) {
    try {
      console.log('Attempting to embed text:', chunk);
      
      const response = await ollamaEmbedService(chunk);
      console.log('Embedding response received:', response);
      
      const createdDoc = await prisma.docs.create({
        data: {
          doc_id: uuidv4(),
          source: text.file_path,
          type: text.file_type,
          chunk: chunk,
          embedding: response.embedding
        }
      });
      console.log('Document created with ID:', createdDoc.id);
      results.push(createdDoc);
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
    await prisma.$disconnect();
  }
};

// Immediately invoke the process
mainProcess().catch(console.error);