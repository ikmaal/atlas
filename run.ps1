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
$env:OSM_CLIENT_ID="q-a7gttnOHrFfToAYgZnWU9tZuf6QpHLBNRd4YMxgSU"
$env:OSM_CLIENT_SECRET="qGbFyDFxXG9adcfEBeMB_UE6e8JYf8tUX4vNVl7zxh8"
$env:OSM_REDIRECT_URI="http://127.0.0.1:5000/oauth/callback"
$env:SECRET_KEY="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"

# Groq API Key for Atlas AI (get free key from https://console.groq.com)
$env:GROQ_API_KEY="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"

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

