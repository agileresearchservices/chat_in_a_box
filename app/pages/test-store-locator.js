import React, { useState } from 'react';
import Head from 'next/head';

export default function TestStoreLocator() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);
    
    try {
      const resp = await fetch('/api/agents/store-locator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: query }),
      });
      
      if (!resp.ok) {
        throw new Error(`API responded with status: ${resp.status}`);
      }
      
      const data = await resp.json();
      setResponse(data);
    } catch (err) {
      console.error('Error calling store locator agent:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Store Locator Test</title>
      </Head>
      
      <h1 className="text-2xl font-bold mb-4">Store Locator Agent Test</h1>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex flex-col space-y-2">
          <label htmlFor="query" className="font-medium">
            Enter your search query:
          </label>
          <input
            id="query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find stores in Port Ericmouth"
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>
      
      {error && (
        <div className="p-4 mb-4 bg-red-100 border-l-4 border-red-500 text-red-700">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      {response && (
        <div className="bg-gray-100 p-4 rounded-md">
          <h2 className="text-xl font-bold mb-2">Agent Response:</h2>
          <p className="whitespace-pre-line">{response.message}</p>
          
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Extracted Parameters:</h3>
            <pre className="bg-gray-200 p-3 rounded-md overflow-x-auto">
              {JSON.stringify(response.params, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2">Suggested Queries to Try:</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <button 
              className="text-blue-600 hover:underline"
              onClick={() => setQuery("Find stores in port ERICmouth")}
            >
              Find stores in port ERICmouth
            </button>
          </li>
          <li>
            <button 
              className="text-blue-600 hover:underline"
              onClick={() => setQuery("Stores in VA")}
            >
              Stores in VA
            </button>
          </li>
          <li>
            <button 
              className="text-blue-600 hover:underline"
              onClick={() => setQuery("Electronics stores in NY")}
            >
              Electronics stores in NY
            </button>
          </li>
          <li>
            <button 
              className="text-blue-600 hover:underline"
              onClick={() => setQuery("Stores near me")}
            >
              Stores near me
            </button>
          </li>
          <li>
            <button 
              className="text-blue-600 hover:underline"
              onClick={() => setQuery("Find stores in zip 42056")}
            >
              Find stores in zip 42056
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
