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

// Update dashboard summary
function updateDashboardSummary(summary) {
    const summaryContainer = document.getElementById('dashboardSummary');
    if (!summaryContainer || !summary) return;
    
    const messages = [];
    
    // Main activity summary
    if (summary.total_changesets > 0) {
        messages.push(`
            <p class="summary-text">
                In the last 24 hours, <span class="summary-stat">${summary.total_changesets}</span> changesets were added to Singapore, 
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
                    Peak activity occurred around <span class="summary-highlight">${summary.most_active_hour}</span> (Singapore Time).
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

        // Fetch analytics data
        const response = await fetch('/api/analytics');
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
    
    // Initialize map
    dashboardMap = L.map('dashboardMap').setView([1.3521, 103.8198], 11);
    
    // Add tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(dashboardMap);
    
    // Create a custom pane for the Singapore boundary to ensure visibility
    dashboardMap.createPane('boundaryPane');
    dashboardMap.getPane('boundaryPane').style.zIndex = 650;
    
    // Create Singapore boundary polygon (hidden by default, uses SINGAPORE_BOUNDARY from script.js)
    if (typeof SINGAPORE_BOUNDARY !== 'undefined') {
        dashboardPolygonLayer = L.polygon(SINGAPORE_BOUNDARY, {
            color: '#dc2626',
            weight: 3,
            opacity: 0.9,
            fillColor: '#dc2626',
            fillOpacity: 0.05,
            interactive: false,
            pane: 'boundaryPane'
        });
        // Don't add to map initially - user can toggle it
        // Add if boundary is currently visible
        if (typeof singaporeBoundaryVisible !== 'undefined' && singaporeBoundaryVisible) {
            dashboardPolygonLayer.addTo(dashboardMap);
        }
        
        // Set max bounds and min zoom
        dashboardMap.setMaxBounds(dashboardPolygonLayer.getBounds().pad(0.2));
        dashboardMap.setMinZoom(10);
        console.log('✅ Singapore boundary polygon ready for dashboard map (hidden by default)');
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

// Update dashboard map with changesets
async function updateDashboardMap() {
    if (!dashboardMap) {
        initializeDashboardMap();
    }
    
    if (!dashboardMarkers) {
        return;
    }
    
    try {
        const response = await fetch('/api/changesets');
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

console.log('📊 Analytics.js loaded');

