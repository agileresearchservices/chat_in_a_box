#!/usr/bin/env python3
import sys
import json
import time
import requests
import csv
import logging
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def construct_url(city, state):
    # Verizon URL pattern for API
    state_part = state.lower().strip()
    city_part = city.lower().replace(" ", "-").strip()
    
    # Construct URL for web page (for reference)
    web_url = f"https://www.verizon.com/stores/city/{state_part}/{city_part}/"
    
    # Construct URL for API
    # We'll use the direct API endpoint that the website is using to get store data
    api_url = f"https://www.verizon.com/stores-services/endpoints/v1/locations?city={city_part}&state={state_part}&stateCode=&zipCode=&country=us&deviceSku=&deviceType=&isResidential=&isBusinessEligible=&isFios=false&isFiosTV=false&isCellular=false&isWireless=false&appointmentFlag=&storesAvailabilityNearBy=&storeType=&isPrepay=false&isSIM=false&isUpgrade=false&isActivation=false&isAccessory=false&isSmartHome=false&isDataDevice=false&isHomePhone=false&isDeviceProtection=false&radius=50&latitude=&longitude="
    
    logger.info({"message": "Constructed API URL", "url": api_url})
    logger.info({"message": "Reference web URL", "url": web_url})
    
    return api_url, web_url

def get_store_data(city, state):
    """Fallback method using Selenium if the API call fails"""
    web_url = f"https://www.verizon.com/stores/city/{state.lower().strip()}/{city.lower().replace(' ', '-').strip()}/"
    logger.info({"message": "Using Selenium fallback method to access", "url": web_url})
    
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    # Important: Enable logging for network performance
    chrome_options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        driver.get(web_url)
        logger.info({"message": "Page loaded, waiting for dynamic content"})
        
        # Wait for page to load and potentially capture network requests
        time.sleep(5)
        
        # First, try to intercept network requests that might contain store data
        logger.info({"message": "Analyzing network requests for store data"})
        store_data = extract_from_network_requests(driver)
        if store_data:
            logger.info({"message": "Successfully extracted store data from network requests"})
            return store_data
        
        # If network approach fails, try to find store data in JSON within script tags
        logger.info({"message": "Searching for embedded JSON data in page source"})
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')
        scripts = soup.find_all('script')
        
        for script in scripts:
            script_text = script.string if script.string else ""
            
            # Look for keywords that might indicate store data
            keywords = ['storeList', 'storeName', 'storeLocation', 'locations', 'stores']
            if script_text and any(keyword in script_text for keyword in keywords):
                logger.info({"message": "Found script with potential store data"})
                try:
                    # Try to identify and extract JSON
                    start_markers = ['{', '[']
                    end_markers = ['}', ']']
                    
                    for start_marker, end_marker in zip(start_markers, end_markers):
                        start_idx = script_text.find(start_marker)
                        if start_idx >= 0:
                            # Find balanced end marker
                            depth = 0
                            end_idx = -1
                            for i in range(start_idx, len(script_text)):
                                if script_text[i] == start_marker:
                                    depth += 1
                                elif script_text[i] == end_marker:
                                    depth -= 1
                                    if depth == 0:
                                        end_idx = i + 1
                                        break
                            
                            if end_idx > start_idx:
                                json_str = script_text[start_idx:end_idx]
                                try:
                                    data = json.loads(json_str)
                                    
                                    # Check if the JSON contains store data
                                    if isinstance(data, dict):
                                        if 'locations' in data and isinstance(data['locations'], list):
                                            return extract_from_json(data['locations'])
                                        elif 'stores' in data and isinstance(data['stores'], list):
                                            return extract_from_json(data['stores'])
                                        elif 'storeList' in data and isinstance(data['storeList'], list):
                                            return extract_from_json(data['storeList'])
                                    elif isinstance(data, list) and len(data) > 0:
                                        # Check if the first item looks like a store
                                        if isinstance(data[0], dict) and any(key in data[0] for key in ['storeName', 'address', 'title']):
                                            return extract_from_json(data)
                                except json.JSONDecodeError:
                                    # Not valid JSON, continue searching
                                    pass
                except Exception as e:
                    logger.warning({
                        "message": "Error parsing script tag",
                        "errorType": e.__class__.__name__,
                        "errorMessage": str(e)
                    })
        
        # Try executing JavaScript to find store data directly
        logger.info({"message": "Attempting to execute JavaScript to find store data"})
        try:
            js_result = driver.execute_script("""
            // Look for store data in window variables
            for (let key in window) {
                try {
                    let value = window[key];
                    if (typeof value === 'object' && value !== null) {
                        if (value.stores || value.locations || value.storeList) {
                            return value;
                        }
                        // Check for arrays that might contain store objects
                        if (Array.isArray(value) && value.length > 0) {
                            let first = value[0];
                            if (first && (first.storeName || first.address || first.title)) {
                                return value;
                            }
                        }
                    }
                } catch (e) {
                    // Ignore errors from accessing certain window properties
                }
            }
            return null;
            """)
            
            if js_result:
                logger.info({"message": "Found store data via JavaScript execution"})
                if isinstance(js_result, list):
                    return extract_from_json(js_result)
                elif isinstance(js_result, dict):
                    if 'stores' in js_result and isinstance(js_result['stores'], list):
                        return extract_from_json(js_result['stores'])
                    elif 'locations' in js_result and isinstance(js_result['locations'], list):
                        return extract_from_json(js_result['locations'])
                    elif 'storeList' in js_result and isinstance(js_result['storeList'], list):
                        return extract_from_json(js_result['storeList'])
        except Exception as e:
            logger.warning({
                "message": "Error executing JavaScript",
                "errorType": e.__class__.__name__,
                "errorMessage": str(e)
            })
        
    except Exception as e:
        logger.error({
            "message": "Error in Selenium fallback method",
            "errorType": e.__class__.__name__,
            "errorMessage": str(e)
        })
    finally:
        driver.quit()
    
    return []

def extract_from_json(store_list):
    """Extract store data from JSON structure"""
    stores = []
    
    for store in store_list:
        try:
            store_info = {}
            
            # Extract store name
            store_info["Store Name"] = store.get("storeName", store.get("title", "")).strip()
            
            # Extract address
            store_info["Address"] = store.get("address", "").strip()
            
            # Extract city
            store_info["City"] = store.get("city", "").strip()
            
            # Extract state
            store_info["State"] = store.get("stateAbbr", store.get("state", "")).strip()
            
            # Extract ZIP
            store_info["ZIP Code"] = store.get("zip", "").strip()
            
            # Extract phone (format it if needed)
            phone = store.get("phone", "")
            if phone and len(phone) == 10:
                phone = f"({phone[:3]}) {phone[3:6]}-{phone[6:]}"
            store_info["Phone Number"] = phone
            
            # Extract store type
            store_type = store.get("storeType", "")
            if store_type:
                store_info["Store Type"] = store_type
            
            # Extract hours if available
            if "openingHours" in store and store["openingHours"]:
                hours = []
                days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
                for day in days:
                    if day in store["openingHours"] and store["openingHours"][day]:
                        day_name = day.capitalize()
                        hours.append(f"{day_name}: {store['openingHours'][day]}")
                
                if hours:
                    store_info["Hours"] = " | ".join(hours)
            
            stores.append(store_info)
            logger.info({
                "message": "Extracted store data", 
                "storeName": store_info['Store Name'], 
                "address": store_info['Address']
            })
            
        except Exception as e:
            logger.error({
                "message": "Error extracting store data",
                "errorType": e.__class__.__name__,
                "errorMessage": str(e)
            })
    
    return stores

def extract_from_network_requests(driver):
    """Extract store data from network requests captured by the browser"""
    try:
        # Collect all network requests
        logs = driver.get_log('performance')
        logger.info({"message": "Collected network events", "count": len(logs)})
        
        # Filter for XHR/Fetch requests
        api_calls = []
        store_data = []
        
        for log in logs:
            try:
                log_entry = json.loads(log['message'])
                
                # Check if this is a Network event
                if 'message' in log_entry and 'method' in log_entry['message'] and log_entry['message']['method'].startswith('Network.'):
                    message = log_entry['message']
                    
                    # Look for request events
                    if message['method'] == 'Network.requestWillBeSent':
                        req_url = message['params']['request']['url']
                        
                        # Identify potential API calls related to store data
                        if any(keyword in req_url.lower() for keyword in ['store', 'location', 'locator']):
                            api_calls.append({
                                'url': req_url,
                                'method': message['params']['request'].get('method', 'GET'),
                                'headers': message['params']['request'].get('headers', {}),
                                'requestId': message['params'].get('requestId', '')
                            })
                            logger.info({"message": "Found potential store API request", "url": req_url})
                    
                    # Look for response events
                    elif message['method'] == 'Network.responseReceived':
                        req_id = message['params'].get('requestId', '')
                        resp_url = message['params']['response']['url']
                        mime_type = message['params']['response'].get('mimeType', '')
                        
                        # Focus on JSON responses
                        if 'json' in mime_type and any(keyword in resp_url.lower() for keyword in ['store', 'location', 'locator']):
                            logger.info({"message": "Found JSON response with potential store data", "url": resp_url})
                            
                            # Try to get the response body
                            try:
                                response_body = driver.execute_cdp_cmd('Network.getResponseBody', {'requestId': req_id})
                                if 'body' in response_body:
                                    try:
                                        data = json.loads(response_body['body'])
                                        
                                        # Check for store data patterns
                                        if isinstance(data, dict):
                                            if 'locations' in data and isinstance(data['locations'], list):
                                                logger.info({"message": "Found stores in network response", "count": len(data['locations'])})
                                                return extract_from_json(data['locations'])
                                            elif 'stores' in data and isinstance(data['stores'], list):
                                                logger.info({"message": "Found stores in network response", "count": len(data['stores'])})
                                                return extract_from_json(data['stores'])
                                            elif 'response' in data and 'docs' in data['response']:
                                                logger.info({"message": "Found stores in network response", "count": len(data['response']['docs'])})
                                                return extract_from_json(data['response']['docs'])
                                            # Log all keys to help identify where store data might be
                                            logger.info({"message": "Response keys", "keys": list(data.keys())})
                                    except json.JSONDecodeError as e:
                                        logger.warning({
                                            "message": "Error parsing JSON response",
                                            "errorType": e.__class__.__name__,
                                            "errorMessage": str(e)
                                        })
                            except Exception as e:
                                logger.warning({
                                    "message": "Error getting response body",
                                    "errorType": e.__class__.__name__,
                                    "errorMessage": str(e)
                                })
            except Exception as e:
                # Individual log processing errors shouldn't stop the entire process
                pass
                
        # If we found API calls but couldn't extract directly, retry with requests
        if api_calls and not store_data:
            logger.info({"message": "Trying to directly fetch data from potential API endpoints", "count": len(api_calls)})
            
            for api_call in api_calls:
                try:
                    # Use the headers from the browser request
                    headers = api_call['headers'].copy()
                    # Add some important headers if missing
                    if 'User-Agent' not in headers:
                        headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    if 'Referer' not in headers:
                        headers['Referer'] = driver.current_url
                    
                    logger.info({"message": "Requesting API endpoint", "url": api_call['url']})
                    response = requests.get(api_call['url'], headers=headers)
                    
                    if response.status_code == 200:
                        try:
                            data = response.json()
                            
                            # Check for store data patterns
                            if isinstance(data, dict):
                                if 'locations' in data and isinstance(data['locations'], list):
                                    logger.info({"message": "Found stores in API response", "count": len(data['locations'])})
                                    return extract_from_json(data['locations'])
                                elif 'stores' in data and isinstance(data['stores'], list):
                                    logger.info({"message": "Found stores in API response", "count": len(data['stores'])})
                                    return extract_from_json(data['stores'])
                                elif 'response' in data and 'docs' in data['response']:
                                    logger.info({"message": "Found stores in API response", "count": len(data['response']['docs'])})
                                    return extract_from_json(data['response']['docs'])
                                
                                # Look for any array of objects that looks like store data
                                for key, value in data.items():
                                    if isinstance(value, list) and len(value) > 0 and isinstance(value[0], dict):
                                        first_item = value[0]
                                        if any(store_key in first_item for store_key in ['storeName', 'address', 'title', 'city', 'storeType']):
                                            logger.info({
                                                "message": "Found potential store array", 
                                                "key": key, 
                                                "count": len(value)
                                            })
                                            return extract_from_json(value)
                        except json.JSONDecodeError as e:
                            logger.warning({
                                "message": "Error parsing response as JSON",
                                "errorType": e.__class__.__name__,
                                "errorMessage": str(e)
                            })
                except Exception as e:
                    logger.warning({
                        "message": "Error fetching API", 
                        "errorType": e.__class__.__name__,
                        "errorMessage": str(e)
                    })
                
        return store_data
    
    except Exception as e:
        logger.error({
            "message": "Error extracting from network requests", 
            "errorType": e.__class__.__name__,
            "errorMessage": str(e)
        })
        return []

def print_csv(stores):
    # Print CSV header
    fields = ["Store Name", "Address", "City", "State", "ZIP Code", "Phone Number", "Store Type", "Hours"]
    print(",".join(f'"{field}"' for field in fields))
    
    for store in stores:
        row = []
        for field in fields:
            row.append(f'"{store.get(field, "")}"')
        print(",".join(row))

def main():
    if len(sys.argv) != 3:
        print("Usage: python vz_store_locator.py <City> <State>")
        sys.exit(1)
        
    city = sys.argv[1]
    state = sys.argv[2]
    logger.info({"message": "Looking for Verizon stores", "city": city, "state": state})
    
    stores = get_store_data(city, state)
    
    if not stores:
        logger.warning({"message": "No stores found", "city": city, "state": state})
    else:
        logger.info({"message": "Found stores", "count": len(stores), "city": city, "state": state})
    
    print_csv(stores)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error({
            "message": "Unhandled exception",
            "errorType": e.__class__.__name__,
            "errorMessage": str(e)
        })
        sys.exit(1)