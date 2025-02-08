'use client'

// Import essential React hooks and external libraries
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Message as AiMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

// Import heroicons for UI elements
import { 
  ClipboardDocumentIcon, 
  ClipboardDocumentCheckIcon, 
  StopIcon, 
  PaperAirplaneIcon, 
  TrashIcon, 
  BeakerIcon,
  XMarkIcon,
  UserIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'

// Import application-specific services and utilities
import { sendMessage, getEmbedding, _clearMemory } from './services/api'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { parseMessage } from '@/utils/message-parser'

/**
 * Extended Message Type with Enhanced Metadata
 * 
 * Augments the base AI message type with additional contextual information
 * 
 * Key Enhancements:
 * - Adds timestamp for message tracking
 * - Includes thinking process metadata
 * - Supports streaming and thinking state flags
 * 
 * Use Cases:
 * - Detailed message history tracking
 * - Capturing AI reasoning process
 * - Managing message rendering states
 */
interface TimestampedMessage extends AiMessage {
  timestamp: Date
  thinkingProcess?: string
  isThinking?: boolean
}

/**
 * Chat State Management Interface
 * 
 * Defines the comprehensive state structure for the chat interface
 * 
 * Key State Components:
 * - Messages array with extended metadata
 * - Loading state indicators
 * - Streaming state management
 * - Optional thinking process tracking
 * 
 * Responsibilities:
 * - Tracks conversation history
 * - Manages UI interaction states
 * - Supports dynamic message rendering
 */
interface ChatState {
  messages: TimestampedMessage[]
  isLoading: boolean
  isStreaming: boolean
  thinkingProcess?: string
}

/**
 * Chat State Reducer Action Types
 * 
 * Defines a type-safe set of actions for managing chat state
 * 
 * Action Categories:
 * - Message manipulation
 * - State update actions
 * - Loading and streaming control
 * 
 * Design Pattern:
 * - Implements Redux-like reducer pattern
 * - Ensures predictable state transitions
 */
type ChatAction =
  | { type: 'ADD_MESSAGE'; message: TimestampedMessage }
  | { type: 'UPDATE_LAST_MESSAGE'; content: string; thinkingProcess?: string; isThinking?: boolean }
  | { type: 'SET_MESSAGES'; messages: TimestampedMessage[] }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_STREAMING'; isStreaming: boolean }
  | { type: 'UPDATE_THINKING_PROCESS'; thinkingProcess: string }

/**
 * Chat State Reducer
 * 
 * Manages state transitions for the chat interface
 * 
 * Key Responsibilities:
 * - Handles complex state updates
 * - Manages message list modifications
 * - Persists chat history to local storage
 * 
 * State Management Strategies:
 * - Immutable state updates
 * - Local storage synchronization
 * - Supports streaming and thinking process tracking
 * 
 * @param {ChatState} state - Current chat state
 * @param {ChatAction} action - State modification action
 * @returns {ChatState} Updated chat state
 */
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'ADD_MESSAGE':
      // Add new message and persist to local storage
      const newMessages = [...state.messages, action.message]
      localStorage.setItem('chatMessages', JSON.stringify(newMessages))
      return { ...state, messages: newMessages }
      
    case 'UPDATE_LAST_MESSAGE':
      // Update the most recent assistant message
      if (state.messages.length === 0) return state
      const updatedMessages = [...state.messages]
      const lastMessage = updatedMessages[updatedMessages.length - 1]
      if (lastMessage.role === 'assistant') {
        lastMessage.content = action.content
        lastMessage.thinkingProcess = action.thinkingProcess
        lastMessage.isThinking = action.isThinking
        localStorage.setItem('chatMessages', JSON.stringify(updatedMessages))
      }
      return { ...state, messages: updatedMessages }
      
    case 'UPDATE_THINKING_PROCESS':
      // Update the current thinking process
      return { ...state, thinkingProcess: action.thinkingProcess }
      
    case 'SET_MESSAGES':
      // Replace entire message list and update localStorage
      if (action.messages.length === 0) {
        localStorage.removeItem('chatMessages')
      } else {
        localStorage.setItem('chatMessages', JSON.stringify(action.messages))
      }
      return { ...state, messages: action.messages }
      
    case 'SET_LOADING':
      // Toggle loading state
      return { ...state, isLoading: action.isLoading }
      
    case 'SET_STREAMING':
      // Toggle streaming state
      return { ...state, isStreaming: action.isStreaming }
      
    default:
      return state
  }
}

/**
 * Chat Message Component Props
 * 
 * Defines the props for the ChatMessage component
 * 
 * Key Props:
 * - Message object with extended metadata
 * 
 * Use Cases:
 * - Rendering individual chat messages
 * - Displaying message content and metadata
 */
interface ChatMessageProps {
  message: TimestampedMessage
}

/**
 * Chat Message Component
 * 
 * Renders a single chat message with extended metadata
 * 
 * Key Features:
 * - Displays message content and timestamp
 * - Supports thinking process and streaming states
 * - Includes copy button for message text
 * 
 * @param {ChatMessageProps} props - Message object with extended metadata
 */
const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === 'user'
  const [isCopied, setIsCopied] = useState(false)
  const [showThinkingModal, setShowThinkingModal] = useState(false)
  const messageContentRef = useRef<HTMLDivElement>(null)

  // Memoize the markdown content to prevent unnecessary re-renders
  const markdownContent = useMemo(() => message.content, [message.content])

  // Simple smooth scroll when content changes
  useEffect(() => {
    if (messageContentRef.current) {
      messageContentRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end',
      })
    }
  }, [markdownContent])

  const copyToClipboard = async () => {
    if (!messageContentRef.current) return

    try {
      await navigator.clipboard.writeText(message.content)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
      toast.success('Copied to clipboard')
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('Failed to copy')
    }
  }

  const hasThinkingProcess = !isUser && message.thinkingProcess

  return (
    <>
      <div
        className={cn(
          "flex px-2 sm:px-0",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        <div
          className={cn(
            "flex items-start space-x-2 sm:space-x-4 w-full max-w-[85%] sm:max-w-[75%]",
            isUser ? "flex-row-reverse space-x-reverse sm:space-x-reverse" : "flex-row"
          )}
        >
          <div className="flex-shrink-0">
            <div 
              className={cn(
                "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center",
                isUser ? "bg-blue-500" : "bg-gray-500"
              )}
              aria-label={isUser ? "User Avatar" : "Assistant Avatar"}
            >
              {isUser ? (
                <UserIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              ) : (
                <SparklesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              )}
            </div>
          </div>

          <div className="flex-grow space-y-2">
            <div
              ref={messageContentRef}
              className={cn(
                "relative rounded-lg px-3 py-2 overflow-x-auto",
                isUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
              )}
            >
              <div className={cn(
                "prose max-w-none markdown-content",
                "[&>*]:text-inherit [&_h1]:text-inherit [&_h2]:text-inherit [&_h3]:text-inherit [&_h4]:text-inherit [&_h5]:text-inherit [&_h6]:text-inherit [&_ul]:text-inherit [&_ol]:text-inherit [&_li]:text-inherit [&_p]:text-inherit",
                !isUser && "pr-20",
                isUser ? "text-white prose-headings:text-white prose-ul:text-white prose-ol:text-white" : "text-gray-900",
                "scroll-mt-4"
              )}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      const codeString = String(children).replace(/\n$/, '')
                      const isInline = !match

                      if (isInline) {
                        return (
                          <code 
                            className={cn("px-1 py-0.5 rounded bg-gray-200 max-w-full overflow-x-auto whitespace-pre-wrap break-words", className)} 
                            {...props}
                          >
                            {children}
                          </code>
                        )
                      }

                      return (
                        <div className="relative mt-2 max-w-full">
                          <button
                            onClick={() => navigator.clipboard.writeText(codeString)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Copy code"
                          >
                            <ClipboardDocumentIcon className="w-5 h-5" />
                          </button>
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match?.[1] || 'text'}
                            PreTag="div"
                            className="rounded-md !mt-0 max-w-full overflow-x-auto whitespace-pre-wrap break-words"
                            wrapLongLines={true}
                            customStyle={{
                              maxWidth: '100%',
                              padding: '1rem',
                            }}
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        </div>
                      )
                    }
                  }}
                >
                  {markdownContent}
                </ReactMarkdown>
                {message.isThinking && (
                  <div className="inline-flex items-center gap-1 bg-grey-50 text-grey-600 px-2 py-1 rounded-md my-1">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    </div>
                    <span>Thinking...</span>
                  </div>
                )}
              </div>

              {!isUser && (
                <div className="absolute top-2 right-2 flex space-x-1">
                  {hasThinkingProcess && (
                    <button
                      onClick={() => setShowThinkingModal(true)}
                      className="p-1 text-gray-500 hover:text-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Show thinking process"
                    >
                      <BeakerIcon className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={copyToClipboard}
                    className="p-1 text-gray-500 hover:text-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Copy message"
                  >
                    {isCopied ? (
                      <ClipboardDocumentCheckIcon className="w-5 h-5" />
                    ) : (
                      <ClipboardDocumentIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ThinkingModal
        isOpen={showThinkingModal}
        onClose={() => setShowThinkingModal(false)}
        content={message.thinkingProcess || ''}
      />
    </>
  )
}

/**
 * Thinking Modal Component Props
 * 
 * Defines the props for the ThinkingModal component
 * 
 * Key Props:
 * - Modal open state
 * - Close callback function
 * - Thinking process content
 * 
 * Use Cases:
 * - Displaying thinking process details
 * - Customizable modal behavior
 */
interface ThinkingModalProps {
  isOpen: boolean
  onClose: () => void
  content: string
}

/**
 * Thinking Modal Component
 * 
 * Displays the thinking process details in a modal window
 * 
 * Key Features:
 * - Displays thinking process content
 * - Supports copy button for content
 * - Customizable modal behavior
 * 
 * @param {ThinkingModalProps} props - Modal props
 */
const ThinkingModal = ({ isOpen, onClose, content }: ThinkingModalProps) => {
  const [isCopied, setIsCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
      toast.success('Copied to clipboard')
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('Failed to copy')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Thinking Process</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={copyToClipboard}
              className="p-1 text-gray-500 hover:text-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Copy content"
            >
              {isCopied ? (
                <ClipboardDocumentCheckIcon className="w-5 h-5" />
              ) : (
                <ClipboardDocumentIcon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close modal"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose max-w-none [&>*]:text-inherit [&_h1]:text-inherit [&_h2]:text-inherit [&_h3]:text-inherit [&_h4]:text-inherit [&_h5]:text-inherit [&_h6]:text-inherit [&_ul]:text-inherit [&_ol]:text-inherit [&_li]:text-inherit [&_p]:text-inherit"
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

/**
 * Main Chat Interface Component
 * 
 * Manages the entire chat conversation and UI
 * 
 * Key Features:
 * - Manages chat state and message history
 * - Handles user input and message submission
 * - Supports streaming and thinking process tracking
 * - Includes copy button for message text
 * 
 * @returns {JSX.Element} Chat interface component
 */
export default function Home() {
  const [input, setInput] = useState('')
  const [state, dispatch] = useReducer(chatReducer, {
    messages: [],
    isLoading: false,
    isStreaming: false
  })
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load messages from local storage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatMessages')
    if (savedMessages) {
      try {
        const messages = JSON.parse(savedMessages)
        // Convert timestamp strings back to Date objects
        const messagesWithDates = messages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
        }))
        dispatch({ type: 'SET_MESSAGES', messages: messagesWithDates })
      } catch (error) {
        console.error('Error loading saved messages:', error)
        localStorage.removeItem('chatMessages')
      }
    }
  }, [])

  // Save messages to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(state.messages))
  }, [state.messages])

  useEffect(() => {
    if (state.messages.length === 0 && inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = '50px';
    }
  }, [state.messages]);

  /**
   * Scrolls to the bottom of the chat log.
   * @param behavior - The scroll behavior (smooth or auto).
   */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  /**
   * Stops the streaming of the response.
   */
  const stopStreaming = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.cancel()
      readerRef.current = null
      dispatch({ type: 'SET_STREAMING', isStreaming: false })
      toast.success('Stopped streaming response')
    }
  }, [])

  /**
   * Handles clearing the conversation memory
   */
  const handleClearMemory = useCallback(async () => {
    try {
      // Clear server-side memory first
      await _clearMemory();

      // Comprehensive local storage clearing
      localStorage.removeItem('chatMessages');
      
      // Reset local state to empty array
      dispatch({ 
        type: 'SET_MESSAGES', 
        messages: [] 
      });

      // Additional verification and logging
      console.log('Memory cleared:', {
        localStorage: localStorage.getItem('chatMessages'),
        currentState: state.messages
      });

      toast.success('Conversation memory cleared');
    } catch (error) {
      console.error('Failed to clear memory:', error);
      toast.error('Failed to clear memory');
    }
  }, [state.messages]);

  /**
   * Handles the submission of a message.
   * @param e - The form event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Explicitly reset textarea height
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = '50px';
    }

    if (!input.trim() || state.isLoading) return

    // Set loading state and thinking process immediately
    dispatch({ type: 'SET_LOADING', isLoading: true })
    dispatch({ 
      type: 'UPDATE_THINKING_PROCESS', 
      thinkingProcess: 'Thinking...' 
    })

    try {
      const userMessage: TimestampedMessage = {
        role: 'user' as const,
        content: input,
        id: Date.now().toString(),
        timestamp: new Date()
      }

      // Add user message immediately
      dispatch({ type: 'ADD_MESSAGE', message: userMessage })
      setInput('')

      // Generate embedding for the user message
      try {
        const embeddingResponse = await getEmbedding(input)
        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text()
          console.error('Failed to generate embedding:', errorText)
        }
      } catch (error) {
        console.error('Unexpected error generating embedding:', error)
      }

      // Send message with full conversation history
      const response = await sendMessage(input, state.messages)

      const reader = response.body?.getReader() ?? null
      readerRef.current = reader
      
      if (!reader) throw new Error('No response reader')

      dispatch({ type: 'SET_STREAMING', isStreaming: true })
      let currentMessage = ''
      let displayMessage = ''
      let insideThinkTag = false
      let showThinking = false

      // Add an empty assistant message that we'll update
      const assistantMessage: TimestampedMessage = {
        role: 'assistant' as const,
        content: '',
        id: Date.now().toString(),
        timestamp: new Date()
      }
      dispatch({ type: 'ADD_MESSAGE', message: assistantMessage })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = new TextDecoder().decode(value)
        const lines = text.split('\n').filter(Boolean)

        for (const line of lines) {
          const data = JSON.parse(line)
          const chunk = data.message.content
          currentMessage += chunk
          
          // Check for think tag boundaries
          if (chunk.includes('<think>')) {
            insideThinkTag = true
            showThinking = true
          }
          
          // Only accumulate display content when not inside think tags
          if (!insideThinkTag) {
            displayMessage += chunk
          }
          
          if (chunk.includes('</think>')) {
            insideThinkTag = false
            showThinking = false
          }
          
          if (data.done) {
            // Parse the complete message to extract thinking process
            const parsedMessage = parseMessage(currentMessage)
            dispatch({ 
              type: 'UPDATE_LAST_MESSAGE', 
              content: parsedMessage.content,
              thinkingProcess: parsedMessage.thinkingProcess
            })
            break
          } else {
            dispatch({ 
              type: 'UPDATE_LAST_MESSAGE', 
              content: showThinking ? displayMessage + ' ' : displayMessage,
              isThinking: showThinking
            })
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message. Is the LLM and embedding model running?')
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false })
      dispatch({ type: 'SET_STREAMING', isStreaming: false })
      readerRef.current = null
    }
  }

  // Handle Escape key to stop streaming
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.isStreaming) {
        stopStreaming()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.isStreaming, stopStreaming])

  // Scroll to bottom when messages update or during streaming
  useEffect(() => {
    scrollToBottom()
  }, [state.messages, scrollToBottom])

  /**
   * Memoized component for rendering the chat messages.
   */
  const messageComponents = useMemo(() => (
    <div className="flex flex-col space-y-4">
      {state.messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
    </div>
  ), [state.messages])

  return (
    <main className="flex flex-col min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="flex-1 w-full mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto scroll-smooth" ref={messagesEndRef}>
            <div className="container max-w-4xl mx-auto py-6 space-y-6">
              {messageComponents}
            </div>
          </div>

          <div className="border-t">
            <form onSubmit={handleSubmit} className="mt-2 sm:mt-4 px-2 sm:px-0">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleClearMemory}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-500"
                    aria-label="Clear conversation memory"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                  {state.isStreaming && (
                    <button
                      type="button"
                      onClick={stopStreaming}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-500"
                      aria-label="Stop streaming"
                    >
                      <StopIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>

                <div className="relative flex-grow">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="w-full p-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-0 resize-none overflow-y-auto"
                    disabled={state.isLoading}
                    aria-label="Message input"
                    rows={1}
                    style={{ 
                      minHeight: '50px', 
                      maxHeight: '200px', 
                      height: 'auto' 
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${Math.max(Math.min(target.scrollHeight, 200), 50)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e as unknown as React.FormEvent);
                      }
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!input.trim() || state.isLoading}
                  className={cn(
                    "inline-flex items-center space-x-2 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                    !input.trim() || state.isLoading
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-blue-500 hover:bg-blue-600 text-white"
                  )}
                  aria-label="Send message"
                >
                  <span className="flex items-center space-x-2">
                    <PaperAirplaneIcon className="w-5 h-5" />
                    <span>Send</span>
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
