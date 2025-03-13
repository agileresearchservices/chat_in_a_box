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
    - Brand and model extraction
    - Technical specs extraction (processor, RAM)
    - Feature preference extraction (water resistance, wireless charging, etc.)
    - Rating preferences
    - Category extraction
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
        
        # Brand patterns
        self.brand_patterns = [
            r'(?:from|by)\s+([a-zA-Z0-9\s]+)',
            r'([a-zA-Z0-9\s]+)\s+(?:brand|phones|devices)',
        ]
        
        # Feature patterns for boolean features
        self.feature_patterns = {
            'waterResistant': [r'water[\s-]*(?:resistant|proof)', r'splash[\s-]*proof'],
            'wirelessCharging': [r'wireless[\s-]*charg(?:ing|er)', r'qi[\s-]*charg(?:ing|er)'],
            'fastCharging': [r'fast[\s-]*charg(?:ing|er)', r'quick[\s-]*charg(?:ing|er)', r'rapid[\s-]*charg(?:ing|er)'],
            'fiveGCompatible': [r'5g', r'(?:five|5)[\s-]*g', r'(?:fifth|5th)[\s-]*generation'],
        }
        
        # Rating patterns
        self.rating_patterns = [
            r'(?:top|best)[\s-]*rated',
            r'(?:high|highest)[\s-]*rated',
            r'(?:rating|ratings)[\s-]*(?:above|over|higher than)[\s-]*(\d+)',
            r'(\d+(?:\.\d+)?)[\s-]*(?:stars?|ratings?)',
            r'at least (\d+(?:\.\d+)?)[\s-]*stars?',
        ]
        
        # Category patterns
        self.category_patterns = [
            r'(?:in|category)\s+(smartphone|flagship|budget|midrange|gaming|camera)',
            r'(smartphone|flagship|budget|midrange|gaming|camera)[\s-]*(?:phones?|category)',
        ]
        
        # Processor patterns
        self.processor_patterns = [
            r'(?:with|using)[\s-]*(snapdragon|exynos|bionic|mediatek)[\s-]*(\d+)?',
            r'(snapdragon|exynos|bionic|mediatek)[\s-]*(\d+)?[\s-]*(?:processor|chip|chipset)',
        ]
        
        # RAM patterns
        self.ram_patterns = [
            r'(\d+)[\s-]*gb[\s-]*(?:of)?[\s-]*ram',
            r'ram[\s-]*(?:of)?[\s-]*(\d+)[\s-]*gb',
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
        - Brand: Keyword exact match
        - Model: Keyword exact match
        - Rating: Float range for minimum rating
        - Water_Resistant: Boolean
        - Wireless_Charging: Boolean
        - Fast_Charging: Boolean
        - 5G_Compatible: Boolean
        - Category: Keyword exact match
        - Processor: Keyword exact match
        - RAM: Keyword exact match
        """
        # Start with base query structure
        search_params = {
            'query': '',  # Empty query string for price-only searches
            'size': 5,      # Limit results for agent response
            'page': 1,      # Start with first page
            'filters': {},  # Initialize empty filters object
            'fallbackStrategy': True,  # Enable fallback strategy for 0 results
            'sort': 'relevance'  # Default sort order
        }

        # Clean query: remove action verbs like "find" and keep product terms
        # Also handle "Show me the latest/cheapest/best" patterns
        clean_query = re.sub(r'^(find|show me|show|get|search for|looking for|give me|i want|i need)\s+(the\s+)?(latest|newest|best|cheapest|most expensive)?\s*', '', query.lower())
        logging.debug(f"Original query: '{query}' -> Cleaned query: '{clean_query}'")
        
        # Special handling for "latest"/"newest" queries that were cleaned
        if 'latest' in query.lower() or 'newest' in query.lower():
            search_params['sort'] = 'relevance'  # Prioritize newest models
            search_params['filters']['releaseYear'] = 2023  # Focus on newer models
            logging.debug("Set sort order and filters for latest/newest query")
        
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
        
        # Handle special sorting queries
        if any(re.search(pattern, query.lower()) for pattern in self.screen_patterns):
            search_params['filters']['minScreenSize'] = 6.0  # Consider 6" and above as "large"
            search_params['sort'] = 'relevance'  # Use relevance to avoid overriding the sort
        
        # If query mentions "best" or "top rated", sort by rating
        if re.search(r'(?:best|top|highest)[\s-]*(?:rated)?', query.lower()):
            search_params['sort'] = 'rating_desc'
        
        # If query mentions "cheapest" or "least expensive", sort by price ascending
        if re.search(r'(?:cheapest|least[\s-]*expensive|affordable|budget)', query.lower()):
            search_params['sort'] = 'price_asc'
        
        # If query mentions "premium" or "high-end", sort by price descending
        if re.search(r'(?:premium|high[\s-]*end|luxur)', query.lower()):
            search_params['sort'] = 'price_desc'
        
        # Extract brand preferences from the CLEANED query, not the original
        for pattern in self.brand_patterns:
            brand_match = re.search(pattern, clean_query)
            if brand_match:
                # Make sure the matched brand is not a common search prefix or part of another pattern
                potential_brand = brand_match.group(1).strip().lower()
                # Skip if the brand is a common prefix, search term, or modifier
                common_terms = [
                    'find', 'show', 'show me', 'get', 'me', 'search for', 'phones',
                    'latest', 'newest', 'recent', 'new', 'best', 'top', 'cheapest',
                    'expensive', 'the', 'a', 'an', 'some', 'any', 'all', 'most'
                ]
                if potential_brand in common_terms:
                    logging.debug(f"Skipping common term as brand: '{potential_brand}'")
                    continue
                
                # Check if it's one of our known valid brands
                valid_brands = ['hyperphone', 'techpro', 'globaltech', 'nexgen', 'smartdevice']
                if potential_brand.lower() in valid_brands:
                    search_params['filters']['brand'] = potential_brand.capitalize()
                    logging.debug(f'Set brand filter to {search_params["filters"]["brand"]}')
                    break
                
                # If it's not a common term and seems like a legitimate brand, use it
                if len(potential_brand.split()) <= 2:  # Most brands are 1-2 words
                    search_params['filters']['brand'] = potential_brand.capitalize()
                    logging.debug(f'Set brand filter to {search_params["filters"]["brand"]}')
                    break
        
        # Extract color preferences
        for pattern in self.color_patterns:
            match = re.search(pattern, query.lower())
            if match:
                search_params['filters']['color'] = match.group(1).capitalize()
                logging.debug(f'Set color filter to {search_params["filters"]["color"]}')
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
        
        # Extract feature preferences (boolean features)
        for feature, patterns in self.feature_patterns.items():
            if any(re.search(pattern, query.lower()) for pattern in patterns):
                search_params['filters'][feature] = True
                logging.debug(f'Set {feature} filter to True')
        
        # Extract rating preferences
        rating_match = None
        for pattern in self.rating_patterns:
            match = re.search(pattern, query.lower())
            if match and len(match.groups()) >= 1:
                rating_match = match
                break
        
        if rating_match:
            try:
                min_rating = float(rating_match.group(1))
                if 0 <= min_rating <= 5:
                    search_params['filters']['minRating'] = min_rating
                    logging.debug(f'Set minRating to {min_rating}')
            except (IndexError, ValueError):
                # If there's no explicit number but terms like "high-rated"
                if re.search(r'(?:top|best|high|highest)[\s-]*rated', query.lower()):
                    search_params['filters']['minRating'] = 4.0
                    logging.debug(f'Set default minRating to 4.0 for high-rated query')
        
        # Extract category preferences
        category_match = None
        for pattern in self.category_patterns:
            match = re.search(pattern, query.lower())
            if match:
                category_match = match
                break
        
        if category_match:
            category = category_match.group(1).capitalize()
            search_params['filters']['category'] = category
            logging.debug(f'Set category filter to {category}')
        
        # Extract processor preferences
        processor_match = None
        for pattern in self.processor_patterns:
            match = re.search(pattern, query.lower())
            if match:
                processor_match = match
                break
        
        if processor_match:
            processor = processor_match.group(1).capitalize()
            if len(processor_match.groups()) > 1 and processor_match.group(2):
                processor += " " + processor_match.group(2)
            search_params['filters']['processor'] = processor
            logging.debug(f'Set processor filter to {processor}')
        
        # Extract RAM preferences
        ram_match = None
        for pattern in self.ram_patterns:
            match = re.search(pattern, query.lower())
            if match:
                ram_match = match
                break
        
        if ram_match:
            ram = ram_match.group(1) + "GB"
            search_params['filters']['ram'] = ram
            logging.debug(f'Set RAM filter to {ram}')
        
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
            
            if filters.get('brand'):
                constraints.append(f"from {filters['brand']}")
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
            if filters.get('minRating'):
                constraints.append(f"with at least {filters['minRating']} star rating")
            if filters.get('processor'):
                constraints.append(f"with {filters['processor']} processor")
            if filters.get('ram'):
                constraints.append(f"with {filters['ram']} RAM")
            if filters.get('category'):
                constraints.append(f"in the {filters['category']} category")
            
            # Add boolean features
            for feature, display_name in [
                ('waterResistant', 'water resistance'),
                ('wirelessCharging', 'wireless charging'),
                ('fastCharging', 'fast charging'),
                ('fiveGCompatible', '5G capability')
            ]:
                if filters.get(feature):
                    constraints.append(f"with {display_name}")
            
            constraint_text = " and ".join(constraints) if constraints else "matching your criteria"
            return f"I couldn't find any products {constraint_text}. Try adjusting your search criteria."

        # Build response header based on search type
        header = f"I found {total} {'product' if total == 1 else 'products'}"
        
        if params.get('sort') == 'rating_desc':
            header += ", sorted by highest rating"
        elif params.get('sort') == 'price_asc':
            header += ", sorted by lowest price"
        elif params.get('sort') == 'price_desc':
            header += ", sorted by highest price"
        
        # Add price range info if filtering by price
        if params.get('filters', {}).get('maxPrice') or params.get('filters', {}).get('minPrice'):
            prices = [float(p.get('price', 0)) for p in products]  # Ensure prices are floats
            min_price = min(prices)
            max_price = max(prices)
            if params['filters'].get('maxPrice'):
                header += f" under ${params['filters']['maxPrice']}"
            elif params['filters'].get('minPrice'):
                header += f" over ${params['filters']['minPrice']}"
            if len(products) > 1:
                header += f" (price range: ${min_price:.2f} - ${max_price:.2f})"
        
        # Add brand info if filtering by brand
        if params.get('filters', {}).get('brand'):
            header += f" from {params['filters']['brand']}"
        
        header += ":"
        response = [header]
        
        for i, product in enumerate(products):
            # Line 1: Product title with brand & model, emoji and money bag before price
            title_parts = []
            if product.get('brand'):
                title_parts.append(product['brand'])
            if product.get('model'):
                title_parts.append(product['model'])
            
            # If no brand/model available, use original title
            product_title = " ".join(title_parts) if title_parts else product.get('title', 'Unknown Product')
            
            # Add original price and discount if available
            price_text = f"${float(product.get('price', 0)):.2f}"
            if product.get('discountPercentage') and float(product.get('discountPercentage', 0)) > 0:
                orig_price = product.get('originalPrice', 0)
                if orig_price and float(orig_price) > float(product.get('price', 0)):
                    price_text = f"${float(product.get('price', 0)):.2f} 🏷️ {int(float(product.get('discountPercentage', 0)))}% off (was ${float(orig_price):.2f})"
            
            model_line = f"\n📱 {product_title} 💸 {price_text}"
            
            # Line 2: Rating and review count
            rating_line = ""
            if product.get('rating'):
                stars = "⭐" * int(float(product.get('rating', 0)))
                rating_line = f"{stars} {float(product.get('rating', 0))}/5"
                
                if product.get('reviewCount') and int(product.get('reviewCount', 0)) > 0:
                    rating_line += f" ({product['reviewCount']} reviews)"
            
            # Line 3: All specs on one line with separators
            specs_parts = []
            
            # Add storage information
            if product.get('storage'):
                specs_parts.append(f"Storage: {product['storage']} 💾")
            
            # Add color information
            if product.get('color'):
                specs_parts.append(f"Color: {product['color']} 🎨")
            
            # Add RAM if available
            if product.get('ram'):
                specs_parts.append(f"RAM: {product['ram']} 🧠")
            
            # Add processor if available
            if product.get('processor'):
                specs_parts.append(f"Processor: {product['processor']} 🔄")
            
            # Add screen size if available
            if product.get('screenSize'):
                specs_parts.append(f"Screen: {product['screenSize']}\" 📱")
            
            # Add stock information
            if product.get('stock') is not None:
                if int(product.get('stock', 0)) > 0:
                    specs_parts.append(f"Stock: {product['stock']} 📦")
                else:
                    specs_parts.append("Out of Stock ❌")
            
            # Join all specs with bullet point separators
            specs_line = " • ".join(specs_parts)
            
            # Line 4: Features with icons
            features = []
            
            if product.get('waterResistant') == True or product.get('waterResistant') == 'Yes':
                features.append("Water Resistant 💧")
                
            if product.get('wirelessCharging') == True or product.get('wirelessCharging') == 'Yes':
                features.append("Wireless Charging 🔄")
                
            if product.get('fastCharging') == True or product.get('fastCharging') == 'Yes':
                features.append("Fast Charging ⚡")
                
            if product.get('fiveGCompatible') == True or product.get('fiveGCompatible') == 'Yes':
                features.append("5G Compatible 📶")
            
            features_line = " • ".join(features) if features else ""
            
            # Add all lines to response
            response.append(model_line)
            if rating_line:
                response.append(rating_line)
            response.append(specs_line)
            if features_line:
                response.append(features_line)
            
            # Add an empty line between products
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
            logging.error(f"Error processing product query: {str(e)}", exc_info=True)
            return f"Error processing product query: {str(e)}"
