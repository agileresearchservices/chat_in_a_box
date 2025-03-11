from pydantic_ai import Agent
from typing import Dict, Any, Optional
import httpx
import json
import os
import re
import logging
import sys

# Configure logging to write to a file
logging.basicConfig(filename='logs/app.log', level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

class ProductAgent(Agent):
    """
    PydanticAI agent for handling product search queries using the OpenSearch catalog.
    
    Integrates with:
    - Product Service (/app/services/product.service.ts)
    - Product API Route (/app/api/products/route.ts)
    
    Features:
    - Natural language query parsing
    - Price range extraction
    - Color preference extraction
    - Storage capacity extraction
    - Release year extraction
    - Error handling and logging
    """
    
    def __init__(self):
        super().__init__()
        # Common price patterns
        self.price_patterns = [
            r'under\s+\$?(\d+)',
            r'less than\s+\$?(\d+)',
            r'cheaper than\s+\$?(\d+)',
            r'below\s+\$?(\d+)',
            r'around\s+\$?(\d+)',
            r'about\s+\$?(\d+)',
            r'between\s+\$?(\d+)\s+and\s+\$?(\d+)',
            r'\$?(\d+)\s*-\s*\$?(\d+)',
            r'more than\s+\$?(\d+)',
            r'over\s+\$?(\d+)',
            r'at least\s+\$?(\d+)',
        ]
        
        # Common color patterns (must match OpenSearch Color field values)
        self.color_patterns = [
            r'(?:in|color)\s+(black|white|blue|red|green|yellow|purple|pink|gold|silver)',
            r'(black|white|blue|red|green|yellow|purple|pink|gold|silver)\s+(?:phone|device|xenophone)',
        ]
        
        # Storage patterns (must match OpenSearch Storage field format)
        self.storage_patterns = [
            r'(\d+)\s*(?:gb|tb)',
            r'(?:with|has)\s+(\d+)\s*(?:gb|tb)',
            r'(?:storage|capacity)\s+(?:of\s+)?(\d+)\s*(?:gb|tb)',
        ]

        # Screen size patterns (for "large screen" queries)
        self.screen_patterns = [
            r'large\s+screen',
            r'big\s+screen',
            r'larger\s+screen',
            r'bigger\s+screen',
        ]

        # Latest/newest patterns (for Release_Year sorting)
        self.latest_patterns = [
            r'latest',
            r'newest',
            r'recent',
            r'new',
        ]

    def extract_search_params(self, query: str) -> Dict[str, Any]:
        """
        Extract search parameters from the natural language query.
        
        Maps extracted parameters to OpenSearch catalog schema:
        - Title: Full text search including brand/model
        - Price: Float range queries
        - Storage: Keyword exact match
        - Color: Keyword exact match
        - Screen_Size: Float range for "large screen" queries
        - Release_Year: Integer sorting for "latest" queries
        """
        # Start with base query structure
        search_params = {
            'query': '',  # Empty query string for price-only searches
            'size': 5,      # Limit results for agent response
            'page': 1,      # Start with first page
            'filters': {},  # Initialize empty filters object
            'fallbackStrategy': True  # Enable fallback strategy for 0 results
        }

        # Clean query: remove action verbs like "find" and keep product terms
        clean_query = re.sub(r'^(find|show|get|search for|looking for|give me|i want|i need)\s+', '', query.lower())
        
        # Extract product type (likely nouns before price filters)
        # For queries like "Find phones under $500", extract "phones"
        for price_term in ['under', 'less than', 'cheaper than', 'below', 'around', 'about', 'between', 'over', 'at least']:
            if price_term in clean_query:
                parts = clean_query.split(price_term)
                if parts[0].strip():
                    search_params['query'] = parts[0].strip()
                    logging.debug(f"Extracted product type: '{search_params['query']}' from '{clean_query}'")
                    break
        
        # If no product type found yet, use the whole cleaned query
        if not search_params['query'] and clean_query:
            search_params['query'] = clean_query
            logging.debug(f"Using entire cleaned query: '{clean_query}'")
        
        # Handle special queries first
        if any(re.search(pattern, query.lower()) for pattern in self.screen_patterns):
            search_params['filters']['minScreenSize'] = 6.0  # Consider 6" and above as "large"
            search_params['sort'] = [{'Screen_Size': 'desc'}]  # Sort by screen size descending
        
        if any(re.search(pattern, query.lower()) for pattern in self.latest_patterns):
            search_params['sort'] = [{'Release_Year': 'desc'}]  # Sort by release year descending
        
        # Extract brand preferences
        brand_match = re.search(r'(from|by)\s+(\w+)', query.lower())
        if brand_match:
            search_params['filters']['brand'] = brand_match.group(2).capitalize()
            logging.debug(f'Set brand filter to {search_params["filters"]["brand"]}')
        
        # Extract color preferences
        for pattern in self.color_patterns:
            match = re.search(pattern, query.lower())
            if match:
                search_params['filters']['color'] = match.group(1).capitalize()
                break
        
        # Extract storage capacity
        storage_match = None
        for pattern in self.storage_patterns:
            match = re.search(pattern, query.lower())
            if match:
                storage_match = match
                break
        
        if storage_match:
            storage_value = storage_match.group(1)
            storage_unit = 'GB'
            
            # Check if TB is mentioned and convert to GB
            if 'tb' in storage_match.group(0).lower():
                storage_unit = 'TB'
            
            # Format storage value according to OpenSearch format
            if storage_unit == 'TB':
                storage_formatted = f"{storage_value}TB"
            else:
                storage_formatted = f"{storage_value}GB"
                
            search_params['filters']['storage'] = storage_formatted.upper()
            logging.debug(f'Set storage filter to {search_params["filters"]["storage"]}')
        
        # Extract price ranges
        price_match = None
        for pattern in self.price_patterns:
            match = re.search(pattern, query.lower())
            if match:
                price_match = match
                break
        
        if price_match:
            logging.debug(f'Price match found: {price_match.groups()}')
            if len(price_match.groups()) == 2:
                search_params['filters']['minPrice'] = float(price_match.group(1))
                search_params['filters']['maxPrice'] = float(price_match.group(2))
                logging.debug(f'Set minPrice to {search_params["filters"]["minPrice"]} and maxPrice to {search_params["filters"]["maxPrice"]}')
            elif 'under' in query.lower() or 'less than' in query.lower() or 'below' in query.lower():
                search_params['filters']['maxPrice'] = float(price_match.group(1))
                logging.debug(f'Set maxPrice to {search_params["filters"]["maxPrice"]}')
            elif 'over' in query.lower() or 'more than' in query.lower() or 'at least' in query.lower():
                search_params['filters']['minPrice'] = float(price_match.group(1))
                logging.debug(f'Set minPrice to {search_params["filters"]["minPrice"]}')
            else:
                target_price = float(price_match.group(1))
                search_params['filters']['minPrice'] = target_price * 0.8
                search_params['filters']['maxPrice'] = target_price * 1.2
                logging.debug(f'Set minPrice to {search_params["filters"]["minPrice"]} and maxPrice to {search_params["filters"]["maxPrice"]} for around price')
            logging.debug(f'Search params after price extraction: {search_params}')
        
        # Only set query if we have non-filter search terms
        query_terms = query.lower()
        for pattern in (self.price_patterns + self.color_patterns + self.storage_patterns + 
                       self.screen_patterns + self.latest_patterns):
            query_terms = re.sub(pattern, '', query_terms, flags=re.IGNORECASE)
        
        query_terms = query_terms.replace('phones', '').replace('phone', '').strip()
        if query_terms:
            search_params['query'] = query_terms
        
        return search_params

    def format_product_results(self, products: list, total: int, params: Dict[str, Any]) -> str:
        """Format product results into a natural language response."""
        logging.debug(f'Products found: {products}')
        if not products:
            constraints = []
            filters = params.get('filters', {})
            
            if filters.get('color'):
                constraints.append(f"in {filters['color']}")
            if filters.get('storage'):
                constraints.append(f"with {filters['storage']} storage")
            if filters.get('maxPrice'):
                constraints.append(f"under ${filters['maxPrice']}")
            elif filters.get('minPrice'):
                constraints.append(f"over ${filters['minPrice']}")
            if filters.get('minScreenSize'):
                constraints.append("with large screens")
            if filters.get('brand'):
                constraints.append(f"from {filters['brand']}")
            
            constraint_text = " and ".join(constraints) if constraints else "matching your criteria"
            return f"I couldn't find any products {constraint_text}. Try adjusting your search criteria."

        # Build response header based on search type
        header = f"I found {total} {'product' if total == 1 else 'products'}"
        if params.get('sort'):
            sort_field = next(iter(params['sort'][0].keys()))
            if sort_field == 'Screen_Size':
                header += " with large screens"
            elif sort_field == 'Release_Year':
                header += ", sorted by release year"
        
        # Add price range info if filtering by price
        if params.get('filters', {}).get('maxPrice') or params.get('filters', {}).get('minPrice'):
            prices = [float(p['price']) for p in products]  # Ensure prices are floats
            min_price = min(prices)
            max_price = max(prices)
            if params['filters'].get('maxPrice'):
                header += f" under ${params['filters']['maxPrice']}"
            elif params['filters'].get('minPrice'):
                header += f" over ${params['filters']['minPrice']}"
            if len(products) > 1:
                header += f" (price range: ${min_price:.2f} - ${max_price:.2f})"
        
        header += ":"
        response = [header]
        
        for i, product in enumerate(products):
            # Line 1: Product title with phone emoji and money bag before price
            model_line = f"\n📱 {product['title']} 💸 ${float(product['price']):.2f}"
            
            # Line 2: All specs on one line with separators
            specs_parts = []
            
            # Add storage information
            if product.get('storage'):
                specs_parts.append(f"Storage: {product['storage']} 💾")
            
            # Add color information
            if product.get('color'):
                specs_parts.append(f"Color: {product['color']} 🎨")
            
            # Add stock information
            if product.get('stock') and product['stock'] != '0':
                specs_parts.append(f"Stock: {product['stock']} 📦")
            else:
                specs_parts.append("Out of Stock ❌")
            
            # Join all specs with bullet point separators
            specs_line = " • ".join(specs_parts)
            
            # Add both lines to response
            response.append(model_line)
            response.append(specs_line)
            
            # Add an empty line between products (single newline is rendered as space)
            if i < len(products) - 1:
                response.append("")
        
        return "\n".join(response)

    async def process(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> str:
        """
        Process a product search query using the OpenSearch catalog.
        
        Args:
            query: The user's product query
            parameters: Additional parameters including base URL
            
        Returns:
            Formatted product response
        """
        try:
            # Extract search parameters
            search_params = self.extract_search_params(query)
            logging.debug(f'Extracted search parameters: {search_params}')  # Log extracted parameters
            
            # Get base URL from parameters or use default
            base_url = 'http://localhost:3000'
            if parameters and 'baseUrl' in parameters:
                base_url = parameters['baseUrl']
            
            # Make request to products API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{base_url}/api/products",
                    json=search_params,
                    headers={'Content-Type': 'application/json'},
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    logging.debug(f'API response: {data}')  # Log the API response
                    if data.get('error'):
                        return f"Error searching products: {data['error']}"
                        
                    products = data.get('data', {}).get('products', [])
                    total = data.get('data', {}).get('total', 0)
                    
                    return self.format_product_results(products, total, search_params)
                else:
                    return f"Error searching products: {response.status_code} {response.text}"
                    
        except Exception as e:
            return f"Error processing product query: {str(e)}"
