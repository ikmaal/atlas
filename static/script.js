// Global variables
let map;
let markers = [];
let markerCluster;
let changesets = [];
let mapViewMode = 'validation'; // Always show validation colors
let visualizationLayer = null; // Layer for AI visualization

// Region configuration
let regions = {};
let currentRegion = 'singapore';
let currentRegionData = null;

// Validation visibility state
let validationVisibility = {
    valid: true,
    needs_review: true
};

let currentFilters = {
    search: '',
    validity: 'all',
    keyword: '',
    criteria: {
        mass_changes: true,
        erp: true,
        oneway: true,
        access: true
    }
};
// Pagination state
let currentPage = 1;
const itemsPerPage = 20;
let filteredChangesets = []; // Store filtered changesets for pagination

// Persistent storage for needs_review changesets
const STORAGE_KEY = 'atlas_needs_review_changesets';
// Persistent storage for Grab changesets
const GRAB_STORAGE_KEY = 'atlas_grab_changesets';

// Load stored needs_review changesets from localStorage
function loadStoredNeedsReviewChangesets() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading stored needs_review changesets:', error);
    }
    return {};
}

// Save needs_review changeset to localStorage
function saveNeedsReviewChangeset(changeset) {
    try {
        const stored = loadStoredNeedsReviewChangesets();
        const changesetId = changeset.id.toString();
        
        // Only save if not already stored (avoid duplicates)
        if (!stored[changesetId]) {
            // Add timestamp when stored
            stored[changesetId] = {
                ...changeset,
                storedAt: new Date().toISOString(),
                storedFromRegion: currentRegion
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
            console.log(`Stored needs_review changeset ${changesetId} permanently`);
        }
    } catch (error) {
        console.error('Error saving needs_review changeset:', error);
    }
}

// Get all stored needs_review changesets as an array
function getAllStoredNeedsReviewChangesets() {
    const stored = loadStoredNeedsReviewChangesets();
    const changesets = Object.values(stored);
    
    // Sort by created_at date (newest first), fallback to storedAt if created_at not available
    return changesets.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : (a.storedAt ? new Date(a.storedAt) : new Date(0));
        const dateB = b.created_at ? new Date(b.created_at) : (b.storedAt ? new Date(b.storedAt) : new Date(0));
        return dateB - dateA; // Newest first
    });
}

// Load stored Grab changesets from localStorage
function loadStoredGrabChangesets() {
    try {
        const stored = localStorage.getItem(GRAB_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading stored Grab changesets:', error);
    }
    return {};
}

// Save Grab changeset to localStorage
function saveGrabChangeset(changeset) {
    try {
        const stored = loadStoredGrabChangesets();
        const changesetId = changeset.id.toString();
        
        // Only save if not already stored (avoid duplicates)
        if (!stored[changesetId]) {
            // Add timestamp when stored
            stored[changesetId] = {
                ...changeset,
                storedAt: new Date().toISOString(),
                storedFromRegion: currentRegion
            };
            localStorage.setItem(GRAB_STORAGE_KEY, JSON.stringify(stored));
            console.log(`Stored Grab changeset ${changesetId} permanently`);
        }
    } catch (error) {
        console.error('Error saving Grab changeset:', error);
    }
}

// Get all stored Grab changesets as an array
function getAllStoredGrabChangesets() {
    const stored = loadStoredGrabChangesets();
    const changesets = Object.values(stored);
    
    // Sort by created_at date (newest first), fallback to storedAt if created_at not available
    return changesets.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : (a.storedAt ? new Date(a.storedAt) : new Date(0));
        const dateB = b.created_at ? new Date(b.created_at) : (b.storedAt ? new Date(b.storedAt) : new Date(0));
        return dateB - dateA; // Newest first
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Load regions first
    await loadRegions();
    
    // Log stored needs_review changesets count
    const storedCount = Object.keys(loadStoredNeedsReviewChangesets()).length;
    if (storedCount > 0) {
        console.log(`Loaded ${storedCount} stored needs_review changesets from database`);
    }
    
    // Log stored Grab changesets count
    const storedGrabCount = Object.keys(loadStoredGrabChangesets()).length;
    if (storedGrabCount > 0) {
        console.log(`Loaded ${storedGrabCount} stored Grab changesets from database`);
    }
    
    initMap();
    
    // Check for changeset parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const changesetParam = urlParams.get('changeset');
    const comparisonParam = urlParams.get('comparison');
    
    if (comparisonParam) {
        // Open comparison tool directly for the specified changeset
        loadData().then(() => {
            // Switch to list view tab if not already there
            const listTab = document.querySelector('.sidenav-item[onclick*="list"]');
            if (listTab) {
                listTab.click();
            }
            // Wait a bit for tab to switch, then open comparison modal
            setTimeout(() => {
                if (typeof showChangesetComparison === 'function') {
                    showChangesetComparison(comparisonParam);
                }
            }, 500);
        });
    } else if (changesetParam) {
        // Load data and then filter to the specified changeset
        loadData().then(() => {
            filterToChangeset(changesetParam);
        });
    } else {
        loadData();
    }

    // Set up tab switching
    // Use setTimeout to ensure DOM is fully ready
    setTimeout(() => {
        initTabs();
    }, 100);
    
    // Initialize Atlas AI greeting (for compatibility)
    if (typeof initAtlasGreeting === 'function') {
        initAtlasGreeting();
    }
    
    // Initialize Atlas logo hover introduction
    if (typeof initAtlasLogoIntro === 'function') {
        initAtlasLogoIntro();
    }

    // Set up filters
    initFilters();

    // Set up map search
    initMapSearch();

    // Set up map legend and view toggle
    initMapControls();


    // Auto-refresh every 5 minutes
    setInterval(loadData, 5 * 60 * 1000);
    
    // Set up IntersectionObserver to invalidate maps when they become visible
    setupMapVisibilityObserver();
});

// Load available regions from the API
async function loadRegions() {
    try {
        const response = await fetch('/api/regions');
        const data = await response.json();
        
        if (data.success) {
            regions = data.regions;
            currentRegion = data.currentRegion || data.defaultRegion || 'singapore';
            currentRegionData = regions[currentRegion];
            
            // Update region switcher UI
            updateRegionSwitcher();
            
            console.log(`🌏 Loaded ${Object.keys(regions).length} regions, current: ${currentRegion}`);
        }
    } catch (error) {
        console.error('Error loading regions:', error);
        // Fallback to singapore
        currentRegion = 'singapore';
    }
}

// Update the region switcher dropdown
function updateRegionSwitcher() {
    const switcher = document.getElementById('regionSwitcher');
    if (!switcher) return;
    
    switcher.innerHTML = '';
    
    for (const [regionId, regionData] of Object.entries(regions)) {
        const option = document.createElement('option');
        option.value = regionId;
        option.textContent = `${regionData.flag} ${regionData.name}`;
        option.selected = regionId === currentRegion;
        switcher.appendChild(option);
    }
}

// Show region loading overlay
function showRegionLoadingOverlay(regionName) {
    const overlay = document.getElementById('regionLoadingOverlay');
    const nameSpan = document.getElementById('regionLoadingName');
    const progressBar = document.getElementById('regionLoadingProgress');
    const stepText = document.getElementById('regionLoadingStep');
    
    if (overlay) {
        if (nameSpan) nameSpan.textContent = regionName;
        if (progressBar) progressBar.style.width = '0%';
        if (stepText) stepText.textContent = 'Preparing...';
        overlay.style.display = 'flex';
        // Trigger reflow for animation
        overlay.offsetHeight;
        overlay.classList.add('visible');
    }
}

// Update region loading progress
function updateRegionLoadingProgress(percent, stepMessage) {
    const progressBar = document.getElementById('regionLoadingProgress');
    const stepText = document.getElementById('regionLoadingStep');
    
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (stepText) stepText.textContent = stepMessage;
}

// Hide region loading overlay
function hideRegionLoadingOverlay() {
    const overlay = document.getElementById('regionLoadingOverlay');
    const progressBar = document.getElementById('regionLoadingProgress');
    
    if (progressBar) progressBar.style.width = '100%';
    
    setTimeout(() => {
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300); // Match the CSS transition duration
        }
    }, 200); // Brief delay to show 100% completion
}

// Switch to a different region
async function switchRegion(regionId) {
    if (!regions[regionId]) {
        console.error(`Region ${regionId} not found`);
        return;
    }
    
    // Don't switch if already on this region
    if (currentRegion === regionId) {
        return;
    }
    
    const regionData = regions[regionId];
    
    console.log(`🌏 Switching to region: ${regionData.name}`);
    
    // Show loading overlay
    showRegionLoadingOverlay(regionData.name);
    
    currentRegion = regionId;
    currentRegionData = regionData;
    
    // Step 1: Update UI (10%)
    updateRegionLoadingProgress(10, 'Updating interface...');
    updateRegionUI();
    
    // Step 2: Update map (20%)
    updateRegionLoadingProgress(20, 'Updating map view...');
    updateMapForRegion();
    
    // Set a timeout to auto-hide the loading overlay if loading takes too long
    const loadingTimeout = setTimeout(() => {
        console.warn('WARNING: Region switch took too long, hiding loading overlay');
        hideRegionLoadingOverlay();
    }, 60000); // 60 second timeout
    
    try {
        // Step 3: Load changesets (50%)
        updateRegionLoadingProgress(35, 'Loading changesets...');
        await loadData();
        updateRegionLoadingProgress(55, 'Changesets loaded');
        
        // Step 4: Load analytics (80%)
        if (typeof updateAnalyticsCharts === 'function') {
            updateRegionLoadingProgress(65, 'Loading analytics...');
            await updateAnalyticsCharts();
            updateRegionLoadingProgress(85, 'Analytics loaded');
        }
        
        
        updateRegionLoadingProgress(100, 'Complete!');
    } catch (error) {
        console.error('ERROR: Error switching region:', error);
        updateRegionLoadingProgress(100, 'Error - please try again');
    } finally {
        // Clear the timeout since we're done
        clearTimeout(loadingTimeout);
        
        // Hide loading overlay (with a small delay to ensure smooth transition)
        setTimeout(() => {
            hideRegionLoadingOverlay();
        }, 400);
    }
}

// Update UI elements for current region
function updateRegionUI() {
    // Update brand subtitle
    const brandSubtitle = document.querySelector('.sidenav-brand-subtitle');
    if (brandSubtitle) {
        brandSubtitle.textContent = currentRegionData.name;
    }
    
    // Update page title
    document.title = `ATLAS - ${currentRegionData.name} OpenStreetMap Monitor`;
    
    // Update boundary toggle button text
    const boundaryToggle = document.getElementById('boundaryToggle');
    if (boundaryToggle) {
        const isVisible = regionBoundaryVisible;
        boundaryToggle.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
            ${isVisible ? 'Hide' : 'Show'} ${currentRegionData.name} Boundary
        `;
    }
}

// Update map view for current region
function updateMapForRegion() {
    if (!map || !currentRegionData) return;
    
    // Update map center and zoom
    map.setView(currentRegionData.center, currentRegionData.zoom);
    
    // Update boundary polygon
    if (regionPolygonLayer) {
        map.removeLayer(regionPolygonLayer);
    }
    
    if (currentRegionData.polygon && currentRegionData.polygon.length > 0) {
        // Use helper function to handle both single and multi-polygon regions
        regionPolygonLayer = createRegionPolygonLayer(map);
        
        // Update map bounds
        map.fitBounds(regionPolygonLayer.getBounds(), { padding: [20, 20] });
        map.setMaxBounds(regionPolygonLayer.getBounds().pad(0.5));
        map.setMinZoom(currentRegionData.minZoom || 5);
        
        // Add to map if boundary is visible
        if (regionBoundaryVisible) {
            regionPolygonLayer.addTo(map);
        }
    }
    
}

// Initialize tab functionality (see updated version below with map invalidation)

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
    const filterButtons = document.querySelectorAll('.filter-btn');
    const criteriaFiltersRow = document.getElementById('criteriaFiltersRow');
    const criteriaCheckboxes = document.querySelectorAll('.criteria-filter-checkbox input');

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

    // Validity filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update filter
            const validity = this.getAttribute('data-filter');
            currentFilters.validity = validity;
            
            // Show/hide criteria filters based on validity filter
            if (criteriaFiltersRow) {
                if (validity === 'needs_review') {
                    criteriaFiltersRow.style.display = 'flex';
                } else {
                    criteriaFiltersRow.style.display = 'none';
                }
            }
            
            applyFilters();
        });
    });

    // Criteria filter checkboxes
    criteriaCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const criteriaValue = this.value;
            currentFilters.criteria[criteriaValue] = this.checked;
            applyFilters();
        });
    });
}

// Reset filters to default values
function resetFilters() {
    currentFilters.validity = 'all';
    currentFilters.search = '';
    currentFilters.keyword = '';
    currentFilters.criteria = {
        mass_changes: true,
        erp: true,
        oneway: true,
        access: true
    };
    
    // Update UI - reset filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        if (btn.getAttribute('data-filter') === 'all') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Clear search inputs
    const searchInput = document.getElementById('searchFilter');
    const keywordInput = document.getElementById('keywordFilter');
    if (searchInput) searchInput.value = '';
    if (keywordInput) keywordInput.value = '';
    
    // Reset criteria checkboxes
    const criteriaCheckboxes = document.querySelectorAll('.criteria-filter-checkbox input');
    criteriaCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // Hide criteria filters row
    const criteriaFiltersRow = document.getElementById('criteriaFiltersRow');
    if (criteriaFiltersRow) {
        criteriaFiltersRow.style.display = 'none';
    }
    
    // Re-apply filters to show all changesets
    applyFilters();
}

// Apply filters to changesets
function applyFilters() {
    let changesetsToFilter = changesets || [];
    
    // If filtering by needs_review, include stored needs_review changesets
    if (currentFilters.validity === 'needs_review') {
        const storedNeedsReview = getAllStoredNeedsReviewChangesets();
        const currentChangesetIds = new Set(changesetsToFilter.map(cs => cs.id.toString()));
        
        // Add stored changesets that aren't already in current changesets
        storedNeedsReview.forEach(storedCs => {
            if (!currentChangesetIds.has(storedCs.id.toString())) {
                changesetsToFilter.push(storedCs);
            }
        });
        
        console.log(`Including ${storedNeedsReview.length} stored needs_review changesets`);
    }
    
    // If filtering by grab, include stored Grab changesets
    if (currentFilters.validity === 'grab') {
        const storedGrab = getAllStoredGrabChangesets();
        const currentChangesetIds = new Set(changesetsToFilter.map(cs => cs.id.toString()));
        
        // Add stored changesets that aren't already in current changesets
        storedGrab.forEach(storedCs => {
            if (!currentChangesetIds.has(storedCs.id.toString())) {
                changesetsToFilter.push(storedCs);
            }
        });
        
        console.log(`Including ${storedGrab.length} stored Grab changesets`);
    }

    if (changesetsToFilter.length === 0) {
        // Handle empty state
        const container = document.getElementById('changesetsList');
        if (container) {
            const regionName = currentRegionData?.name || 'the selected';
            container.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>No Changesets Found</h3>
                    <p>No changesets match your filters in the ${regionName} region.</p>
                </div>
            `;
        }
        updateMap([]);
        return;
    }

    let filtered = changesetsToFilter.filter(cs => {
        // Filter by search (username)
        const matchesSearch = currentFilters.search === '' || 
                             cs.user.toLowerCase().includes(currentFilters.search);

        // Filter by keyword (changeset comment)
        const matchesKeyword = currentFilters.keyword === '' || 
                              cs.comment.toLowerCase().includes(currentFilters.keyword);

        // Filter by validity
        const validityStatus = cs.validation ? cs.validation.status : 'valid';
        let matchesValidity = false;
        
        if (currentFilters.validity === 'all') {
            matchesValidity = true;
        } else if (currentFilters.validity === 'grab') {
            // Filter for Grab usernames (starting with "GrabSG")
            matchesValidity = cs.user && cs.user.startsWith('GrabSG');
        } else {
            matchesValidity = validityStatus === currentFilters.validity;
        }

        // Filter by criteria (only when filtering by needs_review)
        let matchesCriteria = true;
        if (currentFilters.validity === 'needs_review' && matchesValidity) {
            const validation = cs.validation || {};
            const flags = validation.flags || [];
            
            // Check if any of the selected criteria match
            const selectedCriteria = Object.keys(currentFilters.criteria).filter(
                key => currentFilters.criteria[key]
            );
            
            if (selectedCriteria.length > 0) {
                // At least one selected criterion must be present in the flags
                matchesCriteria = selectedCriteria.some(criterion => flags.includes(criterion));
            }
        }

        return matchesSearch && matchesKeyword && matchesValidity && matchesCriteria;
    });

    // Store filtered changesets for pagination
    filteredChangesets = filtered;
    // Reset to first page when filters change
    currentPage = 1;
    
    updateChangesetsList(filtered);
    updateMap(filtered);
}

// Region boundary visibility state
let regionBoundaryVisible = false;
let regionPolygonLayer = null;
let dashboardPolygonLayer = null;

// Legacy alias for backward compatibility
let singaporeBoundaryVisible = false;
let singaporePolygonLayer = null;

// Get current region boundary (for legacy code)
function getCurrentRegionBoundary() {
    if (currentRegionData && currentRegionData.polygon) {
        return currentRegionData.polygon;
    }
    // Fallback to Singapore
    return SINGAPORE_BOUNDARY_FALLBACK;
}

// Check if region has multi-polygon
function isMultiPolygonRegion() {
    return currentRegionData && currentRegionData.isMultiPolygon === true;
}

// Create a Leaflet polygon layer for the current region
// Handles both single polygons and multi-polygons
function createRegionPolygonLayer(mapInstance, options = {}) {
    const boundary = getCurrentRegionBoundary();
    const isMulti = isMultiPolygonRegion();
    const boundaryColor = currentRegionData?.boundaryColor || '#dc2626';
    
    const defaultOptions = {
        color: boundaryColor,
        weight: 3,
        opacity: 0.9,
        fillColor: boundaryColor,
        fillOpacity: 0.05,
        interactive: false,
        pane: 'boundaryPane'
    };
    
    const layerOptions = { ...defaultOptions, ...options };
    
    if (isMulti) {
        // For multi-polygon, Leaflet L.polygon accepts array of coordinate arrays
        return L.polygon(boundary, layerOptions);
    } else {
        return L.polygon(boundary, layerOptions);
    }
}

// Fallback Singapore boundary polygon coordinates [lat, lon] for Leaflet
const SINGAPORE_BOUNDARY_FALLBACK = [
    [1.4374204305910894, 103.68206176671208],
    [1.4285151679417964, 103.67276286043511],
    [1.416537060450807, 103.66830637387295],
    [1.4110234655300502, 103.66359851373443],
    [1.4008739119261122, 103.65645502631492],
    [1.3863582521087778, 103.65157778084335],
    [1.380092164482889, 103.64848249116358],
    [1.374053214919627, 103.64619415008514],
    [1.355513484947764, 103.63527235720085],
    [1.3495865471648756, 103.6326287206494],
    [1.3209718317900752, 103.61600327820832],
    [1.2829972828841392, 103.60344510451301],
    [1.2803135891116284, 103.60144936850588],
    [1.2635218264087626, 103.57740732831513],
    [1.1943307648203358, 103.56523522923226],
    [1.1868527612518562, 103.6402076218406],
    [1.1850262155549842, 103.65991878234365],
    [1.1791455797026913, 103.6708555340773],
    [1.1489442597735717, 103.71441701594091],
    [1.130390588109762, 103.74079127418872],
    [1.159946506462191, 103.78704071859727],
    [1.1714133667868225, 103.80498725868085],
    [1.1881129758843798, 103.84216912343902],
    [1.1959892693859189, 103.85985532313777],
    [1.2073427425893328, 103.88105151800545],
    [1.2238404373376284, 103.92139937026343],
    [1.266596358685348, 104.03684272280378],
    [1.2697730050282843, 104.13126741616901],
    [1.3570197805668442, 104.0814591330859],
    [1.3690605445553814, 104.08382725499087],
    [1.393720869608842, 104.09291474983172],
    [1.399163580098346, 104.09373613093112],
    [1.4062378819988197, 104.09331533570213],
    [1.412888983208063, 104.09134418977862],
    [1.4176835488809445, 104.08917899644018],
    [1.4307948743288819, 104.07772682493072],
    [1.4349972492461376, 104.07253387047615],
    [1.4467388769547256, 104.04032159816978],
    [1.4423195754761196, 104.02191680629886],
    [1.4286528759047172, 104.00120540762356],
    [1.4252380071795159, 103.99398246420247],
    [1.4245198599390392, 103.9802031176776],
    [1.422420192817114, 103.9720596368071],
    [1.4222952902766508, 103.96651303737002],
    [1.4244470435201322, 103.96101278691481],
    [1.4250380010241201, 103.95472777048747],
    [1.4275811841350503, 103.94321259051571],
    [1.43048546961505, 103.93758079952084],
    [1.4296998941527903, 103.93244761660071],
    [1.4274778118911229, 103.92044156575355],
    [1.428318230089758, 103.89886836575641],
    [1.434740785422406, 103.88616150622721],
    [1.4563465760880803, 103.86829439397985],
    [1.4626364498582376, 103.8587510408729],
    [1.4728369612134742, 103.83532893291158],
    [1.478827754692162, 103.8119667565141],
    [1.4766679071910715, 103.80346095871982],
    [1.4676932356154566, 103.79388231869814],
    [1.4532715864175145, 103.77043499278165],
    [1.448669405670941, 103.76063365666334],
    [1.4510819110808342, 103.74495786540905],
    [1.453923016011771, 103.73999991717727],
    [1.455211901468246, 103.73901608792534],
    [1.4600287258219815, 103.72823228744282],
    [1.4581304288291577, 103.71389869522139],
    [1.4510904722500193, 103.70359187764298],
    [1.4444822745957655, 103.69726984749266],
    [1.441055926623176, 103.69209246150241],
    [1.4374204305910894, 103.68206176671208],
];

// Legacy alias
const SINGAPORE_BOUNDARY = SINGAPORE_BOUNDARY_FALLBACK;

// Utility function to invalidate map size reliably
function invalidateMapSize(mapInstance, delay = 150, retries = 3) {
    if (!mapInstance) return;
    
    // Check if map container is visible
    const container = mapInstance.getContainer();
    if (!container) return;
    
    // Check visibility using multiple methods
    const isVisible = container.offsetParent !== null && 
                     container.offsetWidth > 0 && 
                     container.offsetHeight > 0;
    
    if (!isVisible && retries > 0) {
        // Container is hidden, try again after a short delay
        setTimeout(() => invalidateMapSize(mapInstance, delay, retries - 1), 200);
        return;
    }
    
    // Use requestAnimationFrame for smooth timing
    requestAnimationFrame(() => {
        setTimeout(() => {
            if (mapInstance && !mapInstance._destroyed) {
                try {
                    mapInstance.invalidateSize();
                } catch (e) {
                    console.warn('Error invalidating map size:', e);
                }
            }
        }, delay);
    });
}

// Set up IntersectionObserver to handle map visibility changes
function setupMapVisibilityObserver() {
    // Create observer for map containers
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0) {
                const containerId = entry.target.id;
                
                // Invalidate the appropriate map
                if (containerId === 'map' && map) {
                    invalidateMapSize(map, 100);
                } else if (containerId === 'dashboardMap' && typeof dashboardMap !== 'undefined' && dashboardMap) {
                    invalidateMapSize(dashboardMap, 100);
                }
            }
        });
    }, {
        threshold: 0.1 // Trigger when at least 10% visible
    });
    
    // Observe all map containers
    const mapContainer = document.getElementById('map');
    const dashboardMapContainer = document.getElementById('dashboardMap');
    
    if (mapContainer) observer.observe(mapContainer);
    if (dashboardMapContainer) observer.observe(dashboardMapContainer);
}

// Initialize Leaflet map
function initMap() {
    console.log('Initializing map...');
    
    // Get region center and zoom, or fall back to Singapore
    const regionCenter = currentRegionData?.center || [1.3521, 103.8198];
    const regionZoom = currentRegionData?.zoom || 11;
    const regionMinZoom = currentRegionData?.minZoom || 10;
    
    map = L.map('map').setView(regionCenter, regionZoom);
    console.log('Map initialized');
    
    // Add CartoDB Light tile layer (clean, modern style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd'
    }).addTo(map);

    // Create a custom pane for the region boundary to ensure visibility
    map.createPane('boundaryPane');
    map.getPane('boundaryPane').style.zIndex = 650;
    
    // Create region boundary polygon (hidden by default)
    // Uses createRegionPolygonLayer to handle both single and multi-polygon regions
    regionPolygonLayer = createRegionPolygonLayer(map);
    // Legacy alias
    singaporePolygonLayer = regionPolygonLayer;
    
    // Don't add to map initially - user can toggle it
    
    // Fit map to region bounds and restrict panning
    map.fitBounds(regionPolygonLayer.getBounds(), { padding: [20, 20] });
    map.setMaxBounds(regionPolygonLayer.getBounds().pad(0.5));
    map.setMinZoom(regionMinZoom);
    console.log(`${currentRegionData?.name || 'Region'} boundary polygon ready (hidden by default)`);

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
    console.log('Marker cluster initialized');
}

// Toggle region boundary polygon visibility
function toggleRegionBoundary() {
    regionBoundaryVisible = !regionBoundaryVisible;
    singaporeBoundaryVisible = regionBoundaryVisible; // Legacy alias
    
    const regionName = currentRegionData?.name || 'Region';
    
    // Toggle on main map
    if (map && regionPolygonLayer) {
        if (regionBoundaryVisible) {
            regionPolygonLayer.addTo(map);
        } else {
            map.removeLayer(regionPolygonLayer);
        }
    }
    
    // Toggle on dashboard map
    if (typeof dashboardMap !== 'undefined' && dashboardMap && dashboardPolygonLayer) {
        if (regionBoundaryVisible) {
            dashboardPolygonLayer.addTo(dashboardMap);
        } else {
            dashboardMap.removeLayer(dashboardPolygonLayer);
        }
    }
    
    // Update all toggle buttons
    const buttonText = regionBoundaryVisible ? 'Hide Boundary' : 'Show Boundary';
    const buttonTitle = regionBoundaryVisible ? `Hide ${regionName} boundary` : `Show ${regionName} boundary`;
    
    ['boundaryToggleBtn', 'dashboardBoundaryToggleBtn'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.toggle('active', regionBoundaryVisible);
            btn.title = buttonTitle;
            const span = btn.querySelector('span');
            if (span) span.textContent = buttonText;
        }
    });
    
    console.log(`${regionName} boundary ${regionBoundaryVisible ? 'shown' : 'hidden'}`);
}

// Legacy alias for backward compatibility
function toggleSingaporeBoundary() {
    toggleRegionBoundary();
}


// Load all data
async function loadData() {
    showLoading(true);
    
    try {
        // Fetch changesets and statistics in parallel (with region parameter)
        const regionParam = `region=${encodeURIComponent(currentRegion)}`;
        const [changesetsResponse, statsResponse] = await Promise.all([
            fetch(`/api/changesets?${regionParam}`),
            fetch(`/api/statistics?${regionParam}`)
        ]);
        
        const changesetsData = await changesetsResponse.json();
        const statsData = await statsResponse.json();
        
        console.log(`Changesets API response for ${currentRegion}:`, changesetsData);
        console.log('Number of changesets:', changesetsData.changesets?.length);
        
        if (changesetsData.success) {
            changesets = changesetsData.changesets;
            console.log('Setting changesets array:', changesets.length);
            
            // Save any needs_review changesets to persistent storage
            changesets.forEach(cs => {
                if (cs.validation && cs.validation.status === 'needs_review') {
                    saveNeedsReviewChangeset(cs);
                }
                
                // Save Grab changesets (usernames starting with "GrabSG")
                if (cs.user && cs.user.startsWith('GrabSG')) {
                    saveGrabChangeset(cs);
                }
            });
            
            // Apply current filters (this will include stored needs_review changesets if filter is active)
            applyFilters();
            console.log('Updated changesets list and applied filters');
        } else {
            console.error('ERROR: Changesets API returned success: false');
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
    // Update time range label
    if (stats.time_range_hours) {
        const hours = stats.time_range_hours;
        let timeText;
        
        if (hours < 24) {
            timeText = `last ${hours} hour${hours !== 1 ? 's' : ''}`;
        } else if (hours === 24) {
            timeText = 'last 24 hours';
        } else if (hours < 168) {
            const days = Math.round(hours / 24);
            timeText = `last ${days} day${days !== 1 ? 's' : ''}`;
        } else {
            const weeks = Math.round(hours / 168);
            timeText = `last ${weeks} week${weeks !== 1 ? 's' : ''}`;
        }
        
        const timeRangeLabel = document.getElementById('timeRangeLabel');
        if (timeRangeLabel) {
            timeRangeLabel.textContent = `In the ${timeText}...`;
        }
    }
    
    // Animate the numbers (with null checks)
    // Note: totalChangesets, totalChanges, and changesetsNeedingReview are now updated
    // by updateStatsCardsFromAnalytics() in analytics.js which has more complete data
    // We still keep these as fallback in case analytics fails to load
    const totalChangesetsEl = document.getElementById('totalChangesets');
    const totalChangesEl = document.getElementById('totalChanges');
    
    if (totalChangesetsEl) {
        animateValue('totalChangesets', 0, stats.total_changesets, 1000);
    }
    if (totalChangesEl) {
        animateValue('totalChanges', 0, stats.total_changes, 1000);
    }
    // changesetsNeedingReview is now updated by analytics.js updateStatsCardsFromAnalytics()
    // which provides accurate counts from the full analytics dataset
}

// Update changesets list
function updateChangesetsList(changesets) {
    const container = document.getElementById('changesetsList');
    const paginationContainer = document.getElementById('changesetsPagination');
    
    if (!changesets || changesets.length === 0) {
        const regionName = currentRegionData?.name || 'the selected';
        container.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>No Changesets Found</h3>
                <p>No recent changesets match your filters in the ${regionName} region.</p>
            </div>
        `;
        // Hide pagination if no results
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(changesets.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedChangesets = changesets.slice(startIndex, endIndex);
    
    container.innerHTML = paginatedChangesets.map(cs => {
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
                parts.push(`<span class="badge badge-modified">${formatNumber(details.total_modified)} modified</span>`);
            }
            if (details.total_deleted > 0) {
                parts.push(`<span class="badge badge-deleted">${formatNumber(details.total_deleted)} deleted</span>`);
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
                validationHTML = `<span class="badge badge-needs-review" title="${escapeHtml(reasons)}">Needs Review</span>`;
            } else {
                validationHTML = `<span class="badge badge-valid">✓ Valid</span>`;
            }
        }
        
        // Add mass changes tag badge if present
        let massChangesHTML = '';
        if (cs.tags && cs.tags.mass_changes === 'yes') {
            const totalChanges = cs.tags.total_changes || 
                (cs.details ? (cs.details.total_created || 0) + (cs.details.total_modified || 0) + (cs.details.total_deleted || 0) : 0) || 
                '50+';
            const createdCount = cs.tags.created_count || cs.details?.total_created || 0;
            const modifiedCount = cs.tags.modified_count || cs.details?.total_modified || 0;
            const deletedCount = cs.tags.deleted_count || cs.details?.total_deleted || 0;
            const changeDetails = [];
            if (createdCount > 0) changeDetails.push(`${createdCount} added`);
            if (modifiedCount > 0) changeDetails.push(`${modifiedCount} modified`);
            if (deletedCount > 0) changeDetails.push(`${deletedCount} deleted`);
            const changeSummary = changeDetails.length > 0 ? changeDetails.join(', ') : `${totalChanges} changes`;
            massChangesHTML = `<span class="badge badge-mass-deletion" title="Mass changes: ${changeSummary}">Mass Changes</span>`;
        } else if (cs.tags && cs.tags.mass_deletion === 'yes') {
            // Backward compatibility: show old mass_deletion tag
            const deletedCount = cs.tags.deleted_count || cs.details?.total_deleted || '50+';
            massChangesHTML = `<span class="badge badge-mass-deletion" title="Mass deletion: ${deletedCount} elements deleted">Mass Deletion</span>`;
        }
        
        // Add ERP badge if name=ERP detected
        let erpBadgeHTML = '';
        if (cs.validation && cs.validation.flags && cs.validation.flags.includes('erp')) {
            erpBadgeHTML = `<span class="badge badge-erp" title="ERP modification detected">ERP</span>`;
        }
        
        // Add oneway badge if one-way edits detected
        let onewayBadgeHTML = '';
        if (cs.validation && cs.validation.flags && cs.validation.flags.includes('oneway')) {
            onewayBadgeHTML = `<span class="badge badge-oneway" title="One-way edit detected">One-Way</span>`;
        }
        
        // Add access badge if access tag edits detected
        let accessBadgeHTML = '';
        if (cs.validation && cs.validation.flags && cs.validation.flags.includes('access')) {
            accessBadgeHTML = `<span class="badge badge-access" title="Access tag edit detected">Access</span>`;
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
                    ${massChangesHTML}
                    ${erpBadgeHTML}
                    ${onewayBadgeHTML}
                    ${accessBadgeHTML}
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
    
    // Update pagination controls
    updatePaginationControls(changesets.length, totalPages);
}

// Update pagination controls
function updatePaginationControls(totalItems, totalPages) {
    const paginationContainer = document.getElementById('changesetsPagination');
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    
    let paginationHTML = `
        <div class="pagination-info" style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 12px;">
            Showing ${startItem}-${endItem} of ${totalItems} changesets
        </div>
        <div class="pagination-controls" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
    `;
    
    // Previous button
    paginationHTML += `
        <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} style="padding: 8px 16px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); border-radius: 6px; cursor: pointer; transition: all 0.2s ease; ${currentPage === 1 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Previous
        </button>
    `;
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="goToPage(1)" style="padding: 8px 12px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); border-radius: 6px; cursor: pointer; transition: all 0.2s ease;">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span style="padding: 8px 4px; color: var(--text-secondary);">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-btn" onclick="goToPage(${i})" ${i === currentPage ? 'style="padding: 8px 12px; border: 1px solid var(--primary-color); background: var(--primary-color); color: white; border-radius: 6px; cursor: pointer; font-weight: 600;"' : 'style="padding: 8px 12px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); border-radius: 6px; cursor: pointer; transition: all 0.2s ease;"'}>
                ${i}
            </button>
        `;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span style="padding: 8px 4px; color: var(--text-secondary);">...</span>`;
        }
        paginationHTML += `<button class="pagination-btn" onclick="goToPage(${totalPages})" style="padding: 8px 12px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); border-radius: 6px; cursor: pointer; transition: all 0.2s ease;">${totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `
        <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} style="padding: 8px 16px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); border-radius: 6px; cursor: pointer; transition: all 0.2s ease; ${currentPage === totalPages ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
            Next
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        </button>
    `;
    
    paginationHTML += `</div>`;
    paginationContainer.innerHTML = paginationHTML;
}

// Navigate to specific page
function goToPage(page) {
    const totalPages = Math.ceil(filteredChangesets.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    updateChangesetsList(filteredChangesets);
    
    // Scroll to top of changesets list
    const container = document.getElementById('changesetsList');
    if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Update contributors list
function updateContributorsList(contributors) {
    const container = document.getElementById('contributorsList');
    
    // Check if container exists (it might not exist on all pages)
    if (!container) {
        return;
    }
    
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
    console.log('updateMap called with', changesets?.length, 'changesets');
    
    if (!markerCluster) {
        console.error('ERROR: markerCluster not initialized!');
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
                const badgeText = status === 'valid' ? 'Valid' : 
                                 'Needs Review';
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
    
    console.log('Created', markersCreated, 'markers out of', changesets.length, 'changesets');
    
    // Update legend
    updateLegend();
}

// Filter and zoom to a specific changeset by ID
function filterToChangeset(changesetId) {
    const csId = parseInt(changesetId);
    if (isNaN(csId)) {
        console.warn(`WARNING: Invalid changeset ID: ${changesetId}`);
        return;
    }
    
    // Find the changeset in the current changesets array
    const targetChangeset = changesets.find(cs => cs.id === csId);
    
    if (!targetChangeset) {
        console.warn(`WARNING: Changeset ${csId} not found in current data`);
        // Try to find in stored needs_review changesets
        const storedNeedsReview = getAllStoredNeedsReviewChangesets();
        const storedChangeset = storedNeedsReview.find(cs => cs.id === csId);
        
        if (storedChangeset) {
            console.log(`Found changeset ${csId} in stored needs_review changesets`);
            // Update map with just this changeset
            updateMap([storedChangeset]);
            
            // Zoom to changeset bbox if available
            if (storedChangeset.bbox && storedChangeset.bbox.min_lat && storedChangeset.bbox.max_lat && 
                storedChangeset.bbox.min_lon && storedChangeset.bbox.max_lon) {
                const bounds = [
                    [storedChangeset.bbox.min_lat, storedChangeset.bbox.min_lon],
                    [storedChangeset.bbox.max_lat, storedChangeset.bbox.max_lon]
                ];
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                
                // Open popup for the marker
                setTimeout(() => {
                    const marker = markers.find(m => {
                        const lat = m.getLatLng().lat;
                        const lon = m.getLatLng().lng;
                        const centerLat = (storedChangeset.bbox.min_lat + storedChangeset.bbox.max_lat) / 2;
                        const centerLon = (storedChangeset.bbox.min_lon + storedChangeset.bbox.max_lon) / 2;
                        return Math.abs(lat - centerLat) < 0.001 && Math.abs(lon - centerLon) < 0.001;
                    });
                    if (marker) {
                        marker.openPopup();
                    }
                }, 500);
            }
            return;
        }
        
        console.warn(`WARNING: Changeset ${csId} not found in stored changesets either`);
        return;
    }
    
    console.log(`Found changeset ${csId}, filtering and zooming...`);
    
    // Update map with just this changeset
    updateMap([targetChangeset]);
    
    // Update changesets list to show only this changeset
    // Reset pagination when filtering to a specific changeset
    currentPage = 1;
    filteredChangesets = [targetChangeset];
    updateChangesetsList([targetChangeset]);
    
    // Zoom to changeset bbox if available
    if (targetChangeset.bbox && targetChangeset.bbox.min_lat && targetChangeset.bbox.max_lat && 
        targetChangeset.bbox.min_lon && targetChangeset.bbox.max_lon) {
        const bounds = [
            [targetChangeset.bbox.min_lat, targetChangeset.bbox.min_lon],
            [targetChangeset.bbox.max_lat, targetChangeset.bbox.max_lon]
        ];
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        
        // Open popup for the marker
        setTimeout(() => {
            const marker = markers.find(m => {
                const lat = m.getLatLng().lat;
                const lon = m.getLatLng().lng;
                const centerLat = (targetChangeset.bbox.min_lat + targetChangeset.bbox.max_lat) / 2;
                const centerLon = (targetChangeset.bbox.min_lon + targetChangeset.bbox.max_lon) / 2;
                return Math.abs(lat - centerLat) < 0.001 && Math.abs(lon - centerLon) < 0.001;
            });
            if (marker) {
                marker.openPopup();
            }
        }, 500);
    }
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
            <span class="legend-toggle">${validationVisibility.valid ? 'Show' : 'Hide'}</span>
        </div>
        <div class="legend-item interactive ${validationVisibility.needs_review ? 'active' : 'inactive'}" onclick="toggleValidationVisibility('needs_review')">
            <span class="legend-color" style="background: #f59e0b;"></span>
            <span class="legend-label">Needs Review</span>
            <span class="legend-toggle">${validationVisibility.needs_review ? 'Show' : 'Hide'}</span>
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
    
    // Check if element exists before animating
    if (!element) {
        console.warn(`WARNING: Element with id '${id}' not found for animation`);
        return;
    }
    
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
        'road': '',
        'building': '',
        'railway': '',
        'station': '',
        'amenity': '',
        'place': '',
        'shop': '',
        'tourism': '',
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

// Initialize tabs
function initTabs() {
    console.log('Initializing tabs...');
    const sidenavItems = document.querySelectorAll('.sidenav-item');
    console.log('Found', sidenavItems.length, 'tab buttons');

    if (sidenavItems.length === 0) {
        console.error('No tab buttons found!');
        return;
    }

    // Convert NodeList to Array to avoid issues with DOM manipulation
    Array.from(sidenavItems).forEach((button, index) => {
        const targetTab = button.getAttribute('data-tab');
        console.log(`Setting up tab ${index}: ${targetTab}`);
        
        // Remove any existing event listeners by cloning the button
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const targetTabId = this.getAttribute('data-tab');
            console.log('Tab clicked:', targetTabId);
            
            if (!targetTabId) {
                console.error('No data-tab attribute found on button');
                return;
            }
            
            // Get current active tab before switching
            const currentActiveTab = document.querySelector('.tab-content.active')?.id || 
                                   document.querySelector('.sidenav-item.active')?.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            document.querySelectorAll('.sidenav-item').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // Add active class to clicked button and corresponding content
            this.classList.add('active');
            const targetTabElement = document.getElementById(targetTabId);
            if (targetTabElement) {
                targetTabElement.classList.add('active');
                console.log('Switched to tab:', targetTabId);
            } else {
                console.error('Tab content element not found:', targetTabId);
            }

            // Reset filters when returning to changesets tab (list-view)
            // This ensures filters reset to "All" when coming back from another tab
            const changesetsTab = 'list-view';
            if (targetTabId === changesetsTab && currentActiveTab !== changesetsTab) {
                if (typeof resetFilters === 'function') {
                    resetFilters();
                }
            }

            // Show stats only on dashboard tab
            const dashboardStats = document.getElementById('dashboardStats');
            const dashboardTimeRange = document.getElementById('dashboardTimeRange');
            if (targetTabId === 'dashboard') {
                if (dashboardStats) dashboardStats.style.display = 'grid';
                if (dashboardTimeRange) dashboardTimeRange.style.display = 'flex';
            } else {
                if (dashboardStats) dashboardStats.style.display = 'none';
                if (dashboardTimeRange) dashboardTimeRange.style.display = 'none';
            }

            // Load specific tab content and invalidate map sizes
            if (targetTabId === 'map-view' && map) {
                invalidateMapSize(map);
            } else if (targetTabId === 'dashboard') {
                // Initialize dashboard map if needed and invalidate size
                if (typeof initializeDashboardMap === 'function') {
                    initializeDashboardMap();
                }
                // Invalidate dashboard map size
                if (typeof dashboardMap !== 'undefined' && dashboardMap) {
                    invalidateMapSize(dashboardMap);
                }
            } else if (targetTabId === 'atlas-ai') {
                // Initialize Atlas AI bubble with typewriter effect when tab is shown
                if (typeof initAtlasBubble === 'function') {
                    // Reset bubble text first
                    const bubbleTextEl = document.getElementById('atlasBubbleText');
                    if (bubbleTextEl) {
                        bubbleTextEl.textContent = '';
                    }
                    // Trigger typewriter effect
                    setTimeout(() => {
                        initAtlasBubble();
                    }, 100);
                }
            } else if (targetTabId === 'settings') {
                // Initialize settings page when tab is shown
                if (typeof initSettingsPage === 'function') {
                    setTimeout(() => {
                        initSettingsPage();
                    }, 100);
                }
            }
        });
    });
    
    console.log('Tabs initialized successfully');
}




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

// Helper function to check if an element is a routing element (road)
function isRoutingElementJS(elem) {
    // Only ways (roads) affect routing
    if (elem.tagName !== 'way') {
        return false;
    }
    
    // Excluded highway values (foot paths and cycleways)
    const excludedHighwayValues = ['footway', 'path', 'pedestrian', 'steps', 'bridleway', 'cycleway'];
    
    // Check for highway tag and exclude foot paths
    const tags = elem.querySelectorAll('tag');
    for (const tag of tags) {
        if (tag.getAttribute('k') === 'highway') {
            const highwayValue = (tag.getAttribute('v') || '').toLowerCase();
            // Exclude foot paths
            if (!excludedHighwayValues.includes(highwayValue)) {
                return true;
            }
        }
    }
    return false;
}

// Parse changeset XML and visualize on map - FILTER: Only show routing elements (roads)
function parseAndVisualizeChangeset(xmlDoc, layerGroup, mapInstance) {
    const stats = {
        created: { nodes: 0, ways: 0 },
        modified: { nodes: 0, ways: 0 },
        deleted: { nodes: 0, ways: 0 },
        bounds: null,
        center: null
    };
    
    // Store all nodes by ID for way rendering (only for routing elements)
    const allNodes = {};
    
    // Colors for different actions
    const colors = {
        create: '#22c55e',  // Green
        modify: '#eab308',  // Yellow
        delete: '#ef4444'   // Red
    };
    
    const bounds = L.latLngBounds();
    
    // First pass: collect nodes from routing elements (roads) only
    ['create', 'modify', 'delete'].forEach(action => {
        const actionElement = xmlDoc.querySelector(action);
        if (actionElement) {
            // Only collect nodes from ways that are routing elements
            const ways = actionElement.querySelectorAll('way');
            ways.forEach(way => {
                if (isRoutingElementJS(way)) {
                    const wayNodes = way.querySelectorAll('nd');
                    wayNodes.forEach(nd => {
                        const ref = nd.getAttribute('ref');
                        // We'll need to fetch node coordinates separately if not in changeset
                        // For now, we'll collect them in the second pass
                    });
                }
            });
            
            // Also collect standalone nodes (though they don't affect routing directly)
            // But we'll skip them since we only care about roads
        }
    });
    
    // Second pass: render routing elements (roads) only
    ['create', 'modify', 'delete'].forEach(action => {
        const actionElement = xmlDoc.querySelector(action);
        if (!actionElement) return;
        
        const color = colors[action];
        const actionKey = action === 'create' ? 'created' : action === 'modify' ? 'modified' : 'deleted';
        
        // Render ways as polylines - FILTER: Only routing elements (roads)
        const ways = actionElement.querySelectorAll('way');
        ways.forEach(way => {
            // Only process routing elements (roads)
            if (!isRoutingElementJS(way)) {
                return;
            }
            
            const wayNodes = way.querySelectorAll('nd');
            const coordinates = [];
            
            // Try to get coordinates from nodes in the changeset
            wayNodes.forEach(nd => {
                const ref = nd.getAttribute('ref');
                // Look for the node in the changeset
                const nodeInChangeset = xmlDoc.querySelector(`node[id="${ref}"]`);
                if (nodeInChangeset) {
                    const lat = parseFloat(nodeInChangeset.getAttribute('lat'));
                    const lon = parseFloat(nodeInChangeset.getAttribute('lon'));
                    if (lat && lon) {
                        coordinates.push([lat, lon]);
                        bounds.extend([lat, lon]);
                        allNodes[ref] = { lat, lon, action };
                    }
                } else if (allNodes[ref]) {
                    // Use previously collected node
                    const nodeData = allNodes[ref];
                    coordinates.push([nodeData.lat, nodeData.lon]);
                    bounds.extend([nodeData.lat, nodeData.lon]);
                }
            });
            
            if (coordinates.length >= 2) {
                // Get highway tag for popup
                const tags = way.querySelectorAll('tag');
                let highwayType = 'road';
                for (const tag of tags) {
                    if (tag.getAttribute('k') === 'highway') {
                        highwayType = tag.getAttribute('v');
                        break;
                    }
                }
                
                L.polyline(coordinates, {
                    color: color,
                    weight: 4,
                    opacity: 0.8,
                    smoothFactor: 1
                }).bindPopup(`
                    <div style="font-size: 0.85rem;">
                        <strong>${action.toUpperCase()} Road</strong><br/>
                        ID: ${way.getAttribute('id')}<br/>
                        Type: ${highwayType}<br/>
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
                                const validationText = validationStatus === 'valid' ? 'Valid' : 'Needs Review';
            
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
    document.getElementById('loadingDetails').textContent = details || 'Initializing...';
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
        // Use longer timeout for large changesets
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout
        
        let response;
        try {
            response = await fetch(`/api/changeset/${changesetId}/comparison`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - changeset is too large. Processing may take longer than expected.');
            }
            throw error;
        }
        
        updateComparisonProgress(30, 'Processing data...', 'Parsing changeset XML');
        
        const data = await response.json();
        
        if (!data.success) {
            if (data.error_type === 'timeout') {
                throw new Error('Request timeout - changeset is too large. Try again or contact support.');
            }
            throw new Error(data.error || 'Failed to fetch comparison data');
        }
        
        updateComparisonProgress(60, 'Analyzing changes...', 'Calculating element geometries');
        
        comparisonData = data.comparison;
        
        // Show warning for large changesets with partial data
        if (comparisonData.metadata && comparisonData.metadata.is_large_changeset) {
            showLargeChangesetWarning(comparisonData.metadata);
        }
        
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
        
        // Show user-friendly error message
        let errorMessage = 'Failed to load changeset comparison: ' + error.message;
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
            errorMessage = 'This changeset is very large and processing timed out. ' +
                          'The comparison tool is working on improving support for large changesets. ' +
                          'Please try again in a moment or contact support if the issue persists.';
        }
        
        alert(errorMessage);
        closeComparisonModal();
    }
}

// Show warning banner for large changesets
function showLargeChangesetWarning(metadata) {
    // Remove any existing warnings
    const existingWarning = document.querySelector('.large-changeset-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    const warning = document.createElement('div');
    warning.className = 'large-changeset-warning';
    warning.style.cssText = `
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        border-left: 4px solid #f59e0b;
        padding: 12px 16px;
        margin: 16px;
        border-radius: 6px;
        color: #92400e;
        font-size: 14px;
    `;
    
    let warningText = '<strong>WARNING: Large Changeset Detected</strong><br>';
    
    if (metadata.total_modified > 500) {
        warningText += `<p style="margin: 8px 0 0 0;">Showing old version data for ${metadata.modified_with_old_data} of ${metadata.total_modified} modified elements ` +
                      `(processing limited to first 500 for performance).</p>`;
    }
    
    if (metadata.total_deleted > 200) {
        warningText += `<p style="margin: 8px 0 0 0;">Processing ${metadata.deleted_with_geometry} of ${metadata.total_deleted} deleted elements with geometry data.</p>`;
    }
    
    warning.innerHTML = warningText;
    
    // Insert after tabs, before filters
    const tabs = document.querySelector('.comparison-tabs');
    if (tabs && tabs.parentNode) {
        tabs.parentNode.insertBefore(warning, tabs.nextSibling);
    } else {
        // Fallback: insert at top of modal body
        const modalBody = document.querySelector('.comparison-modal-body');
        if (modalBody) {
            modalBody.insertBefore(warning, modalBody.firstChild);
        }
    }
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        if (warning.parentNode) {
            warning.style.transition = 'opacity 0.5s';
            warning.style.opacity = '0';
            setTimeout(() => warning.remove(), 500);
        }
    }, 10000);
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
    beforeMap = L.map('beforeMap', {
        maxZoom: 22
    }).setView([1.3521, 103.8198], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 22
    }).addTo(beforeMap);
    
    // Add layer groups to before map
    beforeLayers.created.addTo(beforeMap);
    beforeLayers.modified.addTo(beforeMap);
    beforeLayers.deleted.addTo(beforeMap);
    
    // Initialize After map
    afterMap = L.map('afterMap', {
        maxZoom: 22
    }).setView([1.3521, 103.8198], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 22
    }).addTo(afterMap);
    
    // Add layer groups to after map
    afterLayers.created.addTo(afterMap);
    afterLayers.modified.addTo(afterMap);
    afterLayers.deleted.addTo(afterMap);
    
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



