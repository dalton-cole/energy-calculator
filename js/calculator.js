/**
 * Energy Cost Calculator
 * Calculates estimated heating and cooling costs based on:
 * - Home square footage
 * - Wall and ceiling R-values
 * - Window types
 * - Location's climate zone
 * - Local electricity prices
 * - Air infiltration rates
 * - Fuel type selection
 */

// Global variables for calculator
let currentCounty = null;
let currentClimateZone = null;
let currentElectricityPrice = null;
let energyChart = null;

// Default climate data to use if zone data is not available
const defaultClimateData = { hdd: 4000, cdd: 1000, name: 'Average Climate' };

// Climate zone data with approximate heating and cooling degree days
const climateZoneData = {
    // IECC Climate Zones
    '1A': { hdd: 200, cdd: 4500, name: 'Very Hot - Humid' },
    '1B': { hdd: 200, cdd: 4000, name: 'Very Hot - Dry' },
    '2A': { hdd: 750, cdd: 3500, name: 'Hot - Humid' },
    '2B': { hdd: 750, cdd: 3000, name: 'Hot - Dry' },
    '3A': { hdd: 1800, cdd: 2500, name: 'Warm - Humid' },
    '3B': { hdd: 1800, cdd: 2000, name: 'Warm - Dry' },
    '3C': { hdd: 2000, cdd: 1000, name: 'Warm - Marine' },
    '4A': { hdd: 3500, cdd: 1500, name: 'Mixed - Humid' },
    '4B': { hdd: 3500, cdd: 1200, name: 'Mixed - Dry' },
    '4C': { hdd: 3800, cdd: 500, name: 'Mixed - Marine' },
    '5A': { hdd: 5000, cdd: 800, name: 'Cool - Humid' },
    '5B': { hdd: 5000, cdd: 600, name: 'Cool - Dry' },
    '5C': { hdd: 5200, cdd: 300, name: 'Cool - Marine' },
    '6A': { hdd: 6500, cdd: 400, name: 'Cold - Humid' },
    '6B': { hdd: 6500, cdd: 300, name: 'Cold - Dry' },
    '7': { hdd: 8000, cdd: 200, name: 'Very Cold' },
    '8': { hdd: 10000, cdd: 100, name: 'Subarctic' },
    
    // Build America Climate Zones
    'Hot-Humid': { hdd: 500, cdd: 4000, name: 'Hot-Humid' },
    'Hot-Dry': { hdd: 500, cdd: 3500, name: 'Hot-Dry' },
    'Mixed-Humid': { hdd: 3000, cdd: 2000, name: 'Mixed-Humid' },
    'Mixed-Dry': { hdd: 3000, cdd: 1500, name: 'Mixed-Dry' },
    'Cold': { hdd: 5500, cdd: 500, name: 'Cold' },
    'Very Cold': { hdd: 8000, cdd: 250, name: 'Very Cold' },
    'Subarctic': { hdd: 10000, cdd: 100, name: 'Subarctic' },
    'Marine': { hdd: 3500, cdd: 600, name: 'Marine' }
};

// Window U-values
const windowUValues = {
    'single': 1.0,
    'double': 0.5,
    'lowE': 0.35,
    'triple': 0.25
};

// Air infiltration rates by home tightness (air changes per hour)
const infiltrationRates = {
    'tight': 0.2,    // Very tight new construction with air sealing
    'average': 1.0,  // Average home (substantially increased from 0.7)
    'leaky': 2.5     // Older leaky home (substantially increased from 1.5)
};

// Infiltration impact factors - multipliers that account for how infiltration affects different home types
const infiltrationImpactFactors = {
    'tight': 1.0,    // Baseline impact for tight homes
    'average': 1.3,  // 30% higher impact for average homes due to uneven air distribution
    'leaky': 1.8     // 80% higher impact for leaky homes due to drafts, cold spots, etc.
};

// Fuel types and their properties
const fuelTypes = {
    'electricity': {
        name: 'Electricity',
        unit: 'kWh',
        unitCost: null,  // Will be set from electricity price data
        btuPerUnit: 3412,
        co2PerUnit: 0.92  // lbs CO2 per kWh (national average)
    },
    'natural_gas': {
        name: 'Natural Gas',
        unit: 'therm',
        unitCost: 1.80,  // Updated national average in dollars (increased from 1.50)
        btuPerUnit: 100000,
        co2PerUnit: 11.7  // lbs CO2 per therm
    },
    'propane': {
        name: 'Propane',
        unit: 'gallon',
        unitCost: 3.20,  // Updated national average in dollars (increased from 2.50)
        btuPerUnit: 91500,
        co2PerUnit: 12.7  // lbs CO2 per gallon
    },
    'fuel_oil': {
        name: 'Fuel Oil',
        unit: 'gallon',
        unitCost: 4.20,  // Updated national average in dollars (increased from 3.80)
        btuPerUnit: 138500,
        co2PerUnit: 22.4  // lbs CO2 per gallon
    }
};

// More realistic HVAC efficiency factors with temperature dependencies
const efficiencyFactors = {
    'standard': { 
        name: 'Standard Efficiency',
        heating: {
            electric: 0.95,     // Electric resistance
            heat_pump: {
                base: 1.8,      // COP of 1.8 at 47°F (reduced from 2.0)
                tempFactor: -0.08  // Decreases more quickly with temperature (from -0.05)
            },
            furnace: 0.78,      // 78% AFUE gas furnace (reduced from 80%)
            boiler: 0.80        // 80% AFUE boiler (reduced from 82%)
        },
        cooling: {
            base: 2.3,          // Reduced from 2.5
            tempFactor: -0.15   // Decreases more quickly with temperature (from -0.1)
        }
    },
    'high': { 
        name: 'High Efficiency',
        heating: {
            electric: 0.98,
            heat_pump: {
                base: 2.5,      // COP of 2.5 at 47°F (reduced from 2.8)
                tempFactor: -0.09 // More temperature sensitive (from -0.06)
            },
            furnace: 0.90,      // 90% AFUE gas furnace (reduced from 92%)
            boiler: 0.87        // 87% AFUE boiler (reduced from 90%)
        },
        cooling: {
            base: 3.2,          // Reduced from 3.5
            tempFactor: -0.12   // More temperature sensitive (from -0.08)
        }
    },
    'premium': { 
        name: 'Premium Efficiency',
        heating: {
            electric: 0.99,
            heat_pump: {
                base: 3.2,      // COP of 3.2 at 47°F (reduced from 3.5)
                tempFactor: -0.09 // More temperature sensitive (from -0.07)
            },
            furnace: 0.95,      // 95% AFUE gas furnace (reduced from 97%)
            boiler: 0.92        // 92% AFUE boiler (reduced from 95%)
        },
        cooling: {
            base: 4.5,          // Reduced from 5.0
            tempFactor: -0.08   // More temperature sensitive (from -0.05)
        }
    }
};

// Duct loss factors based on duct location
const ductLossFactors = {
    'conditioned': 0.08,   // 8% loss in conditioned space (increased from 5%)
    'unconditioned': 0.35, // 35% loss in unconditioned attic/basement (increased from 25%)
    'none': 0.03           // 3% distribution losses even without ducts (increased from 0%)
};

// Realistic calculations constants
const AIR_DENSITY = 0.075;     // lb/ft³
const AIR_SPECIFIC_HEAT = 0.24; // BTU/lb-°F
const HOURS_PER_DAY = 24;
const CYCLING_FACTOR = 1.25;   // Increased from 1.15 to account for more cycling inefficiency
const DESIGN_TEMP_DIFF = 70;   // Typical design temperature difference in °F
const PART_LOAD_FACTOR = 0.85; // Increased from 0.8 to be more realistic
const SEASONAL_ADJUSTMENT = 1.4; // Increased from 1.2 to better account for extreme weather

// Function to extract location data from county info panel
function extractLocationFromInfoPanel() {
    const countyInfoPanel = document.getElementById('county-info');
    if (!countyInfoPanel) return false;
    
    try {
        const countyHeader = countyInfoPanel.querySelector('h3');
        if (countyHeader && countyHeader.textContent.includes('County')) {
            // Extract location from the panel
            const headerText = countyHeader.textContent;
            const locationMatch = headerText.match(/(.+) County, (.+)/);
            
            console.log("Extracting from header text:", headerText);
            
            if (locationMatch && locationMatch.length >= 3) {
                const countyName = locationMatch[1];
                const stateName = locationMatch[2];
                
                console.log("Extracted county information:", { countyName, stateName });
                
                // Create a basic county object
                currentCounty = { 
                    name: countyName,
                    state: stateName
                };
                
                // Try to get climate zone 
                const zoneElement = countyInfoPanel.querySelector('.classification-section p');
                if (zoneElement) {
                    currentClimateZone = zoneElement.textContent.trim();
                }
                
                // Try to get electricity price
                try {
                    // Try to extract from electricity price info in panel
                    const detailsText = countyInfoPanel.textContent;
                    const priceMatch = detailsText.match(/Residential Electricity Price \(2023\): (\d+\.\d+)/);
                    if (priceMatch && priceMatch.length >= 2) {
                        currentElectricityPrice = parseFloat(priceMatch[1]);
                    } else if (window.getElectricityPrice) {
                        currentElectricityPrice = window.getElectricityPrice(stateName);
                    }
                } catch (e) {
                    console.error("Error getting electricity price:", e);
                }
                
                // Update the display
                const locationDisplay = document.getElementById('selected-location');
                const zoneInfo = currentClimateZone ? (climateZoneData[currentClimateZone] || defaultClimateData) : defaultClimateData;
                
                locationDisplay.innerHTML = `
                    <strong>${countyName} County, ${stateName}</strong><br>
                    ${currentClimateZone ? 'Climate Zone: ' + currentClimateZone + '<br>' : ''}
                    <div class="climate-metrics">
                        <span>HDD: ${zoneInfo.hdd} <span class="tooltip-icon" title="Heating Degree Days: A measure of how cold a location is over a year. Higher values indicate colder climates that require more heating.">?</span></span>
                        <span>CDD: ${zoneInfo.cdd} <span class="tooltip-icon" title="Cooling Degree Days: A measure of how hot a location is over a year. Higher values indicate hotter climates that require more cooling.">?</span></span>
                    </div>
                    ${currentElectricityPrice ? 'Electricity Price: ' + currentElectricityPrice.toFixed(2) + ' cents/kWh' : ''}
                `;
                
                // Add tooltip functionality
                locationDisplay.querySelectorAll('.tooltip-icon').forEach(icon => {
                    icon.addEventListener('mouseover', function() {
                        const tooltip = document.createElement('div');
                        tooltip.className = 'tooltip-text';
                        tooltip.textContent = this.getAttribute('title');
                        tooltip.style.position = 'absolute';
                        tooltip.style.left = (this.getBoundingClientRect().left + window.scrollX) + 'px';
                        tooltip.style.top = (this.getBoundingClientRect().bottom + window.scrollY + 5) + 'px';
                        document.body.appendChild(tooltip);
                        
                        this.addEventListener('mouseout', function() {
                            tooltip.remove();
                        }, {once: true});
                    });
                });
                
                console.log("Calculator: Location data extracted from county info panel", {
                    county: countyName,
                    state: stateName,
                    climateZone: currentClimateZone,
                    electricityPrice: currentElectricityPrice
                });
                
                return true;
            }
        }
    } catch (e) {
        console.error("Error extracting location from info panel:", e);
    }
    
    return false;
}

// Connect to the app's showCountyInfo function to update calculator location
function hookIntoMapEvents() {
    console.log("Attempting to hook into map events");
    
    try {
        // Store the original function
        if (typeof window.showCountyInfo === 'function') {
            const originalShowCountyInfo = window.showCountyInfo;
            
            // Override with our new version that also updates the calculator
            window.showCountyInfo = function(e) {
                // Call the original function first
                originalShowCountyInfo(e);
                
                // Then update the calculator location
                updateSelectedLocation(e.target.feature);
            };
            console.log("Successfully hooked into showCountyInfo");
        } else {
            console.error("showCountyInfo function not found in global scope");
            
            // Set up a direct event listener as a fallback
            document.addEventListener('mapFeatureClicked', function(e) {
                console.log("Map feature clicked event received", e.detail);
                if (e.detail && e.detail.feature) {
                    updateSelectedLocation(e.detail.feature);
                }
            });
        }
    } catch (error) {
        console.error("Error hooking into map events:", error);
    }
    
    // Automatically update calculator when a county is selected from the existing UI
    const countyInfoPanel = document.getElementById('county-info');
    if (countyInfoPanel) {
        // Use a MutationObserver to detect when the county info panel content changes
        const observer = new MutationObserver(function(mutations) {
            // Extract location from the panel when it changes
            extractLocationFromInfoPanel();
        });
        
        // Start observing
        observer.observe(countyInfoPanel, { childList: true, subtree: true });
        console.log("MutationObserver set up for county-info panel");
    }
}

// Show the calculator modal
function showCalculator() {
    // On mobile, add a delay to allow users to see the county info first
    if (window.innerWidth < 768) {
        // First make sure the county info is visible
        const infoPanel = document.querySelector('.info-panel');
        if (infoPanel) {
            infoPanel.scrollIntoView({ behavior: 'smooth' });
            
            // Add a button to open calculator instead of showing it automatically
            const openCalculatorBtn = document.createElement('button');
            openCalculatorBtn.className = 'open-calculator-btn';
            openCalculatorBtn.textContent = 'Open Energy Calculator';
            openCalculatorBtn.addEventListener('click', function() {
                document.querySelector('.calculator-panel').style.display = 'block';
                document.querySelector('.modal-backdrop').style.display = 'block';
                document.body.style.overflow = 'hidden'; // Prevent scrolling
                this.style.display = 'none'; // Hide the button
            });
            
            // Remove any existing button before adding a new one
            const existingBtn = document.querySelector('.open-calculator-btn');
            if (existingBtn) {
                existingBtn.remove();
            }
            
            // Add the button to the county info panel
            const countyInfo = document.getElementById('county-info');
            if (countyInfo) {
                countyInfo.appendChild(openCalculatorBtn);
            }
        }
    } else {
        // On desktop, show calculator immediately
        document.querySelector('.calculator-panel').style.display = 'block';
        document.querySelector('.modal-backdrop').style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }
}

// Hide the calculator modal
function hideCalculator() {
    document.querySelector('.calculator-panel').style.display = 'none';
    document.querySelector('.modal-backdrop').style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
    
    // On mobile, show the open calculator button again
    if (window.innerWidth < 768) {
        const openCalculatorBtn = document.querySelector('.open-calculator-btn');
        if (openCalculatorBtn) {
            openCalculatorBtn.style.display = 'block';
        }
    }
    
    // Ensure the page scrolls to where the user was before
    if (window.innerWidth < 768) {
        const infoPanel = document.querySelector('.info-panel');
        if (infoPanel) {
            infoPanel.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

// Update selected location and show calculator
function updateSelectedLocation(feature) {
    if (!feature || !feature.properties) return;
    
    console.log("Calculator: Location selection detected", feature.properties);
    console.log("Feature properties (detailed):", JSON.stringify(feature.properties, null, 2));
    
    // Get county and state name
    const countyName = feature.properties.NAME || feature.properties.COUNTY || feature.properties.County || feature.properties.COUNTY_NAME || feature.properties.country || "Unknown County";
    const stateName = feature.properties.STATE_NAME || feature.properties.STATE || feature.properties.State || "Unknown State";
    
    console.log(`Calculator: County name: "${countyName}", State name: "${stateName}"`);
    
    // Set current county
    currentCounty = {
        name: countyName,
        state: stateName,
        feature: feature
    };
    
    // Get the climate zone information
    if (window.currentClassification === 'iecc') {
        const zoneNum = feature.properties.IECC_2021 || feature.properties.IECC21;
        const moisture = feature.properties.Moisture21 || feature.properties.Moisture15;
        
        if (zoneNum !== undefined) {
            const zoneInt = Math.floor(zoneNum);
            if (zoneInt >= 7) {
                currentClimateZone = String(zoneInt);
            } else if (moisture) {
                currentClimateZone = `${zoneInt}${moisture}`;
            }
        }
    } else {
        currentClimateZone = feature.properties.BA_2021 || feature.properties.BA21;
    }
    
    // Get electricity price for this state
    currentElectricityPrice = window.getElectricityPrice(stateName);
    
    // Update the location display
    const locationDisplay = document.getElementById('selected-location');
    if (currentClimateZone && currentElectricityPrice) {
        const zoneInfo = climateZoneData[currentClimateZone] || defaultClimateData;
        locationDisplay.innerHTML = `
            <strong>${countyName} County, ${stateName}</strong><br>
            Climate Zone: ${currentClimateZone} (${zoneInfo.name})<br>
            <div class="climate-metrics">
                <span>HDD: ${zoneInfo.hdd} <span class="tooltip-icon" title="Heating Degree Days: A measure of how cold a location is over a year. Higher values indicate colder climates that require more heating.">?</span></span>
                <span>CDD: ${zoneInfo.cdd} <span class="tooltip-icon" title="Cooling Degree Days: A measure of how hot a location is over a year. Higher values indicate hotter climates that require more cooling.">?</span></span>
            </div>
            Electricity Price: ${currentElectricityPrice.toFixed(2)} cents/kWh
        `;
        
        // Add tooltip functionality
        locationDisplay.querySelectorAll('.tooltip-icon').forEach(icon => {
            icon.addEventListener('mouseover', function() {
                const tooltip = document.createElement('div');
                tooltip.className = 'tooltip-text';
                tooltip.textContent = this.getAttribute('title');
                tooltip.style.position = 'absolute';
                tooltip.style.left = (this.getBoundingClientRect().left + window.scrollX) + 'px';
                tooltip.style.top = (this.getBoundingClientRect().bottom + window.scrollY + 5) + 'px';
                document.body.appendChild(tooltip);
                
                this.addEventListener('mouseout', function() {
                    tooltip.remove();
                }, {once: true});
            });
        });
    } else {
        locationDisplay.textContent = `${countyName} County, ${stateName} - Missing climate or price data`;
    }
    
    console.log("Calculator: Location updated", {
        county: countyName,
        state: stateName,
        climateZone: currentClimateZone,
        electricityPrice: currentElectricityPrice
    });
    
    // Show the calculator modal
    showCalculator();
}

// Calculate heating and cooling costs based on user inputs
function calculateCosts() {
    console.log("Calculating costs...");
    
    // First, check if we have location data
    if (!currentCounty || !currentClimateZone || !currentElectricityPrice) {
        console.log("Missing location data, attempting to extract from UI...");
        // Try to extract location data from the county info panel
        const locationExtracted = extractLocationFromInfoPanel();
        
        // If we still don't have location data, alert the user
        if (!locationExtracted || !currentCounty || !currentClimateZone || !currentElectricityPrice) {
            alert("Please select a location on the map before calculating costs.");
            return;
        }
    }
    
    // Update electricity price in fuel types
    fuelTypes.electricity.unitCost = currentElectricityPrice / 100; // Convert cents to dollars
    
    // Get user inputs
    const squareFootage = parseFloat(document.getElementById('square-footage').value);
    const wallRValue = parseFloat(document.getElementById('wall-rvalue').value);
    const ceilingRValue = parseFloat(document.getElementById('ceiling-rvalue').value);
    const windowsElement = document.getElementById('window-type');
    const windowType = windowsElement.options[windowsElement.selectedIndex].value;
    const efficiencyElement = document.getElementById('efficiency');
    const efficiencyType = efficiencyElement.options[efficiencyElement.selectedIndex].value;
    
    // Get infiltration rate and impact factor
    let infiltrationRate = 0.5; // Default to average
    let infiltrationRateKey = 'average'; // Default key
    const infiltrationElement = document.getElementById('infiltration');
    if (infiltrationElement) {
        infiltrationRateKey = infiltrationElement.options[infiltrationElement.selectedIndex].value;
        infiltrationRate = infiltrationRates[infiltrationRateKey];
    }
    
    // Get infiltration impact factor based on tightness level
    const infiltrationImpact = infiltrationImpactFactors[infiltrationRateKey];
    
    let heatingFuelType = 'electricity'; // Default to electricity
    const heatingFuelElement = document.getElementById('heating-fuel');
    if (heatingFuelElement) {
        heatingFuelType = heatingFuelElement.options[heatingFuelElement.selectedIndex].value;
    }
    
    let ductLocation = 'unconditioned'; // Default to unconditioned space
    const ductElement = document.getElementById('duct-location');
    if (ductElement) {
        ductLocation = ductElement.options[ductElement.selectedIndex].value;
    }
    
    // Get heating system type (based on fuel)
    let heatingSystemType = 'electric';
    if (heatingFuelType === 'electricity') {
        const heatSystemElement = document.getElementById('heat-system-type');
        if (heatSystemElement) {
            heatingSystemType = heatSystemElement.options[heatSystemElement.selectedIndex].value;
        }
    } else {
        heatingSystemType = heatingFuelType === 'natural_gas' || heatingFuelType === 'propane' ? 'furnace' : 'boiler';
    }
    
    // Validate inputs
    if (isNaN(squareFootage) || isNaN(wallRValue) || isNaN(ceilingRValue)) {
        alert("Please enter valid numeric values for all fields.");
        return;
    }
    
    // Get climate data based on zone
    const climateData = climateZoneData[currentClimateZone] || defaultClimateData;
    const hdd = climateData.hdd;
    const cdd = climateData.cdd;
    
    // Determine temperature characteristics for efficiency calculations
    const isVeryHotClimate = cdd > 3000;
    const isVeryColdClimate = hdd > 6000;
    const avgWinterTemp = isVeryColdClimate ? 10 : (hdd > 4000 ? 25 : 35);
    const avgSummerTemp = isVeryHotClimate ? 95 : (cdd > 2000 ? 90 : 85);
    
    // Get window U-value
    const windowU = windowUValues[windowType];
    
    // Get duct loss factor
    const ductLoss = ductLossFactors[ductLocation];
    
    // Estimate wall and ceiling area
    const ceilingArea = squareFootage;
    const wallHeight = 9; // Assume 9 foot ceilings
    
    // Improved perimeter calculation - assumes home is rectangular
    // This will give a higher, more realistic perimeter than the square assumption
    const estimatedPerimeter = Math.sqrt(squareFootage) * 4.5; 
    
    // Increased window percentage for more realistic estimates
    const wallArea = estimatedPerimeter * wallHeight;
    const windowArea = wallArea * 0.20; // Increase window area from 15% to 20% of wall area
    const actualWallArea = wallArea - windowArea;
    
    // Calculate heat loss coefficients (U = 1/R for each component)
    const wallU = 1 / wallRValue;
    const ceilingU = 1 / ceilingRValue;
    
    // Calculate total heat loss per degree day through building envelope
    const wallLoss = actualWallArea * wallU;
    const ceilingLoss = ceilingArea * ceilingU;
    const windowLoss = windowArea * windowU;
    const envelopeLoss = wallLoss + ceilingLoss + windowLoss;
    
    // Calculate infiltration heat loss - improved formula with increased factor
    // Formula: Q = 0.018 × CFM × ΔT, where CFM = ACH × Volume / 60
    const buildingVolume = squareFootage * wallHeight;
    const airChangesPerHour = infiltrationRate;
    const cfm = airChangesPerHour * buildingVolume / 60;
    
    // Enhanced infiltration calculation with infiltration impact factor
    // Base factor increased from 0.022 to 0.025
    const infiltrationLossPerDegree = 0.025 * cfm * infiltrationImpact;
    
    // Weather exposure factor - adjusts infiltration based on climate severity
    let weatherExposureFactor = 1.0;
    if (isVeryColdClimate) {
        // More impact in cold climates due to stack effect and wind pressure
        weatherExposureFactor = infiltrationRateKey === 'leaky' ? 1.35 : 1.2; 
    } else if (isVeryHotClimate) {
        // Some impact in hot climates
        weatherExposureFactor = infiltrationRateKey === 'leaky' ? 1.2 : 1.1;
    }
    
    // Apply weather exposure factor to infiltration loss
    const adjustedInfiltrationLoss = infiltrationLossPerDegree * weatherExposureFactor;
    
    // Total heat loss per degree including infiltration
    const totalLossPerDegree = envelopeLoss + adjustedInfiltrationLoss;
    
    // Add extra factor for thermal mass effects in different climate types
    let thermalMassFactor = 1.0;
    if (isVeryColdClimate) {
        thermalMassFactor = 1.15; // Cold climates need more energy due to thermal mass effects
    } else if (isVeryHotClimate) {
        thermalMassFactor = 1.08; // Hot climates have some thermal mass effects
    }
    
    // Adjust heating and cooling energy for actual conditions including duct losses & system cycling
    const adjustedHeatingLoss = totalLossPerDegree * SEASONAL_ADJUSTMENT * (1 + ductLoss) * CYCLING_FACTOR * thermalMassFactor; 
    const adjustedCoolingLoss = totalLossPerDegree * SEASONAL_ADJUSTMENT * (1 + ductLoss) * CYCLING_FACTOR;
    
    // Calculate heating and cooling energy in BTU
    const heatingEnergyBtu = adjustedHeatingLoss * hdd * HOURS_PER_DAY * PART_LOAD_FACTOR;
    const coolingEnergyBtu = adjustedCoolingLoss * cdd * HOURS_PER_DAY * PART_LOAD_FACTOR;
    
    // Get efficiency of heating system based on type, fuel, and temperature
    let heatingEfficiency;
    if (heatingSystemType === 'heat_pump') {
        // Heat pump efficiency varies with temperature
        const tempDiff = (47 - avgWinterTemp) / 10; // How many 10°F increments below 47°F
        const heatPumpData = efficiencyFactors[efficiencyType].heating.heat_pump;
        heatingEfficiency = Math.max(1.0, heatPumpData.base + (tempDiff * heatPumpData.tempFactor));
    } else if (heatingSystemType === 'electric') {
        heatingEfficiency = efficiencyFactors[efficiencyType].heating.electric;
    } else {
        heatingEfficiency = efficiencyFactors[efficiencyType].heating[heatingSystemType];
    }
    
    // Get cooling efficiency (varies with outdoor temperature)
    const tempDiffCooling = Math.max(0, (avgSummerTemp - 95) / 10); // How many 10°F increments above 95°F
    const coolingEfficiency = Math.max(2.0, efficiencyFactors[efficiencyType].cooling.base + 
                                          (tempDiffCooling * efficiencyFactors[efficiencyType].cooling.tempFactor));
    
    // Convert BTU to appropriate fuel units and apply efficiency
    let heatingFuelUnits, coolingElectricityKwh;
    
    if (heatingFuelType === 'electricity') {
        // For electric heating (resistance or heat pump), convert BTU to kWh
        heatingFuelUnits = heatingEnergyBtu / fuelTypes.electricity.btuPerUnit / heatingEfficiency;
    } else {
        // For other fuels (gas, propane, oil), convert BTU to appropriate fuel units
        heatingFuelUnits = heatingEnergyBtu / fuelTypes[heatingFuelType].btuPerUnit / heatingEfficiency;
    }
    
    // Cooling is always electric
    coolingElectricityKwh = coolingEnergyBtu / fuelTypes.electricity.btuPerUnit / coolingEfficiency;
    
    // Calculate costs
    const heatingCost = heatingFuelUnits * fuelTypes[heatingFuelType].unitCost;
    const coolingCost = coolingElectricityKwh * fuelTypes.electricity.unitCost;
    const totalCost = heatingCost + coolingCost;
    
    // Calculate carbon emissions (lbs of CO2)
    const heatingEmissions = heatingFuelUnits * fuelTypes[heatingFuelType].co2PerUnit;
    const coolingEmissions = coolingElectricityKwh * fuelTypes.electricity.co2PerUnit;
    const totalEmissions = heatingEmissions + coolingEmissions;
    
    // Update the results display
    document.getElementById('heating-cost').textContent = `$${heatingCost.toFixed(2)}`;
    document.getElementById('cooling-cost').textContent = `$${coolingCost.toFixed(2)}`;
    document.getElementById('total-cost').textContent = `$${totalCost.toFixed(2)}`;
    
    // Show emissions if the element exists
    const emissionsElement = document.getElementById('carbon-emissions');
    if (emissionsElement) {
        emissionsElement.textContent = `${Math.round(totalEmissions)} lbs CO₂`;
    }
    
    // Update chart
    updateEnergyChart(heatingCost, coolingCost);
    
    // Store detailed results for recommendations
    const results = {
        squareFootage,
        wallRValue,
        ceilingRValue,
        windowType,
        infiltrationRate,
        heatingFuelType,
        heatingSystemType,
        efficiencyType,
        climateZone: currentClimateZone,
        heatingCost,
        coolingCost,
        totalCost,
        heatingEmissions,
        coolingEmissions,
        totalEmissions,
        envelopeLoss,
        infiltrationLoss: infiltrationLossPerDegree,
        ductLoss
    };
    
    // Update efficiency recommendations
    updateRecommendations(results, climateData);
    
    // Show results
    document.getElementById('cost-results').classList.remove('hidden');
    
    // Scroll to the results
    const resultsElement = document.getElementById('cost-results');
    resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    console.log("Calculation details:", results);
    
    return results;
}

// Update the energy chart
function updateEnergyChart(heatingCost, coolingCost) {
    // Update chart data
    energyChart.data.datasets[0].data = [heatingCost, coolingCost];
    
    // Update labels with cost
    energyChart.data.labels = [
        `Heating ($${heatingCost.toFixed(2)})`, 
        `Cooling ($${coolingCost.toFixed(2)})`
    ];
    
    // Render updates
    energyChart.update();
}

// Update efficiency recommendations based on results
function updateRecommendations(results, climateData) {
    const recommendationsList = document.getElementById('efficiency-recommendations');
    recommendationsList.innerHTML = ''; // Clear existing recommendations
    
    const totalCost = results.totalCost;
    const isHeatingDominant = results.heatingCost > results.coolingCost;
    const isCoolingDominant = results.coolingCost > results.heatingCost;
    
    // Get climate characteristics
    const isColdClimate = climateData.hdd > 4000;
    const isHotClimate = climateData.cdd > 2000;
    const isModerateClimate = !isColdClimate && !isHotClimate;
    
    // Add general recommendation
    const generalRec = document.createElement('li');
    generalRec.innerHTML = `<strong>Total annual energy cost:</strong> $${totalCost.toFixed(2)} for ${results.squareFootage} sq ft home.`;
    recommendationsList.appendChild(generalRec);
    
    // Add carbon emissions recommendation
    const emissionsRec = document.createElement('li');
    emissionsRec.innerHTML = `<strong>Annual carbon emissions:</strong> ${Math.round(results.totalEmissions)} pounds of CO₂ (equivalent to driving approximately ${Math.round(results.totalEmissions/22)} miles in an average car).`;
    recommendationsList.appendChild(emissionsRec);
    
    // Targeted recommendations based on collected data
    
    // Air infiltration recommendations - greatly enhanced section
    if (results.infiltrationRate >= infiltrationRates.leaky) {
        const potentialSavings = Math.round((results.heatingCost + results.coolingCost) * 0.3);
        addRecommendation(recommendationsList, `<strong>High air leakage detected:</strong> Your home has very leaky construction (${infiltrationRates.leaky} air changes per hour). Air sealing could save approximately $${potentialSavings} per year on heating and cooling costs.`);
        addRecommendation(recommendationsList, 'Professional air sealing is strongly recommended. Focus on attic air sealing, weatherstripping doors/windows, sealing rim joists, and addressing leaks around vents and utility penetrations.');
        addRecommendation(recommendationsList, 'A blower door test would help identify the major sources of air leakage in your home.');
    } else if (results.infiltrationRate >= infiltrationRates.average) {
        const potentialSavings = Math.round((results.heatingCost + results.coolingCost) * 0.15);
        addRecommendation(recommendationsList, `<strong>Moderate air leakage:</strong> Your home has average air leakage (${infiltrationRates.average} air changes per hour). Improving air sealing could save approximately $${potentialSavings} per year.`);
        addRecommendation(recommendationsList, 'Focus on weatherstripping doors and windows, sealing obvious gaps around pipes and vents, and adding gaskets to electrical outlets on exterior walls.');
    } else {
        addRecommendation(recommendationsList, `<strong>Good air sealing:</strong> Your home has tight construction (${infiltrationRates.tight} air changes per hour). Maintain this by addressing any new leaks promptly and ensuring proper ventilation for indoor air quality.`);
    }
    
    // Duct recommendations
    if (results.ductLoss > 0.1) {
        addRecommendation(recommendationsList, 'Sealing and insulating ductwork could reduce energy losses by up to 20%.');
        
        if (results.ductLoss >= 0.25) {
            addRecommendation(recommendationsList, 'Moving ducts into conditioned space or upgrading to a ductless system would significantly improve efficiency.');
        }
    }
    
    // Fuel-specific recommendations
    if (results.heatingFuelType === 'electricity' && results.heatingSystemType === 'electric' && isColdClimate) {
        addRecommendation(recommendationsList, 'Consider upgrading to a heat pump which can be 2-3 times more efficient than electric resistance heating in your climate.');
    }
    
    // Heat pump recommendations based on climate
    if (results.heatingSystemType === 'heat_pump') {
        if (isColdClimate) {
            addRecommendation(recommendationsList, 'Consider a cold-climate heat pump designed to maintain efficiency at lower temperatures.');
        }
    }
    
    // Fuel switching recommendations where appropriate
    if (isColdClimate) {
        if (results.heatingFuelType === 'electricity' && results.heatingSystemType === 'electric') {
            addRecommendation(recommendationsList, 'In your cold climate, a high-efficiency gas furnace might provide lower operating costs than electric resistance heating.');
        } else if (results.heatingFuelType === 'fuel_oil') {
            addRecommendation(recommendationsList, 'Switching from oil to natural gas or a high-efficiency heat pump could reduce both costs and emissions.');
        }
    } else if (isModerateClimate || isHotClimate) {
        if (results.heatingFuelType !== 'electricity') {
            addRecommendation(recommendationsList, 'In your climate, a high-efficiency heat pump might provide both heating and cooling more efficiently than your current system.');
        }
    }
    
    // Window recommendations
    if (results.windowType === 'single') {
        addRecommendation(recommendationsList, 'Upgrading from single-pane to double-pane windows could reduce heat loss through windows by up to 50%.');
    } else if (results.windowType === 'double' && isColdClimate) {
        addRecommendation(recommendationsList, 'In your cold climate, upgrading to Low-E or triple-pane windows could further reduce heat loss by 20-30%.');
    }
    
    // Insulation recommendations
    if (isColdClimate && results.wallRValue < 21) {
        addRecommendation(recommendationsList, 'Increasing wall insulation to R-21+ would be very beneficial in your cold climate.');
    } else if (isHotClimate && results.ceilingRValue < 49) {
        addRecommendation(recommendationsList, 'Increasing attic insulation to R-49+ is especially important in your hot climate to reduce cooling costs.');
    }
    
    // System efficiency recommendations
    if (results.efficiencyType === 'standard') {
        addRecommendation(recommendationsList, 'Upgrading to a high-efficiency HVAC system could reduce your energy consumption by 15-30%.');
    }
    
    // Primary focus recommendation based on climate and costs
    if (isHeatingDominant && results.heatingCost > 1000) {
        addRecommendation(recommendationsList, 'Your heating costs are high - focus on improving insulation, reducing air leakage, and upgrading heating equipment.');
    } else if (isCoolingDominant && results.coolingCost > 1000) {
        addRecommendation(recommendationsList, 'Your cooling costs are high - consider shade trees, cool roofing, and a more efficient air conditioning system.');
    }
    
    // Potential savings summary
    let potentialSavings = 0;
    if (results.infiltrationRate >= infiltrationRates.leaky) potentialSavings += 0.3;
    if (results.ductLoss >= 0.15) potentialSavings += 0.15;
    if (results.windowType === 'single') potentialSavings += 0.15;
    if (results.efficiencyType === 'standard') potentialSavings += 0.20;
    if (isColdClimate && results.wallRValue < 19) potentialSavings += 0.10;
    
    if (potentialSavings > 0) {
        const savingsEstimate = Math.round(results.totalCost * potentialSavings);
        addRecommendation(recommendationsList, `<strong>Potential savings:</strong> Making the recommended upgrades could save approximately $${savingsEstimate} per year on energy costs.`);
    }
}

// Helper to add a recommendation to the list
function addRecommendation(list, text) {
    const item = document.createElement('li');
    item.innerHTML = text;
    list.appendChild(item);
}

// Initialize calculator
document.addEventListener('DOMContentLoaded', function() {
    // Add modal backdrop
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    document.body.appendChild(modalBackdrop);

    // Add close button to calculator
    const closeButton = document.createElement('button');
    closeButton.className = 'calculator-close';
    closeButton.innerHTML = '&times;';
    closeButton.setAttribute('aria-label', 'Close calculator');
    closeButton.addEventListener('click', hideCalculator);
    document.querySelector('.calculator-panel').appendChild(closeButton);

    // Allow clicking on backdrop to close
    modalBackdrop.addEventListener('click', hideCalculator);

    // Calculate button click handler
    document.getElementById('calculate-costs').addEventListener('click', calculateCosts);
    
    // Fuel type change handler
    const heatingFuelSelect = document.getElementById('heating-fuel');
    const electricHeatOptions = document.querySelector('.electric-heat-options');
    
    if (heatingFuelSelect && electricHeatOptions) {
        // Set initial visibility
        toggleElectricHeatOptions();
        
        // Add change listener
        heatingFuelSelect.addEventListener('change', toggleElectricHeatOptions);
        
        function toggleElectricHeatOptions() {
            if (heatingFuelSelect.value === 'electricity') {
                electricHeatOptions.style.display = 'block';
            } else {
                electricHeatOptions.style.display = 'none';
            }
        }
    }
    
    // Initialize empty chart
    const ctx = document.getElementById('energy-chart').getContext('2d');
    energyChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Heating', 'Cooling'],
            datasets: [{
                data: [50, 50],
                backgroundColor: ['#3498db', '#e74c3c'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Try to hook into map events
    setTimeout(hookIntoMapEvents, 1000);
}); 