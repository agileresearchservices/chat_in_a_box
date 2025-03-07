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
    api_url = f"https://www.verizon.com/stores-services/endpoints/v1/locations-new?locality={city_part}&region={state_part}&country=US"
    
    logger.info(f"Constructed API URL: {api_url}")
    logger.info(f"Reference web URL: {web_url}")
    
    return api_url

def get_store_data(city, state):
    api_url = construct_url(city, state)
    
    # Try direct API call first (most efficient)
    try:
        logger.info(f"Attempting direct API call to: {api_url}")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': f'https://www.verizon.com/stores/city/{state.lower()}/{city.lower().replace(" ", "-")}/'
        }
        
        response = requests.get(api_url, headers=headers)
        
        if response.status_code == 200:
            try:
                data = response.json()
                logger.info(f"Successfully retrieved data from API. Status code: {response.status_code}")
                
                # Check if we have store data
                if 'locations' in data and isinstance(data['locations'], list):
                    logger.info(f"Found {len(data['locations'])} store locations")
                    return extract_from_json(data['locations'])
                elif 'stores' in data and isinstance(data['stores'], list):
                    logger.info(f"Found {len(data['stores'])} store locations")
                    return extract_from_json(data['stores'])
                else:
                    logger.warning("API returned data but no store locations were found")
                    # Debug what we received
                    logger.info(f"API response keys: {list(data.keys())}")
            except Exception as e:
                logger.error(f"Error parsing API response: {str(e)}")
        else:
            logger.warning(f"API request failed with status code: {response.status_code}")
    
    except Exception as e:
        logger.error(f"Error making API request: {str(e)}")
    
    # Fallback to browser automation approach if API call fails
    logger.info("Falling back to browser automation approach")
    return fallback_browser_method(city, state)

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
            logger.info(f"Extracted store: {store_info['Store Name']} at {store_info['Address']}")
            
        except Exception as e:
            logger.error(f"Error extracting store data: {str(e)}")
    
    return stores

def fallback_browser_method(city, state):
    """Fallback method using Selenium if the API call fails"""
    web_url = f"https://www.verizon.com/stores/city/{state.lower().strip()}/{city.lower().replace(' ', '-').strip()}/"
    logger.info(f"Using Selenium fallback method to access: {web_url}")
    
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        driver.get(web_url)
        logger.info("Page loaded, waiting for dynamic content...")
        
        # Wait for page to load and potentially capture network requests
        time.sleep(5)
        
        # Try to find store data in JSON within script tags
        logger.info("Searching for embedded JSON data in page source")
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')
        scripts = soup.find_all('script')
        
        for script in scripts:
            script_text = script.string if script.string else ""
            
            # Look for keywords that might indicate store data
            keywords = ['storeList', 'storeName', 'storeLocation', 'locations', 'stores']
            if script_text and any(keyword in script_text for keyword in keywords):
                logger.info("Found script with potential store data")
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
                    logger.warning(f"Error parsing script tag: {str(e)}")
        
        # Try executing JavaScript to find store data directly
        logger.info("Attempting to execute JavaScript to find store data")
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
                logger.info("Found store data via JavaScript execution")
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
            logger.warning(f"Error executing JavaScript: {str(e)}")
        
        # Last attempt: try to intercept network requests for store data
        logger.info("Attempting to intercept network requests")
        try:
            # Get network requests
            performance_logs = driver.get_log('performance')
            for log in performance_logs:
                if 'message' in log:
                    try:
                        log_dict = json.loads(log['message'])
                        if 'message' in log_dict and 'params' in log_dict['message']:
                            params = log_dict['message']['params']
                            if 'request' in params and 'url' in params['request']:
                                url = params['request']['url']
                                if any(keyword in url for keyword in ['store', 'location', 'stores-services']):
                                    logger.info(f"Found potential API URL: {url}")
                                    # Try to make a direct request to this URL
                                    headers = {
                                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                        'Accept': 'application/json',
                                        'Referer': web_url
                                    }
                                    resp = requests.get(url, headers=headers)
                                    if resp.status_code == 200:
                                        try:
                                            api_data = resp.json()
                                            if 'locations' in api_data and isinstance(api_data['locations'], list):
                                                return extract_from_json(api_data['locations'])
                                            elif 'stores' in api_data and isinstance(api_data['stores'], list):
                                                return extract_from_json(api_data['stores'])
                                        except:
                                            pass
                    except:
                        pass
        except Exception as e:
            logger.warning(f"Error intercepting network requests: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error in Selenium fallback method: {str(e)}")
    finally:
        driver.quit()
    
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
    logger.info(f"Looking for Verizon stores in {city}, {state}")
    
    stores = get_store_data(city, state)
    
    if not stores:
        logger.warning(f"No stores found in {city}, {state}")
    else:
        logger.info(f"Found {len(stores)} stores in {city}, {state}")
    
    print_csv(stores)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Unhandled exception: {str(e)}")
        sys.exit(1)