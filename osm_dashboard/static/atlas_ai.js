// ===== ATLAS AI FUNCTIONS =====

// Store selected image
let atlasSelectedImage = null;

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
    document.getElementById('atlasAIInput').placeholder = 'Ask Atlas about this image...';
}

// Remove selected image
function removeAtlasImage() {
    atlasSelectedImage = null;
    document.getElementById('atlasAIImagePreview').style.display = 'none';
    document.getElementById('atlasAIImageInput').value = '';
    document.getElementById('atlasAIInput').placeholder = 'Ask Atlas anything about OpenStreetMap...';
}

// Handle Enter key press
function handleAtlasKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendAtlasMessage();
    }
}

// Send message to Atlas AI
async function sendAtlasMessage(predefinedMessage = null) {
    const input = document.getElementById('atlasAIInput');
    const sendBtn = document.getElementById('atlasAISendBtn');
    const messagesContainer = document.getElementById('atlasAIMessages');
    const suggestionsContainer = document.getElementById('atlasAISuggestions');
    
    const message = predefinedMessage || input.value.trim();
    
    // Require either message or image
    if (!message && !atlasSelectedImage) return;
    
    // Hide suggestions after first message
    if (predefinedMessage || input.value || atlasSelectedImage) {
        suggestionsContainer.style.display = 'none';
    }
    
    // Store image reference for display
    const imageToDisplay = atlasSelectedImage;
    const imagePreviewSrc = imageToDisplay ? document.getElementById('atlasPreviewImage').src : null;
    
    // Clear input and image
    input.value = '';
    input.style.height = 'auto';
    
    // Add user message (with image if present)
    addAtlasMessage('user', message || 'Can you analyze this image?', imagePreviewSrc);
    
    // Disable send button
    sendBtn.disabled = true;
    
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
    
    // Re-enable send button
    sendBtn.disabled = false;
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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
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
    
    // Random animation styles for variety
    const animationStyles = ['', 'pulse', 'wave'];
    const randomStyle = animationStyles[Math.floor(Math.random() * animationStyles.length)];
    
    // Varied status messages
    const statusMessages = [
        'Thinking...',
        'Analyzing...',
        'Processing...',
        'Computing...',
        'Working on it...',
        'Just a moment...'
    ];
    const randomStatus = statusMessages[Math.floor(Math.random() * statusMessages.length)];
    
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = 'atlas-message atlas-message-assistant';
    
    loadingDiv.innerHTML = `
        <div class="atlas-message-avatar atlas-avatar-typing">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
        </div>
        <div class="atlas-message-content">
            <div class="atlas-message-header">
                <span class="atlas-message-name">Atlas</span>
                <span class="atlas-message-time atlas-typing-status">${randomStatus}</span>
            </div>
            <div class="atlas-message-text">
                <div class="atlas-message-loading ${randomStyle}">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Animate the status text
    animateTypingStatus(loadingDiv);
    
    return loadingId;
}

// Animate the typing status text
function animateTypingStatus(loadingDiv) {
    const statusElement = loadingDiv.querySelector('.atlas-typing-status');
    if (!statusElement) return;
    
    const originalText = statusElement.textContent;
    let dotCount = 0;
    
    const interval = setInterval(() => {
        if (!document.getElementById(loadingDiv.id)) {
            clearInterval(interval);
            return;
        }
        
        dotCount = (dotCount + 1) % 4;
        const dots = '.'.repeat(dotCount);
        statusElement.textContent = originalText.replace('...', '') + dots;
    }, 400);
    
    // Store interval ID for cleanup
    loadingDiv.dataset.intervalId = interval;
}

// Remove loading indicator
function removeAtlasLoading(loadingId) {
    const loadingDiv = document.getElementById(loadingId);
    if (loadingDiv) {
        // Clear any intervals
        if (loadingDiv.dataset.intervalId) {
            clearInterval(parseInt(loadingDiv.dataset.intervalId));
        }
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

// Auto-resize textarea
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('atlasAIInput');
    if (textarea) {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }
});

