// ===== ATLAS AI FUNCTIONS =====

// Store selected image
let atlasSelectedImage = null;

// Initialize Atlas AI greeting
function initAtlasGreeting() {
    const greetingEl = document.getElementById('atlasGreeting');
    if (!greetingEl) return;
    
    const hour = new Date().getHours();
    let greeting;
    
    if (hour < 12) {
        greeting = 'Good Morning';
    } else if (hour < 17) {
        greeting = 'Good Afternoon';
    } else {
        greeting = 'Good Evening';
    }
    
    greetingEl.textContent = greeting;
}

// Show chat screen and hide welcome screen
function showChatScreen() {
    const welcomeScreen = document.getElementById('atlasWelcomeScreen');
    const chatScreen = document.getElementById('atlasChatScreen');
    
    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (chatScreen) chatScreen.style.display = 'flex';
}

// Reset chat and show welcome screen
function resetAtlasChat() {
    const welcomeScreen = document.getElementById('atlasWelcomeScreen');
    const chatScreen = document.getElementById('atlasChatScreen');
    const messagesContainer = document.getElementById('atlasAIMessages');
    
    if (welcomeScreen) welcomeScreen.style.display = 'flex';
    if (chatScreen) chatScreen.style.display = 'none';
    if (messagesContainer) messagesContainer.innerHTML = '';
    
    // Reset image
    removeAtlasImage();
    
    // Refresh greeting
    initAtlasGreeting();
}

// Handle Enter key press in chat input
function handleAtlasChatKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendAtlasChatMessage();
    }
}

// Send message from chat screen input
async function sendAtlasChatMessage() {
    const chatInput = document.getElementById('atlasAIChatInput');
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    if (!message && !atlasSelectedImage) return;
    
    chatInput.value = '';
    await sendAtlasMessageInternal(message);
}

// Handle image selection
function handleAtlasImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('Image size must be less than 10MB');
        return;
    }
    
    // Store the file
    atlasSelectedImage = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('atlasPreviewImage').src = e.target.result;
        document.getElementById('atlasAIImagePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
    
    // Update placeholder
    const mainInput = document.getElementById('atlasAIInput');
    if (mainInput) mainInput.placeholder = 'Ask about this image...';
}

// Remove selected image
function removeAtlasImage() {
    atlasSelectedImage = null;
    const imagePreview = document.getElementById('atlasAIImagePreview');
    const imageInput = document.getElementById('atlasAIImageInput');
    const mainInput = document.getElementById('atlasAIInput');
    
    if (imagePreview) imagePreview.style.display = 'none';
    if (imageInput) imageInput.value = '';
    if (mainInput) mainInput.placeholder = 'Ask AI a question or make a request...';
}

// Handle Enter key press
function handleAtlasKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendAtlasMessage();
    }
}

// Send message to Atlas AI (from welcome screen)
async function sendAtlasMessage(predefinedMessage = null) {
    const input = document.getElementById('atlasAIInput');
    const message = predefinedMessage || (input ? input.value.trim() : '');
    
    // Require either message or image
    if (!message && !atlasSelectedImage) return;
    
    // Clear input
    if (input) input.value = '';
    
    // Switch to chat view
    showChatScreen();
    
    // Send the message
    await sendAtlasMessageInternal(message);
}

// Internal function to send message to Atlas AI
async function sendAtlasMessageInternal(message) {
    const sendBtn = document.getElementById('atlasAISendBtn');
    const chatSendBtn = document.getElementById('atlasAIChatSendBtn');
    
    // Store image reference for display
    const imageToDisplay = atlasSelectedImage;
    const imagePreviewSrc = imageToDisplay ? document.getElementById('atlasPreviewImage').src : null;
    
    // Add user message (with image if present)
    addAtlasMessage('user', message || 'Can you analyze this image?', imagePreviewSrc);
    
    // Disable send buttons
    if (sendBtn) sendBtn.disabled = true;
    if (chatSendBtn) chatSendBtn.disabled = true;
    
    // Show loading indicator
    const loadingId = showAtlasLoading();
    
    try {
        let response;
        
        if (imageToDisplay) {
            // Send with image using FormData
            const formData = new FormData();
            formData.append('message', message || 'Analyze this image');
            formData.append('image', imageToDisplay);
            formData.append('context', JSON.stringify({
                page: getCurrentPage(),
                username: getCurrentUsername()
            }));
            
            response = await fetch('/api/atlas-ai/chat', {
                method: 'POST',
                body: formData
            });
            
            // Clear image after sending
            removeAtlasImage();
        } else {
            // Send text-only message
            response = await fetch('/api/atlas-ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    context: {
                        page: getCurrentPage(),
                        username: getCurrentUsername()
                    }
                })
            });
        }
        
        if (!response.ok) {
            throw new Error('Failed to get response from Atlas AI');
        }
        
        const data = await response.json();
        
        // Remove loading indicator
        removeAtlasLoading(loadingId);
        
        // Add assistant response
        addAtlasMessage('assistant', data.response);
        
    } catch (error) {
        console.error('Atlas AI Error:', error);
        removeAtlasLoading(loadingId);
        addAtlasMessage('assistant', 'I apologize, but I encountered an error. Please try again later.');
    }
    
    // Re-enable send buttons
    if (sendBtn) sendBtn.disabled = false;
    if (chatSendBtn) chatSendBtn.disabled = false;
}

// Add message to chat
function addAtlasMessage(role, content, imageSrc = null) {
    const messagesContainer = document.getElementById('atlasAIMessages');
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `atlas-message atlas-message-${role}`;
    
    let avatarIcon;
    let name;
    
    if (role === 'assistant') {
        name = 'Atlas';
        avatarIcon = `
            <img src="/static/logo.png" alt="Atlas Logo" style="height: 40px; width: auto; object-fit: contain;">
        `;
    } else {
        name = 'You';
        avatarIcon = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        `;
    }
    
    // For assistant messages, parse markdown; for user messages, escape HTML
    let formattedContent;
    if (role === 'assistant') {
        // Configure marked options for better rendering
        marked.setOptions({
            breaks: true,
            gfm: true,
            sanitize: false
        });
        formattedContent = marked.parse(content);
    } else {
        formattedContent = escapeHtml(content).replace(/\n/g, '<br>');
    }
    
    // Add image if present
    let imageHTML = '';
    if (imageSrc) {
        imageHTML = `<div class="atlas-message-image"><img src="${imageSrc}" alt="Attached image"></div>`;
    }
    
    messageDiv.innerHTML = `
        <div class="atlas-message-avatar">${avatarIcon}</div>
        <div class="atlas-message-content">
            <div class="atlas-message-header">
                <span class="atlas-message-name">${name}</span>
                <span class="atlas-message-time">${time}</span>
            </div>
            ${imageHTML}
            <div class="atlas-message-text">${formattedContent}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show loading indicator with enhanced animations
function showAtlasLoading() {
    const messagesContainer = document.getElementById('atlasAIMessages');
    const loadingId = 'atlas-loading-' + Date.now();
    
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = 'atlas-message atlas-message-assistant';
    
    loadingDiv.innerHTML = `
        <div class="atlas-message-avatar atlas-avatar-typing">
            <img src="/static/logo.png" alt="Atlas Logo" style="height: 40px; width: auto; object-fit: contain;">
        </div>
        <div class="atlas-message-content">
            <div class="atlas-message-header">
                <span class="atlas-message-name">Atlas</span>
                <span class="atlas-message-time atlas-typing-status">Thinking...</span>
            </div>
            <div class="atlas-message-text">
                <div class="atlas-message-loading">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    return loadingId;
}

// Remove loading indicator
function removeAtlasLoading(loadingId) {
    const loadingDiv = document.getElementById(loadingId);
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Helper function to get current page context
function getCurrentPage() {
    const activeTab = document.querySelector('.tab-content.active');
    return activeTab ? activeTab.id : 'unknown';
}

// Helper function to get current username
function getCurrentUsername() {
    // Try to get username from user profile section
    const userNameEl = document.querySelector('.user-name');
    return userNameEl ? userNameEl.textContent : null;
}

// Initialize Atlas AI on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize greeting
    initAtlasGreeting();
    
    // Auto-resize textarea (if using textarea)
    const textarea = document.getElementById('atlasAIInput');
    if (textarea && textarea.tagName === 'TEXTAREA') {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }
    
    // Also initialize greeting when user logs in (tab becomes visible)
    const atlasAITab = document.querySelector('[data-tab="atlas-ai"]');
    if (atlasAITab) {
        atlasAITab.addEventListener('click', () => {
            setTimeout(initAtlasGreeting, 100);
        });
    }
});

// ===== MAP COMPARISON FUNCTIONS =====

// Render map comparison when it appears in the DOM
function initializeMapComparison(messageElement) {
    const mapDataDiv = messageElement.querySelector('.atlas-map-comparison');
    if (!mapDataDiv) return;
    
    const changesetId = mapDataDiv.dataset.changesetId;
    const bounds = mapDataDiv.dataset.bounds ? JSON.parse(mapDataDiv.dataset.bounds) : null;
    
    if (!changesetId || !bounds) {
        console.log('No changeset ID or bounds found for map comparison');
        return;
    }
    
    // Create map container HTML
    const mapContainerHTML = `
        <div class="atlas-map-comparison-container" id="map-comparison-${changesetId}">
            <div class="atlas-map-comparison-header">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M2 12h20"></path>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                Interactive Map Comparison
            </div>
            <div class="atlas-map-comparison-maps">
                <div class="atlas-map-side">
                    <div class="atlas-map-label before">Before Changes</div>
                    <div class="atlas-map-canvas" id="map-before-${changesetId}">
                        <div class="atlas-map-loading">Loading map...</div>
                    </div>
                </div>
                <div class="atlas-map-side">
                    <div class="atlas-map-label after">After Changes</div>
                    <div class="atlas-map-canvas" id="map-after-${changesetId}">
                        <div class="atlas-map-loading">Loading map...</div>
                    </div>
                </div>
            </div>
            <div class="atlas-map-comparison-legend">
                <div class="atlas-map-legend-item">
                    <div class="atlas-map-legend-color" style="background: #22c55e;"></div>
                    <span>Created</span>
                </div>
                <div class="atlas-map-legend-item">
                    <div class="atlas-map-legend-color" style="background: #f97316;"></div>
                    <span>Modified</span>
                </div>
                <div class="atlas-map-legend-item">
                    <div class="atlas-map-legend-color" style="background: #ef4444;"></div>
                    <span>Deleted</span>
                </div>
                <div class="atlas-map-legend-item">
                    <span style="margin-left: 12px;">💡 Click and drag to pan, scroll to zoom</span>
                </div>
            </div>
        </div>
    `;
    
    // Insert map container after the data div
    mapDataDiv.insertAdjacentHTML('afterend', mapContainerHTML);
    
    // Wait for Leaflet to be available
    setTimeout(() => {
        if (typeof L === 'undefined') {
            console.error('Leaflet not loaded');
            return;
        }
        
        // Calculate center point
        const centerLat = (bounds.minLat + bounds.maxLat) / 2;
        const centerLon = (bounds.minLon + bounds.maxLon) / 2;
        
        // Create maps
        const beforeMap = L.map(`map-before-${changesetId}`, {
            center: [centerLat, centerLon],
            zoom: 16,
            zoomControl: true,
            scrollWheelZoom: true
        });
        
        const afterMap = L.map(`map-after-${changesetId}`, {
            center: [centerLat, centerLon],
            zoom: 16,
            zoomControl: true,
            scrollWheelZoom: true
        });
        
        // Add Carto Light tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(beforeMap);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(afterMap);
        
        // Sync map movements
        beforeMap.on('move', function() {
            afterMap.setView(beforeMap.getCenter(), beforeMap.getZoom(), { animate: false });
        });
        
        afterMap.on('move', function() {
            beforeMap.setView(afterMap.getCenter(), afterMap.getZoom(), { animate: false });
        });
        
        // Add bounding box rectangle
        const boundsRect = [
            [bounds.minLat, bounds.minLon],
            [bounds.maxLat, bounds.maxLon]
        ];
        
        L.rectangle(boundsRect, {
            color: '#667eea',
            weight: 2,
            fillOpacity: 0.1
        }).addTo(beforeMap).bindPopup('Changeset Area');
        
        L.rectangle(boundsRect, {
            color: '#667eea',
            weight: 2,
            fillOpacity: 0.1
        }).addTo(afterMap).bindPopup('Changeset Area');
        
        // Fit maps to bounds
        beforeMap.fitBounds(boundsRect, { padding: [20, 20] });
        afterMap.fitBounds(boundsRect, { padding: [20, 20] });
        
        // Fetch and display changeset elements
        fetchChangesetElements(changesetId, beforeMap, afterMap);
        
    }, 100);
}

// Fetch changeset elements and display on maps
async function fetchChangesetElements(changesetId, beforeMap, afterMap) {
    try {
        const response = await fetch(`https://api.openstreetmap.org/api/0.6/changeset/${changesetId}/download`);
        if (!response.ok) return;
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Process created elements (show on after map)
        const createElements = xmlDoc.querySelectorAll('create > *');
        createElements.forEach(elem => {
            addElementToMap(elem, afterMap, '#22c55e', 'Created');
        });
        
        // Process modified elements (show on both maps)
        const modifyElements = xmlDoc.querySelectorAll('modify > *');
        modifyElements.forEach(elem => {
            addElementToMap(elem, afterMap, '#f97316', 'Modified');
            // For "before" state, we'd need to fetch previous version (complex)
            // For now, just show on after map
        });
        
        // Process deleted elements (show on before map)
        const deleteElements = xmlDoc.querySelectorAll('delete > *');
        deleteElements.forEach(elem => {
            addElementToMap(elem, beforeMap, '#ef4444', 'Deleted');
        });
        
    } catch (error) {
        console.error('Error fetching changeset elements:', error);
    }
}

// Add element to map
function addElementToMap(elem, map, color, action) {
    const type = elem.tagName;
    const id = elem.getAttribute('id');
    const lat = parseFloat(elem.getAttribute('lat'));
    const lon = parseFloat(elem.getAttribute('lon'));
    
    // Get tags
    const tags = {};
    elem.querySelectorAll('tag').forEach(tag => {
        tags[tag.getAttribute('k')] = tag.getAttribute('v');
    });
    
    const name = tags.name || tags.ref || `${type} #${id}`;
    
    if (type === 'node' && lat && lon) {
        // Add marker for node
        const marker = L.circleMarker([lat, lon], {
            radius: 6,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);
        
        // Add popup
        let popupContent = `<strong>${action}: ${name}</strong><br>`;
        popupContent += `Type: ${type}<br>`;
        popupContent += `ID: ${id}<br>`;
        if (Object.keys(tags).length > 0) {
            popupContent += `<br><strong>Tags:</strong><br>`;
            Object.entries(tags).slice(0, 5).forEach(([k, v]) => {
                popupContent += `${k}: ${v}<br>`;
            });
        }
        marker.bindPopup(popupContent);
    } else if (type === 'way') {
        // For ways, we'd need to fetch node coordinates (complex)
        // For now, just skip or show a simple indicator
        // This would require additional API calls
    }
}

// Observe new messages and initialize maps
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.classList.contains('atlas-message')) {
                // Check if this message has map comparison data
                setTimeout(() => initializeMapComparison(node), 100);
            }
        });
    });
});

// Start observing Atlas AI messages container
const messagesContainer = document.getElementById('atlasAIMessages');
if (messagesContainer) {
    observer.observe(messagesContainer, {
        childList: true,
        subtree: false
    });
}

