#!/bin/bash
# Local development startup script

echo "🚀 Starting OSM Dashboard (Development Mode)"
echo "================================"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Start the application
echo ""
echo "✅ Starting application..."
echo "Navigate to: http://localhost:5000"
echo ""
python app.py

