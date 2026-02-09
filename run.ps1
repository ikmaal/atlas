# OSM Dashboard Startup Script
# ============================================
# IMPORTANT: If you're getting OAuth errors, verify these steps:
# 
# 1. Go to: https://www.openstreetmap.org/oauth2/applications
# 2. Make sure your application has these EXACT settings:
#    - Redirect URIs: http://127.0.0.1:5000/oauth/callback
#    - Confidential application: CHECKED
#    - Permissions: read_prefs
# 3. If redirect URI doesn't match EXACTLY, update it in OSM settings
# 4. If you deleted/recreated the app, update credentials below
# ============================================

# Your OSM OAuth Credentials
# IMPORTANT: Replace these with your actual credentials from https://www.openstreetmap.org/oauth2/applications
$env:OSM_CLIENT_ID="YOUR_CLIENT_ID_HERE"
$env:OSM_CLIENT_SECRET="YOUR_CLIENT_SECRET_HERE"
$env:OSM_REDIRECT_URI="http://127.0.0.1:5000/oauth/callback"
$env:SECRET_KEY="YOUR_SECRET_KEY_HERE"

# Groq API Key for Atlas AI (get free key from https://console.groq.com)
$env:GROQ_API_KEY="YOUR_GROQ_API_KEY_HERE"
$env:SLACK_WEBHOOK_URL=""
$env:SLACK_ALERTS_ENABLED="false"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "ATLAS - Singapore OpenStreetMap Monitor" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "OAuth Client ID configured" -ForegroundColor Yellow
Write-Host "OAuth Client Secret configured" -ForegroundColor Yellow
Write-Host "Redirect URI: http://127.0.0.1:5000/oauth/callback" -ForegroundColor Yellow
Write-Host ""
if ($env:GROQ_API_KEY -eq "YOUR_GROQ_API_KEY_HERE" -or $null -eq $env:GROQ_API_KEY) {
    Write-Host "Atlas AI: Not configured (get free key from https://console.groq.com)" -ForegroundColor DarkYellow
} else {
    Write-Host "Atlas AI: Groq (Llama 3.1) configured" -ForegroundColor Green
}
Write-Host ""
Write-Host "If you get authentication errors:" -ForegroundColor Red
Write-Host "  1. Check: https://www.openstreetmap.org/oauth2/applications" -ForegroundColor White
Write-Host "  2. Verify redirect URI matches EXACTLY" -ForegroundColor White
Write-Host "  3. Ensure Confidential application is CHECKED" -ForegroundColor White
Write-Host ""
Write-Host "Starting server..." -ForegroundColor Green
Write-Host ""

py app.py

