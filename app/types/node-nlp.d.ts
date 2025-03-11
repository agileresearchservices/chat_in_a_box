declare module 'node-nlp' {
  export interface NlpEntity {
    entity: string;
    utterance: string;
    sourceText?: string;
    type?: string;
  }

  export interface NlpToken {
    token: string;
    tag: string;
  }

  export interface NlpSentiment {
    score: number;
    comparative: number;
    vote: string;
  }

  export interface NlpResult {
    entities: NlpEntity[];
    tokens: NlpToken[];
    sentiment: NlpSentiment;
  }

  export interface NlpManagerSettings {
    languages: string[];
    forceNER?: boolean;
    nlu?: {
      log?: boolean;
    };
  }

  export class NlpManager {
    constructor(settings: NlpManagerSettings);
    addNamedEntityText(
      entityName: string,
      entityValue: string,
      languages: string[],
      expressions: string[]
    ): void;
    addRegexEntity(
      entityName: string,
      language: string,
      regex: RegExp
    ): void;
    train(): Promise<void>;
    process(language: string, text: string): Promise<NlpResult>;
  }
}
