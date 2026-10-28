// Settings page functionality

let currentSettings = {
    validation: {
        mass_changes_threshold: 50,
        include_grabsg_in_review: false,
        criteria: {
            mass_changes: true,
            erp: true,
            oneway: true,
            access: true
        }
    },
    slack: {
        enabled: false,
        webhook_url: ''
    }
};

// Load settings when page loads
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            const settings = await response.json();
            currentSettings = settings;
            populateSettingsForm(settings);
        } else {
            console.error('Failed to load settings');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Populate form with current settings
function populateSettingsForm(settings) {
    // Validation threshold
    const thresholdInput = document.getElementById('massDeletionThreshold');
    if (thresholdInput && settings.validation) {
        // Support both old and new setting names for backward compatibility
        thresholdInput.value = settings.validation.mass_changes_threshold || settings.validation.mass_deletion_threshold || 50;
    }

    const includeGrabsgInReview = document.getElementById('includeGrabsgInReview');
    if (includeGrabsgInReview && settings.validation) {
        includeGrabsgInReview.checked = settings.validation.include_grabsg_in_review === true;
    }

    // Review criteria toggles
    const criteriaSettings = settings.validation?.criteria || {};
    const criterionMassChanges = document.getElementById('criterionMassChanges');
    const criterionERP = document.getElementById('criterionERP');
    const criterionOneway = document.getElementById('criterionOneway');
    const criterionAccess = document.getElementById('criterionAccess');
    
    if (criterionMassChanges) {
        criterionMassChanges.checked = criteriaSettings.mass_changes !== false; // Default to true
        // Toggle threshold visibility based on checkbox state
        toggleMassChangesThreshold(criterionMassChanges.checked);
    }
    if (criterionERP) {
        criterionERP.checked = criteriaSettings.erp !== false; // Default to true
    }
    if (criterionOneway) {
        criterionOneway.checked = criteriaSettings.oneway !== false; // Default to true
    }
    if (criterionAccess) {
        criterionAccess.checked = criteriaSettings.access !== false; // Default to true
    }

    // Slack settings
    const slackEnabled = document.getElementById('slackEnabled');
    const slackWebhookField = document.getElementById('slackWebhookField');
    const slackTestField = document.getElementById('slackTestField');
    
    if (slackEnabled && settings.slack) {
        slackEnabled.checked = settings.slack.enabled || false;
        toggleSlackFields(settings.slack.enabled);
    }

    const webhookInput = document.getElementById('slackWebhookUrl');
    if (webhookInput && settings.slack) {
        // Check localStorage first for the full webhook URL
        const storedWebhookUrl = localStorage.getItem('slackWebhookUrl');
        
        const webhookUrl = settings.slack.webhook_url || '';
        if (webhookUrl && !webhookUrl.includes('...')) {
            // Backend returned full URL (unlikely but possible)
            webhookInput.value = webhookUrl;
            // Also save to localStorage for future use
            if (webhookUrl) {
                localStorage.setItem('slackWebhookUrl', webhookUrl);
            }
        } else if (storedWebhookUrl) {
            // Backend returned masked URL, but we have it in localStorage
            webhookInput.value = storedWebhookUrl;
        } else {
            // No stored value, leave empty
            webhookInput.value = '';
        }
    }
}

// Toggle Slack fields visibility
function toggleSlackFields(enabled) {
    const slackWebhookField = document.getElementById('slackWebhookField');
    const slackTestField = document.getElementById('slackTestField');
    
    if (slackWebhookField && slackTestField) {
        if (enabled) {
            slackWebhookField.style.display = 'block';
            slackTestField.style.display = 'block';
        } else {
            slackWebhookField.style.display = 'none';
            slackTestField.style.display = 'none';
        }
    }
}

// Toggle webhook URL visibility
function toggleWebhookVisibility() {
    const webhookInput = document.getElementById('slackWebhookUrl');
    const visibilityIcon = document.getElementById('webhookVisibilityIcon');
    
    if (webhookInput && visibilityIcon) {
        if (webhookInput.type === 'password') {
            webhookInput.type = 'text';
            // Eye-off icon
            visibilityIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
            webhookInput.type = 'password';
            // Eye icon
            visibilityIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
    }
}

// Save settings
async function saveSettings() {
    const saveStatus = document.getElementById('settingsSaveStatus');
    
    // Collect form data
    const thresholdInput = document.getElementById('massDeletionThreshold');
    const slackEnabled = document.getElementById('slackEnabled');
    const webhookInput = document.getElementById('slackWebhookUrl');
    
    // Get criteria toggles
    const criterionMassChanges = document.getElementById('criterionMassChanges');
    const criterionERP = document.getElementById('criterionERP');
    const criterionOneway = document.getElementById('criterionOneway');
    const criterionAccess = document.getElementById('criterionAccess');
    const includeGrabsgInReview = document.getElementById('includeGrabsgInReview');

    const settings = {
        validation: {
            mass_changes_threshold: parseInt(thresholdInput.value) || 50,
            include_grabsg_in_review: includeGrabsgInReview ? includeGrabsgInReview.checked : false,
            criteria: {
                mass_changes: criterionMassChanges ? criterionMassChanges.checked : true,
                erp: criterionERP ? criterionERP.checked : true,
                oneway: criterionOneway ? criterionOneway.checked : true,
                access: criterionAccess ? criterionAccess.checked : true
            }
        },
        slack: {
            enabled: slackEnabled.checked,
            webhook_url: webhookInput.value.trim()
        }
    };

    // Validate
    if (settings.validation.mass_changes_threshold < 1 || settings.validation.mass_changes_threshold > 1000) {
        if (saveStatus) {
            saveStatus.textContent = 'Error: Mass changes threshold must be between 1 and 1000';
            saveStatus.className = 'settings-save-status error';
        }
        return;
    }

    if (settings.slack.enabled && !settings.slack.webhook_url) {
        if (saveStatus) {
            saveStatus.textContent = 'Error: Webhook URL is required when Slack notifications are enabled';
            saveStatus.className = 'settings-save-status error';
        }
        return;
    }

    try {
        // Show loading state
        if (saveStatus) {
            saveStatus.textContent = 'Saving...';
            saveStatus.className = 'settings-save-status';
        }

        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            currentSettings = data.settings || settings;
            // Reload settings to get the full merged settings from server
            loadSettings();
            // Save webhook URL to localStorage for persistence
            if (settings.slack && settings.slack.webhook_url) {
                localStorage.setItem('slackWebhookUrl', settings.slack.webhook_url);
            }
            if (saveStatus) {
                saveStatus.textContent = 'Settings saved successfully!';
                saveStatus.className = 'settings-save-status success';
            }
            // Clear status after 3 seconds
            setTimeout(() => {
                if (saveStatus) {
                    saveStatus.textContent = '';
                    saveStatus.className = 'settings-save-status';
                }
            }, 3000);
        } else {
            if (saveStatus) {
                saveStatus.textContent = data.error || 'Failed to save settings';
                saveStatus.className = 'settings-save-status error';
            }
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        if (saveStatus) {
            saveStatus.textContent = 'Error: Failed to save settings';
            saveStatus.className = 'settings-save-status error';
        }
    }
}

function getSlackWebhookUrlForTest() {
    const webhookInput = document.getElementById('slackWebhookUrl');
    if (webhookInput && webhookInput.value.trim()) {
        return webhookInput.value.trim();
    }
    const stored = localStorage.getItem('slackWebhookUrl');
    return stored ? stored.trim() : '';
}

// Send a realistic Slack preview for one review criterion
async function testCriterionSlackNotification(criterion, buttonEl) {
    const webhookUrl = getSlackWebhookUrlForTest();
    if (!webhookUrl) {
        alert('Add a Slack webhook URL under Notifications & Integrations first.');
        return;
    }

    const originalText = buttonEl ? buttonEl.textContent : '';
    if (buttonEl) {
        buttonEl.disabled = true;
        buttonEl.textContent = 'Sending…';
    }

    const payload = { criterion, webhook_url: webhookUrl };
    if (criterion === 'mass_changes') {
        const thresholdInput = document.getElementById('massDeletionThreshold');
        if (thresholdInput && thresholdInput.value) {
            payload.mass_threshold = parseInt(thresholdInput.value, 10);
        }
    }

    try {
        const response = await fetch('/api/test/slack/criterion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await response.json();

        if (response.ok && data.success) {
            if (buttonEl) {
                buttonEl.textContent = 'Sent';
                setTimeout(() => {
                    buttonEl.textContent = originalText;
                    buttonEl.disabled = false;
                }, 2500);
            }
        } else {
            alert(data.error || 'Failed to send message to Slack.');
            if (buttonEl) {
                buttonEl.textContent = originalText;
                buttonEl.disabled = false;
            }
        }
    } catch (error) {
        console.error('Error sending criterion Slack preview:', error);
        alert('Error: Could not reach the server.');
        if (buttonEl) {
            buttonEl.textContent = originalText;
            buttonEl.disabled = false;
        }
    }
}

// Send Slack alerts for all changesets currently in needs_review
async function notifyNeedsReviewSlack() {
    const testStatus = document.getElementById('slackTestStatus');
    const slackEnabled = document.getElementById('slackEnabled');

    if (slackEnabled && !slackEnabled.checked) {
        if (testStatus) {
            testStatus.textContent = 'Enable Slack notifications and save settings first';
            testStatus.className = 'settings-test-status error';
        }
        return;
    }

    if (!confirm('Send a Slack message for every changeset in the current list that needs review? This may send multiple messages.')) {
        return;
    }

    try {
        if (testStatus) {
            testStatus.textContent = 'Fetching changesets and sending alerts…';
            testStatus.className = 'settings-test-status loading';
        }

        const response = await fetch('/api/slack/notify-needs-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: true }),
        });
        const data = await response.json();

        if (response.ok && data.success) {
            if (testStatus) {
                testStatus.textContent = data.message || `Sent ${data.sent_count || 0} notification(s).`;
                testStatus.className = 'settings-test-status success';
            }
        } else {
            if (testStatus) {
                testStatus.textContent = data.error || 'Failed to send notifications';
                testStatus.className = 'settings-test-status error';
            }
        }

        setTimeout(() => {
            if (testStatus) {
                testStatus.textContent = '';
                testStatus.className = 'settings-test-status';
            }
        }, 8000);
    } catch (error) {
        console.error('Error sending needs-review Slack alerts:', error);
        if (testStatus) {
            testStatus.textContent = 'Error: Could not reach the server';
            testStatus.className = 'settings-test-status error';
        }
    }
}

// Test Slack notification
async function testSlackNotification() {
    const testStatus = document.getElementById('slackTestStatus');
        const webhookInput = document.getElementById('slackWebhookUrl');
    
    if (!webhookInput || !webhookInput.value.trim()) {
        if (testStatus) {
            testStatus.textContent = 'Please enter a webhook URL first';
            testStatus.className = 'settings-test-status error';
        }
        return;
    }

    try {
        if (testStatus) {
            testStatus.textContent = 'Sending test notification...';
            testStatus.className = 'settings-test-status loading';
        }

        const response = await fetch('/api/test/slack', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                webhook_url: webhookInput.value.trim()
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            if (testStatus) {
                testStatus.textContent = 'Test notification sent successfully!';
                testStatus.className = 'settings-test-status success';
            }
        } else {
            if (testStatus) {
                testStatus.textContent = data.error || 'Failed to send test notification';
                testStatus.className = 'settings-test-status error';
            }
        }

        // Clear status after 5 seconds
        setTimeout(() => {
            if (testStatus) {
                testStatus.textContent = '';
                testStatus.className = 'settings-test-status';
            }
        }, 5000);
    } catch (error) {
        console.error('Error testing Slack notification:', error);
        if (testStatus) {
            testStatus.textContent = 'Error: Failed to send test notification';
            testStatus.className = 'settings-test-status error';
        }
    }
}

let settingsInitialized = false;

// Toggle subsection expand/collapse
function toggleSubsection(subsectionHeaderId) {
    const header = document.getElementById(subsectionHeaderId);
    if (!header) return;
    
    const subsection = header.closest('.settings-subsection');
    if (!subsection) return;
    
    subsection.classList.toggle('expanded');
}

// Initialize settings page when tab is shown
function initSettingsPage() {
    // Set up event listeners (only once)
    if (!settingsInitialized) {
        // Initialize subsections - expand by default
        const subsections = document.querySelectorAll('.settings-subsection');
        subsections.forEach(subsection => {
            subsection.classList.add('expanded');
        });

        // Set up subsection toggle handlers
        const criteriaHeader = document.getElementById('criteriaSubsectionHeader');
        if (criteriaHeader) {
            criteriaHeader.addEventListener('click', () => toggleSubsection('criteriaSubsectionHeader'));
        }

        // Toggle threshold visibility when Mass Changes checkbox changes
        const criterionMassChanges = document.getElementById('criterionMassChanges');
        if (criterionMassChanges) {
            // Set initial state
            toggleMassChangesThreshold(criterionMassChanges.checked);
            // Listen for changes
            criterionMassChanges.addEventListener('change', function() {
                toggleMassChangesThreshold(this.checked);
            });
        }

        const slackHeader = document.getElementById('slackSubsectionHeader');
        if (slackHeader) {
            slackHeader.addEventListener('click', () => toggleSubsection('slackSubsectionHeader'));
        }

        const slackEnabled = document.getElementById('slackEnabled');
        if (slackEnabled) {
            slackEnabled.addEventListener('change', function() {
                toggleSlackFields(this.checked);
            });
        }

        const toggleVisibilityBtn = document.getElementById('toggleWebhookVisibility');
        if (toggleVisibilityBtn) {
            toggleVisibilityBtn.addEventListener('click', toggleWebhookVisibility);
        }

        // Save webhook URL to localStorage as user types (for persistence)
        const webhookInput = document.getElementById('slackWebhookUrl');
        if (webhookInput) {
            webhookInput.addEventListener('input', function() {
                const webhookUrl = this.value.trim();
                if (webhookUrl) {
                    localStorage.setItem('slackWebhookUrl', webhookUrl);
                } else {
                    localStorage.removeItem('slackWebhookUrl');
                }
            });
        }

        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', saveSettings);
        }

        const testBtn = document.getElementById('testSlackNotification');
        if (testBtn) {
            testBtn.addEventListener('click', testSlackNotification);
        }

        const notifyNeedsReviewBtn = document.getElementById('notifyNeedsReviewSlack');
        if (notifyNeedsReviewBtn) {
            notifyNeedsReviewBtn.addEventListener('click', notifyNeedsReviewSlack);
        }

        document.querySelectorAll('.settings-criterion-slack-test').forEach((btn) => {
            btn.addEventListener('click', function () {
                const criterion = this.getAttribute('data-criterion');
                if (criterion) {
                    testCriterionSlackNotification(criterion, this);
                }
            });
        });

        settingsInitialized = true;
    }

    // Always reload settings when tab is shown
    loadSettings();
}

// Toggle Mass Changes Threshold visibility
function toggleMassChangesThreshold(enabled) {
    const thresholdField = document.getElementById('massDeletionThreshold')?.closest('.settings-field');
    if (thresholdField) {
        thresholdField.style.display = enabled ? 'block' : 'none';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        // Check if settings tab exists and is active
        const settingsTab = document.getElementById('settings');
        if (settingsTab && settingsTab.classList.contains('active')) {
            initSettingsPage();
        }
    });
} else {
    // DOM already loaded
    const settingsTab = document.getElementById('settings');
    if (settingsTab && settingsTab.classList.contains('active')) {
        initSettingsPage();
    }
}
