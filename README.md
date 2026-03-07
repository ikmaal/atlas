# ATLAS - Singapore OpenStreetMap Monitor

A real-time dashboard for tracking and monitoring OpenStreetMap changesets in the Singapore region.

## Features

- 🗺️ Real-time changeset tracking for Singapore
- 📊 Visual statistics and metrics
- 👥 User contribution tracking
- 🗓️ Timeline view of recent changes
- ⚠️ **Validation System** - Automatic detection of suspicious changesets
- 🗺️ **Map Search** - Search for locations in Singapore
- 🎨 Modern, responsive UI with tabbed interface

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

4. Open your browser and navigate to:
```
http://localhost:5000
```

## How It Works

The dashboard uses the OpenStreetMap API to fetch changesets for the Singapore bounding box:
- Latitude: 1.15° to 1.48° N
- Longitude: 103.59° to 104.05° E
- Time range: Past 365 days (1 year)

Changesets are fetched and displayed with:
- User information
- Number of changes (added, modified, deleted)
- Comments and descriptions
- Timestamp
- Map visualization
- Top contributors statistics
- **Validation status** (valid/warning/suspicious)

## Validation System

The dashboard automatically validates changesets to detect suspicious patterns:

### Validation Levels:
- **✓ Valid** (Green): Normal changesets
- **🔍 Needs Review** (Orange): Changesets requiring manual review
  - 50+ deletions detected
  - Requires verification that deletions are appropriate

### Detection Criteria:
- **Mass deletions**: 50 or more elements deleted in a single changeset

Hover over validation badges to see the exact deletion count.

## Technologies Used

- **Backend**: Python Flask
- **Frontend**: HTML5, CSS3, JavaScript
- **Maps**: Leaflet.js with OpenStreetMap tiles
- **API**: OpenStreetMap Changeset API
