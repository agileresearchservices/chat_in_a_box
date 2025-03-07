#!/usr/bin/env python3
import sys
import json
import time
import requests
import csv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup

def construct_url(city, state):
    state_part = state.lower().strip()
    city_part = city.lower().replace(" ", "-").strip()
    web_url = f"https://www.verizon.com/stores/city/{state_part}/{city_part}/"
    api_url = f"https://www.verizon.com/stores-services/endpoints/v1/locations?city={city_part}&state={state_part}&country=us&radius=50"
    return api_url, web_url

def get_store_data(city, state):
    web_url = f"https://www.verizon.com/stores/city/{state.lower().strip()}/{city.lower().replace(' ', '-').strip()}/"
    
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    chrome_options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        driver.get(web_url)
        time.sleep(5)
        store_data = extract_from_network_requests(driver)
        if store_data:
            return store_data
        
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')
        scripts = soup.find_all('script')
        
        for script in scripts:
            script_text = script.string if script.string else ""
            keywords = ['storeList', 'storeName', 'storeLocation', 'locations', 'stores']
            if script_text and any(keyword in script_text for keyword in keywords):
                try:
                    start_markers = ['{', '[']
                    end_markers = ['}', ']']
                    
                    for start_marker, end_marker in zip(start_markers, end_markers):
                        start_idx = script_text.find(start_marker)
                        if start_idx >= 0:
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
                                    if isinstance(data, dict):
                                        if 'locations' in data and isinstance(data['locations'], list):
                                            return extract_from_json(data['locations'])
                                        elif 'stores' in data and isinstance(data['stores'], list):
                                            return extract_from_json(data['stores'])
                                        elif 'storeList' in data and isinstance(data['storeList'], list):
                                            return extract_from_json(data['storeList'])
                                    elif isinstance(data, list) and len(data) > 0:
                                        if isinstance(data[0], dict) and any(key in data[0] for key in ['storeName', 'address', 'title']):
                                            return extract_from_json(data)
                                except json.JSONDecodeError:
                                    pass
                except Exception:
                    pass
        
        try:
            js_result = driver.execute_script("""
            for (let key in window) {
                try {
                    let value = window[key];
                    if (typeof value === 'object' && value !== null) {
                        if (value.stores || value.locations || value.storeList) {
                            return value;
                        }
                        if (Array.isArray(value) && value.length > 0) {
                            let first = value[0];
                            if (first && (first.storeName || first.address || first.title)) {
                                return value;
                            }
                        }
                    }
                } catch (e) {}
            }
            return null;
            """)
            
            if js_result:
                if isinstance(js_result, list):
                    return extract_from_json(js_result)
                elif isinstance(js_result, dict):
                    if 'stores' in js_result and isinstance(js_result['stores'], list):
                        return extract_from_json(js_result['stores'])
                    elif 'locations' in js_result and isinstance(js_result['locations'], list):
                        return extract_from_json(js_result['locations'])
                    elif 'storeList' in js_result and isinstance(js_result['storeList'], list):
                        return extract_from_json(js_result['storeList'])
        except Exception:
            pass
        
    except Exception:
        pass
    finally:
        driver.quit()
    
    return []

def extract_from_json(store_list):
    stores = []
    
    for store in store_list:
        try:
            store_info = {}
            store_info["Store Name"] = store.get("storeName", store.get("title", "")).strip()
            store_info["Address"] = store.get("address", "").strip()
            store_info["City"] = store.get("city", "").strip()
            store_info["State"] = store.get("stateAbbr", store.get("state", "")).strip()
            store_info["ZIP Code"] = store.get("zip", "").strip()
            phone = store.get("phone", "")
            if phone and len(phone) == 10:
                phone = f"({phone[:3]}) {phone[3:6]}-{phone[6:]}"
            store_info["Phone Number"] = phone
            store_type = store.get("storeType", "")
            if store_type:
                store_info["Store Type"] = store_type
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
        except Exception:
            pass
    
    return stores

def extract_from_network_requests(driver):
    try:
        logs = driver.get_log('performance')
        
        api_calls = []
        store_data = []
        
        for log in logs:
            try:
                log_entry = json.loads(log['message'])
                if 'message' in log_entry and 'method' in log_entry['message'] and log_entry['message']['method'].startswith('Network.'):
                    message = log_entry['message']
                    if message['method'] == 'Network.requestWillBeSent':
                        req_url = message['params']['request']['url']
                        if any(keyword in req_url.lower() for keyword in ['store', 'location', 'locator']):
                            api_calls.append({
                                'url': req_url,
                                'method': message['params']['request'].get('method', 'GET'),
                                'headers': message['params']['request'].get('headers', {}),
                                'requestId': message['params'].get('requestId', '')
                            })
                    elif message['method'] == 'Network.responseReceived':
                        req_id = message['params'].get('requestId', '')
                        resp_url = message['params']['response']['url']
                        mime_type = message['params']['response'].get('mimeType', '')
                        if 'json' in mime_type and any(keyword in resp_url.lower() for keyword in ['store', 'location', 'locator']):
                            try:
                                response_body = driver.execute_cdp_cmd('Network.getResponseBody', {'requestId': req_id})
                                if 'body' in response_body:
                                    try:
                                        data = json.loads(response_body['body'])
                                        if isinstance(data, dict):
                                            if 'locations' in data and isinstance(data['locations'], list):
                                                return extract_from_json(data['locations'])
                                            elif 'stores' in data and isinstance(data['stores'], list):
                                                return extract_from_json(data['stores'])
                                            elif 'response' in data and 'docs' in data['response']:
                                                return extract_from_json(data['response']['docs'])
                                    except json.JSONDecodeError:
                                        pass
                            except Exception:
                                pass
            except Exception:
                pass
                
        if api_calls and not store_data:
            for api_call in api_calls:
                try:
                    headers = api_call['headers'].copy()
                    if 'User-Agent' not in headers:
                        headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    if 'Referer' not in headers:
                        headers['Referer'] = driver.current_url
                    
                    response = requests.get(api_call['url'], headers=headers)
                    
                    if response.status_code == 200:
                        try:
                            data = response.json()
                            if isinstance(data, dict):
                                if 'locations' in data and isinstance(data['locations'], list):
                                    return extract_from_json(data['locations'])
                                elif 'stores' in data and isinstance(data['stores'], list):
                                    return extract_from_json(data['stores'])
                                elif 'response' in data and 'docs' in data['response']:
                                    return extract_from_json(data['response']['docs'])
                                for key, value in data.items():
                                    if isinstance(value, list) and len(value) > 0 and isinstance(value[0], dict):
                                        first_item = value[0]
                                        if any(store_key in first_item for store_key in ['storeName', 'address', 'title', 'city', 'storeType']):
                                            return extract_from_json(value)
                        except json.JSONDecodeError:
                            pass
                except Exception:
                    pass
                
        return store_data
    
    except Exception:
        return []

def print_csv(stores):
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
    
    stores = get_store_data(city, state)
    
    if not stores:
        print("No stores found")
    else:
        print(f"Found {len(stores)} stores")
    
    print_csv(stores)

if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(1)