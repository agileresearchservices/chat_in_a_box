This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Git](https://git-scm.com/)

## Ollama Setup

Before running the development server, you'll need to install Ollama and pull the phi4 model:

### macOS

1. Install Ollama:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

2. Start Ollama:
```bash
ollama serve
```

### Windows

1. Download and install [Windows Subsystem for Linux (WSL)](https://learn.microsoft.com/en-us/windows/wsl/install)
2. Install Ollama in WSL:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

3. Start Ollama in WSL:
```bash
ollama serve
```

### Pull the Model (Both Platforms)

In a new terminal, pull the phi4 model:
```bash
ollama pull phi4
```

## Project Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd chat_in_a_box
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory with the following content:
```bash
NEXT_PUBLIC_API_URL=http://localhost:11434
OLLAMA_MODEL=phi4
```

## Conversation Memory Management

### ConversationMemory Class

The `ConversationMemory` class is a crucial component of the application's conversational context management. It provides the following key functionalities:

- **Message Tracking**: Maintains a rolling history of conversation messages
- **Context Preservation**: Limits memory to the last 10 messages to prevent token overflow
- **Context Generation**: Generates a context prompt for maintaining conversational context

#### Key Methods

- `addMessage(message)`: Adds a new message to the memory, automatically trimming older messages if the memory exceeds the maximum length
- `getMemory()`: Retrieves the current conversation memory
- `getContextPrompt()`: Generates a formatted string representation of the conversation history
- `clear()`: Resets the conversation memory

This mechanism ensures that the AI maintains context across multiple interactions while preventing excessive memory usage.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Troubleshooting

- **Windows Users**: Make sure WSL is running and Ollama is started in WSL before running the application
- **Mac Users**: If you get a security warning, you may need to approve Ollama in System Settings > Security & Privacy
- If the model isn't responding, ensure Ollama is running with `ollama serve` in a separate terminal
- Check that the NEXT_PUBLIC_API_URL environment variable matches your Ollama server address
