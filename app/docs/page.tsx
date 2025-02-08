/**
 * ApiDocsPage: A React component for rendering dynamic API documentation
 * 
 * This page uses Redoc to dynamically render OpenAPI/Swagger specifications
 * fetched from the server. It handles asynchronous loading of the API spec
 * and provides a responsive, interactive documentation view.
 * 
 * Key Features:
 * - Dynamic import of Redoc to avoid server-side rendering issues
 * - Async fetching of API specification from '/api/redoc' endpoint
 * - Customizable theme with primary color branding
 * - Fallback loading state during spec retrieval
 * 
 * @module ApiDocsPage
 * @returns {React.JSX.Element} Rendered API documentation page
 */
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Redoc to avoid server-side rendering (SSR) compatibility issues
// This ensures the component only renders on the client-side
const RedocStandalone = dynamic(
  () => import('redoc').then((mod) => mod.RedocStandalone),
  { 
    ssr: false, // Disable server-side rendering
    loading: () => <div>Loading API documentation...</div> // Show loading state
  }
);

export default function ApiDocsPage() {
  // State to store the fetched API specification
  const [spec, setSpec] = useState(null);

  // Effect hook to fetch API specification when component mounts
  useEffect(() => {
    /**
     * Fetches the API specification from the server
     * 
     * @async
     * @function fetchApiSpec
     * @throws {Error} If API spec cannot be retrieved
     */
    async function fetchApiSpec() {
      try {
        // Fetch API spec from the designated endpoint
        const response = await fetch('/api/redoc');
        const apiSpec = await response.json();
        
        // Update state with retrieved specification
        setSpec(apiSpec);
      } catch (error) {
        // Log any errors during spec retrieval
        console.error('Failed to fetch API specification', error);
      }
    }
    
    // Invoke the fetch function
    fetchApiSpec();
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    // Full-height container for API documentation
    <div style={{ height: '100vh', width: '100%' }}>
      {spec && (
        // Render Redoc standalone component when spec is available
        <RedocStandalone 
          spec={spec}
          options={{
            // Custom theme configuration
            theme: {
              colors: {
                primary: {
                  main: '#0070f3' // Next.js brand blue
                }
              }
            },
            // Enable search functionality in documentation
            disableSearch: false
          }}
        />
      )}
    </div>
  );
}
