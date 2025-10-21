# Local development startup script for Windows

Write-Host "🚀 Starting OSM Dashboard (Development Mode)" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# Check if virtual environment exists
if (-Not (Test-Path "venv")) {
    Write-Host "📦 Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "🔧 Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

# Install dependencies
Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

# Start the application
Write-Host ""
Write-Host "✅ Starting application..." -ForegroundColor Green
Write-Host "Navigate to: http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
python app.py

