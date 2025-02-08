'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Redoc to avoid SSR issues
const RedocStandalone = dynamic(
  () => import('redoc').then((mod) => mod.RedocStandalone),
  { 
    ssr: false,
    loading: () => <div>Loading API documentation...</div>
  }
);

export default function ApiDocsPage() {
  const [spec, setSpec] = useState(null);

  useEffect(() => {
    async function fetchApiSpec() {
      try {
        const response = await fetch('/api/redoc');
        const apiSpec = await response.json();
        setSpec(apiSpec);
      } catch (error) {
        console.error('Failed to fetch API specification', error);
      }
    }
    
    fetchApiSpec();
  }, []);

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      {spec && (
        <RedocStandalone 
          spec={spec}
          options={{
            theme: {
              colors: {
                primary: {
                  main: '#0070f3'
                }
              }
            },
            disableSearch: false
          }}
        />
      )}
    </div>
  );
}
