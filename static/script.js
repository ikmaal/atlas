// Global variables
let map;
let myEditsMap;
let markers = [];
let myEditsMarkers = [];
let markerCluster;
let myEditsMarkerCluster;
let changesets = [];
let myEditsChangesets = [];
let mapViewMode = 'validation'; // Always show validation colors
let currentCommentChangesetId = null;
let visualizationLayer = null; // Layer for AI visualization
let myEditsVisualizationLayer = null; // Layer for My Edits AI visualization

// Validation visibility state
let validationVisibility = {
    valid: true,
    needs_review: true
};

let currentFilters = {
    search: '',
    validity: 'all',
    timePeriod: '30d',
    keyword: ''
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    loadData();

    // Set up tab switching
    initTabs();

    // Set up filters
    initFilters();

    // Set up map search
    initMapSearch();

    // Set up map legend and view toggle
    initMapControls();

    // Load user profile
    loadUserProfile();

    // Auto-refresh every 5 minutes
    setInterval(loadData, 5 * 60 * 1000);
});

// Initialize tab functionality
function initTabs() {
    const sidenavItems = document.querySelectorAll('.sidenav-item');

    sidenavItems.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            sidenavItems.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // Add active class to clicked button and corresponding content
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

            // Hide/show stats grid based on tab
            const container = document.querySelector('.container');
            if (targetTab === 'atlas-ai') {
                container.classList.add('hide-stats');
            } else {
                container.classList.remove('hide-stats');
            }

            // Invalidate map size when switching to map view
            if (targetTab === 'map-view' && map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
        });
    });
}

// Toggle filters visibility
function toggleFilters() {
    const filtersContainer = document.getElementById('filtersContainer');
    const filterToggleBtn = document.getElementById('filterToggleBtn');
    
    if (filtersContainer.style.display === 'none') {
        filtersContainer.style.display = 'flex';
        filterToggleBtn.classList.add('active');
    } else {
        filtersContainer.style.display = 'none';
        filterToggleBtn.classList.remove('active');
    }
}

// Initialize filter functionality
function initFilters() {
    const searchInput = document.getElementById('searchFilter');
    const keywordInput = document.getElementById('keywordFilter');
    const timePeriodSelect = document.getElementById('timePeriodFilter');
    const filterButtons = document.querySelectorAll('.filter-btn');

    // Search input filter (username)
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            currentFilters.search = e.target.value.toLowerCase();
            applyFilters();
        });
    }

    // Keyword input filter (changeset comment)
    if (keywordInput) {
        keywordInput.addEventListener('input', function(e) {
            currentFilters.keyword = e.target.value.toLowerCase();
            applyFilters();
        });
    }

    // Time period select filter
    if (timePeriodSelect) {
        timePeriodSelect.addEventListener('change', function(e) {
            currentFilters.timePeriod = e.target.value;
            applyFilters();
        });
    }

    // Validity filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update filter
            currentFilters.validity = this.getAttribute('data-filter');
            applyFilters();
        });
    });
}

// Apply filters to changesets
function applyFilters() {
    if (!changesets || changesets.length === 0) return;

    let filtered = changesets.filter(cs => {
        // Filter by search (username)
        const matchesSearch = currentFilters.search === '' || 
                             cs.user.toLowerCase().includes(currentFilters.search);

        // Filter by keyword (changeset comment)
        const matchesKeyword = currentFilters.keyword === '' || 
                              cs.comment.toLowerCase().includes(currentFilters.keyword);

        // Filter by validity
        const validityStatus = cs.validation ? cs.validation.status : 'valid';
        const matchesValidity = currentFilters.validity === 'all' || 
                               validityStatus === currentFilters.validity;

        // Filter by time period
        let matchesTimePeriod = true;
        if (currentFilters.timePeriod !== 'all') {
            const now = new Date();
            const changesetDate = new Date(cs.created_at);
            let cutoffDate;

            switch(currentFilters.timePeriod) {
                case '24h':
                    cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    cutoffDate = null;
            }

            if (cutoffDate) {
                matchesTimePeriod = changesetDate >= cutoffDate;
            }
        }

        return matchesSearch && matchesKeyword && matchesValidity && matchesTimePeriod;
    });

    updateChangesetsList(filtered);
    updateMap(filtered);
}

// Initialize Leaflet map
function initMap() {
    console.log('🗺️ Initializing map...');
    
    // Singapore coordinates
    const singaporeCenter = [1.3521, 103.8198];
    
    map = L.map('map').setView(singaporeCenter, 11);
    console.log('✅ Map initialized');
    
    // Add CartoDB Light tile layer (clean, modern style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd'
    }).addTo(map);

    // Initialize marker cluster group
    markerCluster = L.markerClusterGroup({
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
    map.addLayer(markerCluster);
    console.log('✅ Marker cluster initialized');
}
// Initialize My Edits map
function initMyEditsMap() {
    if (myEditsMap) {
        return; // Already initialized
    }
    
    const singaporeCenter = [1.3521, 103.8198];
    
    myEditsMap = L.map('myEditsMap').setView(singaporeCenter, 11);
    
    // Add CartoDB Light tile layer (clean, modern style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd'
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
            
            // Create marker with color based on validation status
            const fillColor = getColorForValidation(cs.validation);
            
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



// Load all data
async function loadData() {
    showLoading(true);
    
    try {
        // Fetch changesets and statistics in parallel
        const [changesetsResponse, statsResponse] = await Promise.all([
            fetch('/api/changesets'),
            fetch('/api/statistics')
        ]);
        
        const changesetsData = await changesetsResponse.json();
        const statsData = await statsResponse.json();
        
        console.log('📊 Changesets API response:', changesetsData);
        console.log('📊 Number of changesets:', changesetsData.changesets?.length);
        
        if (changesetsData.success) {
            changesets = changesetsData.changesets;
            console.log('✅ Setting changesets array:', changesets.length);
            updateChangesetsList(changesets);
            console.log('✅ Updated changesets list');
            updateMap(changesets);
            console.log('✅ Updated map');
        } else {
            console.error('❌ Changesets API returned success: false');
        }
        
        if (statsData.success) {
            updateStatistics(statsData.statistics);
            updateContributorsList(statsData.statistics.top_contributors);
        }
        
        updateLastUpdateTime();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load data. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Update statistics cards
function updateStatistics(stats) {
    document.getElementById('totalChangesets').textContent = formatNumber(stats.total_changesets);
    document.getElementById('totalChanges').textContent = formatNumber(stats.total_changes);
    document.getElementById('uniqueUsers').textContent = formatNumber(stats.unique_users);
    
    // Animate the numbers
    animateValue('totalChangesets', 0, stats.total_changesets, 1000);
    animateValue('totalChanges', 0, stats.total_changes, 1000);
    animateValue('uniqueUsers', 0, stats.unique_users, 1000);
}

// Update changesets list
function updateChangesetsList(changesets) {
    const container = document.getElementById('changesetsList');
    
    if (!changesets || changesets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>No Changesets Found</h3>
                <p>No recent changesets in the Singapore region.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = changesets.map(cs => {
        let detailsHTML = '';
        if (cs.details) {
            const details = cs.details;
            
            // Debug: Log first changeset details
            if (cs === changesets[0]) {
                console.log('First changeset details:', {
                    id: cs.id,
                    details: cs.details,
                    total_created: details.total_created,
                    total_modified: details.total_modified,
                    total_deleted: details.total_deleted
                });
            }
            
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
        
        // Add validation badge
        let validationHTML = '';
        if (cs.validation) {
            const validation = cs.validation;
            if (validation.status === 'needs_review') {
                const reasons = validation.reasons.join(', ');
                validationHTML = `<span class="badge badge-needs-review" title="${escapeHtml(reasons)}">🔍 Needs Review</span>`;
            } else {
                validationHTML = `<span class="badge badge-valid">✓ Valid</span>`;
            }
        }
        
        return `
        <div class="changeset-item ${cs.validation && cs.validation.status !== 'valid' ? 'changeset-flagged' : ''}">
            <div class="changeset-header">
                <div>
                    <div class="changeset-user"><a href="javascript:void(0)" onclick="openUserProfile('${escapeHtml(cs.user)}')" class="user-link">${escapeHtml(cs.user)}</a></div>
                    <div class="changeset-comment">${escapeHtml(cs.comment)}</div>
                </div>
                <div class="changeset-header-right">
                    ${validationHTML}
                    <button class="comparison-btn" onclick="showChangesetComparison('${cs.id}')" title="Compare before/after changes">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                        </svg>
                        Compare
                    </button>
                    <a href="https://osmcha.org/changesets/${cs.id}" target="_blank" class="osmcha-btn" title="Analyze in OSMCha">
                        OSMCha
                    </a>
                    <button class="comment-btn" onclick="openCommentModal('${cs.id}', '${escapeHtml(cs.user)}', '${escapeHtml(cs.comment)}')" title="Add comment">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </button>
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
}

// Update contributors list
function updateContributorsList(contributors) {
    const container = document.getElementById('contributorsList');
    
    if (!contributors || contributors.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                </svg>
                <h3>No Contributors</h3>
                <p>No contributor data available.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = contributors.map((contributor, index) => `
        <div class="contributor-item">
            <div class="contributor-rank">${index + 1}</div>
            <div class="contributor-info">
                <div class="contributor-name"><a href="javascript:void(0)" onclick="openUserProfile('${escapeHtml(contributor.user)}')" class="user-link">${escapeHtml(contributor.user)}</a></div>
                <div class="contributor-stats">
                    <div class="stat-row">
                        <span class="stat-label">Changesets:</span>
                        <span class="stat-value-inline">${formatNumber(contributor.changesets)}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Changes:</span>
                        <span class="stat-value-inline">${formatNumber(contributor.total_changes)}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Update map with changeset markers
function updateMap(changesets) {
    console.log('🗺️ updateMap called with', changesets?.length, 'changesets');
    
    if (!markerCluster) {
        console.error('❌ markerCluster not initialized!');
        return;
    }
    
    // Clear existing markers from cluster
    markerCluster.clearLayers();
    markers = [];
    
    let markersCreated = 0;
    
    // Add new markers
    changesets.forEach(cs => {
        if (cs.bbox && cs.bbox.min_lat && cs.bbox.max_lat && cs.bbox.min_lon && cs.bbox.max_lon) {
            // Calculate center of bounding box
            const centerLat = (cs.bbox.min_lat + cs.bbox.max_lat) / 2;
            const centerLon = (cs.bbox.min_lon + cs.bbox.max_lon) / 2;
            
            // Always use validation colors
            const fillColor = getColorForValidation(cs.validation);
            
            // Create marker (larger and more visible)
            const marker = L.circleMarker([centerLat, centerLon], {
                radius: Math.min(Math.log(cs.num_changes + 1) * 4, 20) + 5,
                fillColor: fillColor,
                color: '#fff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.85
            });
            
            // Build popup content
            let validationBadge = '';
            if (cs.validation) {
                const status = cs.validation.status;
                const badgeClass = `badge-${status}`;
                const badgeText = status === 'valid' ? '✓ Valid' : 
                                 '🔍 Needs Review';
                validationBadge = `<span class="badge ${badgeClass}">${badgeText}</span>`;
            }
            
            const popupContent = `
                <div class="popup-content">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <h3 style="margin: 0;">${escapeHtml(cs.user)}</h3>
                        ${validationBadge}
                    </div>
                    <p style="margin: 4px 0;"><strong>${formatNumber(cs.num_changes)} changes</strong></p>
                    <p style="margin: 8px 0; font-size: 0.85rem;">${escapeHtml(cs.comment)}</p>
                    <p style="margin: 4px 0; font-size: 0.75rem; color: #666;">${formatDate(cs.created_at)} at ${formatTime(cs.created_at)}</p>
                    <p style="margin: 8px 0 0 0;"><a href="https://www.openstreetmap.org/changeset/${cs.id}" target="_blank" style="color: #1a1a1a; font-weight: 600;">View on OSM →</a></p>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            markers.push(marker);
            markerCluster.addLayer(marker);
            markersCreated++;
        }
    });
    
    console.log('🗺️ Created', markersCreated, 'markers out of', changesets.length, 'changesets');
    
    // Update legend
    updateLegend();
}

// Get color based on number of changes
function getColorForChanges(numChanges) {
    if (numChanges < 10) return '#10b981';  // Green - small changes
    if (numChanges < 50) return '#3b82f6';  // Blue - medium changes
    if (numChanges < 100) return '#f59e0b'; // Orange - large changes
    return '#ef4444';                        // Red - very large changes
}

// Get color based on validation status
function getColorForValidation(validation) {
    if (!validation) return '#10b981'; // Default to green/valid
    switch(validation.status) {
        case 'valid':
            return '#10b981';      // Green
        case 'needs_review':
            return '#f59e0b';      // Orange/Yellow
        default:
            return '#10b981';      // Default green
    }
}

// Update map legend (validation only)
function updateLegend() {
    const legendContent = document.getElementById('legendContent');
    if (!legendContent) return;
    
    legendContent.innerHTML = `
        <div class="legend-item interactive ${validationVisibility.valid ? 'active' : 'inactive'}" onclick="toggleValidationVisibility('valid')">
            <span class="legend-color" style="background: #10b981;"></span>
            <span class="legend-label">✓ Valid</span>
            <span class="legend-toggle">${validationVisibility.valid ? '👁️' : '👁️‍🗨️'}</span>
        </div>
        <div class="legend-item interactive ${validationVisibility.needs_review ? 'active' : 'inactive'}" onclick="toggleValidationVisibility('needs_review')">
            <span class="legend-color" style="background: #f59e0b;"></span>
            <span class="legend-label">🔍 Needs Review</span>
            <span class="legend-toggle">${validationVisibility.needs_review ? '👁️' : '👁️‍🗨️'}</span>
        </div>
    `;
}

// Toggle validation visibility
function toggleValidationVisibility(type) {
    validationVisibility[type] = !validationVisibility[type];
    updateLegend();
    updateMapVisibility();
}

// Update map markers based on visibility settings
function updateMapVisibility() {
    if (!changesets || changesets.length === 0) return;
    
    // Filter changesets based on visibility settings
    const filteredChangesets = changesets.filter(cs => {
        const status = cs.validation?.status || 'valid';
        return validationVisibility[status];
    });
    
    // Update map with filtered changesets
    updateMap(filteredChangesets);
}

// Initialize map controls (legend only)
function initMapControls() {
    // Initialize legend
    updateLegend();
}

// Update last update time
function updateLastUpdateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
}

// Show/hide loading spinner
function showLoading(show) {
    const spinner = document.getElementById('changesetsLoading');
    if (show) {
        spinner.classList.remove('hidden');
    } else {
        spinner.classList.add('hidden');
    }
}

// Show error message
function showError(message) {
    console.error(message);
    // You could add a toast notification here
}

// Utility functions
function formatNumber(num) {
    return num.toLocaleString();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    
    // Normalize both dates to midnight in local timezone for accurate day comparison
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Calculate difference in days
    const diffTime = nowOnly - dateOnly;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 0 && diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-SG', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-SG', { 
        hour: '2-digit', 
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function animateValue(id, start, end, duration) {
    const element = document.getElementById(id);
    const range = end - start;
    const increment = range / (duration / 16); // 60fps
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = formatNumber(Math.floor(current));
    }, 16);
}

// Initialize map search functionality
let searchMarker = null;
let searchDebounceTimer = null;
let selectedResultIndex = -1;

function initMapSearch() {
    const searchInput = document.getElementById('mapSearch');
    const searchClear = document.getElementById('mapSearchClear');
    const searchResults = document.getElementById('mapSearchResults');

    if (!searchInput) return;

    // Handle search input with debounce
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();
        selectedResultIndex = -1;
        
        // Show/hide clear button
        if (query) {
            searchClear.style.display = 'flex';
        } else {
            searchClear.style.display = 'none';
            searchResults.style.display = 'none';
            return;
        }

        // Debounce search
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            searchLocation(query);
        }, 500);
    });
    
    // Keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        const items = searchResults.querySelectorAll('.map-search-result-item');
        if (items.length === 0) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedResultIndex = Math.min(selectedResultIndex + 1, items.length - 1);
            updateSelectedResult(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedResultIndex = Math.max(selectedResultIndex - 1, -1);
            updateSelectedResult(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedResultIndex >= 0 && selectedResultIndex < items.length) {
                items[selectedResultIndex].click();
            }
        } else if (e.key === 'Escape') {
            searchResults.style.display = 'none';
            this.blur();
        }
    });

    // Handle clear button
    searchClear.addEventListener('click', function() {
        searchInput.value = '';
        searchClear.style.display = 'none';
        searchResults.style.display = 'none';
        
        // Remove search marker if exists
        if (searchMarker) {
            map.removeLayer(searchMarker);
            searchMarker = null;
        }
        
        // Reset map view to Singapore
        map.setView([1.3521, 103.8198], 12);
    });

    // Close results when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

// Helper functions for advanced search
function updateSelectedResult(items) {
    items.forEach((item, index) => {
        if (index === selectedResultIndex) {
            item.style.background = '#f3f4f6';
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.style.background = '';
        }
    });
}

function getLocationIcon(type) {
    const icons = {
        'road': '🛣️',
        'building': '🏢',
        'railway': '🚇',
        'station': '🚇',
        'amenity': '📍',
        'place': '🏙️',
        'shop': '🛒',
        'tourism': '🎡',
        'leisure': '🌳'
    };
    return icons[type] || '📍';
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
}

function attachSearchResultHandlers() {
    const searchResults = document.getElementById('mapSearchResults');
    searchResults.querySelectorAll('.map-search-result-item').forEach(item => {
        item.addEventListener('click', function() {
            const lat = parseFloat(this.dataset.lat);
            const lon = parseFloat(this.dataset.lon);
            const name = this.dataset.name || this.querySelector('.map-search-result-name').textContent.trim();
            
            // Move map to location
            map.setView([lat, lon], 16);
            
            // Remove old search marker if exists
            if (searchMarker) {
                map.removeLayer(searchMarker);
            }
            
            // Add new marker
            searchMarker = L.marker([lat, lon], {
                icon: L.divIcon({
                    className: 'search-marker',
                    html: '<div style="background: #ef4444; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                })
            }).addTo(map);
            
            searchMarker.bindPopup(`<strong>${escapeHtml(name)}</strong>`).openPopup();
            
            // Hide results
            searchResults.style.display = 'none';
        });
    });
}

// Search for location using Nominatim API
async function searchLocation(query) {
    const searchResults = document.getElementById('mapSearchResults');
    
    try {
        // Show loading
        searchResults.innerHTML = '<div class="map-search-no-results">Searching...</div>';
        searchResults.style.display = 'block';

        // Search within Singapore bounding box
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `format=json&` +
            `q=${encodeURIComponent(query)}&` +
            `countrycodes=sg&` +
            `limit=5&` +
            `bounded=1&` +
            `viewbox=103.59,1.48,104.05,1.15`
        );

        if (!response.ok) throw new Error('Search failed');

        const results = await response.json();

        if (results.length === 0) {
            searchResults.innerHTML = '<div class="map-search-no-results">No results found</div>';
            return;
        }

        // Get current map center for distance calculation
        const center = map.getCenter();

        // Display results with enhanced features
        searchResults.innerHTML = results.map(result => {
            const name = result.name || result.display_name.split(',')[0];
            const distance = calculateDistance(center.lat, center.lng, result.lat, result.lon);
            const icon = getLocationIcon(result.type || result.class);
            
            return `
                <div class="map-search-result-item" data-lat="${result.lat}" data-lon="${result.lon}" data-name="${escapeHtml(name)}" data-address="${escapeHtml(result.display_name)}">
                    <div class="map-search-result-name">
                        <span style="margin-right: 6px;">${icon}</span>
                        ${escapeHtml(name)}
                    </div>
                    <div class="map-search-result-address">
                        ${escapeHtml(result.display_name)}
                        <span style="color: #3b82f6; margin-left: 8px; font-weight: 500;">• ${distance} km</span>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers using the shared function
        attachSearchResultHandlers();

    } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = '<div class="map-search-no-results">Search failed. Please try again.</div>';
    }
}

// Load user profile
async function loadUserProfile() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        const userSection = document.getElementById('userSection');
        const myEditsBtn = document.getElementById('myEditsBtn');
        
        if (data.logged_in) {
            const user = data.user;
            
            // Show My Edits button
            myEditsBtn.style.display = 'flex';
            
            // Display user profile
            userSection.innerHTML = `
                <div class="user-profile" onclick="openUserProfile('${escapeHtml(user.display_name)}')" style="cursor: pointer;" title="View your profile">
                    ${user.img_url ? `<img src="${escapeHtml(user.img_url)}" alt="${escapeHtml(user.display_name)}" class="user-avatar">` : 
                    `<div class="user-avatar-placeholder">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </div>`}
                    <div class="user-info">
                        <div class="user-name">${escapeHtml(user.display_name)}</div>
                        <div class="user-stats-small">${formatNumber(user.changeset_count)} changesets</div>
                    </div>
                    <button class="logout-btn" onclick="event.stopPropagation(); logout();" title="Logout">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </button>
                </div>
            `;
        } else {
            // Show login button
            myEditsBtn.style.display = 'none';
            userSection.innerHTML = `
                <a href="/oauth/login" class="login-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                        <polyline points="10 17 15 12 10 7"></polyline>
                        <line x1="15" y1="12" x2="3" y2="12"></line>
                    </svg>
                    <span>Login with OSM</span>
                </a>
            `;
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

// Logout function
function logout() {
    window.location.href = '/oauth/logout';
}

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
                        <div class="changeset-user"><a href="javascript:void(0)" onclick="openUserProfile('${escapeHtml(cs.user)}')" class="user-link">${escapeHtml(cs.user)}</a></div>
                        <div class="changeset-comment">${escapeHtml(cs.comment)}</div>
                    </div>
                    <div class="changeset-header-right">
                        <button class="comparison-btn" onclick="showChangesetComparison('${cs.id}')" title="Compare before/after changes">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="16 18 22 12 16 6"></polyline>
                                <polyline points="8 6 2 12 8 18"></polyline>
                            </svg>
                            Compare
                        </button>
                        <button class="ai-btn" onclick="visualizeChangesetOnMyEditsMap('${cs.id}')" title="Atlas Intelligence: Visualize changeset on map">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M2 12h20"></path>
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                            </svg>
                            <span class="ai-btn-text">AI</span>
                        </button>
                        <a href="https://osmcha.org/changesets/${cs.id}" target="_blank" class="osmcha-btn" title="Analyze in OSMCha">
                            OSMCha
                        </a>
                        <button class="comment-btn" onclick="openCommentModal('${cs.id}', '${escapeHtml(cs.user)}', '${escapeHtml(cs.comment)}')" title="Add comment">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </button>
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


// Update initTabs to handle My Edits tab
const originalInitTabs = initTabs;
function initTabs() {
    const sidenavItems = document.querySelectorAll('.sidenav-item');

    sidenavItems.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            sidenavItems.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // Add active class to clicked button and corresponding content
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

            // Hide/show stats grid based on tab
            const container = document.querySelector('.container');
            if (targetTab === 'atlas-ai') {
                container.classList.add('hide-stats');
            } else {
                container.classList.remove('hide-stats');
            }

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
        });
    });
}


// Comment functionality
function openCommentModal(changesetId, changesetUser, changesetComment) {
    // Check if user is logged in
    fetch('/api/user')
        .then(response => response.json())
        .then(data => {
            if (!data.logged_in) {
                alert('Please login to comment on changesets');
                return;
            }
            
            currentCommentChangesetId = changesetId;
            
            // Update modal with changeset info
            const infoDiv = document.getElementById('commentChangesetInfo');
            infoDiv.innerHTML = `
                <div style="margin-bottom: 15px; padding: 10px; background: var(--bg-primary); border-radius: 6px;">
                    <strong>Changeset #${changesetId}</strong><br>
                    <span style="color: var(--text-secondary); font-size: 0.85rem;">by ${escapeHtml(changesetUser)}</span><br>
                    <span style="font-size: 0.85rem; font-style: italic;">"${escapeHtml(changesetComment)}"</span>
                </div>
            `;
            
            // Clear previous content
            document.getElementById('commentText').value = '';
            document.getElementById('commentError').style.display = 'none';
            document.getElementById('commentSuccess').style.display = 'none';
            
            // Show modal
            document.getElementById('commentModal').style.display = 'flex';
        })
        .catch(error => {
            console.error('Error checking login status:', error);
            alert('Please login to comment on changesets');
        });
}

function closeCommentModal() {
    document.getElementById('commentModal').style.display = 'none';
    currentCommentChangesetId = null;
}

async function submitComment() {
    const commentText = document.getElementById('commentText').value.trim();
    const errorDiv = document.getElementById('commentError');
    const successDiv = document.getElementById('commentSuccess');
    const submitBtn = document.getElementById('submitCommentBtn');
    
    // Hide previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    // Validate
    if (!commentText) {
        errorDiv.textContent = 'Please enter a comment';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!currentCommentChangesetId) {
        errorDiv.textContent = 'No changeset selected';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Disable button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Posting...</span>';
    
    try {
        const response = await fetch(`/api/changeset/${currentCommentChangesetId}/comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ comment: commentText })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            successDiv.textContent = 'Comment posted successfully!';
            successDiv.style.display = 'block';
            document.getElementById('commentText').value = '';
            
            // Close modal after 2 seconds
            setTimeout(() => {
                closeCommentModal();
            }, 2000);
        } else {
            errorDiv.textContent = data.error || 'Failed to post comment';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error posting comment:', error);
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Post Comment
        `;
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('commentModal');
    if (modal && event.target === modal) {
        closeCommentModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('commentModal');
        if (modal && modal.style.display === 'flex') {
            closeCommentModal();
        }
    }
});

// Open OSM Editor at current map location
function openOSMEditor() {
    if (!map) {
        alert('Map not initialized');
        return;
    }
    
    // Get current map center and zoom
    const center = map.getCenter();
    const zoom = map.getZoom();
    
    // OpenStreetMap editor URL format:
    // https://www.openstreetmap.org/edit?editor=id#map=zoom/lat/lon
    const osmEditorUrl = `https://www.openstreetmap.org/edit?editor=id#map=${zoom}/${center.lat}/${center.lng}`;
    
    // Open in new tab
    window.open(osmEditorUrl, '_blank');
}

// Atlas Intelligence: Visualize changeset on map
async function visualizeChangeset(changesetId) {
    if (!map) {
        alert('Map not initialized');
        return;
    }
    
    try {
        // Switch to map view
        const mapViewTab = document.querySelector('[data-tab="map-view"]');
        if (mapViewTab) {
            mapViewTab.click();
        }
        
        // Clear previous visualization
        if (visualizationLayer) {
            map.removeLayer(visualizationLayer);
        }
        
        // Create a new layer group for visualization
        visualizationLayer = L.layerGroup().addTo(map);
        
        // Show loading indicator
        const loadingMsg = L.popup()
            .setLatLng(map.getCenter())
            .setContent('<div style="text-align: center;"><strong>🤖 Atlas Intelligence</strong><br/>Loading changeset data...</div>')
            .openOn(map);
        
        // Fetch changeset data from OSM API
        const response = await fetch(`https://api.openstreetmap.org/api/0.6/changeset/${changesetId}/download`);
        if (!response.ok) {
            throw new Error(`Failed to fetch changeset: ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Close loading message
        map.closePopup();
        
        // Parse and visualize the data
        const stats = parseAndVisualizeChangeset(xmlDoc, visualizationLayer, map);
        
        // Show summary popup
        const summaryContent = `
            <div style="text-align: center; min-width: 200px;">
                <h3 style="margin: 0 0 10px 0; color: #3b82f6; font-size: 1rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 5px;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M2 12h20"></path>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    Atlas Intelligence
                </h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; font-size: 0.85rem;">
                    <div style="background: #dcfce7; padding: 8px; border-radius: 6px;">
                        <div style="font-weight: 700; color: #16a34a;">${stats.created.nodes + stats.created.ways}</div>
                        <div style="font-size: 0.75rem; color: #15803d;">Created</div>
                    </div>
                    <div style="background: #fef3c7; padding: 8px; border-radius: 6px;">
                        <div style="font-weight: 700; color: #d97706;">${stats.modified.nodes + stats.modified.ways}</div>
                        <div style="font-size: 0.75rem; color: #b45309;">Modified</div>
                    </div>
                    <div style="background: #fee2e2; padding: 8px; border-radius: 6px; grid-column: span 2;">
                        <div style="font-weight: 700; color: #dc2626;">${stats.deleted.nodes + stats.deleted.ways}</div>
                        <div style="font-size: 0.75rem; color: #b91c1c;">Deleted</div>
                    </div>
                </div>
                <div style="font-size: 0.75rem; color: #666; margin-top: 8px;">
                    🟢 Green: Created | 🟡 Yellow: Modified | 🔴 Red: Deleted
                </div>
            </div>
        `;
        
        L.popup()
            .setLatLng(stats.center || map.getCenter())
            .setContent(summaryContent)
            .openOn(map);
        
        // Fit map to visualization bounds if available
        if (stats.bounds && stats.bounds.isValid()) {
            map.fitBounds(stats.bounds, { padding: [50, 50] });
        }
        
    } catch (error) {
        console.error('Error visualizing changeset:', error);
        alert(`Failed to visualize changeset: ${error.message}`);
        
        // Clean up
        if (visualizationLayer) {
            map.removeLayer(visualizationLayer);
            visualizationLayer = null;
        }
    }
}

// Visualize changeset on My Edits map
async function visualizeChangesetOnMyEditsMap(changesetId) {
    if (!myEditsMap) {
        alert('My Edits map not initialized');
        return;
    }
    
    try {
        // Clear previous visualization
        if (myEditsVisualizationLayer) {
            myEditsMap.removeLayer(myEditsVisualizationLayer);
        }
        
        // Create a new layer group for visualization
        myEditsVisualizationLayer = L.layerGroup().addTo(myEditsMap);
        
        // Show loading indicator
        const loadingMsg = L.popup()
            .setLatLng(myEditsMap.getCenter())
            .setContent('<div style="text-align: center;"><strong>🤖 Atlas Intelligence</strong><br/>Loading changeset data...</div>')
            .openOn(myEditsMap);
        
        // Fetch changeset data from OSM API
        const response = await fetch(`https://api.openstreetmap.org/api/0.6/changeset/${changesetId}/download`);
        if (!response.ok) {
            throw new Error(`Failed to fetch changeset: ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Close loading message
        myEditsMap.closePopup();
        
        // Parse and visualize the data
        const stats = parseAndVisualizeChangeset(xmlDoc, myEditsVisualizationLayer, myEditsMap);
        
        // Show summary popup
        const summaryContent = `
            <div style="text-align: center; min-width: 200px;">
                <h3 style="margin: 0 0 10px 0; color: #3b82f6; font-size: 1rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 5px;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M2 12h20"></path>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    Atlas Intelligence
                </h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; font-size: 0.85rem;">
                    <div style="background: #dcfce7; padding: 8px; border-radius: 6px;">
                        <div style="font-weight: 700; color: #16a34a;">${stats.created.nodes + stats.created.ways}</div>
                        <div style="font-size: 0.75rem; color: #15803d;">Created</div>
                    </div>
                    <div style="background: #fef3c7; padding: 8px; border-radius: 6px;">
                        <div style="font-weight: 700; color: #d97706;">${stats.modified.nodes + stats.modified.ways}</div>
                        <div style="font-size: 0.75rem; color: #b45309;">Modified</div>
                    </div>
                    <div style="background: #fee2e2; padding: 8px; border-radius: 6px; grid-column: span 2;">
                        <div style="font-weight: 700; color: #dc2626;">${stats.deleted.nodes + stats.deleted.ways}</div>
                        <div style="font-size: 0.75rem; color: #b91c1c;">Deleted</div>
                    </div>
                </div>
                <div style="font-size: 0.75rem; color: #666; margin-top: 8px;">
                    🟢 Green: Created | 🟡 Yellow: Modified | 🔴 Red: Deleted
                </div>
            </div>
        `;
        
        L.popup()
            .setLatLng(stats.center || myEditsMap.getCenter())
            .setContent(summaryContent)
            .openOn(myEditsMap);
        
        // Fit map to visualization bounds if available
        if (stats.bounds && stats.bounds.isValid()) {
            myEditsMap.fitBounds(stats.bounds, { padding: [50, 50] });
        }
        
    } catch (error) {
        console.error('Error visualizing changeset:', error);
        alert(`Failed to visualize changeset: ${error.message}`);
        
        // Clean up
        if (myEditsVisualizationLayer) {
            myEditsMap.removeLayer(myEditsVisualizationLayer);
            myEditsVisualizationLayer = null;
        }
    }
}

// Parse changeset XML and visualize on map
function parseAndVisualizeChangeset(xmlDoc, layerGroup, mapInstance) {
    const stats = {
        created: { nodes: 0, ways: 0 },
        modified: { nodes: 0, ways: 0 },
        deleted: { nodes: 0, ways: 0 },
        bounds: null,
        center: null
    };
    
    // Store all nodes by ID for way rendering
    const allNodes = {};
    
    // Colors for different actions
    const colors = {
        create: '#22c55e',  // Green
        modify: '#eab308',  // Yellow
        delete: '#ef4444'   // Red
    };
    
    const bounds = L.latLngBounds();
    
    // First pass: collect all nodes
    ['create', 'modify', 'delete'].forEach(action => {
        const actionElement = xmlDoc.querySelector(action);
        if (actionElement) {
            const nodes = actionElement.querySelectorAll('node');
            nodes.forEach(node => {
                const id = node.getAttribute('id');
                const lat = parseFloat(node.getAttribute('lat'));
                const lon = parseFloat(node.getAttribute('lon'));
                
                if (lat && lon) {
                    allNodes[id] = { lat, lon, action };
                }
            });
        }
    });
    
    // Second pass: render nodes and ways
    ['create', 'modify', 'delete'].forEach(action => {
        const actionElement = xmlDoc.querySelector(action);
        if (!actionElement) return;
        
        const color = colors[action];
        const actionKey = action === 'create' ? 'created' : action === 'modify' ? 'modified' : 'deleted';
        
        // Render nodes as circle markers
        const nodes = actionElement.querySelectorAll('node');
        nodes.forEach(node => {
            const lat = parseFloat(node.getAttribute('lat'));
            const lon = parseFloat(node.getAttribute('lon'));
            
            if (lat && lon) {
                const latlng = L.latLng(lat, lon);
                bounds.extend(latlng);
                
                // Create circle marker for node
                L.circleMarker(latlng, {
                    radius: 5,
                    fillColor: color,
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup(`
                    <div style="font-size: 0.85rem;">
                        <strong>${action.toUpperCase()} Node</strong><br/>
                        ID: ${node.getAttribute('id')}<br/>
                        Lat: ${lat.toFixed(6)}<br/>
                        Lon: ${lon.toFixed(6)}
                    </div>
                `).addTo(layerGroup);
                
                stats[actionKey].nodes++;
            }
        });
        
        // Render ways as polylines
        const ways = actionElement.querySelectorAll('way');
        ways.forEach(way => {
            const wayNodes = way.querySelectorAll('nd');
            const coordinates = [];
            
            wayNodes.forEach(nd => {
                const ref = nd.getAttribute('ref');
                if (allNodes[ref]) {
                    const nodeData = allNodes[ref];
                    coordinates.push([nodeData.lat, nodeData.lon]);
                    bounds.extend([nodeData.lat, nodeData.lon]);
                }
            });
            
            if (coordinates.length >= 2) {
                L.polyline(coordinates, {
                    color: color,
                    weight: 4,
                    opacity: 0.8,
                    smoothFactor: 1
                }).bindPopup(`
                    <div style="font-size: 0.85rem;">
                        <strong>${action.toUpperCase()} Way</strong><br/>
                        ID: ${way.getAttribute('id')}<br/>
                        Nodes: ${coordinates.length}
                    </div>
                `).addTo(layerGroup);
                
                stats[actionKey].ways++;
            }
        });
    });
    
    stats.bounds = bounds;
    if (bounds.isValid()) {
        stats.center = bounds.getCenter();
    }
    
    return stats;
}

// User Profile Functions
async function openUserProfile(username) {
    const modal = document.getElementById('profileModal');
    const loading = document.getElementById('profileLoading');
    const content = document.getElementById('profileContent');
    const error = document.getElementById('profileError');
    
    // Show modal
    modal.style.display = 'flex';
    loading.style.display = 'block';
    content.style.display = 'none';
    error.style.display = 'none';
    
    // Set username in header
    document.getElementById('profileUsername').textContent = `${username}'s Profile`;
    
    try {
        // Fetch user profile data
        const profileResponse = await fetch(`/api/profile/${encodeURIComponent(username)}`);
        if (!profileResponse.ok) {
            const errorData = await profileResponse.json();
            throw new Error(errorData.error || 'Failed to fetch profile');
        }
        const profileData = await profileResponse.json();
        
        // Fetch Singapore stats
        const statsResponse = await fetch(`/api/profile/${encodeURIComponent(username)}/singapore-stats`);
        if (!statsResponse.ok) {
            const errorData = await statsResponse.json();
            throw new Error(errorData.error || 'Failed to fetch stats');
        }
        const statsData = await statsResponse.json();
        
        // Hide loading, show content
        loading.style.display = 'none';
        content.style.display = 'block';
        
        // Populate profile data
        displayUserProfile(profileData.user, statsData.stats);
        
    } catch (err) {
        console.error('Error loading profile:', err);
        loading.style.display = 'none';
        error.style.display = 'block';
        
        // Show specific error message
        const errorElement = document.getElementById('profileError');
        errorElement.innerHTML = `<p><strong>Error:</strong> ${err.message}</p><p>User: ${username}</p>`;
    }
}

function displayUserProfile(user, stats) {
    // Basic info
    document.getElementById('profileDisplayName').textContent = user.display_name;
    
    // Avatar
    const avatar = document.getElementById('profileAvatar');
    if (user.img_url) {
        avatar.src = user.img_url;
        avatar.style.display = 'block';
    } else {
        avatar.style.display = 'none';
    }
    
    // Member since
    if (user.account_created) {
        const date = new Date(user.account_created);
        document.getElementById('profileMemberSince').textContent = 
            `Member since ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    }
    
    // External links
    document.getElementById('profileOSMLink').href = `https://www.openstreetmap.org/user/${user.display_name}`;
    document.getElementById('profileOSMChaLink').href = `https://osmcha.org/users/${user.display_name}`;
    document.getElementById('profileHDYCLink').href = `https://hdyc.neis-one.org/?${user.display_name}`;
    
    // Statistics
    document.getElementById('profileTotalChangesets').textContent = stats.total_changesets.toLocaleString();
    document.getElementById('profileTotalChanges').textContent = stats.total_changes.toLocaleString();
    document.getElementById('profileAllTimeChangesets').textContent = user.changesets_count.toLocaleString();
    
    // Edit breakdown
    document.getElementById('profileCreated').textContent = stats.breakdown.created.toLocaleString();
    document.getElementById('profileModified').textContent = stats.breakdown.modified.toLocaleString();
    document.getElementById('profileDeleted').textContent = stats.breakdown.deleted.toLocaleString();
    
    // Validation status
    const total = stats.total_changesets;
    if (total > 0) {
        const validPct = ((stats.validation.valid / total) * 100).toFixed(1);
        const needsReviewPct = ((stats.validation.needs_review / total) * 100).toFixed(1);
        
        document.getElementById('profileValidCount').textContent = 
            `${stats.validation.valid} (${validPct}%)`;
        document.getElementById('profileNeedsReviewCount').textContent = 
            `${stats.validation.needs_review} (${needsReviewPct}%)`;
    }
    
    // Editors used
    const editorsList = document.getElementById('profileEditorsList');
    editorsList.innerHTML = '';
    
    // Sort editors by count
    const sortedEditors = Object.entries(stats.editors).sort((a, b) => b[1] - a[1]);
    
    sortedEditors.forEach(([editor, count]) => {
        const percentage = ((count / stats.total_changesets) * 100).toFixed(1);
        const editorItem = document.createElement('div');
        editorItem.className = 'profile-editor-item';
        editorItem.innerHTML = `
            <div class="profile-editor-name">${escapeHtml(editor)}</div>
            <div class="profile-editor-bar">
                <div class="profile-editor-bar-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="profile-editor-stats">${count} (${percentage}%)</div>
        `;
        editorsList.appendChild(editorItem);
    });
    
    // Recent changesets
    const recentList = document.getElementById('profileRecentChangesets');
    recentList.innerHTML = '';
    
    if (stats.recent_changesets && stats.recent_changesets.length > 0) {
        stats.recent_changesets.forEach(cs => {
            const csItem = document.createElement('div');
            csItem.className = 'profile-recent-changeset-item';
            
            const validationStatus = cs.validation ? cs.validation.status : 'valid';
            const validationClass = validationStatus === 'valid' ? 'badge-valid' : 
                                   'badge-needs-review';
                                const validationText = validationStatus === 'valid' ? '✓ Valid' : '🔍 Needs Review';
            
            csItem.innerHTML = `
                <div class="profile-changeset-header">
                    <a href="https://www.openstreetmap.org/changeset/${cs.id}" target="_blank" class="profile-changeset-link">
                        #${cs.id}
                    </a>
                    <span class="badge ${validationClass}">${validationText}</span>
                </div>
                <div class="profile-changeset-comment">${escapeHtml(cs.comment)}</div>
                <div class="profile-changeset-meta">
                    <span class="badge badge-changes">${cs.num_changes} changes</span>
                    <span>📅 ${formatDate(cs.created_at)}</span>
                </div>
            `;
            recentList.appendChild(csItem);
        });
    } else {
        recentList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No recent changesets in Singapore</p>';
    }
}

function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    modal.style.display = 'none';
}

// Close profile modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('profileModal');
    if (modal && event.target === modal) {
        closeProfileModal();
    }
});

// Close profile modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('profileModal');
        if (modal && modal.style.display === 'flex') {
            closeProfileModal();
        }
    }
});

// ============================================
// NOTES FUNCTIONALITY
// ============================================

let currentNote = null; // For tracking note being edited
let noteImages = [];
let noteLinks = [];
let noteTags = [];
let selectedNoteColor = '#ffffff'; // Default white background

// Popular emojis for the picker
const EMOJIS = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
    '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋',
    '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳',
    '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖',
    '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯',
    '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔',
    '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦',
    '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴',
    '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿',
    '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖',
    '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
    '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
    '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
    '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
    '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂',
    '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁', '👅',
    '👄', '💋', '🩸', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤',
    '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖',
    '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯',
    '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌',
    '🔥', '💧', '🌊', '💨', '☁️', '⛅', '⛈', '🌤', '🌥', '🌦',
    '🌧', '🌨', '🌩', '🌪', '🌫', '🌬', '🌀', '🌈', '⚡', '❄️',
    '⭐', '🌟', '✨', '💫', '🌙', '☀️', '🌞', '🌝', '🌛', '🌜',
    '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒',
    '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬',
    '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀',
    '✅', '❌', '⭕', '❗', '❓', '💯', '🔴', '🟠', '🟡', '🟢',
    '🔵', '🟣', '🟤', '⚫', '⚪', '🟥', '🟧', '🟨', '🟩', '🟦'
];

// Initialize notes
function initNotes() {
    loadNotes();
    
    // Add note button
    document.getElementById('addNoteBtn').addEventListener('click', openAddNoteModal);
    
    // Initialize emoji picker
    initializeEmojiPicker();
    
    // Load notes on startup
    document.addEventListener('DOMContentLoaded', () => {
        loadNotes();
    });
}

// Format text in the editor
function formatText(command) {
    document.execCommand(command, false, null);
    document.getElementById('noteContent').focus();
}

// Initialize emoji picker
function initializeEmojiPicker() {
    const emojiGrid = document.querySelector('.note-emoji-grid');
    emojiGrid.innerHTML = EMOJIS.map(emoji => 
        `<div class="note-emoji-item" onclick="insertEmoji('${emoji}')">${emoji}</div>`
    ).join('');
}

// Toggle emoji picker
function toggleEmojiPicker() {
    const picker = document.getElementById('noteEmojiPicker');
    picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}

// Insert emoji at cursor position
function insertEmoji(emoji) {
    const editor = document.getElementById('noteContent');
    editor.focus();
    
    // Insert emoji at cursor position
    document.execCommand('insertText', false, emoji);
    
    // Close picker
    document.getElementById('noteEmojiPicker').style.display = 'none';
}

// Select note color
function selectNoteColor(color, buttonElement) {
    selectedNoteColor = color;
    
    // Update custom color input
    document.getElementById('noteCustomColor').value = color;
    
    // Update selected state on preset buttons
    const allColorOptions = document.querySelectorAll('.note-color-option');
    allColorOptions.forEach(btn => btn.classList.remove('selected'));
    
    // If button element provided, mark it as selected
    if (buttonElement) {
        buttonElement.classList.add('selected');
    } else {
        // For custom color, try to find matching preset
        const matchingPreset = document.querySelector(`.note-color-option[data-color="${color}"]`);
        if (matchingPreset) {
            matchingPreset.classList.add('selected');
        }
    }
}

// Sanitize HTML to prevent XSS
function sanitizeHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    
    // Remove script tags and event handlers
    const scripts = div.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // Remove on* event attributes
    const allElements = div.querySelectorAll('*');
    allElements.forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on')) {
                el.removeAttribute(attr.name);
            }
        });
    });
    
    return div.innerHTML;
}

// Load notes from API
async function loadNotes() {
    const notesList = document.getElementById('notesList');
    
    try {
        const response = await fetch('/api/notes');
        const data = await response.json();
        
        if (data.success) {
            displayNotes(data.notes);
        } else {
            notesList.innerHTML = '<div class="notes-empty">Failed to load notes</div>';
        }
    } catch (error) {
        console.error('Error loading notes:', error);
        notesList.innerHTML = '<div class="notes-empty">Error loading notes</div>';
    }
}

// Display notes in sidebar
function displayNotes(notes) {
    const notesList = document.getElementById('notesList');
    
    if (!notes || notes.length === 0) {
        notesList.innerHTML = '<div class="notes-empty">No notes yet. Click + to add one!</div>';
        return;
    }
    
    notesList.innerHTML = notes.map(note => {
        const bgColor = note.color || '#ffffff';
        const styleAttr = bgColor !== '#ffffff' ? `style="background: ${bgColor};"` : '';
        return `
        <div class="note-item" ${styleAttr} onclick="openEditNoteModal('${note.id}')">
            <div class="note-item-header">
                <h4 class="note-item-title">${escapeHtml(note.title)}</h4>
                <div class="note-item-actions" onclick="event.stopPropagation()">
                    <button class="note-item-action" onclick="deleteNote('${note.id}')" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="note-item-content">${note.content || 'No content'}</div>
            <div class="note-item-meta">
                ${note.images && note.images.length > 0 ? `<span class="note-item-badge note-badge-image">📷 ${note.images.length}</span>` : ''}
                ${note.links && note.links.length > 0 ? `<span class="note-item-badge note-badge-link">🔗 ${note.links.length}</span>` : ''}
                ${note.tags && note.tags.length > 0 ? `<span class="note-item-badge note-badge-tag">🏷️ ${note.tags.length}</span>` : ''}
            </div>
            <div class="note-item-date">${formatDate(note.created_at)} by ${escapeHtml(note.created_by)}</div>
        </div>
        `;
    }).join('');
}

// Open add note modal
function openAddNoteModal() {
    currentNote = null;
    noteImages = [];
    noteLinks = [];
    noteTags = [];
    selectedNoteColor = '#ffffff';
    
    document.getElementById('noteModalTitle').textContent = 'Add Note';
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').innerHTML = ''; // Use innerHTML for contenteditable
    document.getElementById('noteImagesPreview').innerHTML = '';
    document.getElementById('noteLinksPreview').innerHTML = '';
    document.getElementById('noteTagsPreview').innerHTML = '';
    document.getElementById('noteEmojiPicker').style.display = 'none';
    document.getElementById('noteMessage').style.display = 'none';
    
    // Reset color selection to default (white)
    const defaultColorBtn = document.querySelector('.note-color-option[data-color="#ffffff"]');
    selectNoteColor('#ffffff', defaultColorBtn);
    
    const modal = document.getElementById('noteModal');
    modal.style.display = 'flex';
}

// Open edit note modal
async function openEditNoteModal(noteId) {
    try {
        const response = await fetch('/api/notes');
        const data = await response.json();
        
        if (data.success) {
            const note = data.notes.find(n => n.id === noteId);
            if (note) {
                currentNote = note;
                noteImages = note.images || [];
                noteLinks = note.links || [];
                noteTags = note.tags || [];
                selectedNoteColor = note.color || '#ffffff';
                
                document.getElementById('noteModalTitle').textContent = 'Edit Note';
                document.getElementById('noteTitle').value = note.title;
                document.getElementById('noteContent').innerHTML = note.content || ''; // Use innerHTML for contenteditable
                
                // Set the color selection
                const colorBtn = document.querySelector(`.note-color-option[data-color="${selectedNoteColor}"]`);
                selectNoteColor(selectedNoteColor, colorBtn);
                
                // Display existing images
                displayNoteImages();
                
                // Display existing links
                displayNoteLinks();
                
                // Display existing tags
                displayNoteTags();
                
                document.getElementById('noteEmojiPicker').style.display = 'none';
                document.getElementById('noteMessage').style.display = 'none';
                
                const modal = document.getElementById('noteModal');
                modal.style.display = 'flex';
            }
        }
    } catch (error) {
        console.error('Error loading note:', error);
    }
}

// Close note modal
function closeNoteModal() {
    const modal = document.getElementById('noteModal');
    modal.style.display = 'none';
    currentNote = null;
    noteImages = [];
    noteLinks = [];
    noteTags = [];
}

// Handle image upload
async function handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            noteImages.push(data.url);
            displayNoteImages();
            input.value = ''; // Clear file input
        } else {
            showNoteMessage(data.error || 'Failed to upload image', 'error');
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        showNoteMessage('Error uploading image', 'error');
    }
}

// Display note images
function displayNoteImages() {
    const preview = document.getElementById('noteImagesPreview');
    preview.innerHTML = noteImages.map((url, index) => `
        <div class="note-image-item">
            <img src="${url}" alt="Note image">
            <button class="note-image-remove" onclick="removeNoteImage(${index})">×</button>
        </div>
    `).join('');
}

// Remove note image
function removeNoteImage(index) {
    noteImages.splice(index, 1);
    displayNoteImages();
}

// Add link
function addLink() {
    const input = document.getElementById('noteLinkInput');
    const url = input.value.trim();
    
    if (!url) {
        showNoteMessage('Please enter a URL', 'error');
        return;
    }
    
    // Basic URL validation
    try {
        new URL(url);
        noteLinks.push(url);
        displayNoteLinks();
        input.value = '';
        document.getElementById('noteMessage').style.display = 'none';
    } catch (e) {
        showNoteMessage('Please enter a valid URL', 'error');
    }
}

// Display note links
function displayNoteLinks() {
    const preview = document.getElementById('noteLinksPreview');
    preview.innerHTML = noteLinks.map((url, index) => `
        <div class="note-link-item">
            <a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>
            <button class="note-item-remove" onclick="removeNoteLink(${index})">×</button>
        </div>
    `).join('');
}

// Remove note link
function removeNoteLink(index) {
    noteLinks.splice(index, 1);
    displayNoteLinks();
}

// Add tag
function addTag() {
    const input = document.getElementById('noteTagInput');
    let tag = input.value.trim();
    
    if (!tag) {
        showNoteMessage('Please enter a username', 'error');
        return;
    }
    
    // Add @ if not present
    if (!tag.startsWith('@')) {
        tag = '@' + tag;
    }
    
    if (!noteTags.includes(tag)) {
        noteTags.push(tag);
        displayNoteTags();
        input.value = '';
        document.getElementById('noteMessage').style.display = 'none';
    } else {
        showNoteMessage('Tag already added', 'error');
    }
}

// Display note tags
function displayNoteTags() {
    const preview = document.getElementById('noteTagsPreview');
    preview.innerHTML = noteTags.map((tag, index) => `
        <div class="note-tag-item">
            ${escapeHtml(tag)}
            <button class="note-item-remove" onclick="removeNoteTag(${index})">×</button>
        </div>
    `).join('');
}

// Remove note tag
function removeNoteTag(index) {
    noteTags.splice(index, 1);
    displayNoteTags();
}

// Save note
async function saveNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const contentElement = document.getElementById('noteContent');
    const content = sanitizeHTML(contentElement.innerHTML);
    
    if (!title) {
        showNoteMessage('Please enter a title', 'error');
        return;
    }
    
    const noteData = {
        title,
        content,
        images: noteImages,
        links: noteLinks,
        tags: noteTags,
        color: selectedNoteColor
    };
    
    try {
        const url = currentNote ? `/api/notes/${currentNote.id}` : '/api/notes';
        const method = currentNote ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(noteData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNoteMessage(currentNote ? 'Note updated!' : 'Note created!', 'success');
            setTimeout(() => {
                closeNoteModal();
                loadNotes();
            }, 1000);
        } else {
            showNoteMessage(data.error || 'Failed to save note', 'error');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        showNoteMessage('Error saving note', 'error');
    }
}

// Delete note
async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadNotes();
        } else {
            alert('Failed to delete note');
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Error deleting note');
    }
}

// Show note message
function showNoteMessage(message, type) {
    const messageEl = document.getElementById('noteMessage');
    messageEl.textContent = message;
    messageEl.className = `note-message ${type}`;
    messageEl.style.display = 'block';
}

// Close note modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('noteModal');
    if (modal && event.target === modal) {
        closeNoteModal();
    }
});

// Initialize notes when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotes);
} else {
    initNotes();
}


// ===================================
// TEAMS FUNCTIONALITY
// ===================================

let currentTeam = null;
let teams = [];

// Initialize teams
async function initTeams() {
    const createTeamBtn = document.getElementById('createTeamBtn');
    if (createTeamBtn) {
        createTeamBtn.addEventListener('click', openTeamModal);
    }
    
    await loadTeams();
}

// Load teams
async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        const data = await response.json();
        
        if (data.success) {
            teams = data.teams || [];
            renderTeams();
        }
    } catch (error) {
        console.error('Error loading teams:', error);
    }
}

// Render teams list
function renderTeams() {
    const teamsList = document.getElementById('teamsList');
    
    if (teams.length === 0) {
        teamsList.innerHTML = '<div style="padding: 12px; text-align: center; color: #999; font-size: 0.8rem;">No teams yet. Create one!</div>';
        return;
    }
    
    teamsList.innerHTML = teams.map(team => `
        <div class="note-item" onclick="openTeamChat('${team.id}')" style="cursor: pointer;">
            <div class="note-item-title">${escapeHtml(team.name)}</div>
            <div class="note-item-date">${team.members.length} member(s)</div>
        </div>
    `).join('');
}

// Open team modal for creation
function openTeamModal() {
    document.getElementById('teamModal').style.display = 'flex';
    document.getElementById('teamName').value = '';
    document.getElementById('teamDescription').value = '';
    document.getElementById('teamMessage').textContent = '';
}

// Close team modal
function closeTeamModal() {
    document.getElementById('teamModal').style.display = 'none';
}

// Create team
async function createTeam() {
    const name = document.getElementById('teamName').value.trim();
    const description = document.getElementById('teamDescription').value.trim();
    
    if (!name) {
        showTeamMessage('Please enter a team name', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/teams', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showTeamMessage('Team created successfully!', 'success');
            setTimeout(() => {
                closeTeamModal();
                loadTeams();
            }, 1000);
        } else {
            showTeamMessage(data.error || 'Failed to create team', 'error');
        }
    } catch (error) {
        console.error('Error creating team:', error);
        showTeamMessage('Error creating team', 'error');
    }
}

// Show team message
function showTeamMessage(message, type) {
    const messageEl = document.getElementById('teamMessage');
    messageEl.textContent = message;
    messageEl.className = `note-message ${type}`;
    messageEl.style.display = 'block';
}

// Open team chat
async function openTeamChat(teamId) {
    currentTeam = teams.find(t => t.id === teamId);
    if (!currentTeam) return;
    
    document.getElementById('teamChatModal').style.display = 'flex';
    document.getElementById('teamChatName').textContent = currentTeam.name;
    document.getElementById('teamChatDescription').textContent = currentTeam.description || 'No description';
    document.getElementById('teamMessageInput').value = '';
    
    await loadTeamMessages(teamId);
}

// Close team chat modal
function closeTeamChatModal() {
    document.getElementById('teamChatModal').style.display = 'none';
    currentTeam = null;
}

// Load team messages
async function loadTeamMessages(teamId) {
    try {
        const response = await fetch(`/api/teams/${teamId}/messages`);
        const data = await response.json();
        
        if (data.success) {
            renderTeamMessages(data.messages || []);
        }
    } catch (error) {
        console.error('Error loading team messages:', error);
        document.getElementById('teamMessages').innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">Error loading messages</div>';
    }
}

// Render team messages
function renderTeamMessages(messages) {
    const container = document.getElementById('teamMessages');
    
    if (messages.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No messages yet. Start the conversation!</div>';
        return;
    }
    
    container.innerHTML = messages.map(msg => {
        const date = new Date(msg.created_at);
        const timeStr = date.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' });
        const dateStr = formatDate(msg.created_at);
        
        return `
            <div style="margin-bottom: 16px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #3b82f6;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                    <span style="font-weight: 600; color: #1f2937;">${escapeHtml(msg.user)}</span>
                    <span style="font-size: 0.75rem; color: #999;">${dateStr} ${timeStr}</span>
                </div>
                <div style="color: #374151; white-space: pre-wrap;">${escapeHtml(msg.message)}</div>
                ${msg.changeset_id ? `<div style="margin-top: 8px; font-size: 0.85rem;"><a href="https://www.openstreetmap.org/changeset/${msg.changeset_id}" target="_blank" style="color: #3b82f6;">View Changeset #${msg.changeset_id}</a></div>` : ''}
            </div>
        `;
    }).join('');
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Send team message
async function sendTeamMessage() {
    if (!currentTeam) return;
    
    const input = document.getElementById('teamMessageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    try {
        const response = await fetch(`/api/teams/${currentTeam.id}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        if (data.success) {
            input.value = '';
            await loadTeamMessages(currentTeam.id);
        } else {
            alert(data.error || 'Failed to send message');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message');
    }
}

// Handle Enter key in message input
function handleTeamMessageKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendTeamMessage();
    }
}

// Show team members
async function showTeamMembers() {
    if (!currentTeam) return;
    
    document.getElementById('teamMembersModal').style.display = 'flex';
    renderTeamMembers();
}

// Close team members modal
function closeTeamMembersModal() {
    document.getElementById('teamMembersModal').style.display = 'none';
    document.getElementById('addMemberUsername').value = '';
    document.getElementById('teamMembersMessage').textContent = '';
}

// Render team members
function renderTeamMembers() {
    const container = document.getElementById('teamMembersList');
    
    container.innerHTML = `
        <h3 style="font-size: 1rem; margin-bottom: 12px;">Members (${currentTeam.members.length})</h3>
        ${currentTeam.members.map(member => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f9fafb; border-radius: 6px; margin-bottom: 8px;">
                <div>
                    <span style="font-weight: 500;">${escapeHtml(member)}</span>
                    ${member === currentTeam.created_by ? '<span style="margin-left: 8px; font-size: 0.75rem; background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px;">Owner</span>' : ''}
                </div>
                ${member !== currentTeam.created_by ? `<button class="btn btn-secondary" onclick="removeTeamMember('${escapeHtml(member)}')" style="font-size: 0.85rem; padding: 4px 10px;">Remove</button>` : ''}
            </div>
        `).join('')}
    `;
}

// Add team member
async function addTeamMember() {
    if (!currentTeam) return;
    
    const username = document.getElementById('addMemberUsername').value.trim();
    
    if (!username) {
        showTeamMembersMessage('Please enter a username', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/teams/${currentTeam.id}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentTeam = data.team;
            // Update in teams array
            const index = teams.findIndex(t => t.id === currentTeam.id);
            if (index !== -1) teams[index] = currentTeam;
            
            document.getElementById('addMemberUsername').value = '';
            showTeamMembersMessage('Member added successfully!', 'success');
            renderTeamMembers();
            
            setTimeout(() => {
                document.getElementById('teamMembersMessage').textContent = '';
            }, 2000);
        } else {
            showTeamMembersMessage(data.error || 'Failed to add member', 'error');
        }
    } catch (error) {
        console.error('Error adding member:', error);
        showTeamMembersMessage('Error adding member', 'error');
    }
}

// Remove team member
async function removeTeamMember(username) {
    if (!currentTeam) return;
    
    if (!confirm(`Remove ${username} from the team?`)) return;
    
    try {
        const response = await fetch(`/api/teams/${currentTeam.id}/members/${encodeURIComponent(username)}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update current team
            currentTeam.members = currentTeam.members.filter(m => m !== username);
            // Update in teams array
            const index = teams.findIndex(t => t.id === currentTeam.id);
            if (index !== -1) teams[index] = currentTeam;
            
            showTeamMembersMessage('Member removed successfully!', 'success');
            renderTeamMembers();
            
            setTimeout(() => {
                document.getElementById('teamMembersMessage').textContent = '';
            }, 2000);
        } else {
            showTeamMembersMessage(data.error || 'Failed to remove member', 'error');
        }
    } catch (error) {
        console.error('Error removing member:', error);
        showTeamMembersMessage('Error removing member', 'error');
    }
}

// Show team members message
function showTeamMembersMessage(message, type) {
    const messageEl = document.getElementById('teamMembersMessage');
    messageEl.textContent = message;
    messageEl.className = `note-message ${type}`;
    messageEl.style.display = 'block';
}

// Initialize teams when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTeams);
} else {
    initTeams();
}


// ===========================
// Team Tasks Management
// ===========================

// Switch between tabs in team chat modal
function switchTeamTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.team-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    // Update tab content
    document.getElementById('messagesTab').style.display = tab === 'messages' ? 'block' : 'none';
    document.getElementById('tasksTab').style.display = tab === 'tasks' ? 'block' : 'none';
    
    // Load data for the active tab
    if (tab === 'tasks' && currentTeam) {
        loadTeamTasks(currentTeam.id);
    }
}

// Show create task form
function showCreateTaskForm() {
    document.getElementById('createTaskForm').style.display = 'block';
    
    // Populate assignee dropdown with team members
    if (currentTeam) {
        const select = document.getElementById('taskAssignee');
        select.innerHTML = '<option value="">Unassigned</option>';
        currentTeam.members.forEach(member => {
            select.innerHTML += `<option value="${member}">${member}</option>`;
        });
    }
}

// Hide create task form
function hideCreateTaskForm() {
    document.getElementById('createTaskForm').style.display = 'none';
    
    // Clear form
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskType').value = 'changeset';
    document.getElementById('taskPriority').value = 'medium';
    document.getElementById('taskAssignee').value = '';
    document.getElementById('taskDueDate').value = '';
    document.getElementById('taskLocation').value = '';
    document.getElementById('taskFormMessage').textContent = '';
}

// Create new task
async function createTask() {
    if (!currentTeam) return;
    
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const taskType = document.getElementById('taskType').value;
    const priority = document.getElementById('taskPriority').value;
    const assignee = document.getElementById('taskAssignee').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const location = document.getElementById('taskLocation').value.trim();
    
    if (!title) {
        document.getElementById('taskFormMessage').textContent = 'Task title is required';
        document.getElementById('taskFormMessage').style.color = '#dc2626';
        return;
    }
    
    try {
        const response = await fetch(`/api/teams/${currentTeam.id}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                description,
                task_type: taskType,
                priority,
                assignee,
                due_date: dueDate,
                location
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('taskFormMessage').textContent = 'Task created successfully!';
            document.getElementById('taskFormMessage').style.color = '#16a34a';
            
            // Reset form after a delay
            setTimeout(() => {
                hideCreateTaskForm();
                loadTeamTasks(currentTeam.id);
            }, 1000);
        } else {
            document.getElementById('taskFormMessage').textContent = data.error || 'Failed to create task';
            document.getElementById('taskFormMessage').style.color = '#dc2626';
        }
    } catch (error) {
        console.error('Error creating task:', error);
        document.getElementById('taskFormMessage').textContent = 'Error creating task';
        document.getElementById('taskFormMessage').style.color = '#dc2626';
    }
}

// Load team tasks
async function loadTeamTasks(teamId) {
    try {
        const response = await fetch(`/api/teams/${teamId}/tasks`);
        const data = await response.json();
        
        if (data.success) {
            renderTeamTasks(data.tasks || []);
        }
    } catch (error) {
        console.error('Error loading team tasks:', error);
        document.getElementById('teamTasks').innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">Error loading tasks</div>';
    }
}

// Render team tasks
function renderTeamTasks(tasks) {
    const container = document.getElementById('teamTasks');
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="task-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                <div>No tasks yet. Create one to get started!</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tasks.map(task => {
        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('en-SG', { month: 'short', day: 'numeric' }) : null;
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
        
        return `
            <div class="task-card">
                <div class="task-card-header">
                    <div style="flex: 1;">
                        <div class="task-card-title">${escapeHtml(task.title)}</div>
                        ${task.description ? `<div class="task-card-description">${escapeHtml(task.description)}</div>` : ''}
                    </div>
                </div>
                
                <div class="task-card-meta">
                    <span class="task-badge task-type-${task.task_type}">${formatTaskType(task.task_type)}</span>
                    <span class="task-badge task-status-${task.status}">${formatTaskStatus(task.status)}</span>
                    <span class="task-badge task-priority-${task.priority}">${task.priority}</span>
                    ${dueDate ? `<span style="color: ${isOverdue ? '#dc2626' : '#666'};">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${dueDate}${isOverdue ? ' (overdue)' : ''}
                    </span>` : ''}
                    ${task.location ? `<span style="color: #666;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        ${escapeHtml(task.location)}
                    </span>` : ''}
                </div>
                
                <div class="task-card-footer">
                    <div class="task-assignee">
                        ${task.assignee ? `
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            ${escapeHtml(task.assignee)}
                        ` : '<span style="color: #999;">Unassigned</span>'}
                    </div>
                    <div class="task-actions">
                        ${task.status !== 'completed' ? `
                            <button class="task-action-btn" onclick="updateTaskStatus('${task.id}', 'completed')" title="Mark as complete">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </button>
                        ` : ''}
                        <button class="task-action-btn" onclick="deleteTask('${task.id}')" title="Delete task">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Format task type for display
function formatTaskType(type) {
    const types = {
        'changeset': 'Changeset',
        'restriction': 'Restrictions',
        'review': 'Review',
        'validation': 'Validation',
        'general': 'General'
    };
    return types[type] || type;
}

// Format task status for display
function formatTaskStatus(status) {
    const statuses = {
        'pending': 'Pending',
        'in_progress': 'In Progress',
        'completed': 'Completed'
    };
    return statuses[status] || status;
}

// Update task status
async function updateTaskStatus(taskId, status) {
    if (!currentTeam) return;
    
    try {
        const response = await fetch(`/api/teams/${currentTeam.id}/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadTeamTasks(currentTeam.id);
        } else {
            alert(data.error || 'Failed to update task');
        }
    } catch (error) {
        console.error('Error updating task:', error);
        alert('Error updating task');
    }
}

// Delete task
async function deleteTask(taskId) {
    if (!currentTeam) return;
    
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const response = await fetch(`/api/teams/${currentTeam.id}/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadTeamTasks(currentTeam.id);
        } else {
            alert(data.error || 'Failed to delete task');
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Error deleting task');
    }
}


// ===========================
// Team Edit Functions
// ===========================

// Show edit team form
function showEditTeamForm() {
    if (!currentTeam) return;
    
    const form = document.getElementById('editTeamForm');
    const nameInput = document.getElementById('editTeamName');
    const descInput = document.getElementById('editTeamDescription');
    const message = document.getElementById('editTeamMessage');
    
    // Populate form with current values
    nameInput.value = currentTeam.name;
    descInput.value = currentTeam.description || '';
    message.textContent = '';
    
    // Show the form
    form.style.display = 'block';
}

// Hide edit team form
function hideEditTeamForm() {
    const form = document.getElementById('editTeamForm');
    form.style.display = 'none';
    document.getElementById('editTeamMessage').textContent = '';
}

// Save team edits
async function saveTeamEdit() {
    if (!currentTeam) return;
    
    const nameInput = document.getElementById('editTeamName');
    const descInput = document.getElementById('editTeamDescription');
    const message = document.getElementById('editTeamMessage');
    
    const newName = nameInput.value.trim();
    const newDesc = descInput.value.trim();
    
    if (!newName) {
        message.textContent = 'Team name is required';
        message.style.color = '#dc2626';
        return;
    }
    
    try {
        const response = await fetch(`/api/teams/${currentTeam.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: newName,
                description: newDesc
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            message.textContent = 'Team updated successfully!';
            message.style.color = '#16a34a';
            
            // Update the display
            currentTeam.name = data.team.name;
            currentTeam.description = data.team.description;
            document.getElementById('teamChatName').textContent = data.team.name;
            document.getElementById('teamChatDescription').textContent = data.team.description || 'No description';
            
            // Reload teams list to reflect changes
            await loadTeams();
            
            // Hide form after a delay
            setTimeout(() => {
                hideEditTeamForm();
            }, 1500);
        } else {
            message.textContent = data.error || 'Failed to update team';
            message.style.color = '#dc2626';
        }
    } catch (error) {
        console.error('Error updating team:', error);
        message.textContent = 'Error updating team';
        message.style.color = '#dc2626';
    }
}


// ===== CHANGESET COMPARISON TOOL =====

// Comparison Tool Variables
let beforeMap = null;
let afterMap = null;
let comparisonData = null;
let mapsAreSynced = true;

// Layer groups for filtering
let beforeLayers = {
    created: null,
    modified: null,
    deleted: null
};
let afterLayers = {
    created: null,
    modified: null,
    deleted: null
};

// Helper function to update loading progress
function updateComparisonProgress(progress, text, details = '') {
    document.getElementById('progressBarFill').style.width = progress + '%';
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingDetails').textContent = details;
}

// Open comparison modal
async function showChangesetComparison(changesetId) {
    try {
        // Show modal with loading state
        document.getElementById('comparisonModal').style.display = 'flex';
        document.getElementById('comparisonChangesetId').textContent = '#' + changesetId;
        
        // Show loading progress bar
        document.getElementById('comparisonLoadingBar').style.display = 'flex';
        document.getElementById('sideByMapsView').style.display = 'none';
        document.getElementById('diffView').style.display = 'none';
        document.getElementById('timelineView').style.display = 'none';
        
        // Start progress
        updateComparisonProgress(10, 'Loading changeset...', 'Fetching changeset data from OpenStreetMap API');
        
        // Fetch comparison data with progress updates
        const response = await fetch(`/api/changeset/${changesetId}/comparison`);
        updateComparisonProgress(30, 'Processing data...', 'Parsing changeset XML');
        
        const data = await response.json();
        updateComparisonProgress(60, 'Analyzing changes...', 'Calculating element geometries');
        
        if (!data.success) {
            throw new Error('Failed to fetch comparison data');
        }
        
        comparisonData = data.comparison;
        updateComparisonProgress(80, 'Preparing visualization...', 'Setting up maps and views');
        
        // Update stats
        document.getElementById('createdCount').textContent = comparisonData.created.length;
        document.getElementById('modifiedCount').textContent = comparisonData.modified.length;
        document.getElementById('deletedCount').textContent = comparisonData.deleted.length;
        
        // Render diff view
        renderDiffView();
        
        // Render timeline
        renderTimeline();
        
        updateComparisonProgress(90, 'Almost done...', 'Rendering map layers');
        
        // Hide loading, show content
        document.getElementById('comparisonLoadingBar').style.display = 'none';
        document.getElementById('sideByMapsView').style.display = 'block';
        
        // Initialize side-by-side maps
        setTimeout(() => {
            initializeComparisonMaps();
            updateComparisonProgress(100, 'Complete!', '');
        }, 200);
        
    } catch (error) {
        console.error('Error loading comparison:', error);
        alert('Failed to load changeset comparison: ' + error.message);
        closeComparisonModal();
    }
}

function initializeComparisonMaps() {
    // Clear existing maps if any
    if (beforeMap) {
        beforeMap.remove();
        beforeMap = null;
    }
    if (afterMap) {
        afterMap.remove();
        afterMap = null;
    }
    
    // Initialize layer groups
    beforeLayers.created = L.layerGroup();
    beforeLayers.modified = L.layerGroup();
    beforeLayers.deleted = L.layerGroup();
    
    afterLayers.created = L.layerGroup();
    afterLayers.modified = L.layerGroup();
    afterLayers.deleted = L.layerGroup();
    
    // Initialize Before map
    beforeMap = L.map('beforeMap').setView([1.3521, 103.8198], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(beforeMap);
    
    // Add layer groups to before map
    beforeLayers.created.addTo(beforeMap);
    beforeLayers.modified.addTo(beforeMap);
    beforeLayers.deleted.addTo(beforeMap);
    
    // Initialize After map
    afterMap = L.map('afterMap').setView([1.3521, 103.8198], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(afterMap);
    
    // Add layer groups to after map
    afterLayers.created.addTo(afterMap);
    afterLayers.modified.addTo(afterMap);
    afterLayers.deleted.addTo(afterMap);
    
    // Update filter counts
    document.getElementById('createdCountFilter').textContent = comparisonData.created.length;
    document.getElementById('modifiedCountFilter').textContent = comparisonData.modified.length;
    document.getElementById('deletedCountFilter').textContent = comparisonData.deleted.length;
    
    // Sync map movements
    syncMapMovements();
    
    // Render elements on maps
    renderBeforeState();
    renderAfterState();
}

function syncMapMovements() {
    beforeMap.on('move', function() {
        if (mapsAreSynced && afterMap) {
            afterMap.setView(beforeMap.getCenter(), beforeMap.getZoom(), { animate: false });
        }
    });
    
    afterMap.on('move', function() {
        if (mapsAreSynced && beforeMap) {
            beforeMap.setView(afterMap.getCenter(), afterMap.getZoom(), { animate: false });
        }
    });
}

function renderBeforeState() {
    const bounds = [];
    
    // Show modified elements in OLD state (before changes)
    comparisonData.modified.forEach(item => {
        // Use old geometry and tags if available
        const displayGeometry = item.old_geometry || item.geometry;
        const displayTags = item.old_tags || item.tags;
        const displayLat = item.old_lat || item.lat;
        const displayLon = item.old_lon || item.lon;
        
        if (displayGeometry && displayGeometry.length > 1) {
            // Draw as polyline/polygon for ways
            const isArea = displayTags && (displayTags.building || displayTags.area === 'yes' || displayTags.landuse || displayTags.amenity);
            const isClosed = displayGeometry.length > 2 && 
                             displayGeometry[0][0] === displayGeometry[displayGeometry.length-1][0] &&
                             displayGeometry[0][1] === displayGeometry[displayGeometry.length-1][1];
            
            if (isArea && isClosed) {
                // Draw as polygon for buildings/areas
                const polygon = L.polygon(displayGeometry, {
                    color: '#f59e0b',
                    fillColor: '#f59e0b',
                    weight: 3,
                    opacity: 0.8,
                    fillOpacity: 0.2
                }).addTo(beforeLayers.modified);
                
                polygon.bindPopup(`<strong>Modified ${item.type} (Before)</strong><br>` +
                    Object.entries(displayTags || {}).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>'));
            } else {
                // Draw as line for roads/paths
                const polyline = L.polyline(displayGeometry, {
                    color: '#f59e0b',
                    weight: 4,
                    opacity: 0.8
                }).addTo(beforeLayers.modified);
                
                polyline.bindPopup(`<strong>Modified ${item.type} (Before)</strong><br>` +
                    Object.entries(displayTags || {}).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>'));
            }
            
            displayGeometry.forEach(coord => bounds.push(coord));
        } else if (displayLat && displayLon) {
            // Show as marker for nodes
            const marker = L.circleMarker([displayLat, displayLon], {
                radius: 8,
                fillColor: '#f59e0b',
                color: '#fff',
                weight: 2,
                fillOpacity: 0.7
            }).addTo(beforeLayers.modified);
            
            marker.bindPopup(`<strong>Modified ${item.type} (Before)</strong><br>` +
                Object.entries(displayTags || {}).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>'));
            bounds.push([displayLat, displayLon]);
        }
    });
    
    // Show deleted elements
    comparisonData.deleted.forEach(item => {
        if (item.geometry && item.geometry.length > 1) {
            // Draw as polyline/polygon for ways
            const isArea = item.tags && (item.tags.building || item.tags.area === 'yes' || item.tags.landuse || item.tags.amenity);
            const isClosed = item.geometry.length > 2 && 
                             item.geometry[0][0] === item.geometry[item.geometry.length-1][0] &&
                             item.geometry[0][1] === item.geometry[item.geometry.length-1][1];
            
            if (isArea && isClosed) {
                // Draw as polygon for buildings/areas
                const polygon = L.polygon(item.geometry, {
                    color: '#dc2626',
                    fillColor: '#dc2626',
                    weight: 3,
                    opacity: 0.8,
                    fillOpacity: 0.3
                }).addTo(beforeLayers.deleted);
                
                polygon.bindPopup(`<strong>Deleted ${item.type}</strong><br>` +
                    Object.entries(item.tags || {}).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>'));
            } else {
                // Draw as line for roads/paths
                const polyline = L.polyline(item.geometry, {
                    color: '#dc2626',
                    weight: 4,
                    opacity: 0.8,
                    dashArray: '5, 5'  // Dashed line for deleted
                }).addTo(beforeLayers.deleted);
                
                polyline.bindPopup(`<strong>Deleted ${item.type}</strong><br>` +
                    Object.entries(item.tags || {}).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>'));
            }
            
            item.geometry.forEach(coord => bounds.push(coord));
        } else if (item.lat && item.lon) {
            // Show as marker for nodes
            const marker = L.circleMarker([item.lat, item.lon], {
                radius: 8,
                fillColor: '#dc2626',
                color: '#fff',
                weight: 2,
                fillOpacity: 0.7
            }).addTo(beforeLayers.deleted);
            
            marker.bindPopup(`<strong>Deleted ${item.type}</strong><br>` +
                Object.entries(item.tags || {}).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>'));
            bounds.push([item.lat, item.lon]);
        }
    });
    
    // Fit to bounds if we have any elements
    if (bounds.length > 0) {
        beforeMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

function renderAfterState() {
    const bounds = [];
    
    // Show created elements
    comparisonData.created.forEach(item => {
        if (item.geometry && item.geometry.length > 1) {
            // Draw as polyline/polygon for ways
            const isArea = item.tags && (item.tags.building || item.tags.area === 'yes' || item.tags.landuse || item.tags.amenity);
            const isClosed = item.geometry.length > 2 && 
                             item.geometry[0][0] === item.geometry[item.geometry.length-1][0] &&
                             item.geometry[0][1] === item.geometry[item.geometry.length-1][1];
            
            if (isArea && isClosed) {
                // Draw as polygon for buildings/areas
                const polygon = L.polygon(item.geometry, {
                    color: '#10b981',
                    fillColor: '#10b981',
                    weight: 3,
                    opacity: 0.8,
                    fillOpacity: 0.3
                }).addTo(afterLayers.created);
                
                polygon.bindPopup(`<strong>Created ${item.type}</strong><br>` +
                    Object.entries(item.tags || {}).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>'));
            } else {
                // Draw as line for roads/paths
                const polyline = L.polyline(item.geometry, {
                    color: '#10b981',
                    weight: 4,
                    opacity: 0.8
                }).addTo(afterLayers.created);
                
                polyline.bindPopup(`<strong>Created ${item.type}</strong><br>` +
                    Object.entries(item.tags || {}).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>'));
            }
            
            item.geometry.forEach(coord => bounds.push(coord));
        } else if (item.lat && item.lon) {
            // Show as marker for nodes
            const marker = L.circleMarker([item.lat, item.lon], {
                radius: 8,
                fillColor: '#10b981',
                color: '#fff',
                weight: 2,
                fillOpacity: 0.7
            }).addTo(afterLayers.created);
            
            marker.bindPopup(`<strong>Created ${item.type}</strong><br>` +
                Object.entries(item.tags || {}).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>'));
            bounds.push([item.lat, item.lon]);
        }
    });
    
    // Show modified elements in NEW state (after changes)
    comparisonData.modified.forEach(item => {
        if (item.geometry && item.geometry.length > 1) {
            // Draw as polyline/polygon for ways (using NEW geometry and tags)
            const isArea = item.tags && (item.tags.building || item.tags.area === 'yes' || item.tags.landuse || item.tags.amenity);
            const isClosed = item.geometry.length > 2 && 
                             item.geometry[0][0] === item.geometry[item.geometry.length-1][0] &&
                             item.geometry[0][1] === item.geometry[item.geometry.length-1][1];
            
            if (isArea && isClosed) {
                // Draw as polygon for buildings/areas
                const polygon = L.polygon(item.geometry, {
                    color: '#f59e0b',
                    fillColor: '#f59e0b',
                    weight: 3,
                    opacity: 0.8,
                    fillOpacity: 0.2
                }).addTo(afterLayers.modified);
                
                polygon.bindPopup(`<strong>Modified ${item.type} (After)</strong><br>` +
                    Object.entries(item.tags || {}).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>'));
            } else {
                // Draw as line for roads/paths
                const polyline = L.polyline(item.geometry, {
                    color: '#f59e0b',
                    weight: 4,
                    opacity: 0.8
                }).addTo(afterLayers.modified);
                
                polyline.bindPopup(`<strong>Modified ${item.type} (After)</strong><br>` +
                    Object.entries(item.tags || {}).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>'));
            }
            
            item.geometry.forEach(coord => bounds.push(coord));
        } else if (item.lat && item.lon) {
            // Show as marker for nodes (using NEW position and tags)
            const marker = L.circleMarker([item.lat, item.lon], {
                radius: 8,
                fillColor: '#f59e0b',
                color: '#fff',
                weight: 2,
                fillOpacity: 0.7
            }).addTo(afterLayers.modified);
            
            marker.bindPopup(`<strong>Modified ${item.type} (After)</strong><br>` +
                Object.entries(item.tags || {}).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>'));
            bounds.push([item.lat, item.lon]);
        }
    });
    
    // Fit to bounds if we have any elements
    if (bounds.length > 0) {
        afterMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

function renderDiffView() {
    const diffList = document.getElementById('diffList');
    let html = '';
    
    // Created elements
    if (comparisonData.created.length > 0) {
        html += '<div class="diff-section"><h3>Created Elements</h3>';
        comparisonData.created.forEach(item => {
            html += `<div class="diff-item diff-item-created">
                <div class="diff-item-header"><strong>${item.type} #${item.id}</strong></div>
                <div class="diff-item-tags">
                    ${Object.entries(item.tags || {}).map(([k,v]) => `<span class="tag-new">${k}=${v}</span>`).join('')}
                </div>
            </div>`;
        });
        html += '</div>';
    }
    
    // Modified elements
    if (comparisonData.modified.length > 0) {
        html += '<div class="diff-section"><h3>Modified Elements</h3>';
        comparisonData.modified.forEach(item => {
            html += `<div class="diff-item diff-item-modified">
                <div class="diff-item-header"><strong>${item.type} #${item.id}</strong></div>
                <div class="diff-item-tags">
                    ${Object.entries(item.tags || {}).map(([k,v]) => `<span class="tag-changed">${k}: ${v}</span>`).join('')}
                </div>
            </div>`;
        });
        html += '</div>';
    }
    
    // Deleted elements
    if (comparisonData.deleted.length > 0) {
        html += '<div class="diff-section"><h3>Deleted Elements</h3>';
        comparisonData.deleted.forEach(item => {
            html += `<div class="diff-item diff-item-deleted">
                <div class="diff-item-header"><strong>${item.type} #${item.id}</strong></div>
                <div class="diff-item-tags">
                    ${Object.entries(item.tags || {}).map(([k,v]) => `<span class="tag-removed">${k}=${v}</span>`).join('')}
                </div>
            </div>`;
        });
        html += '</div>';
    }
    
    diffList.innerHTML = html || '<p style="text-align: center; color: #666;">No changes detected</p>';
}

function renderTimeline() {
    const timeline = document.getElementById('changeTimeline');
    const allChanges = [
        ...comparisonData.created.map(c => ({...c, action: 'created', color: '#10b981'})),
        ...comparisonData.modified.map(c => ({...c, action: 'modified', color: '#f59e0b'})),
        ...comparisonData.deleted.map(c => ({...c, action: 'deleted', color: '#ef4444'}))
    ];
    
    timeline.innerHTML = allChanges.map((item, index) => `
        <div class="timeline-item">
            <div class="timeline-marker" style="background: ${item.color};"></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <strong>${item.action} ${item.type} #${item.id}</strong>
                    <span class="timeline-time">Step ${index + 1}</span>
                </div>
                <div class="timeline-tags">
                    ${Object.entries(item.tags || {}).slice(0, 3).map(([k,v]) => 
                        `<span class="timeline-tag">${k}=${v}</span>`
                    ).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

function switchComparisonView(view) {
    // Update tab active state
    document.querySelectorAll('.comparison-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    
    // Hide all views
    document.querySelectorAll('.comparison-view').forEach(v => v.style.display = 'none');
    
    // Show selected view
    if (view === 'sidebyside') {
        document.getElementById('sideByMapsView').style.display = 'block';
        setTimeout(() => {
            if (beforeMap) beforeMap.invalidateSize();
            if (afterMap) afterMap.invalidateSize();
        }, 100);
    } else if (view === 'diff') {
        document.getElementById('diffView').style.display = 'block';
    } else if (view === 'timeline') {
        document.getElementById('timelineView').style.display = 'block';
    }
}

function toggleMapSync() {
    mapsAreSynced = !mapsAreSynced;
    const btn = event.target.closest('button');
    btn.style.opacity = mapsAreSynced ? '1' : '0.5';
}

function toggleComparisonFilter(filterType) {
    const checkbox = document.getElementById(`filter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`);
    const isChecked = checkbox.checked;
    
    // Toggle layers on before map
    if (beforeLayers[filterType]) {
        if (isChecked) {
            beforeMap.addLayer(beforeLayers[filterType]);
        } else {
            beforeMap.removeLayer(beforeLayers[filterType]);
        }
    }
    
    // Toggle layers on after map
    if (afterLayers[filterType]) {
        if (isChecked) {
            afterMap.addLayer(afterLayers[filterType]);
        } else {
            afterMap.removeLayer(afterLayers[filterType]);
        }
    }
}

function closeComparisonModal() {
    document.getElementById('comparisonModal').style.display = 'none';
    
    // Reset loading progress bar
    document.getElementById('comparisonLoadingBar').style.display = 'none';
    updateComparisonProgress(0, 'Loading changeset...', 'Initializing...');
    
    if (beforeMap) {
        beforeMap.remove();
        beforeMap = null;
    }
    if (afterMap) {
        afterMap.remove();
        afterMap = null;
    }
}

function exportComparison() {
    const changesetId = document.getElementById('comparisonChangesetId').textContent.replace('#', '');
    const report = {
        changeset_id: changesetId,
        timestamp: new Date().toISOString(),
        summary: {
            created: comparisonData.created.length,
            modified: comparisonData.modified.length,
            deleted: comparisonData.deleted.length
        },
        details: comparisonData
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `changeset_${changesetId}_comparison.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function openInJOSM() {
    const changesetId = document.getElementById('comparisonChangesetId').textContent.replace('#', '');
    window.open(`http://127.0.0.1:8111/import?url=https://api.openstreetmap.org/api/0.6/changeset/${changesetId}/download`, '_blank');
}

