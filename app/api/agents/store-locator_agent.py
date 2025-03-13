from pydantic_ai import Agent
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
import httpx
import json
import os
import re
import logging
import sys

# Configure logging to write to a file
logging.basicConfig(filename='logs/app.log', level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

class StoreQueryInput(BaseModel):
    """Model for store location query input."""
    query: str = Field(..., description="The user's store location query")
    
class StoreQueryOutput(BaseModel):
    """Model for store location query output."""
    response: str = Field(..., description="The formatted store location response")
    
class StoreFilterParams(BaseModel):
    """Model for store filter parameters extracted from the query."""
    query: str = Field("", description="Search terms")
    size: int = Field(5, description="Number of results to return")
    page: int = Field(1, description="Page number")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Filter parameters")

class Store(BaseModel):
    """Model for store data."""
    storeName: str
    storeNumber: str
    address: str
    city: str
    state: str
    zipCode: str
    phoneNumber: str

class StoreLocatorAgent(Agent):
    """
    PydanticAI agent for handling store location search queries using the OpenSearch stores index.
    
    Integrates with:
    - Store Service (/app/services/store.service.ts)
    - Store API Route (/app/api/stores/route.ts)
    
    Features:
    - Natural language query parsing
    - City extraction
    - State extraction
    - ZIP code extraction
    - Error handling and logging
    """
    
    def __init__(self):
        super().__init__()
        # Register the process method as a tool
        self.tools = [self.process]
        
        # More flexible city patterns that handle various cases
        self.city_patterns = [
            r'(?:in|at|near)\s+([A-Za-z0-9\s]+)(?:,|\s+(?:[A-Za-z]{2}|[A-Za-z]+)|\s*$)',
            r'(?:store|stores|location|locations)\s+(?:in|at|near)\s+([A-Za-z0-9\s]+)(?:,|\s+(?:[A-Za-z]{2}|[A-Za-z]+)|\s*$)',
            r'\b([A-Za-z0-9\s]+)\b'
        ]
        
        # More flexible state patterns (both abbreviations and full names)
        self.state_patterns = [
            r'(?:in|at|near)\s+(?:[A-Za-z0-9\s]+,\s+)?([A-Za-z]{2})(?:\s+\d{5}|\s*$)',
            r'(?:in|at|near)\s+(?:[A-Za-z0-9\s]+,\s+)?(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\s+Hampshire|New\s+Jersey|New\s+Mexico|New\s+York|North\s+Carolina|North\s+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\s+Island|South\s+Carolina|South\s+Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\s+Virginia|Wisconsin|Wyoming)(?:\s+\d{5}|\s*$)',
            r'\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b'
        ]
        
        # State abbreviations lookup table
        self.state_abbrevs = {
            'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
            'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
            'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
            'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
            'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
            'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
            'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
            'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
            'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
            'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
        }

    def extract_search_params(self, query: str, keep_original_query: bool = False) -> StoreFilterParams:
        """
        Extract search parameters from a natural language query
        
        Args:
            query: Natural language query from the user
            keep_original_query: Whether to keep the original query in the search parameters
            
        Returns:
            Dictionary of extracted search parameters:
            - query: Search query
            - size: Number of results
            - page: Page number
            - city: City name
            - state: State (2-letter code)
            - zipCode: ZIP code
        """
        # Special handling for queries that contain "ZIP code" followed by a ZIP
        # This is to avoid interpreting "ZIP code" as a city name
        if "ZIP code" in query or "zip code" in query:
            logging.debug("Detected 'ZIP code' phrase in query, using special handling")
            # Extract ZIP directly with a specific pattern
            zip_match = re.search(r'(?:zip|ZIP) code\s+(\d{5})', query, re.IGNORECASE)
            if zip_match:
                zipcode = zip_match.group(1)
                logging.debug(f"Extracted ZIP code {zipcode} from 'ZIP code' phrase")
                
                # Create search parameters with just the ZIP code
                search_params = StoreFilterParams(
                    query='',
                    size=5,
                    page=1,
                    filters={
                        'zipCode': zipcode
                    }
                )
                return search_params
        
        # Start with base query structure
        search_params = StoreFilterParams(
            query='',
            size=5,
            page=1,
            filters={}
        )
        
        # Clean query: remove action verbs like "find" and keep store terms
        clean_query = re.sub(r'^(find|show|get|search for|looking for|give me|i want|i need)\s+', '', query.lower())
        search_params.query = clean_query
        
        # State abbreviations list for reference
        state_abbrevs_list = [
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 
            'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 
            'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 
            'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
        ]
        
        # Extract ZIP code FIRST using simpler, more reliable pattern
        zipcode = None
        # Look for any 5-digit number in the query, which is most likely a ZIP code
        zip_match = re.search(r'\b(\d{5})\b', query)
        if zip_match:
            zipcode = zip_match.group(1)
            logging.debug(f'Extracted ZIP code: {zipcode}')
            # Create a modified query where we remove the ZIP code before extracting city
            # This prevents treating the ZIP as a city name
            query_without_zip = re.sub(r'\b' + re.escape(zipcode) + r'\b', '', query)
            logging.debug(f'Modified query without ZIP: {query_without_zip}')
        else:
            query_without_zip = query
        
        # THEN extract state (to avoid matching state names as cities)
        state = None
        state_abbrevs_list = list(self.state_abbrevs.values())
        
        # Check for state abbreviations or full names using more precise patterns
        # that won't incorrectly match prepositions like "in" as "IN" (Indiana)
        for pattern in self.state_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                potential_state = match.group(1).strip().upper()
                
                # Additional validation to prevent common false positives
                # such as mistaking "in" for "IN" (Indiana)
                if potential_state == "IN":
                    # Check if "in" is being used as a preposition rather than state code
                    # by ensuring it's not preceded by prepositions or store-related words
                    in_as_preposition = re.search(r'\b(find|show|stores?|locate|get|where|are)\s+\bin\b', 
                                                 query, re.IGNORECASE)
                    if in_as_preposition:
                        logging.debug(f"Skipping potential state 'IN' as it appears to be a preposition")
                        continue
                
                # Validate that it's a real state abbreviation or name
                if potential_state in state_abbrevs_list:
                    # For two-letter codes, ensure they're not just part of words
                    if len(potential_state) == 2:
                        # Make sure it's a standalone state code with word boundaries
                        standalone = re.search(r'\b' + re.escape(potential_state) + r'\b', 
                                              query, re.IGNORECASE)
                        if not standalone:
                            logging.debug(f"Skipping potential state {potential_state} as it's part of another word")
                            continue
                    
                    state = potential_state
                    logging.debug(f"Found state abbreviation: {state}")
                    break
                elif potential_state in self.state_abbrevs:
                    state = self.state_abbrevs[potential_state]
                    logging.debug(f"Found state name: {potential_state}, abbreviation: {state}")
                    break
        
        # THEN extract city - but don't consider state abbreviations or ZIP codes as cities
        city = None
        state_abbrevs_list_set = set(state_abbrevs_list)
        query_for_city = query_without_zip  # Use the version without ZIP code
        
        if not (len(query_for_city.strip()) == 2 and query_for_city.strip().upper() in state_abbrevs_list_set):  # Skip if query is just a state code
            # First try patterns with clear context (in/at/near)
            for pattern in self.city_patterns[0:2]:  # First try patterns with context
                match = re.search(pattern, query_for_city, re.IGNORECASE)
                if match:
                    potential_city = match.group(1).strip()
                    # Clean up the city name - remove trailing state or zip code if present
                    if ',' in potential_city:
                        potential_city = potential_city.split(',')[0].strip()
                    
                    # Further clean by removing trailing digits (ZIP codes)
                    potential_city = re.sub(r'\s+\d+$', '', potential_city)
                    
                    # Validate the potential city:
                    # 1. Not empty
                    # 2. Not a state abbreviation
                    # 3. Not the same as the state
                    # 4. Not the same as the ZIP code we extracted
                    if (potential_city and 
                            potential_city.upper() not in state_abbrevs_list_set and
                            (not state or potential_city.upper() != state) and
                            (not zipcode or potential_city != zipcode)):
                        city = potential_city
                        logging.debug(f"Found city with context: {city}")
                        break
            
            # If we still don't have a city, look for compound city names with prefixes
            # like "Port", "South", "East", "North", "West", "New", etc.
            if not city:
                # Common prefixes in city names
                city_prefixes = ["Port", "South", "North", "East", "West", "New", "Fort", "Mount", "San", "Santa", "Saint", "Lake"]
                for prefix in city_prefixes:
                    prefix_pattern = rf'\b{prefix}\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b'
                    match = re.search(prefix_pattern, query_for_city, re.IGNORECASE)
                    if match:
                        # Extract the full city name including the prefix
                        start_idx = match.start()
                        end_idx = match.end()
                        potential_city = query_for_city[start_idx:end_idx].strip()
                        
                        # Additional validation to ensure we don't pick up false positives
                        if (potential_city and 
                                potential_city.upper() not in state_abbrevs_list_set and
                                (not state or potential_city.upper() != state)):
                            city = potential_city
                            logging.debug(f"Found compound city with prefix: {city}")
                            break
            
            # If we still haven't found a city, check for city names that end with suffixes
            # like "ville", "town", "burg", "port", "ford", "bury", etc.
            if not city:
                city_suffix_pattern = r'\b([A-Za-z]+(?:ville|town|burg|port|ford|bury|mouth|fort|field|dale|wood|land))\b'
                match = re.search(city_suffix_pattern, query_for_city, re.IGNORECASE)
                if match:
                    potential_city = match.group(1).strip()
                    if (potential_city and 
                            potential_city.upper() not in state_abbrevs_list_set and
                            (not state or potential_city.upper() != state)):
                        city = potential_city
                        logging.debug(f"Found city with common suffix: {city}")
        
        # Add extracted parameters to the filters object
        # The Store API expects filters in a nested structure
        if zipcode:
            search_params.filters['zipCode'] = zipcode
        if city:
            search_params.filters['city'] = city
        if state:
            search_params.filters['state'] = state
        
        # Add original query for improved relevance if needed
        if query and not city and not state and not zipcode:
            search_params.query = query
        
        logging.debug(f'Final search parameters: {search_params}')
        return search_params

    def format_store_results(self, stores: List[Store], total: int, params: StoreFilterParams) -> str:
        """Format store results into a natural language response."""
        logging.debug(f'Formatting results for {total} stores with params: {params}')
        
        # Create a response list
        response = []
        
        if not stores or len(stores) == 0:
            # Improved no results message with more details about what was searched
            constraints = []
            
            if params.filters.get('city'):
                city = params.filters['city']
                constraints.append(f"in {city}")
                logging.debug(f"No results for city: {city}")
            
            if params.filters.get('state'):
                state = params.filters['state']
                constraints.append(f"in {state}")
                logging.debug(f"No results for state: {state}")
                
            if params.filters.get('zipCode'):
                zip_code = params.filters['zipCode']
                constraints.append(f"near ZIP code {zip_code}")
                logging.debug(f"No results for ZIP: {zip_code}")
            
            # Join constraints for a natural language response
            constraints_str = " ".join(constraints) if constraints else "matching your criteria"
            return f"I couldn't find any stores {constraints_str}. Please try a different location or check your spelling."
        
        # Get city from filters
        city = None
        if params.filters.get('city'):
            city = params.filters['city']
            
        # Get state from filters
        state = None
        if params.filters.get('state'):
            state = params.filters['state']
            
        # Get ZIP from filters
        zip_code = None
        if params.filters.get('zipCode'):
            zip_code = params.filters['zipCode']
        
        # Build location parts for the header
        if city and state:
            location_part = f"in {city}, {state}"
        elif city:
            location_part = f"in {city}"
        elif state:
            location_part = f"in {state}"
        elif zip_code:
            location_part = f"near ZIP code {zip_code}"
        else:
            location_part = ""
            
        # Add header with count
        response.append(f"I found {len(stores)} store{'s' if len(stores) != 1 else ''} {location_part}:")
        
        for i, store in enumerate(stores):
            # Line 1: Store name and store number with emoji
            store_line = f"\n🏪 {store.storeName} (Store #{store.storeNumber})"
            
            # Line 2: Address info
            address_line = f"📍 {store.address}, {store.city}, {store.state} {store.zipCode}"
            
            # Line 3: Phone info
            phone_line = f"📞 {store.phoneNumber}"
            
            # Add all lines to response
            response.append(store_line)
            response.append(address_line)
            response.append(phone_line)
        
        # Add a note about more stores if applicable
        if total > len(stores):
            response.append(f"\n(Showing {len(stores)} of {total} total stores)")
        
        return "\n".join(response)
    
    async def process(self, query_input, parameters: Optional[Dict[str, Any]] = None) -> StoreQueryOutput:
        """
        Process a store location query using the OpenSearch stores index.
        
        Args:
            query_input: The user's store location query (either string or StoreQueryInput)
            parameters: Additional parameters including base URL
            
        Returns:
            Formatted store response in StoreQueryOutput model
        """
        try:
            # Handle both string input and StoreQueryInput for backward compatibility
            query = query_input.query if isinstance(query_input, StoreQueryInput) else query_input
            
            logging.debug(f'Processing store query: {query}')
            
            # Extract search parameters from the query string
            extracted_params = self.extract_search_params(query)
            logging.debug(f'Sending search parameters to API: {extracted_params}')
            
            # Call the API
            logging.debug(f"Calling store API with params: {json.dumps(extracted_params.dict())}")
            
            # Use the dedicated find_stores method to make the API call
            response = await self.find_stores(extracted_params)
            
            # Process the API response
            if response.get('success'):
                try:
                    data = response.get('data', {})
                    logging.debug(f"API response data: {data}")
                    
                    # Check if the data matches the expected structure
                    if 'data' in data and 'stores' in data['data']:
                        stores = [Store(**store) for store in data['data']['stores']]
                        total = data['data'].get('total', 0)
                        
                        # Special log for ZIP code 81775
                        if 'filters' in extracted_params.dict() and 'zipCode' in extracted_params.dict()['filters'] and extracted_params.dict()['filters']['zipCode'] == '81775':
                            logging.warning(f"ZIP 81775 - Found {total} stores in response")
                            logging.warning(f"ZIP 81775 - First store data: {stores[0].dict() if stores else 'No stores found'}")
                        
                        if stores and len(stores) > 0:
                            logging.debug(f"Found {len(stores)} stores, formatting results")
                            formatted_response = self.format_store_results(stores, total, extracted_params)
                            return StoreQueryOutput(response=formatted_response) if isinstance(query_input, StoreQueryInput) else formatted_response
                        else:
                            logging.warning(f"No stores found in API response for params: {extracted_params}")
                            result = f"I couldn't find any stores matching your criteria. Please try a different location or check your spelling."
                            return StoreQueryOutput(response=result) if isinstance(query_input, StoreQueryInput) else result
                    else:
                        logging.error(f"Unexpected API response structure: {data}")
                        result = f"I couldn't find any stores matching your criteria. Please try a different location or check your spelling."
                        return StoreQueryOutput(response=result) if isinstance(query_input, StoreQueryInput) else result
                except Exception as e:
                    logging.error(f"Error processing API response: {str(e)}", exc_info=True)
                    result = f"Error processing store response: {str(e)}"
                    return StoreQueryOutput(response=result) if isinstance(query_input, StoreQueryInput) else result
            else:
                logging.error(f"API error: {response.get('error', 'Unknown error')}")
                result = f"Error searching for stores: {response.get('error', 'Unknown error')}"
                return StoreQueryOutput(response=result) if isinstance(query_input, StoreQueryInput) else result
                    
        except Exception as e:
            logging.error(f"Error processing store query: {str(e)}", exc_info=True)
            result = f"Error processing store location query: {str(e)}"
            return StoreQueryOutput(response=result) if isinstance(query_input, StoreQueryInput) else result

    async def find_stores(self, search_params: StoreFilterParams) -> Dict[str, Any]:
        """
        Call the store API with the given search parameters
        
        Args:
            search_params: Search parameters for the store API
            
        Returns:
            API response
        """
        try:
            # Log API call parameters for debugging
            if 'filters' in search_params.dict() and 'zipCode' in search_params.dict()['filters'] and search_params.dict()['filters']['zipCode'] == '81775':
                logging.warning(f"Making API call for ZIP 81775 with params: {json.dumps(search_params.dict())}")
            
            # Create a copy of the search params to avoid modifying the original
            params = {k: v for k, v in search_params.dict().items()}
            
            # Get API URL from parameters or use default
            base_url = os.environ.get('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3000')
            api_url = f"{base_url}/api/stores"
            
            # Create request with params as JSON in the body
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            
            # Call API
            logging.debug(f"API call to: {api_url}")
            logging.debug(f"Request params: {params}")
            
            # Send the HTTP request
            async with httpx.AsyncClient() as session:
                response = await session.post(api_url, json=params, headers=headers)
                logging.debug(f"API response: {response.text[:200]}")
                
                # Handle response
                if response.status_code == 200:
                    data = response.json()
                    return {
                        'success': True,
                        'data': data
                    }
                else:
                    error_msg = f"API error (status {response.status_code}): {response.text}"
                    logging.error(error_msg)
                    return {
                        'success': False,
                        'error': error_msg
                    }
        except Exception as e:
            error_msg = f"Exception in find_stores: {str(e)}"
            logging.exception(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
