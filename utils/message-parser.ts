interface ParsedMessage {
  content: string;
  thinkingProcess?: string;
}

/**
 * Parses a message to extract the thinking process and main content
 * @param message The raw message that may contain thinking process
 * @returns Object containing the main content and optional thinking process
 */
export function parseMessage(message: string): ParsedMessage {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/;
  const match = message.match(thinkRegex);

  if (!match) {
    return { content: message };
  }

  // Extract thinking process and remove it from the content
  const thinkingProcess = match[1].trim();
  const content = message.replace(match[0], '').trim();

  return {
    content,
    thinkingProcess
  };
}
