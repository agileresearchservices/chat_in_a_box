'use client'

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Message as AiMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

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
import { sendMessage, getEmbedding, clearMemory } from './services/api'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { parseMessage } from '@/utils/message-parser'

/**
 * Extended Message type that includes a timestamp
 */
interface TimestampedMessage extends AiMessage {
  timestamp: Date
  thinkingProcess?: string
  isThinking?: boolean
}

/**
 * Interface for the chat state.
 * Includes messages, loading, and streaming states.
 */
interface ChatState {
  messages: TimestampedMessage[]
  isLoading: boolean
  isStreaming: boolean
  thinkingProcess?: string
}

/**
 * Type for chat actions.
 * Includes actions to add messages, update the last message, and set loading/streaming states.
 */
type ChatAction =
  | { type: 'ADD_MESSAGE'; message: TimestampedMessage }
  | { type: 'UPDATE_LAST_MESSAGE'; content: string; thinkingProcess?: string; isThinking?: boolean }
  | { type: 'SET_MESSAGES'; messages: TimestampedMessage[] }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_STREAMING'; isStreaming: boolean }
  | { type: 'UPDATE_THINKING_PROCESS'; thinkingProcess: string }

/**
 * Reducer function to manage chat state.
 * Handles actions to add messages, update the last message, and set loading/streaming states.
 * @param state - The current state of the chat.
 * @param action - The action to be processed.
 * @returns The updated state.
 */
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'ADD_MESSAGE':
      const newMessages = [...state.messages, action.message]
      // Save to local storage
      localStorage.setItem('chatMessages', JSON.stringify(newMessages))
      return { ...state, messages: newMessages }
      
    case 'UPDATE_LAST_MESSAGE':
      if (state.messages.length === 0) return state
      const updatedMessages = [...state.messages]
      const lastMessage = updatedMessages[updatedMessages.length - 1]
      if (lastMessage.role === 'assistant') {
        lastMessage.content = action.content
        lastMessage.thinkingProcess = action.thinkingProcess
        lastMessage.isThinking = action.isThinking
        // Save to local storage
        localStorage.setItem('chatMessages', JSON.stringify(updatedMessages))
      }
      return { ...state, messages: updatedMessages }
      
    case 'UPDATE_THINKING_PROCESS':
      return { ...state, thinkingProcess: action.thinkingProcess }
      
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages }
      
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading }
      
    case 'SET_STREAMING':
      return { ...state, isStreaming: action.isStreaming }
      
    default:
      return state
  }
}

/**
 * Interface for the CopyButton component.
 * Includes text and optional className props.
 */
interface CopyButtonProps {
  text: string
  className?: string
}


/**
 * Interface for the ChatMessage component.
 * Includes a message prop.
 */
interface ChatMessageProps {
  message: TimestampedMessage
}

/**
 * Component for rendering a chat message.
 * @param message - The message to be rendered.
 */
const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === 'user'
  const [isCopied, setIsCopied] = useState(false)
  const [showThinkingModal, setShowThinkingModal] = useState(false)
  const messageContentRef = useRef<HTMLDivElement>(null)

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
                "prose max-w-none",
                !isUser && "pr-20",
                isUser ? "text-white" : "text-gray-900"
              )}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      const codeString = String(children).replace(/\n$/, '')
                      const isInline = !match

                      if (isInline) {
                        return (
                          <code 
                            className={cn("px-1 py-0.5 rounded bg-gray-200", className)} 
                            {...props}
                          >
                            {children}
                          </code>
                        )
                      }

                      return (
                        <div className="relative mt-2">
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
                            className="rounded-md !mt-0"
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        </div>
                      )
                    }
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                {message.isThinking && (
                  <div className="inline-flex items-center gap-1 bg-grey-50 text-grey-600 px-2 py-1 rounded-md my-1">
                    <BeakerIcon className="w-4 h-4 animate-bounce" />
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

interface ThinkingModalProps {
  isOpen: boolean
  onClose: () => void
  content: string
}

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
            className="prose max-w-none"
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

/**
 * Main component for the chat interface.
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
  const handleClearMemory = async () => {
    try {
      // Clear local storage and state
      localStorage.removeItem('chatMessages')
      dispatch({ type: 'SET_MESSAGES', messages: [] })
      toast.success('Conversation cleared')
    } catch (error) {
      console.error('Error clearing conversation:', error)
      toast.error('Failed to clear conversation')
    }
  }

  /**
   * Handles the submission of a message.
   * @param e - The form event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
          console.warn('Failed to generate embedding:', await embeddingResponse.text())
        }
      } catch (error) {
        console.warn('Error generating embedding:', error)
      }

      // Send message with full conversation history
      const response = await sendMessage(input, state.messages)
      if (!response.ok) throw new Error('Failed to send message')

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
      toast.error('Failed to send message')
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
          <div className="flex-1 overflow-y-auto p-2 sm:p-4">
            {messageComponents}
            <div ref={messagesEndRef} />
          </div>

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
                    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
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
    </main>
  )
}
