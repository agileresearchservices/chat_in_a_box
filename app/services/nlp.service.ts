import { NlpManager, NlpEntity, NlpToken, NlpResult } from 'node-nlp';

export interface NLPAnalysisResult {
  entities: Array<{
    entity: string;
    value: string;
    type?: string;
  }>;
  tokens: Array<{
    token: string;
    tag: string;
  }>;
  sentiment?: {
    score: number;
    comparative: number;
    vote: string;
  };
}

class NLPService {
  private manager: NlpManager;
  private initialized: boolean = false;

  constructor() {
    this.manager = new NlpManager({ 
      languages: ['en'],
      forceNER: true,
      nlu: { log: false }
    });
  }

  private async initializeManager() {
    if (this.initialized) return;

    // Add common named entities
    // Cities
    const cities: [string, string[]][] = [
      ['New York', ['New York', 'NYC', 'New York City']],
      ['Boston', ['Boston', 'Boston City']],
      ['San Francisco', ['San Francisco', 'SF', 'San Fran']],
      ['Los Angeles', ['Los Angeles', 'LA', 'L.A.']],
      ['Chicago', ['Chicago', 'Chi-town']],
    ];

    for (const [city, aliases] of cities) {
      this.manager.addNamedEntityText('city', city, ['en'], aliases);
    }

    // Add common person names
    const names = [
      'John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Tom', 'Mary',
      'James', 'Emma', 'William', 'Olivia', 'Michael', 'Sophia'
    ];
    for (const name of names) {
      this.manager.addNamedEntityText('person', name, ['en'], [name]);
    }

    // Add regex entities
    this.manager.addRegexEntity('email', 'en', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    this.manager.addRegexEntity('phone', 'en', /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
    this.manager.addRegexEntity('url', 'en', /https?:\/\/[^\s]+/);
    this.manager.addRegexEntity('date', 'en', /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/);
    this.manager.addRegexEntity('time', 'en', /\b(?:2[0-3]|[01]?[0-9]):[0-5][0-9]\b/);

    // Train the manager
    await this.manager.train();
    this.initialized = true;
  }

  async analyze(text: string): Promise<NLPAnalysisResult> {
    // Ensure manager is initialized
    await this.initializeManager();
    
    // Process the text
    const result: NlpResult = await this.manager.process('en', text);
    
    // Extract entities
    const entities = (result.entities || []).map((entity: NlpEntity) => ({
      entity: entity.entity,
      value: entity.utterance || entity.sourceText || entity.entity,
      type: entity.type
    }));

    // Extract tokens and their parts of speech
    const tokens = (result.tokens || []).map((token: NlpToken) => ({
      token: token.token,
      tag: token.tag
    }));

    // Get sentiment analysis
    const sentiment = result.sentiment ? {
      score: result.sentiment.score,
      comparative: result.sentiment.comparative,
      vote: result.sentiment.vote
    } : undefined;

    return {
      entities,
      tokens,
      sentiment
    };
  }
}

// Export singleton instance
export const nlpService = new NLPService();
