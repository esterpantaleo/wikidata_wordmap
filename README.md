### DATA CLEANING

#### GEOJSON DOWNLOAD
The map was downloaded world from https://ec.europa.eu/eurostat/web/gisco/geodata/reference-data/administrative-units-statistical-units/countries
version
{
  "Administrative or statistical unit": "Countries 2016",
  "Version date": 01/12/2018,
  "Scale": "1:1 Million",
  "File format to download": "geoJSON"
}

#### GEOJSON SIMPLIFICATION
The geoJSON was simplified using mapshaper to reduce the file size.

#### MISSING LANGUAGE? ####
This can happen for various reasons:
* Missing label: just add translation to Wikidata item
* Translation is missing for any word: make sure that language item has coordinates (P625) set. https://wals.info/languoid can be used as source.
