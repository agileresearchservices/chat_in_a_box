'use client'

// Import dynamic as a default import with an alias
// Enables dynamic imports with specific configuration options
import dynamicImport from 'next/dynamic'

// Force dynamic rendering to ensure fresh content on each request
export const dynamic = 'force-dynamic'

// Import necessary React hooks and Swagger UI styling
import 'swagger-ui-react/swagger-ui.css'

/**
 * Dynamically import SwaggerUI component with disabled server-side rendering
 * 
 * Key Configurations:
 * - Uses dynamic import to reduce initial bundle size
 * - Disables server-side rendering for client-side only rendering
 * - Ensures Swagger UI is only loaded in the browser
 */
const SwaggerUI = dynamicImport(() => import('swagger-ui-react'), { ssr: false })

/**
 * API Documentation Page Component
 * 
 * Renders an interactive API documentation page using Swagger UI
 * 
 * Features:
 * - Displays comprehensive API documentation
 * - Uses Swagger UI for interactive API exploration
 * - Fetches documentation from the '/api/docs' endpoint
 * - Responsive and mobile-friendly design
 * 
 * Rendering Strategy:
 * - Client-side rendering only
 * - Dynamic import of Swagger UI to optimize performance
 * - Tailwind CSS for styling and responsiveness
 * 
 * Use Cases:
 * - Developer documentation
 * - API endpoint exploration
 * - Understanding available API capabilities
 * 
 * @component
 * @returns {React.ReactElement} A React component rendering the API documentation page
 */
export default function ApiDocs() {
  // Render the API documentation page
  // Uses a container with responsive padding and centered layout
  return (
    <div className="container mx-auto p-4">
      {/* Page title with bold styling */}
      <h1 className="text-2xl font-bold mb-4">API Documentation</h1>
      
      {/* Swagger UI component fetching documentation from '/api/docs' */}
      <SwaggerUI url="/api/docs" />
    </div>
  )
}
