#!/usr/bin/env python3
"""
Convert IECC Climate Zone shapefile to GeoJSON for web mapping application.
This script will read the shapefile, simplify geometries for web performance,
and export a GeoJSON file.
"""

import os
import geopandas as gpd
from shapely.geometry import mapping
import json
import numpy as np

def convert_shapefile_to_geojson(input_shapefile, output_geojson, simplify_tolerance=None):
    """
    Convert a shapefile to GeoJSON with optional simplification.
    
    Parameters:
    input_shapefile (str): Path to the input shapefile
    output_geojson (str): Path to save the output GeoJSON
    simplify_tolerance (float, optional): Tolerance for simplifying geometries.
        Higher values = more simplification = smaller file size but less precision.
    """
    # Read shapefile using geopandas
    print(f"Reading shapefile from {input_shapefile}")
    gdf = gpd.read_file(input_shapefile)
    
    # Check for and print data information
    print(f"Shapefile contains {len(gdf)} features")
    print("Columns:", gdf.columns.tolist())
    
    # Sample a few records to understand the data
    print("\nSample data (first 3 records):")
    print(gdf.head(3))
    
    # Make sure we're working with the right coordinate system for web mapping
    # Web maps typically use WGS84 (EPSG:4326)
    if gdf.crs and gdf.crs != "EPSG:4326":
        print(f"Converting CRS from {gdf.crs} to EPSG:4326 (WGS84)")
        gdf = gdf.to_crs("EPSG:4326")
    
    # Simplify geometries if tolerance is provided
    if simplify_tolerance:
        print(f"Simplifying geometries with tolerance {simplify_tolerance}")
        gdf['geometry'] = gdf['geometry'].simplify(simplify_tolerance, preserve_topology=True)
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(output_geojson), exist_ok=True)
    
    # Save to GeoJSON
    print(f"Saving GeoJSON to {output_geojson}")
    gdf.to_file(output_geojson, driver='GeoJSON')
    
    # Calculate file size
    output_size = os.path.getsize(output_geojson) / (1024 * 1024)  # Size in MB
    print(f"GeoJSON file created: {output_size:.2f} MB")
    
    # Generate color scheme and zone info for the web application
    generate_zone_info(gdf, os.path.dirname(output_geojson))
    
    return True

def generate_zone_info(gdf, output_dir):
    """
    Generate JSON files with information about climate zones and colors
    for the web application.
    """
    # Get unique climate zones
    if 'IECC21' in gdf.columns:
        zones = gdf['IECC21'].unique().tolist()
        # Filter out None values and handle NaN values
        zones = [z for z in zones if z is not None and not (isinstance(z, float) and np.isnan(z))]
        zones.sort()
        
        # Create a color scheme (you can refine this)
        colors = {
            "1": "#ffeda0",  # Light yellow for zone 1 (hot)
            "2": "#feb24c",  # Orange for zone 2
            "3": "#f03b20",  # Red-orange for zone 3
            "4": "#bd0026",  # Red for zone 4 (mixed)
            "5": "#98D8C8",  # Light teal for zone 5
            "6": "#43A2CA",  # Medium blue for zone 6
            "7": "#0868ac",  # Deep blue for zone 7
            "8": "#253494"   # Deep navy for zone 8 (cold)
        }
        
        # For zones with moisture designations (A, B, C) or descriptive terms
        for zone in zones:
            zone_str = str(zone)
            base_num = zone_str[0] if zone_str and zone_str[0].isdigit() else ""
            if base_num and base_num in colors:
                if len(zone_str) > 1:
                    # For zones like "3A", "4C", etc. - use a variant of the base color
                    alpha = 0.7 if 'A' in zone_str else 0.85 if 'B' in zone_str else 1.0
                    colors[zone_str] = colors[base_num]  # Use same color with variant (will handle in JS)
            else:
                # For non-standard zones, generate a default color
                colors[zone_str] = "#999999"  # Gray for undefined
        
        # Write zone information to a JSON file
        zone_info = {
            "zones": zones,
            "colors": colors
        }
        
        # Custom JSON encoder to handle NaN values
        class NpEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, np.floating):
                    if np.isnan(obj):
                        return None  # Convert NaN to null in JSON
                    return float(obj)
                return super(NpEncoder, self).default(obj)
        
        with open(os.path.join(output_dir, "zone_info.json"), "w") as f:
            json.dump(zone_info, f, indent=2, cls=NpEncoder)
        
        print(f"Generated zone information with {len(zones)} unique zones")
    else:
        print("Warning: IECC21 column not found in data")

if __name__ == "__main__":
    # Input shapefile
    input_shapefile = "ClimateZoneDataFiles/ClimateZones.shp"
    
    # Output GeoJSON
    output_geojson = "data/climate_zones.geojson"
    
    # Run conversion
    # Using a tolerance of 0.001 degrees (roughly 100m) for simplification
    # Adjust this value based on your precision needs and file size constraints
    convert_shapefile_to_geojson(input_shapefile, output_geojson, simplify_tolerance=0.001) 