'use client'

// Import dynamic as a default import with an alias
import dynamicImport from 'next/dynamic'

export const dynamic = 'force-dynamic'

// Import necessary modules from React and Swagger UI
import { useEffect } from 'react'
import 'swagger-ui-react/swagger-ui.css'

// Dynamically import SwaggerUI with no SSR
const SwaggerUI = dynamicImport(() => import('swagger-ui-react'), { ssr: false })

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
