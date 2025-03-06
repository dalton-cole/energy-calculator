# US Climate Zones Interactive Map

An interactive web map to visualize and explore the IECC 2021 Climate Zone classifications for counties across the United States.

## Features

- Interactive map displaying all US counties colored by their IECC 2021 climate zone
- Filter counties by climate zone or state
- View detailed information for each county including:
  - IECC 2021 Climate Zone
  - IECC 2015 Climate Zone (for comparison)
  - Moisture regime
- Responsive design that works on desktop and mobile devices

## Data Source

This application uses climate zone data from the International Energy Conservation Code (IECC) 2021 update. The source data is provided as shapefiles in the `ClimateZoneDataFiles` directory.

## Technical Details

The application converts the ESRI Shapefile format to GeoJSON using a Python script and then displays the data on an interactive web map using:

- Leaflet.js for the interactive mapping
- HTML/CSS/JavaScript for the front-end interface
- GeoPandas (Python) for shapefile processing

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3.x with GeoPandas (only needed if you want to regenerate the GeoJSON from the shapefile)

### Setup

1. Clone this repository
2. Open `index.html` in your web browser

If you need to regenerate the GeoJSON from the shapefile:

1. Set up a Python virtual environment: `python -m venv venv`
2. Activate the environment: `source venv/bin/activate` (Unix/Mac) or `venv\Scripts\activate` (Windows)
3. Install dependencies: `pip install geopandas shapely`
4. Run the conversion script: `python convert_to_geojson.py`

## Project Structure

```
├── ClimateZoneDataFiles/  # Original shapefiles (IECC 2021 Climate Zones)
├── css/                   # CSS styles
│   └── styles.css         # Main stylesheet
├── data/                  # Processed data files
│   ├── climate_zones.geojson  # Converted GeoJSON file
│   └── zone_info.json     # Information about climate zones and colors
├── js/                    # JavaScript files
│   └── app.js             # Main application code
├── convert_to_geojson.py  # Python script to convert shapefile to GeoJSON
├── index.html             # Main HTML page
└── README.md              # This file
```

## License

This project is provided for educational and reference purposes.

## Acknowledgments

- IECC for providing the climate zone classifications
- OpenStreetMap for base map tiles
- Leaflet.js for the mapping library 