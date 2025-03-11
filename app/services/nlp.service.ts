/**
 * NLP Service for Chat in a Box
 * 
 * Provides natural language processing capabilities including:
 * - Named Entity Recognition (NER)
 * - Sentiment Analysis
 * - Part-of-speech Tagging
 * 
 * Uses node-nlp library with custom type definitions and entity recognition patterns.
 * Implements lazy initialization to improve performance.
 */

import { NlpManager, NlpEntity, NlpToken, NlpResult } from 'node-nlp';

/**
 * Interface representing the result of NLP analysis
 */
export interface NLPAnalysisResult {
  /** Named entities found in the text */
  entities: Array<{
    /** Type of entity (e.g., person, city, date) */
    entity: string;
    /** Actual value found in the text */
    value: string;
    /** Recognition method (enum for predefined entities, regex for pattern matching) */
    type?: string;
  }>;
  /** Tokenized words with their part-of-speech tags */
  tokens: Array<{
    /** Individual word or token */
    token: string;
    /** Part-of-speech tag (e.g., NNP for proper noun, VBD for past tense verb) */
    tag: string;
  }>;
  /** Sentiment analysis results, if available */
  sentiment?: {
    /** Raw sentiment score (-1 to 1) */
    score: number;
    /** Normalized sentiment score */
    comparative: number;
    /** Overall sentiment classification */
    vote: string;
  };
}

/**
 * Service class for natural language processing
 * Implements entity recognition, sentiment analysis, and POS tagging
 */
class NLPService {
  private manager: NlpManager;
  private initialized: boolean = false;

  constructor() {
    this.manager = new NlpManager({ 
      languages: ['en'],
      forceNER: true,
      nlu: { log: false }
    });
    console.log('[NLPService] Initialized NLP manager');
  }

  /**
   * Initializes the NLP manager with entity recognition patterns and trains the model
   * Uses lazy initialization - only runs when first needed
   * @private
   */
  private async initializeManager() {
    if (this.initialized) return;

    console.log('[NLPService] Starting manager initialization...');

    // Add common named entities
    // Cities with their common aliases
    const cities: [string, string[]][] = [
      ['New York', ['New York', 'NYC', 'New York City']],
      ['Boston', ['Boston', 'Boston City']],
      ['San Francisco', ['San Francisco', 'SF', 'San Fran']],
      ['Los Angeles', ['Los Angeles', 'LA', 'L.A.']],
      ['Chicago', ['Chicago', 'Chi-town']],
    ];

    console.log('[NLPService] Adding city entities...');
    for (const [city, aliases] of cities) {
      this.manager.addNamedEntityText('city', city, ['en'], aliases);
    }

    // Common English names for person recognition
    const names = [
      'John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Tom', 'Mary',
      'James', 'Emma', 'William', 'Olivia', 'Michael', 'Sophia'
    ];
    console.log('[NLPService] Adding person entities...');
    for (const name of names) {
      this.manager.addNamedEntityText('person', name, ['en'], [name]);
    }

    // Add regex patterns for structured data
    console.log('[NLPService] Adding regex entities...');
    this.manager.addRegexEntity('email', 'en', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    this.manager.addRegexEntity('phone', 'en', /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
    this.manager.addRegexEntity('url', 'en', /https?:\/\/[^\s]+/);
    this.manager.addRegexEntity('date', 'en', /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/);
    this.manager.addRegexEntity('time', 'en', /\b(?:2[0-3]|[01]?[0-9]):[0-5][0-9]\b/);

    // Train the manager
    console.log('[NLPService] Training NLP manager...');
    await this.manager.train();
    this.initialized = true;
    console.log('[NLPService] Manager initialization complete');
  }

  /**
   * Analyzes text using NLP techniques
   * @param text - The text to analyze
   * @returns Promise resolving to analysis results including entities, tokens, and sentiment
   */
  async analyze(text: string): Promise<NLPAnalysisResult> {
    console.log('[NLPService] Analyzing text:', text);
    
    // Ensure manager is initialized
    await this.initializeManager();
    
    // Process the text
    const result: NlpResult = await this.manager.process('en', text);
    
    // Extract entities with their actual values from the text
    const entities = (result.entities || []).map((entity: NlpEntity) => ({
      entity: entity.entity,
      value: entity.utterance || entity.sourceText || entity.entity,
      type: entity.type
    }));

    // Extract tokens with their part-of-speech tags
    const tokens = (result.tokens || []).map((token: NlpToken) => ({
      token: token.token,
      tag: token.tag
    }));

    // Get sentiment analysis results if available
    const sentiment = result.sentiment ? {
      score: result.sentiment.score,
      comparative: result.sentiment.comparative,
      vote: result.sentiment.vote
    } : undefined;

    const analysisResult = { entities, tokens, sentiment };
    console.log('[NLPService] Analysis result:', JSON.stringify(analysisResult, null, 2));

    return analysisResult;
  }
}

// Export singleton instance
export const nlpService = new NLPService();
