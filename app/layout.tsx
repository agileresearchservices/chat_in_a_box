// Import global styles and essential dependencies
// Ensures consistent styling and provides core application layout functionality
import './globals.css'
import { Inter } from 'next/font/google'
import { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'

/**
 * Font Configuration
 * 
 * Configures the Inter font from Google Fonts
 * 
 * Key Features:
 * - Uses Latin character subset for optimal performance
 * - Provides a clean, modern typography
 * - Ensures consistent text rendering across the application
 * 
 * Performance Optimization:
 * - Subset reduces font file size
 * - Improves initial page load time
 */
const inter = Inter({ subsets: ['latin'] })

/**
 * Application Metadata Configuration
 * 
 * Defines global metadata for the application
 * 
 * Key Components:
 * - Page title
 * - Description for SEO and accessibility
 * 
 * Use Cases:
 * - Browser tab title
 * - Search engine indexing
 * - Social media sharing
 */
export const metadata: Metadata = {
  title: 'Chat In a Box',
  description: 'Your personal chat assistant',
}

/**
 * Root Layout Component
 * 
 * Serves as the foundational layout for the entire application
 * 
 * Key Responsibilities:
 * - Provides a consistent HTML structure
 * - Applies global font styling
 * - Integrates global notification system
 * 
 * Rendering Strategy:
 * - Server-side rendering of base HTML
 * - Applies Inter font class globally
 * - Renders child components within the layout
 * 
 * Component Composition:
 * - Wraps entire application content
 * - Adds global toast notification provider
 * 
 * Accessibility Features:
 * - Sets language attribute for screen readers
 * 
 * @param {Object} props - Component properties
 * @param {React.ReactNode} props.children - Child components to be rendered
 * @returns {React.ReactElement} The root application layout
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // HTML root element with language set for accessibility
    <html lang="en">
      {/* Apply global font class and render application content */}
      <body className={inter.className}>
        {/* Render child components (page content) */}
        {children}
        
        {/* Global toast notification provider */}
        {/* Positioned at top-right for non-intrusive notifications */}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
