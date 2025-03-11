/**
 * Type definitions for node-nlp library
 * 
 * These type definitions extend the node-nlp library to provide better TypeScript support
 * and include additional properties needed for our NLP service implementation.
 */

declare module 'node-nlp' {
  /**
   * Configuration options for NLP Manager
   */
  export interface NlpManagerSettings {
    /** List of languages to support */
    languages: string[];
    /** Force NER processing even without training data */
    forceNER?: boolean;
    /** NLU (Natural Language Understanding) options */
    nlu?: {
      /** Whether to log NLU operations */
      log?: boolean;
    };
  }

  /**
   * Named entity recognition result
   */
  export interface NlpEntity {
    /** Type of entity (e.g., person, city, date) */
    entity: string;
    /** Start position in text */
    start: number;
    /** End position in text */
    end: number;
    /** Accuracy/confidence score */
    accuracy?: number;
    /** Original text that matched the entity */
    sourceText?: string;
    /** Normalized or canonical form of the entity */
    utterance?: string;
    /** Recognition method (enum or regex) */
    type?: string;
  }

  /**
   * Token with part-of-speech information
   */
  export interface NlpToken {
    /** The word or token from text */
    token: string;
    /** Part-of-speech tag (e.g., NNP, VBD) */
    tag: string;
    /** Start position in text */
    start?: number;
    /** End position in text */
    end?: number;
  }

  /**
   * Sentiment analysis result
   */
  export interface NlpSentiment {
    /** Raw sentiment score (-1 to 1) */
    score: number;
    /** Normalized comparative score */
    comparative: number;
    /** Overall sentiment classification */
    vote: 'positive' | 'negative' | 'neutral';
  }

  /**
   * Complete NLP analysis result
   */
  export interface NlpResult {
    /** Language of the analyzed text */
    language: string;
    /** Identified named entities */
    entities?: NlpEntity[];
    /** Tokenized words with POS tags */
    tokens?: NlpToken[];
    /** Sentiment analysis results */
    sentiment?: NlpSentiment;
  }

  /**
   * Main NLP processing class
   */
  export class NlpManager {
    constructor(options: NlpManagerSettings);
    
    /**
     * Add a named entity with text variations
     * @param entityName - Type of entity (e.g., person, city)
     * @param entityValue - Canonical form of the entity
     * @param languages - List of languages this entity applies to
     * @param variations - Different ways the entity might appear in text
     */
    addNamedEntityText(
      entityName: string,
      entityValue: string,
      languages: string[],
      variations: string[]
    ): void;

    /**
     * Add a regex pattern for entity recognition
     * @param entityName - Type of entity to recognize
     * @param language - Language this pattern applies to
     * @param regex - Regular expression pattern
     */
    addRegexEntity(
      entityName: string,
      language: string,
      regex: RegExp
    ): void;

    /**
     * Train the NLP manager
     * Must be called after adding entities and before processing text
     */
    train(): Promise<void>;

    /**
     * Process text through NLP pipeline
     * @param language - Language of the input text
     * @param text - Text to analyze
     * @returns Analysis results including entities, tokens, and sentiment
     */
    process(language: string, text: string): Promise<NlpResult>;
  }
}
