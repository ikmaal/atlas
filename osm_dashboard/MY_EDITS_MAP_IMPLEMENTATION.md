# 🗺️ My Edits Map View Implementation

This guide shows you how to add a map view to the "My Edits" tab.

---

## 📝 Step 1: Update HTML (templates/index.html)

### Find the "My Edits Tab" section (around line 282-303)

**Replace this:**
```html
                    <!-- My Edits Tab -->
                    <div class="tab-content" id="my-edits">
                        <div class="content-grid">
                            <!-- My Changesets -->
                            <div class="card changesets-card-full">
                                <div class="card-header">
                                    <h2>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        My Changesets in Singapore
                                    </h2>
                                    <div class="loading-spinner" id="myEditsLoading"></div>
                                </div>
                                
                                <div class="changesets-list" id="myEditsList">
                                    <!-- User's changesets will be populated here -->
                                </div>
                            </div>
                        </div>
                    </div>
```

**With this:**
```html
                    <!-- My Edits Tab -->
                    <div class="tab-content" id="my-edits">
                        <div class="content-grid">
                            <!-- My Changesets Map -->
                            <div class="card map-card">
                                <div class="card-header">
                                    <h2>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                                            <line x1="8" y1="2" x2="8" y2="18"></line>
                                            <line x1="16" y1="6" x2="16" y2="22"></line>
                                        </svg>
                                        My Edits Map
                                    </h2>
                                </div>
                                
                                <div id="myEditsMap" style="height: 500px; width: 100%;">
                                    <!-- Map will be initialized here -->
                                </div>
                            </div>

                            <!-- My Changesets List -->
                            <div class="card contributors-card">
                                <div class="card-header">
                                    <h2>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        My Changesets
                                    </h2>
                                    <div class="loading-spinner" id="myEditsLoading"></div>
                                </div>
                                
                                <div class="contributors-list" id="myEditsList" style="max-height: 500px; overflow-y: auto;">
                                    <!-- User's changesets will be populated here -->
                                </div>
                            </div>
                        </div>
                    </div>
```

---

## 📝 Step 2: Update JavaScript (static/script.js)

### 2.1: Update Global Variables (lines 1-11)

**Replace:**
```javascript
// Global variables
let map;
let markers = [];
let markerCluster;
let changesets = [];
let mapViewMode = 'changes'; // 'changes' or 'validation'
let currentFilters = {
    search: '',
    validity: 'all',
    timePeriod: '30d'
};
```

**With:**
```javascript
// Global variables
let map;
let myEditsMap;
let markers = [];
let myEditsMarkers = [];
let markerCluster;
let myEditsMarkerCluster;
let changesets = [];
let myEditsChangesets = [];
let mapViewMode = 'changes'; // 'changes' or 'validation'
let currentFilters = {
    search: '',
    validity: 'all',
    timePeriod: '30d'
};
```

### 2.2: Add Initialize My Edits Map Function

**Add this function after the `initMap()` function (around line 150):**

```javascript
// Initialize My Edits map
function initMyEditsMap() {
    if (myEditsMap) {
        return; // Already initialized
    }
    
    const singaporeCenter = [1.3521, 103.8198];
    
    myEditsMap = L.map('myEditsMap').setView(singaporeCenter, 11);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(myEditsMap);
    
    // Add a rectangle showing the monitored area
    const bounds = [[1.15, 103.59], [1.48, 104.05]];
    L.rectangle(bounds, {
        color: '#1a1a1a',
        weight: 2,
        fillOpacity: 0.05
    }).addTo(myEditsMap);

    // Initialize marker cluster group
    myEditsMarkerCluster = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let size = 'small';
            if (count > 100) size = 'large';
            else if (count > 50) size = 'medium';
            
            return L.divIcon({
                html: '<div><span>' + count + '</span></div>',
                className: 'marker-cluster marker-cluster-' + size,
                iconSize: L.point(40, 40)
            });
        }
    });
    myEditsMap.addLayer(myEditsMarkerCluster);
}

// Update My Edits map with changesets
function updateMyEditsMap(changesets) {
    if (!myEditsMap || !myEditsMarkerCluster) {
        console.error('My Edits map not initialized');
        return;
    }
    
    // Clear existing markers
    myEditsMarkerCluster.clearLayers();
    myEditsMarkers = [];
    
    // Add new markers
    changesets.forEach(cs => {
        if (cs.bbox && cs.bbox.min_lat && cs.bbox.max_lat && cs.bbox.min_lon && cs.bbox.max_lon) {
            // Calculate center of bounding box
            const centerLat = (cs.bbox.min_lat + cs.bbox.max_lat) / 2;
            const centerLon = (cs.bbox.min_lon + cs.bbox.max_lon) / 2;
            
            // Create marker with color based on changes
            const fillColor = getColorForChanges(cs.num_changes);
            
            const marker = L.circleMarker([centerLat, centerLon], {
                radius: Math.min(Math.log(cs.num_changes + 1) * 4, 20) + 5,
                fillColor: fillColor,
                color: '#fff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.85
            });
            
            // Build popup content
            let detailsHTML = '';
            if (cs.details) {
                detailsHTML = `
                    <div style="margin-top: 8px;">
                        <strong>Edit Breakdown:</strong><br>
                        ➕ Created: ${formatNumber(cs.details.total_created)}<br>
                        ✏️ Modified: ${formatNumber(cs.details.total_modified)}<br>
                        🗑️ Deleted: ${formatNumber(cs.details.total_deleted)}
                    </div>
                `;
            }
            
            const popupContent = `
                <div class="popup-content">
                    <h3>${escapeHtml(cs.user)}</h3>
                    <p><strong>Changeset:</strong> <a href="https://www.openstreetmap.org/changeset/${cs.id}" target="_blank">#${cs.id}</a></p>
                    <p><strong>Changes:</strong> ${formatNumber(cs.num_changes)}</p>
                    <p><strong>Comment:</strong> ${escapeHtml(cs.comment)}</p>
                    <p><strong>Editor:</strong> ${escapeHtml(cs.created_by)}</p>
                    <p><strong>Date:</strong> ${formatDate(cs.created_at)}</p>
                    ${detailsHTML}
                </div>
            `;
            
            marker.bindPopup(popupContent);
            myEditsMarkerCluster.addLayer(marker);
            myEditsMarkers.push(marker);
        }
    });
    
    // Fit bounds to show all markers if there are any
    if (myEditsMarkers.length > 0) {
        setTimeout(() => {
            myEditsMap.fitBounds(myEditsMarkerCluster.getBounds(), {
                padding: [50, 50],
                maxZoom: 13
            });
        }, 100);
    }
}
```

### 2.3: Update loadMyEdits() Function (around line 773)

**Find this section (around line 804-830):**
```javascript
        }
        
        container.innerHTML = changesets.map(cs => {
            const detailsHTML = `<span class="badge badge-changes">${formatNumber(cs.num_changes)} changes</span>`;
```

**Replace the ENTIRE `loadMyEdits()` function with:**
```javascript
// Load user's changesets
async function loadMyEdits() {
    const container = document.getElementById('myEditsList');
    const loading = document.getElementById('myEditsLoading');
    
    if (loading) loading.style.display = 'block';
    
    try {
        const response = await fetch('/api/user/changesets');
        
        if (!response.ok) {
            throw new Error('Failed to load changesets');
        }
        
        const data = await response.json();
        const changesets = data.changesets;
        
        // Store globally
        myEditsChangesets = changesets;
        
        if (!changesets || changesets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <h3>No Changesets Found</h3>
                    <p>You haven't made any changesets in Singapore yet.</p>
                </div>
            `;
            return;
        }
        
        // Build detailed HTML
        container.innerHTML = changesets.map(cs => {
            let detailsHTML = '';
            if (cs.details) {
                const details = cs.details;
                const parts = [];
                if (details.total_created > 0) {
                    parts.push(`<span class="badge badge-created">➕ ${formatNumber(details.total_created)} added</span>`);
                }
                if (details.total_modified > 0) {
                    parts.push(`<span class="badge badge-modified">✏️ ${formatNumber(details.total_modified)} modified</span>`);
                }
                if (details.total_deleted > 0) {
                    parts.push(`<span class="badge badge-deleted">🗑️ ${formatNumber(details.total_deleted)} deleted</span>`);
                }
                detailsHTML = parts.join(' ');
            } else {
                detailsHTML = `<span class="badge badge-changes">${formatNumber(cs.num_changes)} changes</span>`;
            }
            
            return `
            <div class="changeset-item">
                <div class="changeset-header">
                    <div>
                        <div class="changeset-user">${escapeHtml(cs.user)}</div>
                        <div class="changeset-comment">${escapeHtml(cs.comment)}</div>
                    </div>
                    <div class="changeset-header-right">
                        <a href="https://www.openstreetmap.org/changeset/${cs.id}" target="_blank" class="changeset-id">
                            #${cs.id}
                        </a>
                    </div>
                </div>
                <div class="changeset-meta">
                    ${detailsHTML}
                    <span class="badge badge-editor">${escapeHtml(cs.created_by)}</span>
                    <span>📅 ${formatDate(cs.created_at)}</span>
                    <span>🕐 ${formatTime(cs.created_at)}</span>
                </div>
            </div>
            `;
        }).join('');
        
        // Update map with changesets
        updateMyEditsMap(changesets);
        
    } catch (error) {
        console.error('Error loading my edits:', error);
        container.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>Error Loading Changesets</h3>
                <p>Could not load your changesets. Please try again later.</p>
            </div>
        `;
    } finally {
        if (loading) loading.style.display = 'none';
    }
}
```

### 2.4: Update initTabs() Function (around line 852)

**Find this section in `initTabs()`:**
```javascript
            // Load specific tab content
            if (targetTab === 'map-view' && map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            } else if (targetTab === 'my-edits') {
                loadMyEdits();
            }
```

**Replace with:**
```javascript
            // Load specific tab content
            if (targetTab === 'map-view' && map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            } else if (targetTab === 'my-edits') {
                // Initialize map if not already done
                if (!myEditsMap) {
                    initMyEditsMap();
                }
                // Load data
                loadMyEdits();
                // Invalidate map size to ensure proper display
                setTimeout(() => {
                    if (myEditsMap) {
                        myEditsMap.invalidateSize();
                    }
                }, 100);
            }
```

---

## ✅ What You'll Get

### Visual Layout
- **Left side (8 columns):** Interactive map showing all your changesets with clustering
- **Right side (4 columns):** Scrollable list of your changesets with details

### Map Features
- 🗺️ **Cluster markers** when zoomed out
- 🎯 **Auto-zoom** to fit all your changesets
- 📍 **Click markers** to see popup with details
- 🎨 **Color-coded** by changeset size (blue → yellow → red)
- 📊 **Detailed popups** with edit breakdown

### List Features
- 📝 Full changeset details
- ➕✏️🗑️ Edit type badges (created, modified, deleted)
- 🔗 Direct links to OpenStreetMap
- 📅 Date and time stamps
- 🛠️ Editor information

---

## 🎯 Testing

1. **Login** to your OSM account
2. **Click "My Edits"** in sidebar
3. **Wait for data** to load
4. **See your changesets** on both map and list
5. **Click markers** to see details
6. **Zoom/pan** to explore your contributions

---

## 🎨 Customization

### Change Map Height
In `index.html`, find:
```html
<div id="myEditsMap" style="height: 500px; width: 100%;">
```

Change `500px` to your preferred height.

### Change List Height
In `index.html`, find:
```html
<div class="contributors-list" id="myEditsList" style="max-height: 500px; overflow-y: auto;">
```

Change `500px` to match your map height.

---

## 🚀 Done!

Your "My Edits" tab now has a beautiful map view showing all your contributions! 🗺️✨

