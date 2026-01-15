// Analytics Charts Management for ATLAS Dashboard
let analyticsCharts = {};
let chartsInitialized = false;
let dashboardMap = null;
let dashboardMarkers = null;
let dashboardChangesets = [];

// Dashboard map validation visibility state
let dashboardValidationVisibility = {
    valid: true,
    needs_review: true
};

// Initialize all analytics charts
function initializeAnalyticsCharts() {
    if (chartsInitialized) {
        console.log('📊 Charts already initialized');
        return;
    }

    console.log('📊 Initializing analytics charts...');

    // Changes Over Time Chart (Line Chart)
    const timelineCtx = document.getElementById('changesTimelineChart');
    if (timelineCtx) {
        analyticsCharts.timeline = new Chart(timelineCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Created',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2.5,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHoverBorderWidth: 2
                    },
                    {
                        label: 'Modified',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2.5,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHoverBorderWidth: 2
                    },
                    {
                        label: 'Deleted',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2.5,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#ef4444',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHoverBorderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 10,
                            boxWidth: 8,
                            boxHeight: 8,
                            font: {
                                size: 10,
                                family: 'Satoshi, sans-serif',
                                weight: '500'
                            },
                            color: 'rgba(0, 0, 0, 0.7)'
                        }
                    },
                    title: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        padding: 10,
                        cornerRadius: 6,
                        titleFont: {
                            size: 11,
                            family: 'Satoshi, sans-serif',
                            weight: '600'
                        },
                        bodyFont: {
                            size: 10,
                            family: 'Satoshi, sans-serif'
                        },
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            font: {
                                size: 10,
                                family: 'Satoshi, sans-serif',
                                weight: '500'
                            },
                            color: 'rgba(0, 0, 0, 0.6)',
                            padding: 8
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.06)',
                            lineWidth: 1,
                            drawBorder: false
                        },
                        border: {
                            display: false
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: 10,
                                family: 'Satoshi, sans-serif',
                                weight: '500'
                            },
                            color: 'rgba(0, 0, 0, 0.6)',
                            padding: 6
                        },
                        grid: {
                            display: false
                        },
                        border: {
                            display: false
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    // Validation Status (Donut Chart)
    const validationCtx = document.getElementById('validationChart');
    if (validationCtx) {
        analyticsCharts.validation = new Chart(validationCtx, {
            type: 'doughnut',
            data: {
                labels: ['Valid', 'Needs Review'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#10b981', '#f59e0b'],
                    borderWidth: 3,
                    borderColor: '#fff',
                    hoverOffset: 8,
                    hoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 10,
                            usePointStyle: true,
                            boxWidth: 8,
                            boxHeight: 8,
                            font: {
                                size: 10,
                                family: 'Satoshi, sans-serif',
                                weight: '500'
                            },
                            color: 'rgba(0, 0, 0, 0.7)'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        padding: 10,
                        cornerRadius: 6,
                        titleFont: {
                            size: 11,
                            family: 'Satoshi, sans-serif',
                            weight: '600'
                        },
                        bodyFont: {
                            size: 10,
                            family: 'Satoshi, sans-serif'
                        },
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    chartsInitialized = true;
    console.log('📊 Analytics charts initialized successfully');
}

// Update stats cards from analytics data for consistency
function updateStatsCardsFromAnalytics(summary, validation) {
    if (!summary) return;
    
    // Use animateValue from script.js if available, otherwise direct update
    const totalChangesetsEl = document.getElementById('totalChangesets');
    const totalChangesEl = document.getElementById('totalChanges');
    const changesetsNeedingReviewEl = document.getElementById('changesetsNeedingReview');
    
    if (totalChangesetsEl) {
        if (typeof animateValue === 'function') {
            animateValue('totalChangesets', 0, summary.total_changesets || 0, 1000);
        } else {
            totalChangesetsEl.textContent = (summary.total_changesets || 0).toLocaleString();
        }
    }
    
    if (totalChangesEl) {
        if (typeof animateValue === 'function') {
            animateValue('totalChanges', 0, summary.total_edits || 0, 1000);
        } else {
            totalChangesEl.textContent = (summary.total_edits || 0).toLocaleString();
        }
    }
    
    if (changesetsNeedingReviewEl) {
        // Use summary.needs_review as the primary source (it's from the full analytics)
        // validation?.needs_review may be 0 if the validation data comes from a limited dataset
        const needsReview = summary.needs_review || validation?.needs_review || 0;
        console.log('📊 Needs review debug - summary.needs_review:', summary.needs_review, 'validation?.needs_review:', validation?.needs_review, 'final:', needsReview);
        if (typeof animateValue === 'function') {
            animateValue('changesetsNeedingReview', 0, needsReview, 1000);
        } else {
            changesetsNeedingReviewEl.textContent = needsReview.toLocaleString();
        }
    }
    
    console.log('📊 Stats cards updated from analytics:', summary.total_changesets, 'changesets,', summary.total_edits, 'edits, needs_review:', summary.needs_review);
}

// Update dashboard summary
function updateDashboardSummary(summary) {
    const summaryContainer = document.getElementById('dashboardSummary');
    if (!summaryContainer || !summary) return;
    
    const messages = [];
    
    // Main activity summary
    const regionName = (typeof currentRegionData !== 'undefined' && currentRegionData?.name) ? currentRegionData.name : 'Singapore';
    if (summary.total_changesets > 0) {
        messages.push(`
            <p class="summary-text">
                In the last 24 hours, <span class="summary-stat">${summary.total_changesets}</span> changesets were added to ${regionName}, 
                containing <span class="summary-stat">${summary.total_edits.toLocaleString()}</span> total edits 
                (<span class="summary-stat created">${summary.breakdown.created}</span> created, 
                <span class="summary-stat modified">${summary.breakdown.modified}</span> modified, 
                <span class="summary-stat deleted">${summary.breakdown.deleted}</span> deleted).
            </p>
        `);
        
        // Contributors
        messages.push(`
            <p class="summary-text">
                <span class="summary-stat">${summary.unique_contributors}</span> unique contributors were active during this period.
                ${summary.top_contributor ? `<span class="summary-highlight">${summary.top_contributor}</span> had the most changesets needing review with <span class="summary-stat warning">${summary.top_contributor_count}</span> flagged.` : ''}
            </p>
        `);
        
        // Peak activity
        if (summary.most_active_hour) {
            messages.push(`
                <p class="summary-text">
                    Peak activity occurred around <span class="summary-highlight">${summary.most_active_hour}</span> (${regionName} Time).
                </p>
            `);
        }
        
        // Review status
        if (summary.needs_review > 0) {
            messages.push(`
                <p class="summary-text">
                    ⚠️ <span class="summary-stat warning">${summary.needs_review}</span> changesets currently need review.
                </p>
            `);
        } else {
            messages.push(`
                <p class="summary-text">
                    ✅ All changesets have been validated.
                </p>
            `);
        }
    } else {
        messages.push(`
            <p class="summary-text">
                No changesets were added in the last 24 hours.
            </p>
        `);
    }
    
    summaryContainer.innerHTML = messages.join('');
}

// Update contributors list
function updateContributorsList(contributors) {
    const listContainer = document.getElementById('contributorsList');
    if (!listContainer) return;
    
    if (!contributors || contributors.length === 0) {
        listContainer.innerHTML = '<div class="contributors-empty">No users with changesets needing review</div>';
        return;
    }
    
    // Create list items
    const listItems = contributors.slice(0, 15).map((contributor) => {
        return `
            <div class="contributor-item">
                <div class="contributor-name">${contributor.user}</div>
                <div class="contributor-badge">
                    ${contributor.changesets}
                </div>
            </div>
        `;
    }).join('');
    
    listContainer.innerHTML = listItems;
}

// Update charts with new data
async function updateAnalyticsCharts() {
    try {
        // Show loading spinner
        const loadingSpinner = document.getElementById('dashboardLoading');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
        }

        console.log('📊 Fetching analytics data');

        // Fetch analytics data with region parameter
        const regionParam = typeof currentRegion !== 'undefined' ? `region=${encodeURIComponent(currentRegion)}` : 'region=singapore';
        const response = await fetch(`/api/analytics?${regionParam}`);
        const data = await response.json();
        
        if (!data.success) {
            console.error('Failed to fetch analytics data:', data.error);
            showError('Failed to load analytics data');
            return;
        }
        
        const analytics = data.analytics;
        console.log('📊 Analytics data received:', analytics);
        
        // Update Timeline Chart
        if (analytics.timeline && analyticsCharts.timeline) {
            analyticsCharts.timeline.data.labels = analytics.timeline.labels;
            analyticsCharts.timeline.data.datasets[0].data = analytics.timeline.created;
            analyticsCharts.timeline.data.datasets[1].data = analytics.timeline.modified;
            analyticsCharts.timeline.data.datasets[2].data = analytics.timeline.deleted;
            analyticsCharts.timeline.update();
        }
        
        // Update Summary
        if (analytics.summary) {
            updateDashboardSummary(analytics.summary);
            // Also update the stats cards with analytics data for consistency
            updateStatsCardsFromAnalytics(analytics.summary, analytics.validation);
        }
        
        // Update Contributors List
        updateContributorsList(analytics.contributors || []);
        
        // Update Validation Chart
        if (analytics.validation && analyticsCharts.validation) {
            analyticsCharts.validation.data.datasets[0].data = [
                analytics.validation.valid || 0,
                analytics.validation.needs_review || 0
            ];
            analyticsCharts.validation.update();
        }
        
        // Update dashboard map for current region
        updateDashboardMapForRegion();
        updateDashboardMap();
        
        // Update geographic distribution
        updateGeoDistribution();
        
        console.log('📊 Analytics charts updated successfully');
    } catch (error) {
        console.error('Error updating analytics charts:', error);
        showError('Error updating analytics charts: ' + error.message);
    } finally {
        // Hide loading spinner
        const loadingSpinner = document.getElementById('dashboardLoading');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }
}

// Initialize dashboard map
function initializeDashboardMap() {
    if (dashboardMap) {
        return;
    }
    
    const mapContainer = document.getElementById('dashboardMap');
    if (!mapContainer) {
        return;
    }
    
    // Get region center and zoom from script.js globals, or fall back to Singapore
    const regionCenter = (typeof currentRegionData !== 'undefined' && currentRegionData?.center) 
        ? currentRegionData.center 
        : [1.3521, 103.8198];
    const regionZoom = (typeof currentRegionData !== 'undefined' && currentRegionData?.zoom) 
        ? currentRegionData.zoom 
        : 11;
    const regionMinZoom = (typeof currentRegionData !== 'undefined' && currentRegionData?.minZoom) 
        ? currentRegionData.minZoom 
        : 10;
    const boundaryColor = (typeof currentRegionData !== 'undefined' && currentRegionData?.boundaryColor) 
        ? currentRegionData.boundaryColor 
        : '#dc2626';
    const regionName = (typeof currentRegionData !== 'undefined' && currentRegionData?.name) 
        ? currentRegionData.name 
        : 'Region';
    
    // Initialize map
    dashboardMap = L.map('dashboardMap').setView(regionCenter, regionZoom);
    
    // Add tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(dashboardMap);
    
    // Create a custom pane for the region boundary to ensure visibility
    dashboardMap.createPane('boundaryPane');
    dashboardMap.getPane('boundaryPane').style.zIndex = 650;
    
    // Get region boundary from script.js
    const regionBoundary = (typeof getCurrentRegionBoundary === 'function') 
        ? getCurrentRegionBoundary() 
        : (typeof SINGAPORE_BOUNDARY !== 'undefined' ? SINGAPORE_BOUNDARY : null);
    
    // Create region boundary polygon (hidden by default)
    if (regionBoundary && regionBoundary.length > 0) {
        dashboardPolygonLayer = L.polygon(regionBoundary, {
            color: boundaryColor,
            weight: 3,
            opacity: 0.9,
            fillColor: boundaryColor,
            fillOpacity: 0.05,
            interactive: false,
            pane: 'boundaryPane'
        });
        // Don't add to map initially - user can toggle it
        // Add if boundary is currently visible
        if (typeof regionBoundaryVisible !== 'undefined' && regionBoundaryVisible) {
            dashboardPolygonLayer.addTo(dashboardMap);
        } else if (typeof singaporeBoundaryVisible !== 'undefined' && singaporeBoundaryVisible) {
            // Legacy fallback
            dashboardPolygonLayer.addTo(dashboardMap);
        }
        
        // Set max bounds and min zoom
        dashboardMap.setMaxBounds(dashboardPolygonLayer.getBounds().pad(0.5));
        dashboardMap.setMinZoom(regionMinZoom);
        console.log(`✅ ${regionName} boundary polygon ready for dashboard map (hidden by default)`);
    }
    
    // Initialize marker cluster
    dashboardMarkers = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
    });
    
    dashboardMap.addLayer(dashboardMarkers);
}

// Update dashboard legend
function updateDashboardLegend() {
    const legendContent = document.getElementById('dashboardLegendContent');
    if (!legendContent) return;
    
    legendContent.innerHTML = `
        <div class="legend-item interactive ${dashboardValidationVisibility.valid ? 'active' : 'inactive'}" onclick="toggleDashboardValidationVisibility('valid')">
            <span class="legend-color" style="background: #10b981;"></span>
            <span class="legend-label">✓ Valid</span>
            <span class="legend-toggle">${dashboardValidationVisibility.valid ? '👁️' : '👁️‍🗨️'}</span>
        </div>
        <div class="legend-item interactive ${dashboardValidationVisibility.needs_review ? 'active' : 'inactive'}" onclick="toggleDashboardValidationVisibility('needs_review')">
            <span class="legend-color" style="background: #f59e0b;"></span>
            <span class="legend-label">🔍 Needs Review</span>
            <span class="legend-toggle">${dashboardValidationVisibility.needs_review ? '👁️' : '👁️‍🗨️'}</span>
        </div>
    `;
}

// Toggle dashboard validation visibility
function toggleDashboardValidationVisibility(type) {
    dashboardValidationVisibility[type] = !dashboardValidationVisibility[type];
    updateDashboardLegend();
    updateDashboardMapVisibility();
}

// Update dashboard map based on visibility settings
function updateDashboardMapVisibility() {
    if (!dashboardChangesets || dashboardChangesets.length === 0) return;
    
    // Filter changesets based on visibility settings
    const filteredChangesets = dashboardChangesets.filter(cs => {
        const status = cs.validation?.status || 'valid';
        return dashboardValidationVisibility[status];
    });
    
    // Update map with filtered changesets
    renderDashboardMapMarkers(filteredChangesets);
}

// Render dashboard map markers
function renderDashboardMapMarkers(changesets) {
    if (!dashboardMarkers) {
        return;
    }
    
    dashboardMarkers.clearLayers();
    
    changesets.forEach(cs => {
        if (cs.bbox && cs.bbox.min_lat && cs.bbox.max_lat && cs.bbox.min_lon && cs.bbox.max_lon) {
            const centerLat = (cs.bbox.min_lat + cs.bbox.max_lat) / 2;
            const centerLon = (cs.bbox.min_lon + cs.bbox.max_lon) / 2;
            
            const fillColor = cs.validation?.status === 'needs_review' ? '#f59e0b' : '#10b981';
            
            const marker = L.circleMarker([centerLat, centerLon], {
                radius: 8,
                fillColor: fillColor,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });
            
            const validationBadge = cs.validation?.status === 'needs_review' ? '🔍 Needs Review' : '✓ Valid';
            
            marker.bindPopup(`
                <div style="min-width: 200px;">
                    <strong>Changeset #${cs.id}</strong><br>
                    <strong>User:</strong> ${cs.user || 'Unknown'}<br>
                    <strong>Status:</strong> ${validationBadge}
                </div>
            `);
            
            dashboardMarkers.addLayer(marker);
        }
    });
}

// Update dashboard map view for current region
function updateDashboardMapForRegion() {
    if (!dashboardMap) return;
    
    // Get current region data
    const regionCenter = (typeof currentRegionData !== 'undefined' && currentRegionData?.center) 
        ? currentRegionData.center 
        : [1.3521, 103.8198];
    const regionZoom = (typeof currentRegionData !== 'undefined' && currentRegionData?.zoom) 
        ? currentRegionData.zoom 
        : 11;
    const boundaryColor = (typeof currentRegionData !== 'undefined' && currentRegionData?.boundaryColor) 
        ? currentRegionData.boundaryColor 
        : '#dc2626';
    const regionMinZoom = (typeof currentRegionData !== 'undefined' && currentRegionData?.minZoom) 
        ? currentRegionData.minZoom 
        : 10;
    
    // Update map view
    dashboardMap.setView(regionCenter, regionZoom);
    
    // Update boundary polygon
    if (dashboardPolygonLayer) {
        dashboardMap.removeLayer(dashboardPolygonLayer);
    }
    
    // Get region boundary
    const regionBoundary = (typeof getCurrentRegionBoundary === 'function') 
        ? getCurrentRegionBoundary() 
        : null;
    
    if (regionBoundary && regionBoundary.length > 0) {
        dashboardPolygonLayer = L.polygon(regionBoundary, {
            color: boundaryColor,
            weight: 3,
            opacity: 0.9,
            fillColor: boundaryColor,
            fillOpacity: 0.05,
            interactive: false,
            pane: 'boundaryPane'
        });
        
        // Add if boundary is currently visible
        if (typeof regionBoundaryVisible !== 'undefined' && regionBoundaryVisible) {
            dashboardPolygonLayer.addTo(dashboardMap);
        }
        
        // Update bounds
        dashboardMap.setMaxBounds(dashboardPolygonLayer.getBounds().pad(0.5));
        dashboardMap.setMinZoom(regionMinZoom);
    }
}

// Update dashboard map with changesets
async function updateDashboardMap() {
    if (!dashboardMap) {
        initializeDashboardMap();
    }
    
    if (!dashboardMarkers) {
        return;
    }
    
    try {
        // Fetch changesets with region parameter
        const regionParam = typeof currentRegion !== 'undefined' ? `region=${encodeURIComponent(currentRegion)}` : 'region=singapore';
        const response = await fetch(`/api/changesets?${regionParam}`);
        const data = await response.json();
        
        if (!data.success || !data.changesets) {
            return;
        }
        
        // Store changesets for filtering
        dashboardChangesets = data.changesets;
        
        // Update legend
        updateDashboardLegend();
        
        // Render markers based on current visibility settings
        updateDashboardMapVisibility();
    } catch (error) {
        console.error('Error updating dashboard map:', error);
    }
}

// Initialize when dashboard tab is opened
document.addEventListener('DOMContentLoaded', function() {
    // Get dashboard tab button
    const dashboardTab = document.querySelector('[data-tab="dashboard"]');
    
    if (dashboardTab) {
        dashboardTab.addEventListener('click', function() {
            console.log('📊 Dashboard tab clicked');
            
            // Initialize charts if not already done
            if (!chartsInitialized) {
                setTimeout(() => {
                    initializeAnalyticsCharts();
                    updateAnalyticsCharts();
                    initializeDashboardMap();
                    updateDashboardMap();
                }, 100);
            } else {
                // Just update with latest data
                updateAnalyticsCharts();
                if (dashboardMap) {
                    dashboardMap.invalidateSize();
                    updateDashboardMap();
                }
            }
        });
    }
    
    // Check if dashboard is the active tab on page load
    const dashboardContent = document.getElementById('dashboard');
    if (dashboardContent && dashboardContent.classList.contains('active')) {
        console.log('📊 Dashboard is active on page load');
        setTimeout(() => {
            initializeAnalyticsCharts();
            updateAnalyticsCharts();
            initializeDashboardMap();
            updateDashboardMap();
        }, 500);
    }
});

// Helper function to show errors
function showError(message) {
    console.error(message);
    // Could add a toast notification here
}

// ============================================
// Geographic Distribution Functions
// ============================================

// Define sub-regions for each country
const REGION_AREAS = {
    singapore: {
        name: 'Singapore',
        areas: [
            { id: 'north', name: 'North', icon: '🌲', bounds: { minLat: 1.38, maxLat: 1.48, minLon: 103.75, maxLon: 103.88 } },
            { id: 'south', name: 'South', icon: '🏝️', bounds: { minLat: 1.24, maxLat: 1.30, minLon: 103.78, maxLon: 103.88 } },
            { id: 'east', name: 'East', icon: '🌅', bounds: { minLat: 1.28, maxLat: 1.38, minLon: 103.88, maxLon: 104.05 } },
            { id: 'west', name: 'West', icon: '🏭', bounds: { minLat: 1.28, maxLat: 1.42, minLon: 103.60, maxLon: 103.75 } },
            { id: 'central', name: 'Central', icon: '🏙️', bounds: { minLat: 1.26, maxLat: 1.38, minLon: 103.78, maxLon: 103.88 } }
        ]
    }
};

// Categorize changesets by geographic area
function categorizeChangesetsByArea(changesets, regionId) {
    const regionConfig = REGION_AREAS[regionId];
    if (!regionConfig) {
        console.warn(`No area configuration for region: ${regionId}`);
        return [];
    }
    
    const areaCounts = {};
    const areaEdits = {};
    const areaUsers = {};
    
    // Initialize counts
    regionConfig.areas.forEach(area => {
        areaCounts[area.id] = 0;
        areaEdits[area.id] = 0;
        areaUsers[area.id] = new Set();
    });
    
    // Process each changeset
    changesets.forEach(cs => {
        // Get center coordinates - try various formats
        let lat, lon;
        
        if (cs.center_lat && cs.center_lon) {
            lat = parseFloat(cs.center_lat);
            lon = parseFloat(cs.center_lon);
        } else if (cs.bbox && cs.bbox.min_lat && cs.bbox.max_lat && cs.bbox.min_lon && cs.bbox.max_lon) {
            // Calculate center from bbox
            lat = (cs.bbox.min_lat + cs.bbox.max_lat) / 2;
            lon = (cs.bbox.min_lon + cs.bbox.max_lon) / 2;
        } else if (cs.bounds && cs.bounds.minLat && cs.bounds.maxLat && cs.bounds.minLon && cs.bounds.maxLon) {
            // Alternative bounds format
            lat = (cs.bounds.minLat + cs.bounds.maxLat) / 2;
            lon = (cs.bounds.minLon + cs.bounds.maxLon) / 2;
        }
        
        if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;
        
        // Find which area this changeset belongs to
        for (const area of regionConfig.areas) {
            const bounds = area.bounds;
            if (lat >= bounds.minLat && lat <= bounds.maxLat && 
                lon >= bounds.minLon && lon <= bounds.maxLon) {
                areaCounts[area.id]++;
                // Handle different property names for edit count
                const editCount = cs.changes || cs.num_changes || cs.edits || 0;
                areaEdits[area.id] += parseInt(editCount) || 0;
                if (cs.user) {
                    areaUsers[area.id].add(cs.user);
                }
                break; // Only count in one area
            }
        }
    });
    
    // Build result array with stats
    const totalChangesets = changesets.length || 1;
    return regionConfig.areas
        .map(area => ({
            ...area,
            count: areaCounts[area.id],
            edits: areaEdits[area.id],
            users: areaUsers[area.id].size,
            percentage: Math.round((areaCounts[area.id] / totalChangesets) * 100)
        }))
        .filter(area => area.count > 0) // Only show areas with activity
        .sort((a, b) => b.count - a.count); // Sort by count descending
}

// Render geographic distribution
function renderGeoDistribution(areaData, regionId) {
    const container = document.getElementById('geoDistribution');
    const titleEl = document.getElementById('geoDistributionTitle');
    
    if (!container) return;
    
    // Update title
    const regionName = REGION_AREAS[regionId]?.name || 'Region';
    if (titleEl) {
        titleEl.textContent = `Activity by Area in ${regionName}`;
    }
    
    if (!areaData || areaData.length === 0) {
        container.innerHTML = `
            <div class="geo-empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <h4>No Geographic Data</h4>
                <p>No changesets with location data found in the last 24 hours.</p>
            </div>
        `;
        return;
    }
    
    const maxCount = Math.max(...areaData.map(a => a.count));
    
    const cardsHTML = areaData.map(area => `
        <div class="geo-area-card" data-area="${area.id}">
            <div class="geo-area-header">
                <div class="geo-area-name">${area.name}</div>
                <div class="geo-area-count">${area.count}</div>
            </div>
            <div class="geo-area-stats">
                <div class="geo-area-stat">
                    <span class="geo-area-stat-label">Edits</span>
                    <span class="geo-area-stat-value">${area.edits.toLocaleString()}</span>
                </div>
                <div class="geo-area-stat">
                    <span class="geo-area-stat-label">Contributors</span>
                    <span class="geo-area-stat-value">${area.users}</span>
                </div>
                <div class="geo-area-stat">
                    <span class="geo-area-stat-label">Share</span>
                    <span class="geo-area-stat-value">${area.percentage}%</span>
                </div>
            </div>
            <div class="geo-area-bar">
                <div class="geo-area-bar-fill" style="width: ${Math.round((area.count / maxCount) * 100)}%"></div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = cardsHTML;
}

// Update geographic distribution
async function updateGeoDistribution() {
    const regionId = typeof currentRegion !== 'undefined' ? currentRegion : 'singapore';
    
    try {
        // Fetch changesets for the current region
        const response = await fetch(`/api/changesets?region=${encodeURIComponent(regionId)}`);
        const data = await response.json();
        
        if (!data.success || !data.changesets) {
            renderGeoDistribution([], regionId);
            return;
        }
        
        const areaData = categorizeChangesetsByArea(data.changesets, regionId);
        renderGeoDistribution(areaData, regionId);
        
    } catch (error) {
        console.error('Error updating geo distribution:', error);
        renderGeoDistribution([], regionId);
    }
}

console.log('📊 Analytics.js loaded');

