import requests
import json
import csv
import os

# EIA API key
api_key = "f64jBIO7U3H6N2Txi8QnWQg80X6w1WYm31kLwMsb"

# API endpoint for residential electricity prices
url = f"https://api.eia.gov/v2/electricity/retail-sales/data?api_key={api_key}&data[]=price&facets[sectorid][]=RES&frequency=annual&start=2023&end=2023&sort[0][column]=stateid&sort[0][direction]=asc&length=100"

try:
    # Make the API request
    response = requests.get(url)
    response.raise_for_status()  # Raise an exception for HTTP errors
    
    # Parse the JSON response
    data = response.json()
    
    # Check if the response contains data
    if 'response' in data and 'data' in data['response']:
        # Create data directory if it doesn't exist
        os.makedirs('data', exist_ok=True)
        
        # Open a CSV file for writing
        with open('data/electricity_prices.csv', 'w', newline='') as csvfile:
            # Create a CSV writer
            writer = csv.writer(csvfile)
            
            # Write header
            writer.writerow(['State', 'StateID', 'Period', 'Price (cents/kWh)'])
            
            # Filter for just the 50 states + DC (skip regions like 'NEW' for New England)
            state_data = []
            for item in data['response']['data']:
                if 'stateid' in item and 'stateDescription' in item and 'period' in item and 'price' in item:
                    state_id = item['stateid']
                    # Include only state codes (2 letters) and DC
                    if (len(state_id) == 2 and state_id != 'US') or state_id == 'DC':
                        state_data.append([
                            item['stateDescription'],
                            item['stateid'],
                            item['period'],
                            item['price']
                        ])
            
            # Sort by price (highest to lowest) before writing
            state_data.sort(key=lambda x: float(x[3]), reverse=True)
            
            # Write the sorted data
            for row in state_data:
                writer.writerow(row)
            
            # Add the U.S. average at the bottom for reference
            for item in data['response']['data']:
                if item.get('stateid') == 'US':
                    writer.writerow([
                        "U.S. Average",
                        'US',
                        item['period'],
                        item['price']
                    ])
                    break
        
        print(f"Electricity prices saved to data/electricity_prices.csv")
        print(f"Found data for {len(state_data)} states/territories")
    else:
        print("No data found in API response")
        print(json.dumps(data, indent=2))
        
except requests.exceptions.RequestException as e:
    print(f"API request failed: {e}")
except Exception as e:
    print(f"Error: {e}") 