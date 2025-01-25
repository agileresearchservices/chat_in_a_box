// Import necessary hooks and components from React and other libraries
// useMemo, useReducer, useState, useRef, useCallback are React hooks for state and lifecycle management
// Message is an interface from ai
// ReactMarkdown is used for rendering markdown content
// Image is used for optimized image rendering
// remarkGfm is a plugin for GitHub Flavored Markdown
// SyntaxHighlighter is used for syntax highlighting code blocks
// format is used for date formatting
// Icons are imported from heroicons for UI elements
// sendMessage is a service function for sending messages
// toast is used for displaying notifications
// cn is a utility function for class names
'use client'

import { useMemo, useReducer, useState, useRef, useCallback } from 'react'
import { Message } from 'ai'
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { format } from 'date-fns'
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon, StopIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { sendMessage } from './services/api'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for a message with a timestamp.
 * Extends the Message interface from ai.
 */
interface MessageWithTimestamp extends Message {
  timestamp: Date // Made required
}

/**
 * Interface for the chat state.
 * Includes messages, loading, and streaming states.
 */
interface ChatState {
  messages: MessageWithTimestamp[]
  isLoading: boolean
  isStreaming: boolean
}

/**
 * Type for chat actions.
 * Includes actions to add messages, update the last message, and set loading/streaming states.
 */
type ChatAction =
  | { type: 'ADD_MESSAGE'; message: MessageWithTimestamp }
  | { type: 'UPDATE_LAST_MESSAGE'; content: string }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_STREAMING'; isStreaming: boolean }

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
      return {
        ...state,
        messages: [...state.messages, action.message]
      }
    case 'UPDATE_LAST_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((msg, index) => 
          index === state.messages.length - 1 
            ? { ...msg, content: action.content }
            : msg
        )
      }
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.isLoading
      }
    case 'SET_STREAMING':
      return {
        ...state,
        isStreaming: action.isStreaming
      }
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
 * Component for copying text to the clipboard.
 * @param text - The text to be copied.
 * @param className - Optional class name for styling.
 */
const CopyButton = ({ text, className }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "p-1 hover:bg-gray-100 rounded absolute top-2 right-2 focus:outline-none focus:ring-2 focus:ring-blue-500",
        className
      )}
      aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
    >
      {copied ? (
        <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-500" />
      ) : (
        <ClipboardDocumentIcon className="h-5 w-5 text-gray-400" />
      )}
    </button>
  )
}

/**
 * Interface for the ChatMessage component.
 * Includes a message prop.
 */
interface ChatMessageProps {
  message: MessageWithTimestamp
}

/**
 * Component for rendering a chat message.
 * @param message - The message to be rendered.
 */
const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === 'user'
  
  return (
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
            {isUser ? '👤' : '🤖'}
          </div>
        </div>
        <div
          className={cn(
            "flex flex-col flex-1 min-w-0",
            isUser ? "items-end" : "items-start"
          )}
        >
          <time className="text-xs text-gray-500 mb-1 px-1">
            {format(message.timestamp, 'HH:mm')}
          </time>
          <div
            className={cn(
              "p-3 sm:p-4 rounded-lg w-full message-content relative break-words",
              isUser
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-900"
            )}
          >
            {!isUser && <CopyButton text={message.content} className="hidden sm:block" />}
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
                      <CopyButton text={codeString} />
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
                },
                a({ node, children, href, ...props }) {
                  return (
                    <a 
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                      {...props}
                    >
                      {children}
                    </a>
                  )
                },
                img({ node, src, alt, ...props }) {
                  if (!src || typeof src !== 'string') return null
                  return (
                    <Image
                      src={src}
                      alt={alt || ''}
                      width={500}
                      height={300}
                      className="rounded-lg max-w-full h-auto"
                      loading="lazy"
                      unoptimized
                    />
                  )
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
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
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
   * Handles the submission of a message.
   * @param e - The form event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || state.isLoading) return

    const userMessage: MessageWithTimestamp = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    dispatch({ type: 'ADD_MESSAGE', message: userMessage })
    setInput('')
    dispatch({ type: 'SET_LOADING', isLoading: true })
    scrollToBottom('auto')

    let currentContent = ''

    try {
      const response = await sendMessage(input.trim())
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || error.error || 'Failed to get response')
      }
      
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      readerRef.current = reader
      dispatch({ type: 'SET_STREAMING', isStreaming: true })

      const assistantMessage: MessageWithTimestamp = {
        id: uuidv4(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }
      dispatch({ type: 'ADD_MESSAGE', message: assistantMessage })

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = new TextDecoder().decode(value)
          const lines = text.split('\n').filter(line => line.trim())

          for (const line of lines) {
            try {
              const data = JSON.parse(line)
              if (data.message?.content !== undefined) {
                currentContent += data.message.content
                dispatch({
                  type: 'UPDATE_LAST_MESSAGE',
                  content: currentContent
                })
                scrollToBottom('auto')
              }
            } catch (e) {
              console.error('Error parsing stream:', e)
            }
          }
        }
      } catch (error) {
        console.error('Error reading stream:', error)
        toast.error('Error reading response stream')
      }
    } catch (error) {
      console.error('Error in chat:', error)
      toast.error(error instanceof Error ? error.message : 'An error occurred while getting the response')
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false })
      dispatch({ type: 'SET_STREAMING', isStreaming: false })
      if (readerRef.current) {
        try {
          await readerRef.current.cancel()
        } catch (error) {
          console.error('Error canceling reader:', error)
        }
        readerRef.current = null
      }
      scrollToBottom()
      inputRef.current?.focus()
    }
  }

  /**
   * Memoized component for rendering the chat messages.
   */
  const messageComponents = useMemo(() => (
    state.messages.map((message) => (
      <ChatMessage
        key={message.id}
        message={message}
      />
    ))
  ), [state.messages])

  return (
    <main className="flex flex-col min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="flex-1 w-full mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <div className="flex flex-col h-[calc(100vh-3rem)]">
          <div 
            className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
            role="log"
            aria-label="Chat messages"
          >
            {state.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 px-4 text-center">
                Start a conversation by typing a message below
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
                {messageComponents}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-2 sm:mt-4 px-2 sm:px-0">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="relative flex-grow">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  className="w-full p-3 sm:p-3 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={state.isLoading}
                  aria-label="Message input"
                />
                {state.isStreaming && (
                  <button
                    type="button"
                    onClick={stopStreaming}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Stop streaming"
                  >
                    <StopIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={state.isLoading || !input.trim()}
                className={cn(
                  "w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg transition-colors",
                  "hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                aria-label="Send message"
              >
                <span className="flex items-center justify-center space-x-2">
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
