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
import logger from '@/utils/logger';

// Dynamically import Redoc to avoid server-side rendering (SSR) compatibility issues
// This ensures the component only renders on the client-side
const RedocStandalone = dynamic(
  () => import('redoc').then((mod) => mod.RedocStandalone),
  { 
    ssr: false, // Disable server-side rendering
    loading: () => {
      logger.debug('Loading Redoc documentation component');
      return <div>Loading API documentation...</div>
    }
  }
);

// Define a clear type for the API specification
interface ApiSpecification {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, any>;
  components?: Record<string, any>;
}

export default function ApiDocsPage() {
  // State for storing API specification
  const [spec, setSpec] = useState<ApiSpecification | undefined>(undefined);

  // Type guard function to validate API specification
  const isValidApiSpec = (spec: unknown): spec is { data: ApiSpecification } => {
    // Check if spec is an object with a data property containing the actual spec
    if (typeof spec === 'object' && spec !== null && 'data' in spec) {
      const apiSpec = (spec as { data: unknown }).data;
      
      // Validate the nested specification
      if (typeof apiSpec !== 'object' || apiSpec === null) return false;
      
      const requiredKeys = ['openapi', 'info', 'paths'];
      return requiredKeys.every(key => key in apiSpec);
    }
    
    return false;
  };

  // Effect hook to fetch API specification when component mounts
  useEffect(() => {
    const fetchApiSpec = async () => {
      try {
        const response = await fetch('/api/redoc', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          logger.error('Failed to fetch API specification', { 
            status: response.status,
            statusText: response.statusText
          });
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const apiSpecResponse = await response.json();
        
        if (isValidApiSpec(apiSpecResponse)) {
          // Extract the nested specification
          const apiSpec = (apiSpecResponse as { data: ApiSpecification }).data;
          
          // Log spec details for debugging
          logger.debug('API specification retrieved', {
            specKeys: Object.keys(apiSpec)
          });
          
          // Update state with retrieved specification
          setSpec(apiSpec);
        } else {
          logger.error('Invalid API specification format', { 
            specContent: apiSpecResponse 
          });
          
          // Optionally set a default or empty spec
          setSpec(undefined);
        }
      } catch (error) {
        // Log any errors during spec retrieval
        logger.error('Failed to fetch API specification', { 
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        
        // Optional: Set a fallback or show an error state
        setSpec(undefined);
      }
    }
    
    // Invoke the fetch function
    fetchApiSpec();
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    // Full-height container for API documentation
    <div style={{ height: '100vh', width: '100%' }}>
      {spec ? (
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
      ) : (
        <div>Loading API specification...</div>
      )}
    </div>
  );
}
