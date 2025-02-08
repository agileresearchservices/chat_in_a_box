/**
 * Parsed Message Structure
 * 
 * Defines the comprehensive output of message parsing
 * 
 * Key Features:
 * - Captures main message content
 * - Optionally preserves AI's thinking process
 * 
 * Design Principles:
 * - Flexible message representation
 * - Supports transparent AI reasoning tracking
 * 
 * Use Cases:
 * - AI conversation logging
 * - Debugging AI reasoning
 * - Enhanced conversational transparency
 */
interface ParsedMessage {
  content: string;        // Primary message content
  thinkingProcess?: string; // Optional AI reasoning details
}

/**
 * Message Parsing Utility
 * 
 * Extracts and separates the main content from the AI's thinking process
 * 
 * Parsing Strategy:
 * 1. Use regex to identify thinking process enclosed in <think> tags
 * 2. Extract thinking process if present
 * 3. Remove thinking process tags from main content
 * 
 * Key Features:
 * - XML-like tag-based thinking process extraction
 * - Robust handling of messages with/without thinking process
 * - Preserves original message semantics
 * 
 * Regex Explanation:
 * - `<think>`: Opening tag for thinking process
 * - `([\s\S]*?)`: Non-greedy capture of any characters (including newlines)
 * - `<\/think>`: Closing tag for thinking process
 * 
 * @param {string} message - Raw message potentially containing thinking process
 * @returns {ParsedMessage} Parsed message with content and optional thinking process
 * 
 * @example
 * // Message with thinking process
 * parseMessage("Let me think about this...<think>Breaking down the problem into steps: 1) Analyze context 2) Generate solution</think>")
 * // Returns: { 
 * //   content: "Let me think about this...", 
 * //   thinkingProcess: "Breaking down the problem into steps: 1) Analyze context 2) Generate solution"
 * // }
 * 
 * @example
 * // Message without thinking process
 * parseMessage("Hello, how can I help you?")
 * // Returns: { 
 * //   content: "Hello, how can I help you?"
 * // }
 */
export function parseMessage(message: string): ParsedMessage {
  // Regular expression to match thinking process within XML-like tags
  const thinkRegex = /<think>([\s\S]*?)<\/think>/;
  
  // Attempt to match thinking process in the message
  const match = message.match(thinkRegex);

  // If no thinking process is found, return the entire message as content
  if (!match) {
    return { content: message };
  }

  // Extract thinking process, removing leading/trailing whitespace
  const thinkingProcess = match[1].trim();
  
  // Remove thinking process tags from the original message
  const content = message.replace(match[0], '').trim();

  // Return parsed message with separated content and thinking process
  return {
    content,
    thinkingProcess
  };
}
