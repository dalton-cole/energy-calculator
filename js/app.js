// Climate Zones Interactive Map Application

// Global variables
let map;                // Leaflet map object
let geoJsonLayer = null; // GeoJSON layer for the counties
let countyData;         // GeoJSON data for all counties
let electricityPriceData = {}; // Electricity price data by state
window.currentClassification = 'iecc'; // Either 'iecc' or 'ba'
let currentVisualization = 'climate'; // Either 'climate' or 'electricity'
let currentFilters = {   // Current filter selections
    zone: 'all',
    state: 'all'
};

// Store reference to the currently selected county
let selectedCountyLayer = null;

// Electricity price visualization colors
const electricityPriceColors = [
    { max: 12, color: '#118ab2' },  // Low: < 12¢/kWh - Blue
    { max: 16, color: '#06d6a0' },  // Average: 12-16¢/kWh - Green
    { max: 25, color: '#ffd166' },  // High: 16-25¢/kWh - Yellow
    { max: 100, color: '#ef476f' }  // Very High: > 25¢/kWh - Red
];

// IECC Climate Zone information
const ieecZoneInfo = {
    zones: [],  // Will be populated from GeoJSON data
    colors: {
        '0A': '#000000',   // Black
        '0B': '#222222',   // Dark Gray
        '1A': '#e6194B',   // Bright Red
        '1B': '#960018',   // Dark Red
        '2A': '#f58231',   // Orange
        '2B': '#b85c00',   // Brown-Orange
        '3A': '#ffe119',   // Bright Yellow
        '3B': '#bca700',   // Gold
        '3C': '#a0a226',   // Olive-Yellow
        '4A': '#3cb44b',   // Bright Green
        '4B': '#007500',   // Dark Green
        '4C': '#00876c',   // Teal-Green
        '5A': '#4363d8',   // Blue
        '5B': '#002cb1',   // Navy Blue
        '5C': '#000075',   // Deep Blue
        '6A': '#911eb4',   // Purple
        '6B': '#6f0087',   // Dark Purple
        '7': '#444e86',    // Blue-Purple
        '8': '#303060'     // Deep Blue-Purple
    },
    descriptions: {
        '0A': 'Extremely Hot - Humid',
        '0B': 'Extremely Hot - Dry',
        '1A': 'Very Hot - Humid',
        '1B': 'Very Hot - Dry',
        '2A': 'Hot - Humid',
        '2B': 'Hot - Dry',
        '3A': 'Warm - Humid',
        '3B': 'Warm - Dry',
        '3C': 'Warm - Marine',
        '4A': 'Mixed - Humid',
        '4B': 'Mixed - Dry',
        '4C': 'Mixed - Marine',
        '5A': 'Cool - Humid',
        '5B': 'Cool - Dry',
        '5C': 'Cool - Marine',
        '6A': 'Cold - Humid',
        '6B': 'Cold - Dry',
        '7': 'Very Cold',
        '8': 'Subarctic'
    }
};

// Build America Climate Zone information
const baZoneInfo = {
    zones: [],  // Will be populated from GeoJSON data
    colors: {
        'Hot-Humid': '#e6194B',    // Bright Red
        'Hot-Dry': '#f58231',      // Orange
        'Mixed-Humid': '#ffe119',  // Bright Yellow
        'Mixed-Dry': '#bca700',    // Gold
        'Cold': '#4363d8',         // Blue
        'Very Cold': '#911eb4',    // Purple
        'Subarctic': '#303060',    // Deep Blue-Purple
        'Marine': '#00876c'        // Teal-Green
    }
};

// Initialize the map
function initMap() {
    // Create map centered on continental US
    map = L.map('map', {
        center: [37.8, -96],
        zoom: 4,
        minZoom: 3,
        maxZoom: 9,
        zoomControl: true,
        attributionControl: true
    });
    
    // Add tile layer (base map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    
    // Add zoom control to top right
    map.zoomControl.setPosition('topright');

    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading-spinner';
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
        <div class="spinner"></div>
        <p>Loading map data...</p>
    `;
    document.querySelector('.map-container').appendChild(loadingIndicator);

    // Load GeoJSON data
    fetch('data/climate_zones.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Store data globally
            countyData = data;
            
            // Inspect the first few features to understand the data structure
            inspectGeoJSONData(data);
            
            // Normalize the properties to ensure consistent naming
            normalizeGeoJSONProperties(data);
            
            // Generate lists of zones
            generateIECCZonesList();
            generateBAZonesList();
            
            // Filters have been removed, so no need to populate them
            // populateFilters();
            
            // Load electricity price data
            loadElectricityPriceData();
            
            // Now that we have data, initialize everything else
            renderMap();
            
            // Remove loading indicator
            document.getElementById('loading-spinner').style.display = 'none';
        })
        .catch(error => {
            console.error("Error loading GeoJSON data:", error);
            const loadingIndicator = document.getElementById('loading-spinner');
            if (loadingIndicator) {
                loadingIndicator.innerHTML = `
                    <p class="error">Error loading map data: ${error.message}<br>Please try refreshing the page.</p>
                `;
            }
        });

    // Set up toggle event listener for classification
    document.getElementById('classification-toggle').addEventListener('change', function() {
        window.currentClassification = this.checked ? 'ba' : 'iecc';
        
        // Reset filters when switching classification - filters removed so commented out
        // currentFilters.zone = 'all';
        // document.getElementById('zone-filter').value = 'all';
        
        // Filters have been removed, so no need to populate them
        // populateFilters();
        
        // Render map with new classification
        renderMap();
        
        console.log("Classification toggled to:", window.currentClassification);
    });
    
    // Set up toggle event listener for visualization
    document.getElementById('visualization-toggle').addEventListener('change', function() {
        currentVisualization = this.checked ? 'electricity' : 'climate';
        
        // Show/hide classification toggle based on visualization
        const classificationToggle = document.querySelector('.classification-toggle');
        if (currentVisualization === 'climate') {
            classificationToggle.style.display = 'flex';
        } else {
            classificationToggle.style.display = 'none';
        }
        
        // Update page title based on visualization
        const header = document.querySelector('header p');
        if (header) {
            if (currentVisualization === 'climate') {
                const classType = window.currentClassification === 'iecc' ? 'IECC' : 'Build America';
                header.textContent = `Interactive map showing ${classType} climate classifications by county`;
            } else {
                header.textContent = `Interactive map showing residential electricity prices by state`;
            }
        }
        
        // Render map with new visualization
        renderMap();
        
        console.log("Visualization toggled to:", currentVisualization);
    });
    
    // Filters have been removed, so these listeners are not needed
    /*
    // Set up filter listeners
    document.getElementById('zone-filter').addEventListener('change', function() {
        currentFilters.zone = this.value;
        renderMap();
    });
    
    document.getElementById('state-filter').addEventListener('change', function() {
        currentFilters.state = this.value;
        renderMap();
    });
    */
    
    // Initialize classification toggle visibility based on initial visualization
    const classificationToggle = document.querySelector('.classification-toggle');
    if (currentVisualization === 'climate') {
        classificationToggle.style.display = 'flex';
    } else {
        classificationToggle.style.display = 'none';
    }
}

// Load electricity price data from CSV
function loadElectricityPriceData() {
    fetch('data/electricity_prices.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(csvText => {
            // Parse CSV data
            const lines = csvText.split('\n');
            const headers = lines[0].split(',');
            
            // Start from line 1 to skip headers
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue; // Skip empty lines
                
                const values = lines[i].split(',');
                const state = values[0];
                const stateID = values[1];
                const price = parseFloat(values[3]);
                
                // Store data by both state name and state ID for flexibility
                if (state && !isNaN(price)) {
                    electricityPriceData[state] = price;
                    
                    if (stateID) {
                        electricityPriceData[stateID] = price;
                    }
                }
            }
            
            console.log("Electricity price data loaded:", Object.keys(electricityPriceData).length, "states");
        })
        .catch(error => {
            console.error("Error loading electricity price data:", error);
        });
}

// Get electricity price for a state
window.getElectricityPrice = function(state) {
    // Try to get price using full state name
    let price = electricityPriceData[state];
    
    if (price === undefined) {
        // If not found, try abbreviation or other variations
        for (const key in electricityPriceData) {
            if (state.toLowerCase().includes(key.toLowerCase()) || 
                key.toLowerCase().includes(state.toLowerCase())) {
                price = electricityPriceData[key];
                break;
            }
        }
    }
    
    return price !== undefined ? price : null;
}

// Generate a list of unique IECC zones from the data
function generateIECCZonesList() {
    if (!countyData) return;
    
    const uniqueZones = new Set();
    
    // Add all possible IECC climate zones to ensure we have a complete legend
    const allZones = ['0A', '0B', '1A', '1B', '2A', '2B', '3A', '3B', '3C', '4A', '4B', '4C', '5A', '5B', '5C', '6A', '6B', '7', '8'];
    allZones.forEach(zone => uniqueZones.add(zone));
    
    // Also try to generate from actual data
    countyData.features.forEach(feature => {
        if (!feature.properties) return;
        
        // Get zone number and moisture
        const zoneNum = feature.properties.IECC_2021 || feature.properties.IECC21;
        const moisture = feature.properties.Moisture21 || feature.properties.Moisture15;
        
        if (zoneNum !== undefined && zoneNum !== null) {
            // Convert to integer if it's a decimal
            const zoneInt = Math.floor(zoneNum);
            
            // Special case for zones 7 and 8 which don't have moisture designations
            if (zoneInt >= 7) {
                uniqueZones.add(String(zoneInt));
            } 
            // For other zones, combine with moisture if available
            else if (moisture) {
                uniqueZones.add(`${zoneInt}${moisture}`);
            }
        }
    });
    
    ieecZoneInfo.zones = Array.from(uniqueZones).sort((a, b) => {
        // Custom sort: first by numeric part, then by letter
        const aNum = parseInt(a.match(/\d+/)[0]);
        const bNum = parseInt(b.match(/\d+/)[0]);
        
        if (aNum !== bNum) return aNum - bNum;
        
        // If numbers are the same, sort by letter
        const aLetter = a.match(/[A-Z]+/) ? a.match(/[A-Z]+/)[0] : '';
        const bLetter = b.match(/[A-Z]+/) ? b.match(/[A-Z]+/)[0] : '';
        
        return aLetter.localeCompare(bLetter);
    });
    
    console.log("Generated IECC Zones:", ieecZoneInfo.zones);
}

// Generate a list of unique Build America zones from the data
function generateBAZonesList() {
    if (!countyData) return;
    
    const uniqueZones = new Set();
    
    // Add all predefined zones to ensure complete legend
    Object.keys(baZoneInfo.colors).forEach(zone => uniqueZones.add(zone));
    
    // Also try to extract from actual data
    countyData.features.forEach(feature => {
        if (!feature.properties) return;
        
        const zone = feature.properties.BA_2021 || feature.properties.BA21;
        if (zone) uniqueZones.add(zone);
    });
    
    baZoneInfo.zones = Array.from(uniqueZones).sort();
    console.log("Generated BA Zones:", baZoneInfo.zones);
}

// Populate filter dropdowns based on current classification
function populateFilters() {
    const zoneFilter = document.getElementById('zone-filter');
    const stateFilter = document.getElementById('state-filter');
    
    // Clear existing options
    zoneFilter.innerHTML = '<option value="all">All Zones</option>';
    
    // Get the appropriate zone list based on current classification
    const zones = window.currentClassification === 'iecc' ? ieecZoneInfo.zones : baZoneInfo.zones;
    
    // Add new options
    zones.forEach(zone => {
        const option = document.createElement('option');
        option.value = zone;
        option.textContent = zone;
        zoneFilter.appendChild(option);
    });
    
    // Populate state filter if not already done
    if (stateFilter.options.length <= 1 && countyData) {
        const uniqueStates = new Set();
        
        countyData.features.forEach(feature => {
            if (feature.properties) {
                const state = feature.properties.STATE_NAME || feature.properties.State;
                if (state) uniqueStates.add(state);
            }
        });
        
        Array.from(uniqueStates).sort().forEach(state => {
            const option = document.createElement('option');
            option.value = state;
            option.textContent = state;
            stateFilter.appendChild(option);
        });
    }
    
    // Update filter to match current selection
    zoneFilter.value = currentFilters.zone;
    stateFilter.value = currentFilters.state;
}

// Generate a legend based on the current visualization
function generateLegend() {
    // Get the legend container
    const legend = document.getElementById('zone-legend');
    
    // Clear the existing legend
    legend.innerHTML = '';
    
    if (currentVisualization === 'climate') {
        // Create legend for climate zones
        // No need for a header since we have one in the HTML
        
        // Get the correct zone information based on current classification
        const zoneInfo = window.currentClassification === 'iecc' ? ieecZoneInfo : baZoneInfo;
        
        // Create an item for each zone
        zoneInfo.zones.forEach(zone => {
            // Get the color for this zone
            const color = zoneInfo.colors[zone] || '#cccccc';
            
            // Create legend item
            const item = document.createElement('div');
            item.className = 'legend-item';
            
            // Create color swatch
            const swatch = document.createElement('span');
            swatch.className = 'legend-color';
            swatch.style.backgroundColor = color;
            item.appendChild(swatch);
            
            // For IECC zones, add a more descriptive label
            let label = zone;
            if (window.currentClassification === 'iecc') {
                const description = ieecZoneInfo.descriptions[zone] || '';
                if (description) {
                    label = `${zone} (${description})`;
                } else {
                    label = `${zone}`;
                }
            }
            
            // Create and add text label
            const text = document.createElement('span');
            text.className = 'legend-label';
            text.textContent = label;
            item.appendChild(text);
            
            // Add the item to the legend
            legend.appendChild(item);
            
            // Add click handler to filter by this zone
            item.addEventListener('click', function() {
                // Set the zone filter to this zone
                currentFilters.zone = zone;
                
                // Update the zone filter dropdown
                document.getElementById('zone-filter').value = zone;
                
                // Render the map with the new filter
                renderMap();
            });
        });
    } else {
        // Create legend for electricity prices
        // No need for a duplicate header
        
        // Define price ranges and colors
        const priceRanges = [
            { min: 0, max: 12, color: '#118ab2', label: 'Low: < 12¢/kWh' },
            { min: 12, max: 16, color: '#06d6a0', label: 'Average: 12-16¢/kWh' },
            { min: 16, max: 25, color: '#ffd166', label: 'High: 16-25¢/kWh' },
            { min: 25, max: 50, color: '#ef476f', label: 'Very High: > 25¢/kWh' }
        ];
        
        // Create legend items for price ranges
        priceRanges.forEach(range => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            
            const swatch = document.createElement('span');
            swatch.className = 'legend-color';
            swatch.style.backgroundColor = range.color;
            item.appendChild(swatch);
            
            const text = document.createElement('span');
            text.className = 'legend-label';
            text.textContent = range.label;
            item.appendChild(text);
            
            legend.appendChild(item);
        });
    }
    
    console.log(`Legend populated for ${currentVisualization} visualization`);
}

// Get color for a feature based on its zone
function getZoneColor(feature) {
    if (!feature || !feature.properties) {
        console.log("Feature or feature properties missing");
        return "#cccccc"; // Default gray for missing properties
    }

    try {
        if (window.currentClassification === "iecc") {
            // Get zone number and moisture regime from properties
            const zoneNum = feature.properties.IECC_2021 || feature.properties.IECC21;
            const moisture = feature.properties.Moisture21 || feature.properties.Moisture15;
            
            if (zoneNum === undefined || zoneNum === null) {
                console.log("Missing IECC zone number for feature:", feature.properties);
                return "#cccccc";
            }
            
            // Convert to integer if it's a decimal (e.g., 3.0 -> 3)
            const zoneInt = Math.floor(zoneNum);
            let fullZoneCode;
            
            // Special case for zones 7 and 8 which don't have moisture designations
            if (zoneInt >= 7) {
                fullZoneCode = String(zoneInt);
            } else if (moisture) {
                fullZoneCode = `${zoneInt}${moisture}`;
            } else {
                console.log("Missing moisture regime for IECC zone:", zoneInt, feature.properties);
                return "#cccccc";
            }
            
            console.log("Looking for IECC zone color:", fullZoneCode, "from zone:", zoneInt, "moisture:", moisture);
            
            if (ieecZoneInfo.colors[fullZoneCode]) {
                return ieecZoneInfo.colors[fullZoneCode];
            } else {
                console.log("No color found for IECC zone:", fullZoneCode);
                return "#cccccc";
            }
        } else if (window.currentClassification === "ba") {
            const zone = feature.properties.BA_2021 || feature.properties.BA21;
            
            if (!zone) {
                console.log("Missing BA zone for feature:", feature.properties);
                return "#cccccc";
            }
            
            // Try exact match first
            if (baZoneInfo.colors[zone]) {
                return baZoneInfo.colors[zone];
            }
            
            // Try fuzzy match - some data may have slightly different formatting
            for (const key in baZoneInfo.colors) {
                if (zone.toLowerCase().includes(key.toLowerCase()) || 
                    key.toLowerCase().includes(zone.toLowerCase())) {
                    return baZoneInfo.colors[key];
                }
            }
            
            console.log("No color found for BA zone:", zone);
            return "#cccccc";
        }
    } catch (error) {
        console.error("Error getting zone color:", error);
        return "#cccccc";
    }
    
    return "#cccccc"; // Default fall-through
}

// Get color for a feature based on electricity price
function getElectricityPriceColor(feature) {
    if (!feature || !feature.properties) {
        return "#cccccc"; // Default gray for missing properties
    }

    try {
        const stateName = feature.properties.STATE_NAME || feature.properties.State;
        if (!stateName) {
            return "#cccccc";
        }
        
        const price = getElectricityPrice(stateName);
        if (price === null) {
            return "#cccccc"; // No price data available
        }
        
        // Find the appropriate color based on price
        for (const range of electricityPriceColors) {
            if (price <= range.max) {
                return range.color;
            }
        }
        
        return "#cccccc"; // Default if no range matched (shouldn't happen)
    } catch (error) {
        console.error("Error getting electricity price color:", error);
        return "#cccccc";
    }
}

// Style function for GeoJSON layer
function styleFeature(feature) {
    // Get color based on current visualization
    const color = currentVisualization === 'climate' 
        ? getZoneColor(feature) 
        : getElectricityPriceColor(feature);
    
    return {
        fillColor: color,
        weight: 1,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

// Filter GeoJSON features based on current filters
function filterFeatures(features, filters) {
    console.log("Filtering features with:", filters);
    return features.filter(feature => {
        const properties = feature.properties;
        
        // Skip if properties are missing
        if (!properties) return false;
        
        // Filter by classification and zone
        if (window.currentClassification === 'iecc') {
            // For IECC, check both possible property names
            const zoneNum = properties.IECC_2021 || properties.IECC21;
            const moisture = properties.Moisture21 || properties.Moisture15;
            
            if (zoneNum === undefined || zoneNum === null) {
                return false;
            }
            
            // Zone filter
            if (filters.zone !== 'all') {
                const zoneInt = Math.floor(zoneNum);
                let fullZoneCode;
                
                // Special case for zones 7 and 8
                if (zoneInt >= 7) {
                    fullZoneCode = String(zoneInt);
                } else if (moisture) {
                    fullZoneCode = `${zoneInt}${moisture}`;
                } else {
                    return false;
                }
                
                if (fullZoneCode !== filters.zone) {
                    return false;
                }
            }
        } else if (window.currentClassification === 'ba') {
            // For Build America, check zone filter
            const zone = properties.BA_2021 || properties.BA21;
            
            if (filters.zone !== 'all' && zone !== filters.zone) {
                // Try fuzzy matching for BA zones
                let matchFound = false;
                if (zone && filters.zone) {
                    matchFound = zone.toLowerCase().includes(filters.zone.toLowerCase()) || 
                                filters.zone.toLowerCase().includes(zone.toLowerCase());
                }
                
                if (!matchFound) {
                    return false;
                }
            }
        }
        
        // Filter by state
        if (filters.state !== 'all') {
            const state = properties.STATE_NAME || properties.State;
            if (state !== filters.state) {
                return false;
            }
        }
        
        return true;
    });
}

// Highlight a county when it's selected
function highlightSelectedCounty(layer) {
    // Reset previous selection if any
    if (selectedCountyLayer && selectedCountyLayer !== layer) {
        selectedCountyLayer._isSelected = false;
        geoJsonLayer.resetStyle(selectedCountyLayer);
    }
    
    // Highlight the new selection
    layer.setStyle({
        weight: 3,
        color: '#ff4500',  // Bright orange-red border
        dashArray: '',
        fillOpacity: 0.7,
        opacity: 1
    });
    
    layer._isSelected = true;
    selectedCountyLayer = layer;
    
    // Bring to front to ensure the borders are visible
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
}

// Display county information when a feature is clicked
// Make this globally accessible for the calculator to hook into
window.showCountyInfo = function(e) {
    try {
        const properties = e.target.feature.properties;
        const infoPanel = document.getElementById('county-info');
        
        // DEBUG: Log properties to see what's available
        console.log("showCountyInfo properties:", JSON.stringify(properties, null, 2));
        
        // Get zone information based on classification
        const zoneType = window.currentClassification === 'iecc' 
            ? (properties.IECC_2021 !== undefined ? 'IECC_2021' : 'IECC21') 
            : (properties.BA_2021 !== undefined ? 'BA_2021' : 'BA21');
        
        // For IECC, we need to combine zone and moisture
        let zoneName = properties[zoneType];
        if (window.currentClassification === 'iecc' && zoneName) {
            const zoneNum = Math.floor(zoneName);
            if (zoneNum < 7) {
                const moisture = properties.Moisture21 || properties.Moisture15;
                if (moisture) {
                    zoneName = `${zoneNum}${moisture}`;
                }
            }
        }
        
        // Determine the correct county name property
        // Check all possible variations of county name
        const countyName = properties.NAME || properties.COUNTY || properties.County || properties.COUNTY_NAME || properties.country || "Unknown";
        const stateName = properties.STATE_NAME || properties.STATE || properties.State || "Unknown State";
        
        console.log(`showCountyInfo: County name: "${countyName}", State name: "${stateName}"`);
        
        // Get electricity price for this state
        const electricityPrice = getElectricityPrice(stateName);
        const priceDisplay = electricityPrice !== null ? 
            `${electricityPrice.toFixed(2)} cents/kWh` : 
            'Data not available';
        
        infoPanel.innerHTML = `
            <h3>${countyName} County, ${stateName}</h3>
            <div class="county-details">
                <div class="classification-section ${window.currentClassification.toLowerCase()}">
                    <h4>${window.currentClassification === 'iecc' ? 'IECC 2021' : 'Build America'} Classification</h4>
                    <p>${zoneName || 'Data not available'}</p>
                </div>
                <p><strong>Residential Electricity Price (2023):</strong> ${priceDisplay}</p>
            </div>
        `;
    } catch (error) {
        console.error("Error in showCountyInfo:", error);
        document.getElementById('county-info').innerHTML = `
            <p>Error displaying county information. Please try again.</p>
        `;
    }
    
    // Scroll the info panel into view on mobile
    if (window.innerWidth < 768) {
        const infoPanel = document.querySelector('.info-panel');
        if (infoPanel) {
            infoPanel.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

// Create tooltips for counties on hover
function onEachFeature(feature, layer) {
    if (!feature.properties) return;
    
    // Create popup content
    const properties = feature.properties;
    
    // DEBUG: Log the properties to see what's available
    console.log("Feature properties:", JSON.stringify(properties, null, 2));
    
    // Determine the correct county name and state - should now prioritize standardized NAME property
    const countyName = properties.NAME || properties.COUNTY || properties.County || properties.COUNTY_NAME || properties.country || "Unknown";
    const stateName = properties.STATE_NAME || properties.STATE || properties.State || "Unknown";
    
    // Log what we found
    console.log(`County name: "${countyName}", State name: "${stateName}"`);
    
    // Get electricity price for this state
    const electricityPrice = getElectricityPrice(stateName);
    const priceDisplay = electricityPrice !== null ? 
        `<br>Electricity: ${electricityPrice.toFixed(2)} cents/kWh` : '';
    
    let zoneInfo = '';
    if (currentVisualization === 'climate' || electricityPrice === null) {
        // Determine the zone based on current classification
        let zoneValue;
        if (window.currentClassification === 'iecc') {
            const zoneNum = properties.IECC_2021 || properties.IECC21;
            const moisture = properties.Moisture21 || properties.Moisture15;
            
            if (zoneNum !== undefined && zoneNum !== null) {
                const zoneInt = Math.floor(zoneNum);
                if (zoneInt >= 7) {
                    zoneValue = String(zoneInt);
                } else if (moisture) {
                    zoneValue = `${zoneInt}${moisture}`;
                } else {
                    zoneValue = String(zoneInt);
                }
            } else {
                zoneValue = 'N/A';
            }
        } else {
            zoneValue = properties.BA_2021 || properties.BA21 || 'N/A';
        }
        
        zoneInfo = `<br>${window.currentClassification === 'iecc' ? 'IECC Zone: ' : 'BA Zone: '}${zoneValue}`;
    }
    
    const popupContent = `
        <strong>${countyName} County, ${stateName}</strong>
        ${zoneInfo}${priceDisplay}
    `;
    
    // Store the feature ID to use for highlighting
    feature.properties.featureId = feature.properties.featureId || `county-${countyName}-${stateName}`.replace(/\s+/g, '-').toLowerCase();
    
    // Add tooltip
    layer.bindTooltip(popupContent, {
        sticky: true,
        direction: 'auto',
        className: 'county-tooltip'
    });
    
    // Add event listeners
    layer.on({
        click: function(e) {
            // Highlight this county by changing its style
            highlightSelectedCounty(e.target);
            
            // Call the original function
            window.showCountyInfo(e);
            
            // Dispatch a custom event for the calculator
            const featureClickEvent = new CustomEvent('mapFeatureClicked', {
                detail: { feature: feature }
            });
            document.dispatchEvent(featureClickEvent);
            
            console.log("Map: County clicked", countyName, stateName);
        },
        mouseover: function(e) {
            const layer = e.target;
            layer.setStyle({
                weight: 2,
                color: '#666',
                dashArray: '',
                fillOpacity: 0.8
            });
            layer.bringToFront();
        },
        mouseout: function(e) {
            // Only reset if this is not the selected county
            if (!e.target._isSelected) {
                geoJsonLayer.resetStyle(e.target);
            }
        }
    });
}

// Render the map based on current filters
function renderMap() {
    try {
        console.log("Rendering map with current settings");
        console.log("Visualization:", currentVisualization);
        console.log("Classification:", window.currentClassification);
        console.log("Filters:", currentFilters);
        
        // Update title in HTML
        const header = document.querySelector('header p');
        if (header) {
            if (currentVisualization === 'climate') {
                const classType = window.currentClassification === 'iecc' ? 'IECC' : 'Build America';
                header.textContent = `Interactive map showing ${classType} climate classifications by county`;
            } else {
                header.textContent = `Interactive map showing residential electricity prices by state`;
            }
        }
        
        // Legend has been removed, so we don't update it anymore
        // generateLegend();

        // Show loading spinner
        document.getElementById('loading-spinner').style.display = 'block';

        // Check if we have data
        if (!countyData || !countyData.features) {
            throw new Error("No GeoJSON data available");
        }

        // Filter features based on current filters
        const filteredData = {
            type: "FeatureCollection",
            features: filterFeatures(countyData.features, currentFilters)
        };

        // Create a new GeoJSON layer with filtered data
        geoJsonLayer = L.geoJSON(filteredData, {
            style: styleFeature,
            onEachFeature: onEachFeature
        }).addTo(map);

        // Total counties element has been removed, so we don't update it anymore
        // document.getElementById('total-counties').textContent = 
        //    `Displaying ${filteredData.features.length} of ${countyData.features.length} counties`;

        // Adjust map view if filters are applied
        if (currentFilters.zone !== 'all' || currentFilters.state !== 'all') {
            if (filteredData.features.length > 0) {
                try {
                    // Get bounds of the filtered data
                    const bounds = geoJsonLayer.getBounds();
                    // Fit map to these bounds
                    map.fitBounds(bounds);
                } catch (error) {
                    console.error("Error fitting bounds:", error);
                    // Reset view to US if error occurs
                    map.setView([37.8, -96], 4);
                }
            } else {
                console.log("No features match the current filters");
                map.setView([37.8, -96], 4);
            }
        }

        console.log("Map rendering complete");
    } catch (error) {
        console.error("Error rendering map:", error);
        document.getElementById('loading-spinner').innerHTML = `
            <p class="error">Error rendering map: ${error.message}<br>Please try refreshing the page.</p>
        `;
    } finally {
        // Hide loading spinner
        document.getElementById('loading-spinner').style.display = 'none';
    }
}

// Add a custom loading spinner CSS
const style = document.createElement('style');
style.textContent = `
    .loading-indicator {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(255, 255, 255, 0.8);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .spinner {
        width: 50px;
        height: 50px;
        border: 5px solid rgba(52, 152, 219, 0.2);
        border-top: 5px solid rgba(52, 152, 219, 1);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 10px;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .error {
        color: #e74c3c;
        font-weight: bold;
        text-align: center;
        padding: 20px;
    }
    
    .county-tooltip {
        background-color: rgba(0, 0, 0, 0.8);
        border: none;
        border-radius: 4px;
        color: white;
        font-family: 'Open Sans', sans-serif;
        padding: 8px 12px;
        font-size: 14px;
        box-shadow: 0 3px 14px rgba(0,0,0,0.4);
    }
    
    .electricity-price-info {
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #e0e0e0;
    }
    
    .electricity-price-info h4 {
        margin-bottom: 8px;
    }
    
    .price-range {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
    }
    
    .price-range-color {
        width: 20px;
        height: 20px;
        margin-right: 8px;
        border-radius: 3px;
    }
    
    .price-range-label {
        font-size: 14px;
    }
`;
document.head.appendChild(style);

// Inspect GeoJSON data structure to understand the property naming
function inspectGeoJSONData(data) {
    if (!data.features || data.features.length === 0) {
        console.log("No features found in GeoJSON data");
        return;
    }
    
    console.log("GeoJSON data loaded with", data.features.length, "features");
    
    // Sample the first 5 features to understand the data structure
    const sampleSize = Math.min(5, data.features.length);
    const samples = data.features.slice(0, sampleSize);
    
    // Collect all property keys to understand the schema
    const allKeys = new Set();
    samples.forEach(feature => {
        if (feature.properties) {
            Object.keys(feature.properties).forEach(key => allKeys.add(key));
        }
    });
    
    console.log("Property schema keys:", [...allKeys]);
    
    // Log detailed samples
    samples.forEach((feature, index) => {
        console.log(`Sample feature ${index + 1}:`, JSON.stringify(feature.properties, null, 2));
    });
    
    // Find all variations of county and state properties
    const countyProperties = [...allKeys].filter(key => 
        key.toLowerCase().includes('county') || 
        key.toLowerCase().includes('count') || 
        key === 'NAME');
    
    const stateProperties = [...allKeys].filter(key => 
        key.toLowerCase().includes('state') || 
        key === 'STATE_NAME' || 
        key === 'State');
    
    console.log("Potential county properties:", countyProperties);
    console.log("Potential state properties:", stateProperties);
}

// Normalize the properties in the GeoJSON data
function normalizeGeoJSONProperties(data) {
    if (!data.features || data.features.length === 0) {
        console.log("No features found in GeoJSON data");
        return;
    }
    
    const countyProps = new Set();
    const stateProps = new Set();
    
    data.features.forEach(feature => {
        if (feature.properties) {
            // Find all properties that might contain county or state information
            Object.keys(feature.properties).forEach(key => {
                if (key.toLowerCase().includes('county') || 
                    key.toLowerCase() === 'name' || 
                    key.toLowerCase().includes('count') || 
                    key.toLowerCase() === 'country') {
                    countyProps.add(key);
                }
                
                if (key.toLowerCase().includes('state')) {
                    stateProps.add(key);
                }
            });
            
            // Add standard properties for county and state
            const props = feature.properties;
            
            // Try to find the county name
            for (const key of countyProps) {
                if (props[key]) {
                    // Ensure we have a standard NAME property
                    props.NAME = props.NAME || props[key];
                    // Also set COUNTY for consistency
                    props.COUNTY = props.COUNTY || props[key];
                    break;
                }
            }
            
            // Try to find the state name
            for (const key of stateProps) {
                if (props[key]) {
                    // Ensure we have a standard STATE_NAME property
                    props.STATE_NAME = props.STATE_NAME || props[key];
                    break;
                }
            }
        }
    });
    
    console.log("County properties found:", [...countyProps]);
    console.log("State properties found:", [...stateProps]);
    console.log("GeoJSON properties normalized");
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the map
    initMap();
    
    // Add event listeners to the filter dropdowns
    document.getElementById('zone-filter').addEventListener('change', function() {
        currentFilters.zone = this.value;
        renderMap();
    });
    
    document.getElementById('state-filter').addEventListener('change', function() {
        currentFilters.state = this.value;
        renderMap();
    });
    
    // Set the current year in the footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
});