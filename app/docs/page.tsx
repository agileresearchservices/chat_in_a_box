'use client'

// Import necessary modules from React and Swagger UI
// useEffect is a React hook for side effects
import { useEffect } from 'react'
// SwaggerUI is used to render the API documentation UI
import SwaggerUI from 'swagger-ui-react'
// The Swagger UI CSS is imported for styling
import 'swagger-ui-react/swagger-ui.css'

/**
 * Component to render the API documentation page.
 * Utilizes Swagger UI to display the API docs.
 * @returns A React component displaying the API documentation.
 */
export default function ApiDocs() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API Documentation</h1>
      <SwaggerUI url="/api/docs" />
    </div>
  )
}
