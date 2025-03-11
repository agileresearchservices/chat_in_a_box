import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';

interface CodeBlockProps {
  codeString: string;
  language: string;
}

/**
 * CodeBlock Component
 * 
 * Renders a code block with syntax highlighting and copy functionality
 */
const CodeBlock: React.FC<CodeBlockProps> = ({ codeString, language }) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="relative group">
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        className="rounded-md !mt-0 max-w-full overflow-x-auto whitespace-pre-wrap break-words"
        wrapLongLines={true}
        customStyle={{
          maxWidth: '100%',
          padding: '1rem',
          color: '#e4e4e7',
          backgroundColor: '#1f2937',
        }}
      >
        {codeString}
      </SyntaxHighlighter>
      <button
        onClick={copyToClipboard}
        className="absolute top-2 right-2 p-1 rounded text-gray-300 hover:text-white hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy code"
      >
        {isCopied ? (
          <ClipboardDocumentCheckIcon className="w-5 h-5" />
        ) : (
          <ClipboardDocumentIcon className="w-5 h-5" />
        )}
      </button>
    </div>
  );
};

export default CodeBlock;
