from flask import Flask, jsonify, render_template, session, redirect, request, url_for, send_from_directory
from flask_cors import CORS
from flask_session import Session
from flask_caching import Cache
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from dateutil import parser as date_parser
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
import secrets
import os
import sys
import json
import base64
import uuid

# Fix Windows console encoding for emojis
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from werkzeug.utils import secure_filename
import gspread
from google.oauth2.service_account import Credentials
from shapely.geometry import Point, Polygon, MultiPolygon

app = Flask(__name__)
CORS(app)

# Session configuration
# Use a persistent SECRET_KEY - critical for session persistence across server restarts
# In production, always set SECRET_KEY environment variable
SECRET_KEY_FILE = '.secret_key'
if os.environ.get('SECRET_KEY'):
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
else:
    # Try to load from file, or create and save a new one
    if os.path.exists(SECRET_KEY_FILE):
        with open(SECRET_KEY_FILE, 'r') as f:
            app.config['SECRET_KEY'] = f.read().strip()
        print("🔑 Loaded SECRET_KEY from file")
    else:
        new_key = secrets.token_hex(32)
        with open(SECRET_KEY_FILE, 'w') as f:
            f.write(new_key)
        app.config['SECRET_KEY'] = new_key
        print("🔑 Generated and saved new SECRET_KEY")
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = './flask_session'
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('SESSION_COOKIE_SECURE', 'False') == 'True'
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['SESSION_FILE_THRESHOLD'] = 500

# Ensure flask_session directory exists
if not os.path.exists('./flask_session'):
    os.makedirs('./flask_session')
    print("📁 Created flask_session directory")

Session(app)

# Cache configuration for performance optimization
app.config['CACHE_TYPE'] = 'FileSystemCache'
app.config['CACHE_DIR'] = './cache'
app.config['CACHE_DEFAULT_TIMEOUT'] = 3600  # 1 hour cache
app.config['CACHE_THRESHOLD'] = 500  # Maximum number of cache items

# Ensure cache directory exists
if not os.path.exists('./cache'):
    os.makedirs('./cache')
    print("💾 Created cache directory")

# Initialize cache
cache = Cache(app)
print("💾 Cache initialized successfully")

# OSM OAuth Configuration
# IMPORTANT: You need to register your app at https://www.openstreetmap.org/oauth2/applications
# Set these as environment variables or update them here
OSM_CLIENT_ID = os.environ.get('OSM_CLIENT_ID', 'YOUR_CLIENT_ID_HERE')
OSM_CLIENT_SECRET = os.environ.get('OSM_CLIENT_SECRET', 'YOUR_CLIENT_SECRET_HERE')
OSM_REDIRECT_URI = os.environ.get('OSM_REDIRECT_URI', 'http://localhost:5000/oauth/callback')
OSM_OAUTH_URL = 'https://www.openstreetmap.org/oauth2/authorize'
OSM_TOKEN_URL = 'https://www.openstreetmap.org/oauth2/token'
OSM_API_URL = 'https://api.openstreetmap.org/api/0.6'

# OAuth state storage (server-side with file persistence)
# Store states with timestamps to prevent session cookie issues during OAuth redirects
OAUTH_STATES_FILE = '.oauth_states.json'

def load_oauth_states():
    """Load OAuth states from file"""
    if os.path.exists(OAUTH_STATES_FILE):
        try:
            with open(OAUTH_STATES_FILE, 'r') as f:
                data = json.load(f)
                # Convert ISO timestamp strings back to datetime objects
                return {state: datetime.fromisoformat(timestamp) 
                       for state, timestamp in data.items()}
        except Exception as e:
            print(f"⚠️  Could not load OAuth states: {e}")
            return {}
    return {}

def save_oauth_states(states):
    """Save OAuth states to file"""
    try:
        # Convert datetime objects to ISO format strings for JSON serialization
        data = {state: timestamp.isoformat() 
               for state, timestamp in states.items()}
        with open(OAUTH_STATES_FILE, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        print(f"⚠️  Could not save OAuth states: {e}")

# Initialize OAuth states from file
oauth_states = load_oauth_states()
print(f"🔐 Loaded {len(oauth_states)} OAuth states from storage")

def cleanup_expired_states():
    """Remove OAuth states older than 10 minutes"""
    current_time = datetime.now(timezone.utc)
    expired = [state for state, timestamp in oauth_states.items() 
               if (current_time - timestamp).total_seconds() > 600]
    for state in expired:
        del oauth_states[state]
    if expired:
        print(f"🧹 Cleaned up {len(expired)} expired OAuth states")
        save_oauth_states(oauth_states)  # Persist after cleanup

# Clean up any expired states on startup
cleanup_expired_states()

# Debug: Print OAuth config on startup
print(f"🔧 OAuth Configuration:")
print(f"   Client ID: {OSM_CLIENT_ID[:20] if OSM_CLIENT_ID != 'YOUR_CLIENT_ID_HERE' else '❌ NOT SET'}...")
print(f"   Client Secret: {'✓ Set' if OSM_CLIENT_SECRET != 'YOUR_CLIENT_SECRET_HERE' else '❌ NOT SET'}")
print(f"   Redirect URI: {OSM_REDIRECT_URI}")
print(f"")
print(f"⚠️  IMPORTANT: Access your app at {OSM_REDIRECT_URI.rsplit('/oauth/callback', 1)[0]}")
print(f"   (Don't use 127.0.0.1 if your redirect URI uses localhost, or vice versa)")
print(f"")

# ============================================
# Multi-Region Configuration
# ============================================

# Load regions from JSON configuration file
REGIONS_CONFIG_FILE = 'static/regions.json'
REGIONS = {}
REGION_POLYGONS = {}
CURRENT_REGION = 'singapore'  # Default region

def load_regions_config():
    """Load region configurations from JSON file"""
    global REGIONS, REGION_POLYGONS
    try:
        with open(REGIONS_CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
            REGIONS = config.get('regions', {})
            
            # Create Shapely polygons for each region
            for region_id, region_data in REGIONS.items():
                polygon_coords = region_data.get('polygonShapely', [])
                is_multi = region_data.get('isMultiPolygon', False)
                
                if polygon_coords:
                    if is_multi:
                        # MultiPolygon - array of polygon coordinate arrays
                        polygons = []
                        for poly_coords in polygon_coords:
                            if poly_coords and len(poly_coords) >= 3:
                                coords = [tuple(coord) for coord in poly_coords]
                                polygons.append(Polygon(coords))
                        
                        if polygons:
                            REGION_POLYGONS[region_id] = MultiPolygon(polygons)
                            print(f"🗺️  {region_data['name']} MultiPolygon initialized with {len(polygons)} polygons")
                        else:
                            REGION_POLYGONS[region_id] = None
                            print(f"⚠️  {region_data['name']} has no valid polygon coordinates")
                    else:
                        # Single polygon
                        if len(polygon_coords) >= 3:
                            coords = [tuple(coord) for coord in polygon_coords]
                            REGION_POLYGONS[region_id] = Polygon(coords)
                            print(f"🗺️  {region_data['name']} polygon initialized with {len(coords)} vertices")
                        else:
                            REGION_POLYGONS[region_id] = None
                            print(f"⚠️  {region_data['name']} has no valid polygon coordinates")
                else:
                    REGION_POLYGONS[region_id] = None
                    print(f"⚠️  {region_data['name']} has no polygon coordinates")
            
            return config.get('defaultRegion', 'singapore')
    except Exception as e:
        print(f"⚠️  Could not load regions config: {e}")
        return 'singapore'

# Initialize regions on startup
DEFAULT_REGION = load_regions_config()
CURRENT_REGION = DEFAULT_REGION

def get_region_bbox(region_id=None):
    """Get the bounding box for a region"""
    region_id = region_id or CURRENT_REGION
    if region_id in REGIONS:
        return REGIONS[region_id].get('bbox', '')
    return ''

def get_region_polygon(region_id=None):
    """Get the Shapely polygon for a region"""
    region_id = region_id or CURRENT_REGION
    return REGION_POLYGONS.get(region_id)

def get_region_name(region_id=None):
    """Get the display name for a region"""
    region_id = region_id or CURRENT_REGION
    if region_id in REGIONS:
        return REGIONS[region_id].get('name', region_id)
    return region_id

# Legacy support - keep SINGAPORE_BBOX for backward compatibility
SINGAPORE_BBOX = get_region_bbox('singapore') or "103.56,1.13,104.14,1.48"

# Time range for fetching changesets (in hours)
CHANGESET_TIME_RANGE_HOURS = int(os.environ.get('CHANGESET_TIME_RANGE_HOURS', '24'))

# Cache for changeset details to avoid repeated API calls
changeset_details_cache = {}

# ============================================
# Slack Configuration
# ============================================

SLACK_WEBHOOK_URL = os.environ.get('SLACK_WEBHOOK_URL', '')
SLACK_ALERTS_ENABLED = os.environ.get('SLACK_ALERTS_ENABLED', 'false').lower() == 'true'
# Detect if using Slack Workflow (workflow URLs contain '/triggers/')
SLACK_IS_WORKFLOW = '/triggers/' in SLACK_WEBHOOK_URL if SLACK_WEBHOOK_URL else False

# Track alerted changesets to avoid duplicate notifications
ALERTED_CHANGESETS_FILE = '.alerted_changesets.json'

def load_alerted_changesets():
    """Load previously alerted changesets from file"""
    if os.path.exists(ALERTED_CHANGESETS_FILE):
        try:
            with open(ALERTED_CHANGESETS_FILE, 'r') as f:
                data = json.load(f)
                return set(data.get('changesets', []))
        except Exception as e:
            print(f"⚠️ Error loading alerted changesets: {e}")
            return set()
    return set()

def save_alerted_changesets(changesets_set):
    """Save alerted changesets to file"""
    try:
        with open(ALERTED_CHANGESETS_FILE, 'w') as f:
            json.dump({'changesets': list(changesets_set)}, f)
    except Exception as e:
        print(f"⚠️ Error saving alerted changesets: {e}")

# Load previously alerted changesets on startup
alerted_changesets = load_alerted_changesets()
if alerted_changesets:
    print(f"📋 Loaded {len(alerted_changesets)} previously alerted changesets")

def send_slack_notification(changeset):
    """Send Slack notification for needs_review changesets"""
    if not SLACK_WEBHOOK_URL or not SLACK_ALERTS_ENABLED:
        if not SLACK_WEBHOOK_URL:
            print("⚠️ Slack webhook URL not configured")
        if not SLACK_ALERTS_ENABLED:
            print("⚠️ Slack alerts not enabled")
        return False
    
    cs_id = changeset.get('id')
    if not cs_id:
        return False
    
    # Convert to string for consistent comparison
    cs_id_str = str(cs_id)
    
    # Check if already alerted (avoid duplicates)
    if cs_id_str in alerted_changesets:
        print(f"⏭️ Skipping changeset {cs_id_str} - already notified")
        return False
    
    try:
        validation = changeset.get('validation', {})
        status = validation.get('status', 'valid')
        
        # Only send for needs_review changesets
        if status != 'needs_review':
            return False
        
        # Mark as alerted and save to file (use string for consistency)
        alerted_changesets.add(cs_id_str)
        save_alerted_changesets(alerted_changesets)
        print(f"📝 Marked changeset {cs_id_str} as alerted")
        
        # Prepare changeset data
        user = changeset.get('user', 'Unknown')
        comment = changeset.get('comment', 'No comment')
        created_at = changeset.get('created_at', 'Unknown')
        
        details = changeset.get('details', {})
        created_count = details.get('total_created', 0)
        modified_count = details.get('total_modified', 0)
        deleted_count = details.get('total_deleted', 0)
        total_changes = created_count + modified_count + deleted_count
        
        reasons = validation.get('reasons', [])
        reason_text = '\n'.join([f'• {reason}' for reason in reasons]) if reasons else 'Mass deletion detected'
        
        # Check if this is a mass deletion or ERP changeset
        flags = validation.get('flags', [])
        is_mass_deletion = 'mass_deletion' in flags
        is_erp = 'erp' in flags
        
        # Build OSM links
        osm_link = f"https://www.openstreetmap.org/changeset/{cs_id}"
        osmcha_link = f"https://osmcha.org/changesets/{cs_id}"
        
        # Determine header text based on changeset type
        if is_mass_deletion:
            header_text = "⚠️ Mass Deletion Changeset Detected"
            status_text = "Mass Deletion Detected"
        elif is_erp:
            header_text = "ERP Changeset Detected"
            status_text = "ERP Detected"
        else:
            header_text = "🔍 Changeset Needs Review"
            status_text = "Needs Review"
        
        # Determine warning_flags message based on changeset type
        if is_mass_deletion:
            warning_flags_text = "Mass Deletion Changeset Detected"
        elif is_erp:
            warning_flags_text = "ERP Modification Changeset Detected"
        else:
            warning_flags_text = reason_text if reasons else "Needs review"
        
        # Check if using Slack Workflow (different format required)
        if SLACK_IS_WORKFLOW:
            # Slack Workflow format - simple key-value pairs
            slack_message = {
                "changeset_id": str(cs_id),
                "user": str(user),
                "total_changes": str(total_changes),
                "created": str(created_count),
                "modified": str(modified_count),
                "deleted": str(deleted_count),
                "warning_flags": warning_flags_text,
                "comment": str(comment) if comment and comment != 'No comment' else "No comment",
                "source": str(changeset.get('tags', {}).get('source', 'Not specified')),
                "created_at": str(created_at),
                "osm_link": osm_link,
                "osmcha_link": osmcha_link,
                "status": status_text
            }
        else:
            # Regular Incoming Webhook format - Block Kit
            slack_message = {
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": header_text,
                            "emoji": True
                        }
                    },
                    {
                        "type": "section",
                        "fields": [
                            {
                                "type": "mrkdwn",
                                "text": f"*Changeset ID:*\n<{osm_link}|{cs_id}>"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*User:*\n{user}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Created:*\n{created_at}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Total Changes:*\n{total_changes}"
                            }
                        ]
                    },
                    {
                        "type": "section",
                        "fields": [
                            {
                                "type": "mrkdwn",
                                "text": f"*Created:* {created_count}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Modified:* {modified_count}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Deleted:* {deleted_count}"
                            }
                        ]
                    }
                ]
            }
            
            # Add comment if available
            if comment and comment != 'No comment':
                slack_message["blocks"].append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Comment:*\n{comment}"
                    }
                })
            
            # Add reasons
            slack_message["blocks"].append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Reasons:*\n{reason_text}"
                }
            })
            
            # Add divider
            slack_message["blocks"].append({
                "type": "divider"
            })
            
            # Add action buttons
            slack_message["blocks"].append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "🗺️ View on OSM",
                            "emoji": True
                        },
                        "url": osm_link,
                        "style": "primary"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "🔍 View on OSMCha",
                            "emoji": True
                        },
                        "url": osmcha_link
                    }
                ]
            })
        
        # Send to Slack
        try:
            response = requests.post(
                SLACK_WEBHOOK_URL, 
                json=slack_message, 
                timeout=10,
                verify=True  # SSL verification
            )
            
            if response.status_code == 200:
                print(f"✅ Slack notification sent successfully for changeset #{cs_id_str}")
                return True
            else:
                print(f"❌ Failed to send Slack notification: HTTP {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                # Remove from alerted set if failed so it can be retried
                alerted_changesets.discard(cs_id_str)
                save_alerted_changesets(alerted_changesets)
                return False
                
        except requests.exceptions.ConnectionError as e:
            print(f"❌ Connection Error: Unable to connect to Slack webhook")
            print(f"   Webhook URL: {SLACK_WEBHOOK_URL[:50]}...")
            print(f"   Error details: {str(e)}")
            print(f"   Possible causes:")
            print(f"   - Check your internet connection")
            print(f"   - Verify the webhook URL is correct")
            print(f"   - Check if firewall is blocking HTTPS requests")
            print(f"   - Ensure Slack webhook URL is still valid")
            alerted_changesets.discard(cs_id_str)
            save_alerted_changesets(alerted_changesets)
            return False
            
        except requests.exceptions.Timeout as e:
            print(f"❌ Timeout Error: Request to Slack timed out after 10 seconds")
            print(f"   Changeset ID: {cs_id_str}")
            print(f"   Error details: {str(e)}")
            alerted_changesets.discard(cs_id_str)
            save_alerted_changesets(alerted_changesets)
            return False
            
        except requests.exceptions.SSLError as e:
            print(f"❌ SSL Error: SSL certificate verification failed")
            print(f"   Changeset ID: {cs_id_str}")
            print(f"   Error details: {str(e)}")
            print(f"   This might indicate a network/proxy issue")
            alerted_changesets.discard(cs_id_str)
            save_alerted_changesets(alerted_changesets)
            return False
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Request Error: {type(e).__name__}")
            print(f"   Changeset ID: {cs_id_str}")
            print(f"   Error details: {str(e)}")
            alerted_changesets.discard(cs_id_str)
            save_alerted_changesets(alerted_changesets)
            return False
            
    except Exception as e:
        print(f"❌ Unexpected error sending Slack notification: {type(e).__name__}")
        print(f"   Changeset ID: {cs_id_str if 'cs_id_str' in locals() else 'unknown'}")
        print(f"   Error: {str(e)}")
        import traceback
        traceback.print_exc()
        # Remove from alerted set if failed so it can be retried
        if 'cs_id_str' in locals():
            alerted_changesets.discard(cs_id_str)
            save_alerted_changesets(alerted_changesets)
        return False

# ============================================
# Google Sheets Configuration
# ============================================

# Check if Google Sheets credentials are available (file or env var)
GOOGLE_CREDENTIALS_JSON = os.environ.get('GOOGLE_CREDENTIALS_JSON', '')
GOOGLE_SHEETS_ENABLED = os.path.exists('google_credentials.json') or bool(GOOGLE_CREDENTIALS_JSON)

def get_sheets_client():
    """Initialize Google Sheets client"""
    if not GOOGLE_SHEETS_ENABLED:
        return None
    
    try:
        scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
        
        # Try to load from environment variable first (for Render/cloud deployment)
        if GOOGLE_CREDENTIALS_JSON:
            import json
            creds_dict = json.loads(GOOGLE_CREDENTIALS_JSON)
            creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
        # Fallback to file (for local development)
        elif os.path.exists('google_credentials.json'):
            creds = Credentials.from_service_account_file('google_credentials.json', scopes=scopes)
        else:
            print("❌ No Google credentials found")
            return None
            
        return gspread.authorize(creds)
    except Exception as e:
        print(f"❌ Google Sheets Error: {e}")
        import traceback
        traceback.print_exc()
        return None

def log_changeset_needing_review(changeset_data, flags, analysis_text):
    """Log changeset needing review to Google Sheets"""
    if not GOOGLE_SHEETS_ENABLED:
        print("⚠️ Google Sheets not enabled - credentials not found")
        return
    
    try:
        client = get_sheets_client()
        if not client:
            return
        
        # Open the spreadsheet (will create if doesn't exist)
        try:
            sheet = client.open('OSM Changesets Needing Review').sheet1
        except gspread.exceptions.SpreadsheetNotFound:
            print("❌ Spreadsheet 'OSM Changesets Needing Review' not found. Please create it and share with service account.")
            return
        
        # Prepare row data
        changeset_id = changeset_data.get('id', 'Unknown')
        user = changeset_data.get('user', 'Unknown')
        created = changeset_data.get('created', 0)
        modified = changeset_data.get('modified', 0)
        deleted = changeset_data.get('deleted', 0)
        total = created + modified + deleted
        
        comment = changeset_data.get('tags', {}).get('comment', 'No comment')
        source = changeset_data.get('tags', {}).get('source', 'Not specified')
        created_at = changeset_data.get('created_at', 'Unknown')
        
        # Format flags as comma-separated string
        flag_text = ', '.join([f.replace('⚠️', '').replace('📊', '').replace('💬', '').replace('📍', '').strip() for f in flags])
        
        # Links
        osm_link = f"https://www.openstreetmap.org/changeset/{changeset_id}"
        osmcha_link = f"https://osmcha.org/changesets/{changeset_id}"
        
        # Timestamp
        logged_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Prepare row
        row = [
            logged_at,
            str(changeset_id),
            user,
            str(total),
            str(created),
            str(modified),
            str(deleted),
            flag_text,
            comment[:100] if comment else '',  # Truncate long comments
            source[:50] if source else '',
            created_at,
            osm_link,
            osmcha_link,
            'Pending'  # Status column
        ]
        
        # Check if sheet has headers, if not add them
        try:
            first_row = sheet.row_values(1)
            if not first_row or first_row[0] != 'Logged At':
                headers = [
                    'Logged At',
                    'Changeset ID',
                    'User',
                    'Total Changes',
                    'Created',
                    'Modified',
                    'Deleted',
                    'Warning Flags',
                    'Comment',
                    'Source',
                    'Created At',
                    'OSM Link',
                    'OSMCha Link',
                    'Status'
                ]
                sheet.insert_row(headers, 1)
        except:
            # Sheet is empty, add headers
            headers = [
                'Logged At',
                'Changeset ID',
                'User',
                'Total Changes',
                'Created',
                'Modified',
                'Deleted',
                'Warning Flags',
                'Comment',
                'Source',
                'Created At',
                'OSM Link',
                'OSMCha Link',
                'Status'
            ]
            sheet.insert_row(headers, 1)
        
        # Check if changeset already exists in the sheet (to prevent duplicates)
        try:
            # Get all changeset IDs from column B (Changeset ID column)
            changeset_ids = sheet.col_values(2)  # Column B is the 2nd column
            
            # Skip if this changeset is already logged (check from row 2 onwards, skip header)
            if str(changeset_id) in changeset_ids[1:]:  # Skip header row
                print(f"ℹ️ Changeset #{changeset_id} already logged to Google Sheets, skipping duplicate")
                return
        except Exception as e:
            print(f"⚠️ Could not check for duplicates: {e}, proceeding with insert")
        
        # Insert the changeset needing review at row 2 (top, after headers)
        sheet.insert_row(row, 2)
        print(f"✅ Logged changeset #{changeset_id} needing review to Google Sheets (at top)")
        
    except Exception as e:
        print(f"❌ Error logging to Google Sheets: {e}")

# Print Google Sheets status on startup
if GOOGLE_SHEETS_ENABLED:
    print("📊 Google Sheets: ✅ ENABLED")
else:
    print("📊 Google Sheets: ⚠️ DISABLED (google_credentials.json not found)")

# Print Slack notifications status on startup
if SLACK_ALERTS_ENABLED and SLACK_WEBHOOK_URL:
    print("📢 Slack Notifications: ✅ ENABLED")
    print(f"   Webhook URL configured: {SLACK_WEBHOOK_URL[:30]}...")
elif SLACK_ALERTS_ENABLED and not SLACK_WEBHOOK_URL:
    print("📢 Slack Notifications: ⚠️ ENABLED but no webhook URL configured")
    print("   Set SLACK_WEBHOOK_URL environment variable to enable")
else:
    print("📢 Slack Notifications: ⚠️ DISABLED (set SLACK_ALERTS_ENABLED=true to enable)")

@app.route('/api/cache/clear')
def clear_cache():
    """Clear the changeset details cache"""
    global changeset_details_cache, erp_cache
    count = len(changeset_details_cache)
    changeset_details_cache.clear()
    erp_cache.clear()
    return jsonify({'success': True, 'message': f'Cleared {count} cached changesets'})

@app.route('/api/test/slack', methods=['POST'])
def test_slack_notification():
    """Test endpoint to send a test Slack notification"""
    if not SLACK_ALERTS_ENABLED:
        return jsonify({
            'success': False,
            'error': 'Slack notifications not enabled. Set SLACK_ALERTS_ENABLED=true'
        }), 400
    
    if not SLACK_WEBHOOK_URL:
        return jsonify({
            'success': False,
            'error': 'SLACK_WEBHOOK_URL not configured. Set it as an environment variable.'
        }), 400
    
    # Validate webhook URL format
    if not SLACK_WEBHOOK_URL.startswith('https://hooks.slack.com/services/'):
        return jsonify({
            'success': False,
            'error': f'Invalid webhook URL format. Should start with https://hooks.slack.com/services/',
            'current_url': SLACK_WEBHOOK_URL[:50] + '...' if len(SLACK_WEBHOOK_URL) > 50 else SLACK_WEBHOOK_URL
        }), 400
    
    # Test basic connectivity first
    try:
        test_response = requests.get('https://hooks.slack.com', timeout=5)
        print(f"✅ Can reach Slack servers (status: {test_response.status_code})")
    except requests.exceptions.ConnectionError:
        return jsonify({
            'success': False,
            'error': 'Cannot connect to Slack servers. Check your internet connection and firewall settings.',
            'troubleshooting': [
                'Check your internet connection',
                'Verify firewall allows HTTPS outbound connections',
                'Check if you need to configure a proxy',
                'Try accessing https://hooks.slack.com in your browser'
            ]
        }), 500
    except Exception as e:
        print(f"⚠️ Connectivity test warning: {e}")
    
    # Create a test changeset with needs_review status
    test_changeset = {
        'id': '999999999',
        'user': 'TestUser',
        'comment': 'This is a test changeset for Slack notification testing',
        'created_at': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC'),
        'validation': {
            'status': 'needs_review',
            'reasons': ['Mass deletion detected: 75 deletions', 'Test notification']
        },
        'details': {
            'total_created': 10,
            'total_modified': 15,
            'total_deleted': 75
        },
        'tags': {
            'comment': 'This is a test changeset for Slack notification testing',
            'source': 'test'
        }
    }
    
    # Temporarily remove from alerted set to allow test
    alerted_changesets.discard('999999999')
    
    # Send test notification
    result = send_slack_notification(test_changeset)
    
    if result:
        return jsonify({
            'success': True,
            'message': 'Test Slack notification sent successfully! Check your Slack channel.'
        })
    else:
        return jsonify({
            'success': False,
            'error': 'Failed to send test notification. Check server logs for details.'
        }), 500

# Notes storage configuration
NOTES_FILE = 'notes.json'
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Teams storage configuration
TEAMS_FILE = 'teams.json'
TEAM_MESSAGES_FILE = 'team_messages.json'
TEAM_TASKS_FILE = 'team_tasks.json'

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_notes():
    """Load notes from JSON file"""
    try:
        if os.path.exists(NOTES_FILE):
            with open(NOTES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading notes: {e}")
        return []

def save_notes(notes):
    """Save notes to JSON file"""
    try:
        with open(NOTES_FILE, 'w', encoding='utf-8') as f:
            json.dump(notes, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving notes: {e}")
        return False

def load_teams():
    """Load teams from JSON file"""
    try:
        if os.path.exists(TEAMS_FILE):
            with open(TEAMS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading teams: {e}")
        return []

def save_teams(teams):
    """Save teams to JSON file"""
    try:
        with open(TEAMS_FILE, 'w', encoding='utf-8') as f:
            json.dump(teams, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving teams: {e}")
        return False

def load_team_messages():
    """Load team messages from JSON file"""
    try:
        if os.path.exists(TEAM_MESSAGES_FILE):
            with open(TEAM_MESSAGES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading team messages: {e}")
        return []

def save_team_messages(messages):
    """Save team messages to JSON file"""
    try:
        with open(TEAM_MESSAGES_FILE, 'w', encoding='utf-8') as f:
            json.dump(messages, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving team messages: {e}")
        return False

def load_team_tasks():
    """Load team tasks from JSON file"""
    try:
        if os.path.exists(TEAM_TASKS_FILE):
            with open(TEAM_TASKS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading team tasks: {e}")
        return []

def save_team_tasks(tasks):
    """Save team tasks to JSON file"""
    try:
        with open(TEAM_TASKS_FILE, 'w', encoding='utf-8') as f:
            json.dump(tasks, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving team tasks: {e}")
        return False

# Validation thresholds for changesets needing review
VALIDATION_THRESHOLDS = {
    'mass_deletion_threshold': 50,  # 50+ deletions triggers "needs review"
}

def is_changeset_in_region(changeset, region_id=None):
    """
    Check if a changeset is primarily within a region using polygon-based filtering.
    Returns True if the changeset's center point is within the region's actual boundaries.
    This is more accurate than rectangular bounding box.
    
    Args:
        changeset: The changeset data dict
        region_id: The region to check against (defaults to current region)
    """
    region_id = region_id or CURRENT_REGION
    polygon = get_region_polygon(region_id)
    
    # If no polygon for this region, we can't filter - include all
    if polygon is None:
        return True
    
    bbox = changeset.get('bbox')
    
    # If no bbox, we can't determine location - exclude it
    if not bbox or not all([bbox.get('min_lat'), bbox.get('max_lat'), 
                            bbox.get('min_lon'), bbox.get('max_lon')]):
        return False
    
    # Calculate the center point of the changeset
    center_lat = (bbox['min_lat'] + bbox['max_lat']) / 2
    center_lon = (bbox['min_lon'] + bbox['max_lon']) / 2
    
    # Create a Shapely Point and check if it's within region polygon
    # Note: Shapely uses (longitude, latitude) order
    point = Point(center_lon, center_lat)
    is_within = polygon.contains(point)
    
    return is_within

# Legacy function for backward compatibility
def is_changeset_in_singapore(changeset):
    """Legacy wrapper - checks if changeset is in Singapore region"""
    return is_changeset_in_region(changeset, 'singapore')

# Cache for ERP (name=ERP) checks
erp_cache = {}

def check_changeset_has_erp(changeset_id):
    """
    Check if a changeset modifies any elements with name=ERP tag
    Returns: tuple (has_erp, count) where count is number of ERP elements modified
    Uses cache to avoid repeated API calls
    """
    # Check cache first
    if changeset_id in erp_cache:
        cached_result = erp_cache[changeset_id]
        return cached_result[0], cached_result[1]
    
    try:
        url = f"https://api.openstreetmap.org/api/0.6/changeset/{changeset_id}/download"
        headers = {'User-Agent': 'ATLAS-Singapore/1.0'}
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parse XML to check for name=ERP tags
        root = ET.fromstring(response.content)
        
        erp_count = 0
        
        # Check all actions (create, modify, delete)
        for action in ['create', 'modify', 'delete']:
            action_elems = root.findall(action)
            
            for action_elem in action_elems:
                # Check all element types (node, way, relation)
                for elem_type in ['node', 'way', 'relation']:
                    elements = action_elem.findall(elem_type)
                    
                    for elem in elements:
                        # Check all tags for name=ERP
                        tags = elem.findall('tag')
                        for tag in tags:
                            if tag.get('k') == 'name' and tag.get('v') == 'ERP':
                                erp_count += 1
                                break  # Count each element only once
        
        # Cache the result
        has_erp = erp_count > 0
        erp_cache[changeset_id] = (has_erp, erp_count)
        
        return has_erp, erp_count
        
    except Exception as e:
        print(f"Error checking name=ERP for changeset {changeset_id}: {e}")
        # Cache negative result to avoid retrying failed requests
        erp_cache[changeset_id] = (False, 0)
        return False, 0

def validate_changeset(changeset):
    """
    Validate a changeset to detect patterns needing review
    Returns: dict with 'status' (valid/needs_review) and 'reasons' list
    """
    validation = {
        'status': 'valid',
        'reasons': [],
        'flags': []
    }
    
    details = changeset.get('details', {})
    
    if details:
        total_deleted = details.get('total_deleted', 0)
        
        # Check for mass deletions (50+ deletions)
        if total_deleted >= VALIDATION_THRESHOLDS['mass_deletion_threshold']:
            validation['status'] = 'needs_review'
            validation['reasons'].append(f'Mass deletion detected: {total_deleted} deletions')
            validation['flags'].append('mass_deletion')
    
    # Check for name=ERP modifications
    cs_id = changeset.get('id')
    if cs_id:
        has_erp, erp_count = check_changeset_has_erp(cs_id)
        if has_erp:
            validation['status'] = 'needs_review'
            validation['reasons'].append(f'ERP modification detected: {erp_count} ERP element(s) modified')
            validation['flags'].append('erp')
    
    return validation

def fetch_changeset_details(changeset_id):
    """
    Fetch detailed statistics for a specific changeset
    Returns dict with created, modified, deleted counts for nodes, ways, relations
    """
    # Check cache first
    if changeset_id in changeset_details_cache:
        return changeset_details_cache[changeset_id]
    
    try:
        url = f"https://api.openstreetmap.org/api/0.6/changeset/{changeset_id}/download"
        headers = {'User-Agent': 'ATLAS-Singapore/1.0'}
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parse XML to count different types of changes
        root = ET.fromstring(response.content)
        
        stats = {
            'created': {'node': 0, 'way': 0, 'relation': 0},
            'modified': {'node': 0, 'way': 0, 'relation': 0},
            'deleted': {'node': 0, 'way': 0, 'relation': 0}
        }
        
        # Note: OSM API can return multiple <create>/<modify>/<delete> tags
        # We need to use findall() to get ALL of them, not just find() which gets the first one
        for action in ['create', 'modify', 'delete']:
            action_key = 'created' if action == 'create' else 'modified' if action == 'modify' else 'deleted'
            
            # Find ALL action elements (there can be multiple <create>, <modify>, <delete> tags)
            action_elems = root.findall(action)
            
            for action_elem in action_elems:
                for elem_type in ['node', 'way', 'relation']:
                    # Count elements in this action block
                    count = len(action_elem.findall(elem_type))
                    stats[action_key][elem_type] += count
        
        # Calculate totals
        stats['total_created'] = sum(stats['created'].values())
        stats['total_modified'] = sum(stats['modified'].values())
        stats['total_deleted'] = sum(stats['deleted'].values())
        
        # Cache the result
        changeset_details_cache[changeset_id] = stats
        return stats
        
    except Exception as e:
        print(f"Error fetching details for changeset {changeset_id}: {e}")
        return None

def fetch_osm_changesets(bbox=None, limit=200, region=None):
    """
    Fetch changesets from OpenStreetMap API for a given bounding box.
    Uses optimized parallel fetching for speed.
    
    Args:
        bbox: Bounding box string (defaults to current region's bbox)
        limit: Maximum number of changesets to return
        region: Region ID to filter by (defaults to current region)
    """
    # Use provided region, or fall back to current region
    region = region or CURRENT_REGION
    
    # Use provided bbox, or get it from the region config
    if bbox is None:
        bbox = get_region_bbox(region)
    
    region_name = get_region_name(region)
    try:
        import time
        start_time_overall = time.time()
        
        # OSM API endpoint for changesets
        url = "https://api.openstreetmap.org/api/0.6/changesets"
        
        headers = {
            'User-Agent': 'ATLAS-Singapore/1.0'
        }
        
        all_changesets = []
        seen_ids = set()
        
        # Start from now and go backwards (configurable time range)
        current_end = datetime.now(timezone.utc)
        start_time = current_end - timedelta(hours=CHANGESET_TIME_RANGE_HOURS)
        
        # We'll make multiple requests, each time using the oldest changeset from the previous batch
        # as the end time for the next batch (pagination backwards in time)
        max_requests = (limit + 99) // 100  # Max requests needed to reach desired limit
        
        print(f"📊 Fetching up to {limit} changesets from last {CHANGESET_TIME_RANGE_HOURS} hours (max {max_requests} API calls)...")
        
        for request_num in range(max_requests):
            # Stop if we already have enough changesets that pass the region filter
            region_count = sum(1 for cs in all_changesets if is_changeset_in_region(cs, region))
            if region_count >= limit:
                print(f"  ℹ️  Already have {region_count} {region_name} changesets, stopping early")
                break
        
            params = {
                'bbox': bbox,
                'closed': 'true',
                'time': f"{start_time.isoformat()}Z,{current_end.isoformat()}Z"
            }
            
            
            try:
                response = requests.get(url, params=params, headers=headers, timeout=15)
                
                
                # Parse XML response
                root = ET.fromstring(response.content)
                batch_changesets = []
                
                for changeset in root.findall('changeset'):
                    cs_id = changeset.get('id')
                    
                    # Skip duplicates
                    if cs_id in seen_ids:
                        continue
                    seen_ids.add(cs_id)
                    
                    user = changeset.get('user', 'Anonymous')
                    uid = changeset.get('uid', '')
                    created_at = changeset.get('created_at', '')
                    closed_at = changeset.get('closed_at', '')
                    num_changes = changeset.get('num_changes', '0')
                    min_lat = changeset.get('min_lat', '')
                    max_lat = changeset.get('max_lat', '')
                    min_lon = changeset.get('min_lon', '')
                    max_lon = changeset.get('max_lon', '')
                    
                    # Get tags (comments, etc.)
                    tags = {}
                    for tag in changeset.findall('tag'):
                        tags[tag.get('k')] = tag.get('v')
                    
                    # Format the changeset data
                    cs_data = {
                        'id': cs_id,
                        'user': user,
                        'uid': uid,
                        'created_at': created_at,
                        'closed_at': closed_at,
                        'num_changes': int(num_changes),
                        'comment': tags.get('comment', 'No comment'),
                        'created_by': tags.get('created_by', 'Unknown'),
                        'bbox': {
                            'min_lat': float(min_lat) if min_lat else None,
                            'max_lat': float(max_lat) if max_lat else None,
                            'min_lon': float(min_lon) if min_lon else None,
                            'max_lon': float(max_lon) if max_lon else None,
                        } if min_lat and max_lat and min_lon and max_lon else None,
                        'tags': tags
                    }
                    
                    batch_changesets.append(cs_data)
                
                if not batch_changesets:
                    print(f"  No more changesets found, stopping")
                    break
                
                all_changesets.extend(batch_changesets)
                
                # Sort batch by created_at to find the oldest
                batch_changesets.sort(key=lambda x: x['created_at'])
                oldest_in_batch = batch_changesets[0]['created_at']
                
                print(f"  Request {request_num + 1}: fetched {len(batch_changesets)} changesets (oldest: {oldest_in_batch[:10]})")
                
                # Update end time for next request to be 1 second before the oldest in this batch
                # This ensures we continue backwards in time without gaps
                current_end = date_parser.parse(oldest_in_batch) - timedelta(seconds=1)
                
                # If we've gone back too far, stop
                if current_end <= start_time:
                    print(f"  Reached time limit (365 days ago), stopping")
                    break
                
            except Exception as e:
                print(f"  Request {request_num + 1} failed: {e}")
                break
        fetch_time = time.time() - start_time_overall
        
        # Filter to only include changesets that are primarily within the region
        total_fetched = len(all_changesets)
        changesets = [cs for cs in all_changesets if is_changeset_in_region(cs, region)]
        filtered_count = len(changesets)
        
        # Sort by created_at descending (most recent first)
        changesets.sort(key=lambda x: x['created_at'], reverse=True)
        changesets = changesets[:limit]
        
        # Debug: Log some changeset info
        print(f"📈 Total: {total_fetched} fetched, {filtered_count} in {region_name}, {len(changesets)} after limit ({fetch_time:.1f}s)")
        if changesets:
            oldest = changesets[-1]['created_at'][:10] if len(changesets) > 0 else 'N/A'
            newest = changesets[0]['created_at'][:10] if len(changesets) > 0 else 'N/A'
            print(f"   Date range: {newest} to {oldest}")
        
        # Fetch detailed statistics for each changeset in parallel with reduced workers to avoid rate limiting
        print(f"🔍 Fetching detailed statistics for {len(changesets)} changesets...")
        details_start = time.time()
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_cs = {executor.submit(fetch_changeset_details, cs['id']): cs for cs in changesets}
            
            completed = 0
            errors = 0
            for future in as_completed(future_to_cs):
                cs = future_to_cs[future]
                completed += 1
                
                # Show progress every 100 changesets
                if completed % 100 == 0:
                    print(f"   Progress: {completed}/{len(changesets)} changesets processed...")
                
                try:
                    details = future.result()
                    if details:
                        cs['details'] = details
                        # Update num_changes from details if available
                        total_from_details = details.get('total_created', 0) + details.get('total_modified', 0) + details.get('total_deleted', 0)
                        if total_from_details > 0:
                            cs['num_changes'] = total_from_details
                    else:
                        errors += 1
                except Exception as e:
                    errors += 1
                    if errors <= 3:  # Show first 3 errors
                        print(f"   ⚠️  Error for changeset {cs['id']}: {str(e)[:50]}")
            
            if errors > 0:
                print(f"   ⚠️  {errors} changesets failed to fetch details")
        
        details_time = time.time() - details_start
        print(f"   Detailed statistics fetched in {details_time:.1f}s")
        
        # Debug: Show sample changeset details
        if changesets and len(changesets) > 0:
            sample = changesets[0]
            if sample.get('details'):
                print(f"   Sample details for changeset {sample['id']}: created={sample['details'].get('total_created', 'N/A')}, modified={sample['details'].get('total_modified', 'N/A')}, deleted={sample['details'].get('total_deleted', 'N/A')}")
            else:
                print(f"   ⚠️  Sample changeset {sample['id']} has no details!")
        
        # Validate all changesets and add tags
        for cs in changesets:
            cs['validation'] = validate_changeset(cs)
            
            # Add "mass_deletion" tag for needs_review changesets with 50+ deletions
            if cs['validation'].get('status') == 'needs_review':
                details = cs.get('details', {})
                total_deleted = details.get('total_deleted', 0)
                
                if total_deleted >= 50:
                    # Ensure tags dictionary exists
                    if 'tags' not in cs:
                        cs['tags'] = {}
                    
                    # Add mass_deletion tag
                    cs['tags']['mass_deletion'] = 'yes'
                    cs['tags']['deleted_count'] = str(total_deleted)
                    print(f"🏷️ Added mass_deletion tag to changeset {cs.get('id')} ({total_deleted} deletions)")
                elif total_deleted > 0:
                    # Debug: log if needs_review but less than 50 deletions (shouldn't happen)
                    print(f"⚠️ Changeset {cs.get('id')} marked needs_review but only has {total_deleted} deletions")
        
        # Check if this is the initial load (no previously alerted changesets)
        initial_load = len(alerted_changesets) == 0
        
        if initial_load:
            # First time loading - mark all existing changesets as seen WITHOUT sending notifications
            print(f"📋 Initial load: Marking {len(changesets)} existing changesets as seen (no notifications will be sent)")
            for cs in changesets:
                cs_id = cs.get('id')
                if cs_id:
                    alerted_changesets.add(str(cs_id))
            save_alerted_changesets(alerted_changesets)
            print(f"✅ Marked {len(alerted_changesets)} changesets as seen. Future NEW changesets will trigger notifications.")
        else:
            # Subsequent loads - only notify for NEW needs_review changesets that haven't been seen before
            new_count = 0
            skipped_count = 0
            for cs in changesets:
                cs_id = cs.get('id')
                if cs_id:
                    cs_id_str = str(cs_id)
                    # Only send notifications for needs_review changesets
                    if cs['validation'].get('status') == 'needs_review' and cs_id_str not in alerted_changesets:
                        # This is a NEW needs_review changeset - send notification
                        print(f"🆕 Detected NEW needs_review changeset: {cs_id_str} (User: {cs.get('user', 'Unknown')})")
                        result = send_slack_notification(cs)
                        if result:
                            new_count += 1
                        else:
                            print(f"⚠️ Failed to send notification for changeset {cs_id_str}")
                    else:
                        skipped_count += 1
            
            if new_count > 0:
                print(f"📢 Sent notifications for {new_count} new needs_review changeset(s)")
            if skipped_count > 0:
                print(f"⏭️ Skipped {skipped_count} already-notified or non-needs_review changeset(s)")
            
            # Also log to Google Sheets if validation status is 'needs_review' and Google Sheets enabled
            if cs['validation'].get('status') == 'needs_review' and GOOGLE_SHEETS_ENABLED:
                # Transform changeset data to match expected format for logging
                details = cs.get('details', {})
                log_data = {
                    'id': cs['id'],
                    'user': cs['user'],
                    'created': details.get('total_created', 0),
                    'modified': details.get('total_modified', 0),
                    'deleted': details.get('total_deleted', 0),
                    'tags': cs.get('tags', {}),
                    'created_at': cs.get('created_at', 'Unknown')
                }
                
                # Get validation reasons as flags
                validation_flags = cs['validation'].get('reasons', [])
                
                # Log to Google Sheets
                log_changeset_needing_review(log_data, validation_flags, 'Auto-detected during fetch')
        
        total_time = time.time() - start_time_overall
        print(f"✅ Loaded {len(changesets)} changesets successfully in {total_time:.1f}s")
        return changesets
    
    except Exception as e:
        print(f"❌ Error fetching changesets: {e}")
        return []

def get_statistics(changesets):
    """
    Calculate statistics from changesets
    """
    if not changesets:
        return {
            'total_changesets': 0,
            'total_changes': 0,
            'unique_users': 0,
            'top_contributors': []
        }
    
    total_changes = sum(cs['num_changes'] for cs in changesets)
    unique_users = len(set(cs['user'] for cs in changesets))
    
    # Count validation statuses
    validation_counts = {
        'valid': 0,
        'needs_review': 0
    }
    for cs in changesets:
        validation_status = cs.get('validation', {}).get('status', 'valid')
        validation_counts[validation_status] = validation_counts.get(validation_status, 0) + 1
    
    # Debug logging
    print(f"Statistics: {len(changesets)} changesets, {total_changes} total changes, {unique_users} users")
    print(f"Validation: {validation_counts['valid']} valid, {validation_counts['needs_review']} needs review")
    
    # Count contributions per user
    user_contributions = {}
    for cs in changesets:
        user = cs['user']
        if user not in user_contributions:
            user_contributions[user] = {
                'user': user,
                'changesets': 0,
                'total_changes': 0
            }
        user_contributions[user]['changesets'] += 1
        user_contributions[user]['total_changes'] += cs['num_changes']
    
    # Get top 10 contributors (sorted by number of changesets)
    top_contributors = sorted(
        user_contributions.values(),
        key=lambda x: x['changesets'],
        reverse=True
    )[:10]
    
    return {
        'total_changesets': len(changesets),
        'total_changes': total_changes,
        'unique_users': unique_users,
        'top_contributors': top_contributors,
        'validation': validation_counts,
        'time_range_hours': CHANGESET_TIME_RANGE_HOURS
    }

@app.route('/')
def index():
    """Serve the dashboard HTML page"""
    return render_template('index.html')

# ============================================
# Region API Endpoints
# ============================================

@app.route('/api/regions')
def get_regions():
    """API endpoint to get available regions"""
    return jsonify({
        'success': True,
        'regions': REGIONS,
        'currentRegion': CURRENT_REGION,
        'defaultRegion': DEFAULT_REGION
    })

@app.route('/api/regions/<region_id>')
def get_region(region_id):
    """API endpoint to get a specific region's configuration"""
    if region_id not in REGIONS:
        return jsonify({
            'success': False,
            'error': f'Region {region_id} not found'
        }), 404
    
    return jsonify({
        'success': True,
        'region': REGIONS[region_id]
    })

@app.route('/api/changesets')
def get_changesets():
    """API endpoint to get changesets for a region"""
    region = request.args.get('region', CURRENT_REGION)
    
    # Validate region exists
    if region not in REGIONS:
        return jsonify({
            'success': False,
            'error': f'Region {region} not found'
        }), 404
    
    # Use limit=1000 to match analytics endpoint and ensure all changesets are included
    changesets = fetch_osm_changesets(region=region, limit=1000)
    return jsonify({
        'success': True,
        'count': len(changesets),
        'region': region,
        'regionName': get_region_name(region),
        'changesets': changesets
    })

@app.route('/api/changeset/<changeset_id>/debug')
def debug_changeset(changeset_id):
    """Debug endpoint to check changeset details"""
    try:
        details = fetch_changeset_details(changeset_id)
        
        # Also fetch raw XML to see what's actually there
        url = f"https://api.openstreetmap.org/api/0.6/changeset/{changeset_id}/download"
        headers = {'User-Agent': 'ATLAS-Singapore/1.0'}
        response = requests.get(url, headers=headers, timeout=10)
        
        xml_preview = response.text[:1000]  # First 1000 chars
        
        return jsonify({
            'success': True,
            'changeset_id': changeset_id,
            'details': details,
            'xml_preview': xml_preview
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/changeset/<changeset_id>/comparison')
@cache.cached(timeout=3600, key_prefix='comparison_%s')
def get_changeset_comparison(changeset_id):
    """
    Fetch detailed before/after comparison for a changeset
    Returns all changes with old and new values
    CACHED: Results cached for 1 hour for performance
    """
    try:
        print(f"🔍 Fetching comparison for changeset #{changeset_id}...")
        # Fetch changeset details from OSM API
        url = f"https://api.openstreetmap.org/api/0.6/changeset/{changeset_id}/download"
        headers = {'User-Agent': 'ATLAS-Singapore/1.0'}
        response = requests.get(url, headers=headers, timeout=60)
        response.raise_for_status()
        
        root = ET.fromstring(response.content)
        
        # Build a lookup table of all nodes in the changeset for calculating way centers
        node_coords = {}
        for node in root.findall('.//node'):
            node_id = node.get('id')
            lat = node.get('lat')
            lon = node.get('lon')
            if node_id and lat and lon:
                node_coords[node_id] = {
                    'lat': float(lat),
                    'lon': float(lon)
                }
        
        comparison_data = {
            'created': [],
            'modified': [],
            'deleted': []
        }
        
        # Parse created elements
        for create_elem in root.findall('create'):
            for elem in create_elem:
                created_item = parse_osm_element(elem, 'created')
                
                # For ways without coordinates, calculate center and geometry from nodes in changeset
                if not created_item['lat'] and created_item['type'] == 'way' and created_item['nodes']:
                    # Build geometry array from node refs
                    geometry_coords = []
                    for node_id in created_item['nodes']:
                        if node_id in node_coords:
                            geometry_coords.append([node_coords[node_id]['lat'], node_coords[node_id]['lon']])
                    
                    if len(geometry_coords) > 0:
                        # Calculate center
                        lats = [coord[0] for coord in geometry_coords]
                        lons = [coord[1] for coord in geometry_coords]
                        created_item['lat'] = sum(lats) / len(lats)
                        created_item['lon'] = sum(lons) / len(lons)
                        created_item['geometry'] = geometry_coords if len(geometry_coords) > 1 else None
                
                comparison_data['created'].append(created_item)
        
        # Parse modified elements
        modified_items = []
        for modify_elem in root.findall('modify'):
            for elem in modify_elem:
                modified_item = parse_osm_element(elem, 'modified')
                
                # For ways without coordinates, calculate center and geometry from nodes in changeset
                if not modified_item['lat'] and modified_item['type'] == 'way' and modified_item['nodes']:
                    # Build geometry array from node refs
                    geometry_coords = []
                    for node_id in modified_item['nodes']:
                        if node_id in node_coords:
                            geometry_coords.append([node_coords[node_id]['lat'], node_coords[node_id]['lon']])
                    
                    if len(geometry_coords) > 0:
                        # Calculate center
                        lats = [coord[0] for coord in geometry_coords]
                        lons = [coord[1] for coord in geometry_coords]
                        modified_item['lat'] = sum(lats) / len(lats)
                        modified_item['lon'] = sum(lons) / len(lons)
                        modified_item['geometry'] = geometry_coords if len(geometry_coords) > 1 else None
                
                modified_items.append(modified_item)
        
        # Fetch previous versions for modified elements to get old tags
        # Limit to first 100 elements to avoid timeouts on large changesets
        MAX_PREVIOUS_VERSIONS = 100
        items_to_fetch = modified_items[:MAX_PREVIOUS_VERSIONS]
        
        if len(modified_items) > MAX_PREVIOUS_VERSIONS:
            print(f"📍 Large changeset detected: {len(modified_items)} modified elements")
            print(f"📍 Fetching old versions for first {MAX_PREVIOUS_VERSIONS} elements only...")
        else:
            print(f"📍 Fetching old versions for {len(modified_items)} modified elements...")
        
        if len(items_to_fetch) > 0:
            with ThreadPoolExecutor(max_workers=15) as executor:
                future_to_item = {}
                for item in items_to_fetch:
                    future = executor.submit(fetch_previous_element_version, item['type'], item['id'], item['version'])
                    future_to_item[future] = item
                
                if len(future_to_item) > 0:
                    completed = 0
                    try:
                        for future in as_completed(future_to_item, timeout=60):
                            item = future_to_item[future]
                            completed += 1
                            try:
                                old_data = future.result()
                                if old_data:
                                    # Merge old data into item
                                    item['old_tags'] = old_data['old_tags']
                                    item['old_lat'] = old_data['old_lat']
                                    item['old_lon'] = old_data['old_lon']
                                    item['old_nodes'] = old_data['old_nodes']
                                    
                                    # Calculate old geometry if it's a way
                                    if item['type'] == 'way' and old_data['old_nodes']:
                                        old_geometry_coords = []
                                        for node_id in old_data['old_nodes']:
                                            if node_id in node_coords:
                                                old_geometry_coords.append([node_coords[node_id]['lat'], node_coords[node_id]['lon']])
                                        
                                        if len(old_geometry_coords) > 1:
                                            item['old_geometry'] = old_geometry_coords
                                    
                                    if completed % 20 == 0 or completed == len(future_to_item):
                                        print(f"  ✓ [{completed}/{len(future_to_item)}] Fetched old versions...")
                                else:
                                    if completed % 20 == 0:
                                        print(f"  ⚠️  [{completed}/{len(future_to_item)}] Some elements missing old versions...")
                            except Exception as e:
                                if completed % 20 == 0:
                                    print(f"  ⚠️  [{completed}/{len(future_to_item)}] Some errors encountered...")
                    except TimeoutError:
                        print(f"  ⚠️  Timeout after {completed}/{len(future_to_item)} completed - continuing with partial results")
        
        comparison_data['modified'] = modified_items
        
        # Parse deleted elements - must fetch from API since changeset strips coordinates
        deleted_items = []
        for delete_elem in root.findall('delete'):
            for elem in delete_elem:
                deleted_item = parse_osm_element(elem, 'deleted')
                deleted_items.append(deleted_item)
        
        print(f"📍 Processing {len(deleted_items)} deleted elements with parallel fetching...")
        
        # Fetch geometry in parallel for better performance
        if len(deleted_items) > 0:
            with ThreadPoolExecutor(max_workers=10) as executor:
                future_to_item = {}
                for item in deleted_items:
                    if not item['lat']:
                        future = executor.submit(fetch_element_geometry, item['type'], item['id'], item['version'])
                        future_to_item[future] = item
                
                if len(future_to_item) > 0:
                    completed = 0
                    errors = 0
                    try:
                        # Increased timeout from 30 to 60 seconds for better reliability with ways
                        for future in as_completed(future_to_item, timeout=60):
                            item = future_to_item[future]
                            completed += 1
                            try:
                                geometry = future.result(timeout=15)  # Individual timeout per element
                                if geometry:
                                    item['lat'] = geometry['lat']
                                    item['lon'] = geometry['lon']
                                    item['geometry'] = geometry.get('geometry')  # Add full geometry array
                                    geo_type = "line" if geometry.get('geometry') else "point"
                                    if completed % 5 == 0 or item['type'] == 'way':  # Always log ways
                                        print(f"  ✓ [{completed}/{len(future_to_item)}] {item['type']} #{item['id']}: {geometry['lat']:.4f}, {geometry['lon']:.4f} ({geo_type})")
                                else:
                                    errors += 1
                                    print(f"  ✗ [{completed}/{len(future_to_item)}] {item['type']} #{item['id']}: no geometry returned")
                            except Exception as e:
                                errors += 1
                                print(f"  ✗ [{completed}/{len(future_to_item)}] {item['type']} #{item['id']}: {str(e)}")
                    except TimeoutError:
                        print(f"  ⚠️  Timeout after {completed}/{len(future_to_item)} completed - continuing with partial results")
                    
                    print(f"  📊 Deleted elements: {completed - errors} successful, {errors} failed")
        
        comparison_data['deleted'] = deleted_items
        print(f"✅ Comparison complete: {len(comparison_data['created'])} created, {len(comparison_data['modified'])} modified, {len(comparison_data['deleted'])} deleted")
        
        return jsonify({
            'success': True,
            'changeset_id': changeset_id,
            'comparison': comparison_data
        })
        
    except Exception as e:
        print(f"Error fetching comparison: {e}")
        return jsonify({'error': str(e)}), 500

def calculate_way_center(node_refs, node_coords):
    """
    Calculate center point of a way from its node references
    node_refs: list of node IDs
    node_coords: dict mapping node ID to {lat, lon}
    Returns dict with lat/lon or None
    """
    lats = []
    lons = []
    
    for node_id in node_refs:
        if node_id in node_coords:
            lats.append(node_coords[node_id]['lat'])
            lons.append(node_coords[node_id]['lon'])
    
    if lats and lons:
        return {
            'lat': sum(lats) / len(lats),
            'lon': sum(lons) / len(lons)
        }
    
    return None

def parse_osm_element(elem, action):
    """Parse OSM element into structured data"""
    element_data = {
        'type': elem.tag,
        'id': elem.get('id'),
        'action': action,
        'version': elem.get('version'),
        'lat': float(elem.get('lat')) if elem.get('lat') else None,
        'lon': float(elem.get('lon')) if elem.get('lon') else None,
        'tags': {},
        'nodes': [],
        'members': []
    }
    
    # Parse tags
    for tag in elem.findall('tag'):
        element_data['tags'][tag.get('k')] = tag.get('v')
    
    # Parse nodes (for ways)
    for nd in elem.findall('nd'):
        element_data['nodes'].append(nd.get('ref'))
    
    # Parse members (for relations)
    for member in elem.findall('member'):
        element_data['members'].append({
            'type': member.get('type'),
            'ref': member.get('ref'),
            'role': member.get('role')
        })
    
    return element_data

@lru_cache(maxsize=1000)
def fetch_previous_element_version(element_type, element_id, current_version):
    """
    Fetch the previous version of an element to get its old tags/attributes
    Used for showing before/after state of modified elements
    Returns dict with old_tags, old_lat, old_lon, etc. or None
    CACHED: Uses LRU cache to avoid redundant API calls
    """
    try:
        headers = {'User-Agent': 'ATLAS-Singapore/1.0'}
        prev_version = int(current_version) - 1
        
        if prev_version < 1:
            return None
        
        # Fetch the previous version
        url = f"https://api.openstreetmap.org/api/0.6/{element_type}/{element_id}/{prev_version}"
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        root = ET.fromstring(response.content)
        elem = root.find(f'.//{element_type}')
        
        if elem is None:
            return None
        
        # Extract old data
        old_data = {
            'old_version': elem.get('version'),
            'old_lat': float(elem.get('lat')) if elem.get('lat') else None,
            'old_lon': float(elem.get('lon')) if elem.get('lon') else None,
            'old_tags': {},
            'old_nodes': []
        }
        
        # Parse old tags
        for tag in elem.findall('tag'):
            old_data['old_tags'][tag.get('k')] = tag.get('v')
        
        # Parse old nodes (for ways)
        for nd in elem.findall('nd'):
            old_data['old_nodes'].append(nd.get('ref'))
        
        return old_data
        
    except Exception as e:
        print(f"    ✗ Error fetching previous version for {element_type} {element_id} v{current_version}: {e}")
        return None

@lru_cache(maxsize=1000)
def fetch_element_geometry(element_type, element_id, version=None):
    """
    Fetch full geometry for a way, relation, or deleted node
    For deleted elements, must provide version number to fetch the previous version
    Returns dict with lat/lon (center) AND geometry array (full coordinates) or None
    CACHED: Uses LRU cache to avoid redundant API calls
    """
    try:
        headers = {'User-Agent': 'ATLAS-Singapore/1.0'}
        
        # For deleted elements, fetch the previous version
        if version is not None:
            prev_version = int(version) - 1
            if prev_version < 1:
                print(f"    ⚠️  {element_type} {element_id}: version {version} is too low (prev would be {prev_version})")
                return None
            
            # For nodes, just fetch the previous version directly
            if element_type == 'node':
                url = f"https://api.openstreetmap.org/api/0.6/node/{element_id}/{prev_version}"
                response = requests.get(url, headers=headers, timeout=10)
                response.raise_for_status()
                
                root = ET.fromstring(response.content)
                node = root.find('.//node')
                
                if node is not None:
                    lat = node.get('lat')
                    lon = node.get('lon')
                    if lat and lon:
                        return {
                            'lat': float(lat),
                            'lon': float(lon),
                            'geometry': None  # Nodes don't have geometry
                        }
                return None
            
            # For ways: OSM API doesn't support /full for historical versions
            # So we fetch the way to get node references, then fetch each node
            print(f"    🔍 Fetching {element_type} {element_id} v{prev_version}...")
            url = f"https://api.openstreetmap.org/api/0.6/{element_type}/{element_id}/{prev_version}"
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            
            root = ET.fromstring(response.content)
            way_elem = root.find('.//way')
            
            if way_elem is None:
                print(f"    ✗ Way {element_id} not found in response")
                return None
            
            # Get node references from the way
            node_refs = [nd.get('ref') for nd in way_elem.findall('nd')]
            print(f"    📍 Way has {len(node_refs)} node references")
            
            if not node_refs:
                return None
            
            # Fetch each node's coordinates
            lats = []
            lons = []
            geometry = []
            
            for node_ref in node_refs:
                try:
                    # Try fetching the current node first
                    node_url = f"https://api.openstreetmap.org/api/0.6/node/{node_ref}"
                    node_response = requests.get(node_url, headers=headers, timeout=5)
                    
                    if node_response.status_code == 200:
                        node_root = ET.fromstring(node_response.content)
                        node = node_root.find('.//node')
                        if node is not None:
                            lat = node.get('lat')
                            lon = node.get('lon')
                            if lat and lon:
                                lats.append(float(lat))
                                lons.append(float(lon))
                                geometry.append([float(lat), float(lon)])
                    elif node_response.status_code == 410:  # Node was deleted
                        # Try fetching the node's history to get its last coordinates
                        try:
                            history_url = f"https://api.openstreetmap.org/api/0.6/node/{node_ref}/history"
                            history_resp = requests.get(history_url, headers=headers, timeout=5)
                            if history_resp.status_code == 200:
                                hist_root = ET.fromstring(history_resp.content)
                                # Find the last visible version
                                visible_nodes = [n for n in hist_root.findall('.//node') if n.get('visible') == 'true']
                                if visible_nodes:
                                    last_visible = visible_nodes[-1]  # Last visible version
                                    lat = last_visible.get('lat')
                                    lon = last_visible.get('lon')
                                    if lat and lon:
                                        lats.append(float(lat))
                                        lons.append(float(lon))
                                        geometry.append([float(lat), float(lon)])
                        except:
                            pass  # Skip this node if history fetch fails
                except Exception as e:
                    print(f"      ✗ Failed to fetch node {node_ref}: {str(e)[:30]}")
                    continue
            
            print(f"    ✓ Successfully fetched {len(geometry)}/{len(node_refs)} nodes")
        else:
            # For current elements, fetch the full data
            if element_type == 'node':
                # Nodes don't need /full
                url = f"https://api.openstreetmap.org/api/0.6/{element_type}/{element_id}"
                response = requests.get(url, headers=headers, timeout=10)
                response.raise_for_status()
                
                root = ET.fromstring(response.content)
                node = root.find('.//node')
                
                if node is not None:
                    lat = node.get('lat')
                    lon = node.get('lon')
                    if lat and lon:
                        return {
                            'lat': float(lat),
                            'lon': float(lon),
                            'geometry': None
                        }
                return None
            
            url = f"https://api.openstreetmap.org/api/0.6/{element_type}/{element_id}/full"
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            root = ET.fromstring(response.content)
            
            # Collect all node coordinates in order
            lats = []
            lons = []
            geometry = []
            
            # Find all nodes in the response
            for node in root.findall('.//node'):
                lat = node.get('lat')
                lon = node.get('lon')
                if lat and lon:
                    lats.append(float(lat))
                    lons.append(float(lon))
                    geometry.append([float(lat), float(lon)])
        
        # Calculate center point and return with full geometry
        if lats and lons:
            center_lat = sum(lats) / len(lats)
            center_lon = sum(lons) / len(lons)
            return {
                'lat': center_lat,
                'lon': center_lon,
                'geometry': geometry if len(geometry) > 1 else None  # Return array of coordinates
            }
        
        return None
        
    except Exception as e:
        print(f"    ✗ Error fetching geometry for {element_type} {element_id} v{version}: {e}")
        return None

@app.route('/api/statistics')
def get_stats():
    """API endpoint to get statistics"""
    region_id = request.args.get('region', 'singapore')
    changesets = fetch_osm_changesets(region=region_id)
    stats = get_statistics(changesets)
    return jsonify({
        'success': True,
        'statistics': stats,
        'region': region_id,
        'regionName': get_region_name(region_id)
    })

@app.route('/api/analytics')
def get_analytics():
    """API endpoint to get analytics data for charts"""
    try:
        # Fixed to 24 hours
        hours = 24
        region_id = request.args.get('region', 'singapore')
        
        print(f"📊 Fetching analytics for last 24 hours (region: {region_id})")
        
        # Fetch changesets for the time range
        changesets = fetch_osm_changesets(region=region_id, limit=1000)
        
        # Filter by time range
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        changesets = [cs for cs in changesets if date_parser.parse(cs['created_at']) >= cutoff]
        
        print(f"📊 Found {len(changesets)} changesets in last 24 hours")
        
        # Hourly buckets for 24h range
        bucket_hours = 1
        
        # Group by time buckets for timeline
        timeline_data = {}
        
        for cs in changesets:
            created_at = date_parser.parse(cs['created_at'])
            # Round down to nearest bucket
            bucket = created_at.replace(minute=0, second=0, microsecond=0)
            bucket = bucket - timedelta(hours=bucket.hour % bucket_hours)
            bucket_key = bucket.strftime('%Y-%m-%d %H:%M')
            
            if bucket_key not in timeline_data:
                timeline_data[bucket_key] = {
                    'created': 0,
                    'modified': 0,
                    'deleted': 0
                }
            
            details = cs.get('details', {})
            timeline_data[bucket_key]['created'] += details.get('total_created', 0)
            timeline_data[bucket_key]['modified'] += details.get('total_modified', 0)
            timeline_data[bucket_key]['deleted'] += details.get('total_deleted', 0)
        
        # Sort timeline by date
        sorted_timeline = sorted(timeline_data.items())
        
        # Aggregate totals
        total_created = sum(cs.get('details', {}).get('total_created', 0) for cs in changesets)
        total_modified = sum(cs.get('details', {}).get('total_modified', 0) for cs in changesets)
        total_deleted = sum(cs.get('details', {}).get('total_deleted', 0) for cs in changesets)
        
        # Element type breakdown
        element_breakdown = {
            'created': {'nodes': 0, 'ways': 0, 'relations': 0},
            'modified': {'nodes': 0, 'ways': 0, 'relations': 0},
            'deleted': {'nodes': 0, 'ways': 0, 'relations': 0}
        }
        
        for cs in changesets:
            details = cs.get('details', {})
            for action in ['created', 'modified', 'deleted']:
                if action in details:
                    for elem_type in ['node', 'way', 'relation']:
                        key = elem_type + 's'
                        element_breakdown[action][key] += details[action].get(elem_type, 0)
        
        # Ensure all changesets have validation set (re-validate if missing or invalid)
        # This is critical - validation must be present and correct for filtering to work
        for cs in changesets:
            if 'validation' not in cs or not cs.get('validation') or not isinstance(cs.get('validation'), dict):
                cs['validation'] = validate_changeset(cs)
        
        # Get users with changesets needing review
        # IMPORTANT: Only count users who have changesets with status == 'needs_review'
        users_needing_review = {}
        total_changesets_checked = 0
        needs_review_count = 0
        
        for cs in changesets:
            total_changesets_checked += 1
            
            # Safely get validation status, ensuring it exists and is valid
            validation = cs.get('validation', {})
            if not isinstance(validation, dict):
                # If validation is not a dict, re-validate
                cs['validation'] = validate_changeset(cs)
                validation = cs['validation']
            
            validation_status = validation.get('status', 'valid')
            
            # CRITICAL: Only include users who have changesets that actually need review
            # Must be exactly 'needs_review' - not 'valid', not empty, not None
            if validation_status == 'needs_review':
                needs_review_count += 1
                user = cs.get('user', 'Unknown')
                # Only count valid usernames
                if user and user != 'Unknown' and user.strip():
                    users_needing_review[user] = users_needing_review.get(user, 0) + 1
        
        # Debug logging to help identify issues
        print(f"📊 Validation check: {total_changesets_checked} changesets checked, {needs_review_count} need review, {len(users_needing_review)} unique users")
        
        # Additional safety check: if somehow we got all users, log a warning
        if len(users_needing_review) > len(changesets) * 0.5:  # More than 50% of changesets
            print(f"⚠️ WARNING: Suspiciously high number of users needing review ({len(users_needing_review)}/{len(changesets)} changesets)")
            print(f"   Sample validation statuses: {[cs.get('validation', {}).get('status', 'missing') for cs in changesets[:5]]}")
        
        # Sort by number of changesets needing review
        sorted_users = sorted(users_needing_review.items(), key=lambda x: x[1], reverse=True)[:10]
        contributors_data = [{'user': user, 'changesets': count} for user, count in sorted_users]
        
        print(f"📊 Users with changesets needing review: {len(users_needing_review)}")
        if contributors_data:
            print(f"📊 Top users needing review: {contributors_data[:5]}")
        
        # Get statistics for validation
        stats = get_statistics(changesets)
        
        # Format timeline labels (hourly for 24h)
        formatted_labels = []
        for label, _ in sorted_timeline:
            dt = datetime.strptime(label, '%Y-%m-%d %H:%M')
            formatted_labels.append(dt.strftime('%H:%M'))
        
        # Generate summary statistics
        unique_contributors = len(set(cs.get('user', 'Unknown') for cs in changesets))
        
        # Find most active hour
        hourly_activity = {}
        for cs in changesets:
            created_at = date_parser.parse(cs['created_at'])
            hour_key = created_at.strftime('%H:00')
            hourly_activity[hour_key] = hourly_activity.get(hour_key, 0) + 1
        
        most_active_hour = max(hourly_activity.items(), key=lambda x: x[1])[0] if hourly_activity else None
        
        summary = {
            'total_changesets': len(changesets),
            'total_edits': total_created + total_modified + total_deleted,
            'breakdown': {
                'created': total_created,
                'modified': total_modified,
                'deleted': total_deleted
            },
            'unique_contributors': unique_contributors,
            'needs_review': stats.get('validation', {}).get('needs_review', 0),
            'most_active_hour': most_active_hour,
            'top_contributor': contributors_data[0]['user'] if contributors_data else None,
            'top_contributor_count': contributors_data[0]['changesets'] if contributors_data else 0
        }
        
        analytics_data = {
            'timeline': {
                'labels': formatted_labels,
                'created': [data['created'] for _, data in sorted_timeline],
                'modified': [data['modified'] for _, data in sorted_timeline],
                'deleted': [data['deleted'] for _, data in sorted_timeline]
            },
            'editType': {
                'created': total_created,
                'modified': total_modified,
                'deleted': total_deleted
            },
            'elementType': element_breakdown,
            'contributors': contributors_data,
            'validation': stats.get('validation', {'valid': 0, 'needs_review': 0}),
            'summary': summary
        }
        
        print(f"📊 Analytics prepared: {total_created} created, {total_modified} modified, {total_deleted} deleted")
        print(f"📊 Found {len(contributors_data)} users with changesets needing review")
        
        return jsonify({
            'success': True,
            'analytics': analytics_data,
            'changeset_count': len(changesets),
            'region': region_id,
            'regionName': get_region_name(region_id)
        })
        
    except Exception as e:
        print(f"❌ Error fetching analytics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# OAuth Routes
@app.route('/oauth/login')
def oauth_login():
    """Initiate OSM OAuth login"""
    try:
        # Check if OAuth credentials are configured
        if OSM_CLIENT_ID == 'YOUR_CLIENT_ID_HERE' or not OSM_CLIENT_ID:
            return jsonify({
                'error': 'OAuth not configured',
                'message': 'OSM_CLIENT_ID environment variable is not set',
                'hint': 'Set OSM_CLIENT_ID, OSM_CLIENT_SECRET, and OSM_REDIRECT_URI in Render environment variables'
            }), 500
        
        if OSM_CLIENT_SECRET == 'YOUR_CLIENT_SECRET_HERE' or not OSM_CLIENT_SECRET:
            return jsonify({
                'error': 'OAuth not configured',
                'message': 'OSM_CLIENT_SECRET environment variable is not set',
                'hint': 'Set OSM_CLIENT_SECRET in Render environment variables'
            }), 500
        
        # Clean up old states before creating a new one
        cleanup_expired_states()
        
        state = secrets.token_urlsafe(32)
        
        # Store state server-side with timestamp (not in session cookie)
        oauth_states[state] = datetime.now(timezone.utc)
        save_oauth_states(oauth_states)  # Persist to file
        
        print(f"🔐 Initiating OAuth login...")
        print(f"   Client ID: {OSM_CLIENT_ID[:20]}...")
        print(f"   Redirect URI: {OSM_REDIRECT_URI}")
        print(f"   Generated state: {state[:20]}...")
        print(f"   Total active states: {len(oauth_states)}")
        
        auth_url = f"{OSM_OAUTH_URL}?client_id={OSM_CLIENT_ID}&redirect_uri={OSM_REDIRECT_URI}&response_type=code&scope=read_prefs&state={state}"
        return redirect(auth_url)
        
    except Exception as e:
        print(f"❌ Error in oauth_login: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'OAuth login failed',
            'message': str(e),
            'hint': 'Check Render logs and verify environment variables are set'
        }), 500

@app.route('/oauth/callback')
def oauth_callback():
    """Handle OSM OAuth callback"""
    received_state = request.args.get('state')
    
    print(f"🔐 OAuth callback received...")
    print(f"   Received state: {received_state[:20] if received_state else 'None'}...")
    print(f"   Active states in storage: {len(oauth_states)}")
    
    # Verify state exists in server-side storage
    if not received_state or received_state not in oauth_states:
        # Get stored state prefixes for debugging
        stored_states = [state[:20] + '...' for state in oauth_states.keys()]
        
        error_msg = {
            'error': 'Invalid state parameter',
            'debug': {
                'received_state_prefix': received_state[:20] if received_state else 'None',
                'state_exists': received_state in oauth_states if received_state else False,
                'active_states_count': len(oauth_states),
                'stored_state_prefixes': stored_states if stored_states else 'No states in storage',
                'hint': 'State not found in server storage. It may have expired (10 min timeout), already been used, or you are reusing an old callback URL. Please click "Login with OSM" again to start a fresh login.'
            }
        }
        print(f"❌ State validation failed!")
        print(f"   Received state: {received_state if received_state else 'None'}")
        print(f"   State in storage: {received_state in oauth_states if received_state else False}")
        print(f"   Stored states: {stored_states}")
        return jsonify(error_msg), 400
    
    # State is valid - remove it (one-time use)
    state_timestamp = oauth_states.pop(received_state)
    save_oauth_states(oauth_states)  # Persist state removal
    state_age = (datetime.now(timezone.utc) - state_timestamp).total_seconds()
    print(f"✅ State validated (age: {state_age:.1f}s)")
    
    code = request.args.get('code')
    if not code:
        return jsonify({'error': 'No authorization code received'}), 400
    
    # Exchange code for access token
    token_data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': OSM_REDIRECT_URI,
        'client_id': OSM_CLIENT_ID,
        'client_secret': OSM_CLIENT_SECRET
    }
    
    try:
        print(f"🔐 Attempting OAuth token exchange...")
        print(f"   Client ID: {OSM_CLIENT_ID[:20]}...")
        print(f"   Redirect URI: {OSM_REDIRECT_URI}")
        
        # Try sending credentials in POST body (not Basic Auth)
        token_response = requests.post(
            OSM_TOKEN_URL, 
            data=token_data
        )
        
        # Log the response for debugging
        print(f"   Response Status: {token_response.status_code}")
        
        if token_response.status_code != 200:
            error_detail = token_response.text
            print(f"❌ Token exchange failed: {error_detail}")
            try:
                error_json = token_response.json()
                error_msg = error_json.get('error_description', error_json.get('error', error_detail))
            except:
                error_msg = error_detail
            
            return jsonify({
                'error': 'OAuth authentication failed',
                'details': error_msg,
                'hint': 'Check that your OSM application is set as "Confidential" and redirect URI matches exactly'
            }), 400
        
        token_json = token_response.json()
        access_token = token_json.get('access_token')
        
        if not access_token:
            print(f"❌ No access token in response: {token_json}")
            return jsonify({'error': 'No access token received'}), 400
        
        print(f"✅ Token received successfully")
        
        # Fetch user details
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(f'{OSM_API_URL}/user/details.json', headers=headers)
        user_response.raise_for_status()
        user_data = user_response.json()
        
        # Store user info in session
        user_info = user_data.get('user', {})
        session['access_token'] = access_token
        session['user'] = {
            'id': user_info.get('id'),
            'display_name': user_info.get('display_name'),
            'account_created': user_info.get('account_created'),
            'changeset_count': user_info.get('changesets', {}).get('count', 0),
            'img_url': user_info.get('img', {}).get('href', '')
        }
        
        print(f"✅ Logged in as: {user_info.get('display_name')}")
        return redirect('/')
        
    except requests.exceptions.RequestException as e:
        print(f"❌ OAuth error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Response: {e.response.text}")
        return jsonify({'error': str(e), 'hint': 'Check server logs for details'}), 500
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/oauth/logout')
def oauth_logout():
    """Logout user"""
    session.clear()
    return redirect('/')

@app.route('/oauth/debug')
def oauth_debug():
    """Debug endpoint to check OAuth configuration"""
    return jsonify({
        'oauth_config': {
            'client_id_set': OSM_CLIENT_ID != 'YOUR_CLIENT_ID_HERE',
            'client_id_prefix': OSM_CLIENT_ID[:20] if OSM_CLIENT_ID != 'YOUR_CLIENT_ID_HERE' else 'NOT SET',
            'client_secret_set': OSM_CLIENT_SECRET != 'YOUR_CLIENT_SECRET_HERE',
            'redirect_uri': OSM_REDIRECT_URI,
            'oauth_url': OSM_OAUTH_URL,
            'token_url': OSM_TOKEN_URL
        },
        'server_state': {
            'active_oauth_states': len(oauth_states),
            'session_configured': app.config.get('SESSION_TYPE'),
            'secret_key_length': len(app.config.get('SECRET_KEY', '')),
            'secret_key_file_exists': os.path.exists(SECRET_KEY_FILE)
        },
        'current_session': {
            'has_user': 'user' in session,
            'has_access_token': 'access_token' in session,
            'session_keys': list(session.keys())
        },
        'instructions': {
            'step_1': 'Check that client_id_set and client_secret_set are both true',
            'step_2': f'Make sure you access the app at: {OSM_REDIRECT_URI.rsplit("/oauth/callback", 1)[0]}',
            'step_3': 'Check that your OSM application redirect URI matches exactly',
            'step_4': 'Try the login flow and check the Flask console for detailed logs'
        }
    })

@app.route('/api/user')
def get_current_user():
    """Get current logged-in user info"""
    if 'user' in session:
        return jsonify({
            'logged_in': True,
            'user': session['user']
        })
    return jsonify({'logged_in': False})

@app.route('/api/user/changesets')
def get_user_changesets():
    """Get changesets for the logged-in user"""
    if 'user' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    user_id = session['user']['id']
    region = request.args.get('region', CURRENT_REGION)
    
    # Validate region exists
    if region not in REGIONS:
        return jsonify({
            'success': False,
            'error': f'Region {region} not found'
        }), 404
    
    region_bbox = get_region_bbox(region)
    region_name = get_region_name(region)
    
    try:
        # Fetch changesets for this user in the selected region
        # Use a longer time range (365 days) for user's own edits
        url = "https://api.openstreetmap.org/api/0.6/changesets"
        
        end_time = datetime.now(timezone.utc)
        MY_EDITS_TIME_RANGE_DAYS = 365  # Show user's edits from last year
        start_time = end_time - timedelta(days=MY_EDITS_TIME_RANGE_DAYS)
        
        params = {
            'user': user_id,
            'bbox': region_bbox,
            'closed': 'true',
            'time': f"{start_time.isoformat()}Z,{end_time.isoformat()}Z"
        }
        
        headers = {'User-Agent': 'ATLAS-Singapore/1.0'}
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        
        root = ET.fromstring(response.content)
        changesets = []
        
        for changeset in root.findall('changeset'):
            cs_id = changeset.get('id')
            user = changeset.get('user', 'Anonymous')
            created_at = changeset.get('created_at', '')
            closed_at = changeset.get('closed_at', '')
            num_changes = changeset.get('num_changes', '0')
            min_lat = changeset.get('min_lat', '')
            max_lat = changeset.get('max_lat', '')
            min_lon = changeset.get('min_lon', '')
            max_lon = changeset.get('max_lon', '')
            
            tags = {}
            for tag in changeset.findall('tag'):
                tags[tag.get('k')] = tag.get('v')
            
            cs_data = {
                'id': cs_id,
                'user': user,
                'created_at': created_at,
                'closed_at': closed_at,
                'num_changes': int(num_changes),
                'comment': tags.get('comment', 'No comment'),
                'created_by': tags.get('created_by', 'Unknown'),
                'bbox': {
                    'min_lat': float(min_lat) if min_lat else None,
                    'max_lat': float(max_lat) if max_lat else None,
                    'min_lon': float(min_lon) if min_lon else None,
                    'max_lon': float(max_lon) if max_lon else None,
                } if min_lat and max_lat and min_lon and max_lon else None,
                'tags': tags
            }
            
            changesets.append(cs_data)
        
        # Filter to only include changesets that are primarily within the region
        changesets = [cs for cs in changesets if is_changeset_in_region(cs, region)]
        
        changesets.sort(key=lambda x: x['created_at'], reverse=True)
        
        print(f"📊 My Edits: Found {len(changesets)} changesets for user {session['user'].get('display_name', user_id)} in {region_name} (last 365 days)")
        
        return jsonify({
            'success': True,
            'count': len(changesets),
            'region': region,
            'regionName': region_name,
            'changesets': changesets,
            'time_range': '365 days'
        })
        
    except Exception as e:
        print(f"❌ Error fetching user changesets: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/changeset/<changeset_id>/comment', methods=['POST'])
def add_changeset_comment(changeset_id):
    """Add a comment to a changeset"""
    if 'user' not in session or 'access_token' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    try:
        data = request.get_json()
        comment_text = data.get('comment', '').strip()
        
        if not comment_text:
            return jsonify({'error': 'Comment text is required'}), 400
        
        # Post comment to OSM API
        access_token = session['access_token']
        comment_url = f'https://api.openstreetmap.org/api/0.6/changeset/{changeset_id}/comment'
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'User-Agent': 'ATLAS-Singapore/1.0'
        }
        
        comment_data = {'text': comment_text}
        
        response = requests.post(comment_url, data=comment_data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            print(f"✅ Comment added to changeset #{changeset_id}")
            return jsonify({
                'success': True,
                'message': 'Comment posted successfully'
            })
        else:
            print(f"❌ Failed to post comment: {response.status_code} - {response.text}")
            return jsonify({
                'error': f'Failed to post comment: {response.status_code}',
                'details': response.text
            }), response.status_code
            
    except Exception as e:
        print(f"❌ Error posting comment: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/profile/<username>')
def get_user_profile(username):
    """Get user profile information"""
    try:
        # First, we need to get the user ID by fetching a changeset from this user
        # We'll search for changesets by this user in Singapore to get their ID
        changesets_url = "https://api.openstreetmap.org/api/0.6/changesets"
        headers = {'User-Agent': 'ATLAS-Singapore/1.0'}
        
        # Get a recent changeset to find user ID
        params = {
            'display_name': username,
            'closed': 'true'
        }
        
        response = requests.get(changesets_url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parse to get user ID
        root = ET.fromstring(response.content)
        changesets = root.findall('changeset')
        
        if not changesets:
            return jsonify({'error': 'User not found'}), 404
        
        # Get user info from first changeset
        first_changeset = changesets[0]
        user_id = first_changeset.get('uid')
        display_name = first_changeset.get('user', username)
        
        # Now fetch user details using ID
        user_url = f"https://api.openstreetmap.org/api/0.6/user/{user_id}"
        user_response = requests.get(user_url, headers=headers, timeout=10)
        user_response.raise_for_status()
        
        # Parse user data
        user_root = ET.fromstring(user_response.content)
        user_elem = user_root.find('user')
        
        if user_elem is None:
            # If we can't get full details, return basic info
            user_data = {
                'id': user_id,
                'display_name': display_name,
                'account_created': first_changeset.get('created_at', ''),
                'description': '',
                'img_url': '',
                'changesets_count': len(changesets),
                'traces_count': 0
            }
        else:
            user_data = {
                'id': user_elem.get('id'),
                'display_name': user_elem.get('display_name'),
                'account_created': user_elem.get('account_created', ''),
                'description': user_elem.find('description').text if user_elem.find('description') is not None else '',
                'img_url': user_elem.find('.//img').get('href') if user_elem.find('.//img') is not None else '',
                'changesets_count': int(user_elem.find('changesets').get('count')) if user_elem.find('changesets') is not None else 0,
                'traces_count': int(user_elem.find('traces').get('count')) if user_elem.find('traces') is not None else 0
            }
        
        return jsonify({
            'success': True,
            'user': user_data
        })
        
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/profile/<username>/region-stats')
@app.route('/api/profile/<username>/singapore-stats')
def get_user_region_stats(username):
    """Get user's statistics for a specific region (defaults to current region)"""
    region = request.args.get('region', CURRENT_REGION)
    
    # Validate region exists
    if region not in REGIONS:
        return jsonify({
            'success': False,
            'error': f'Region {region} not found'
        }), 404
    
    region_bbox = get_region_bbox(region)
    region_name = get_region_name(region)
    
    try:
        headers = {'User-Agent': 'ATLAS-Singapore/1.0'}
        
        # First get user ID by searching for their changesets
        search_url = "https://api.openstreetmap.org/api/0.6/changesets"
        search_params = {
            'display_name': username,
            'closed': 'true'
        }
        
        search_response = requests.get(search_url, params=search_params, headers=headers, timeout=10)
        search_response.raise_for_status()
        
        search_root = ET.fromstring(search_response.content)
        search_changesets = search_root.findall('changeset')
        
        if not search_changesets:
            return jsonify({'error': 'User not found'}), 404
        
        # Get user ID from first changeset
        user_id = search_changesets[0].get('uid')
        
        # Fetch changesets for this user in the selected region
        changesets_url = "https://api.openstreetmap.org/api/0.6/changesets"
        
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(days=365)
        
        params = {
            'user': user_id,
            'bbox': region_bbox,
            'closed': 'true',
            'time': f"{start_time.isoformat()}Z,{end_time.isoformat()}Z"
        }
        
        response = requests.get(changesets_url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parse changesets
        root = ET.fromstring(response.content)
        changesets = []
        
        for changeset in root.findall('changeset'):
            cs_id = changeset.get('id')
            created_at = changeset.get('created_at', '')
            num_changes = int(changeset.get('num_changes', '0'))
            min_lat = changeset.get('min_lat', '')
            max_lat = changeset.get('max_lat', '')
            min_lon = changeset.get('min_lon', '')
            max_lon = changeset.get('max_lon', '')
            
            tags = {}
            for tag in changeset.findall('tag'):
                tags[tag.get('k')] = tag.get('v')
            
            cs_data = {
                'id': cs_id,
                'created_at': created_at,
                'num_changes': num_changes,
                'comment': tags.get('comment', 'No comment'),
                'created_by': tags.get('created_by', 'Unknown'),
                'bbox': {
                    'min_lat': float(min_lat) if min_lat else None,
                    'max_lat': float(max_lat) if max_lat else None,
                    'min_lon': float(min_lon) if min_lon else None,
                    'max_lon': float(max_lon) if max_lon else None,
                } if min_lat and max_lat and min_lon and max_lon else None,
                'tags': tags
            }
            
            changesets.append(cs_data)
        
        # Filter to only include changesets that are primarily within the region
        changesets = [cs for cs in changesets if is_changeset_in_region(cs, region)]
        
        # Fetch detailed statistics for changesets
        print(f"Fetching detailed statistics for {len(changesets)} changesets...")
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_cs = {executor.submit(fetch_changeset_details, cs['id']): cs for cs in changesets}
            
            for future in as_completed(future_to_cs):
                cs = future_to_cs[future]
                try:
                    details = future.result()
                    if details:
                        cs['details'] = details
                except Exception as e:
                    print(f"Error getting details for changeset {cs['id']}: {e}")
        
        # Validate changesets and add tags
        for cs in changesets:
            cs['validation'] = validate_changeset(cs)
            
            # Add "mass_deletion" tag for needs_review changesets with 50+ deletions
            if cs['validation'].get('status') == 'needs_review':
                details = cs.get('details', {})
                total_deleted = details.get('total_deleted', 0)
                
                if total_deleted >= 50:
                    # Ensure tags dictionary exists
                    if 'tags' not in cs:
                        cs['tags'] = {}
                    
                    # Add mass_deletion tag
                    cs['tags']['mass_deletion'] = 'yes'
                    cs['tags']['deleted_count'] = str(total_deleted)
                    print(f"🏷️ Added mass_deletion tag to changeset {cs.get('id')} ({total_deleted} deletions)")
        
        # Only notify for NEW needs_review changesets (not already in alerted set)
        # Skip notifications on initial load to avoid spamming existing changesets
        if len(alerted_changesets) > 0:
            new_count = 0
            for cs in changesets:
                cs_id = cs.get('id')
                # Only send notifications for needs_review changesets
                if cs_id and cs['validation'].get('status') == 'needs_review' and str(cs_id) not in alerted_changesets:
                    # This is a NEW needs_review changeset - send notification
                    send_slack_notification(cs)
                    new_count += 1
            
            if new_count > 0:
                print(f"📢 Sent notifications for {new_count} new needs_review changeset(s)")
        
        # Also log to Google Sheets if validation status is 'needs_review' and Google Sheets enabled
        for cs in changesets:
            if cs['validation'].get('status') == 'needs_review' and GOOGLE_SHEETS_ENABLED:
                # Transform changeset data to match expected format for logging
                details = cs.get('details', {})
                log_data = {
                    'id': cs['id'],
                    'user': cs['user'],
                    'created': details.get('total_created', 0),
                    'modified': details.get('total_modified', 0),
                    'deleted': details.get('total_deleted', 0),
                    'tags': cs.get('tags', {}),
                    'created_at': cs.get('created_at', 'Unknown')
                }
                
                # Get validation reasons as flags
                validation_flags = cs['validation'].get('reasons', [])
                
                # Log to Google Sheets
                log_changeset_needing_review(log_data, validation_flags, 'Auto-detected during user stats fetch')
        
        # Calculate statistics
        total_changesets = len(changesets)
        total_changes = sum(cs['num_changes'] for cs in changesets)
        
        # Detailed breakdown
        total_created = sum(cs.get('details', {}).get('total_created', 0) for cs in changesets)
        total_modified = sum(cs.get('details', {}).get('total_modified', 0) for cs in changesets)
        total_deleted = sum(cs.get('details', {}).get('total_deleted', 0) for cs in changesets)
        
        # Validation breakdown
        validation_counts = {
            'valid': sum(1 for cs in changesets if cs.get('validation', {}).get('status') == 'valid'),
            'needs_review': sum(1 for cs in changesets if cs.get('validation', {}).get('status') == 'needs_review')
        }
        
        # Editor breakdown
        editors = {}
        for cs in changesets:
            editor = cs.get('created_by', 'Unknown')
            editors[editor] = editors.get(editor, 0) + 1
        
        # Activity by month
        activity_by_month = {}
        for cs in changesets:
            try:
                date = date_parser.parse(cs['created_at'])
                month_key = date.strftime('%Y-%m')
                activity_by_month[month_key] = activity_by_month.get(month_key, 0) + 1
            except:
                pass
        
        # Recent changesets (last 10)
        recent_changesets = sorted(changesets, key=lambda x: x['created_at'], reverse=True)[:10]
        
        stats = {
            'total_changesets': total_changesets,
            'total_changes': total_changes,
            'breakdown': {
                'created': total_created,
                'modified': total_modified,
                'deleted': total_deleted
            },
            'validation': validation_counts,
            'editors': editors,
            'activity_by_month': activity_by_month,
            'recent_changesets': recent_changesets
        }
        
        return jsonify({
            'success': True,
            'region': region,
            'regionName': region_name,
            'stats': stats
        })
        
    except Exception as e:
        print(f"Error fetching user {region_name} stats: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================
# NOTES API ENDPOINTS
# ============================================

@app.route('/api/notes', methods=['GET'])
def get_notes():
    """Get notes for the current user only"""
    try:
        # Get current user
        current_user = session.get('user', {}).get('display_name', 'Anonymous') if 'user' in session else 'Anonymous'
        
        # Load all notes and filter by current user
        all_notes = load_notes()
        user_notes = [note for note in all_notes if note.get('created_by') == current_user]
        
        # Sort by creation date, newest first
        user_notes.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return jsonify({
            'success': True,
            'notes': user_notes
        })
    except Exception as e:
        print(f"Error getting notes: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/notes', methods=['POST'])
def create_note():
    """Create a new note"""
    try:
        data = request.get_json()
        
        note = {
                'id': str(uuid.uuid4()),
                'title': data.get('title', 'Untitled Note'),
                'content': data.get('content', ''),
                'images': data.get('images', []),
                'links': data.get('links', []),
                'tags': data.get('tags', []),  # User tags (@mentions)
                'color': data.get('color', '#ffffff'),  # Background color
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat(),
                'created_by': session.get('user', {}).get('display_name', 'Anonymous') if 'user' in session else 'Anonymous'
            }
        
        notes = load_notes()
        notes.append(note)
        
        if save_notes(notes):
            return jsonify({
                'success': True,
                'note': note
            })
        else:
            return jsonify({'error': 'Failed to save note'}), 500
            
    except Exception as e:
        print(f"Error creating note: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/notes/<note_id>', methods=['PUT'])
def update_note(note_id):
    """Update an existing note (only if owned by current user)"""
    try:
        # Get current user
        current_user = session.get('user', {}).get('display_name', 'Anonymous') if 'user' in session else 'Anonymous'
        
        data = request.get_json()
        notes = load_notes()
        
        note_index = next((i for i, note in enumerate(notes) if note['id'] == note_id), None)
        
        if note_index is None:
            return jsonify({'error': 'Note not found'}), 404
        
        # Check if current user owns this note
        if notes[note_index].get('created_by') != current_user:
            return jsonify({'error': 'Permission denied. You can only edit your own notes.'}), 403
        
            # Update note fields
            notes[note_index]['title'] = data.get('title', notes[note_index]['title'])
            notes[note_index]['content'] = data.get('content', notes[note_index]['content'])
            notes[note_index]['images'] = data.get('images', notes[note_index]['images'])
            notes[note_index]['links'] = data.get('links', notes[note_index]['links'])
            notes[note_index]['tags'] = data.get('tags', notes[note_index]['tags'])
            notes[note_index]['color'] = data.get('color', notes[note_index].get('color', '#ffffff'))
            notes[note_index]['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        if save_notes(notes):
            return jsonify({
                'success': True,
                'note': notes[note_index]
            })
        else:
            return jsonify({'error': 'Failed to update note'}), 500
            
    except Exception as e:
        print(f"Error updating note: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/notes/<note_id>', methods=['DELETE'])
def delete_note(note_id):
    """Delete a note (only if owned by current user)"""
    try:
        # Get current user
        current_user = session.get('user', {}).get('display_name', 'Anonymous') if 'user' in session else 'Anonymous'
        
        notes = load_notes()
        
        # Find the note to check ownership
        note_to_delete = next((note for note in notes if note['id'] == note_id), None)
        
        if note_to_delete is None:
            return jsonify({'error': 'Note not found'}), 404
        
        # Check if current user owns this note
        if note_to_delete.get('created_by') != current_user:
            return jsonify({'error': 'Permission denied. You can only delete your own notes.'}), 403
        
        # Delete the note
        notes = [note for note in notes if note['id'] != note_id]
        
        if save_notes(notes):
            return jsonify({
                'success': True,
                'message': 'Note deleted successfully'
            })
        else:
            return jsonify({'error': 'Failed to delete note'}), 500
            
    except Exception as e:
        print(f"Error deleting note: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    """Upload an image for notes"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            # Generate unique filename
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = f"{uuid.uuid4()}.{ext}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            file.save(filepath)
            
            # Return the URL path
            image_url = f"/uploads/{filename}"
            
            return jsonify({
                'success': True,
                'url': image_url,
                'filename': filename
            })
        else:
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, webp'}), 400
            
    except Exception as e:
        print(f"Error uploading image: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# ============================================
# TEAMS API ENDPOINTS
# ============================================

@app.route('/api/teams', methods=['GET'])
def get_teams():
    """Get teams that the current user is a member of"""
    try:
        current_user = session.get('user', {}).get('display_name', 'Anonymous') if 'user' in session else 'Anonymous'
        
        all_teams = load_teams()
        # Filter teams where current user is a member or creator
        user_teams = [team for team in all_teams if current_user in team.get('members', []) or team.get('created_by') == current_user]
        
        return jsonify({
            'success': True,
            'teams': user_teams
        })
    except Exception as e:
        print(f"Error getting teams: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/teams', methods=['POST'])
def create_team():
    """Create a new team"""
    try:
        if 'user' not in session:
            return jsonify({'error': 'Must be logged in to create a team'}), 401
        
        current_user = session['user']['display_name']
        data = request.get_json()
        
        team_name = data.get('name', '').strip()
        if not team_name:
            return jsonify({'error': 'Team name is required'}), 400
        
        team = {
            'id': str(uuid.uuid4()),
            'name': team_name,
            'description': data.get('description', ''),
            'created_by': current_user,
            'members': [current_user],  # Creator is automatically a member
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        teams = load_teams()
        teams.append(team)
        
        if save_teams(teams):
            return jsonify({
                'success': True,
                'team': team
            })
        else:
            return jsonify({'error': 'Failed to create team'}), 500
            
    except Exception as e:
        print(f"Error creating team: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/teams/<team_id>', methods=['PUT'])
def update_team(team_id):
    """Update team name and description"""
    try:
        if 'user' not in session:
            return jsonify({'error': 'Must be logged in'}), 401
        
        current_user = session['user']['display_name']
        data = request.get_json()
        
        teams = load_teams()
        team = next((t for t in teams if t['id'] == team_id), None)
        
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        
        # Only team creator can edit team details
        if team['created_by'] != current_user:
            return jsonify({'error': 'Only team creator can edit team details'}), 403
        
        # Update team name if provided
        if 'name' in data:
            team_name = data['name'].strip()
            if not team_name:
                return jsonify({'error': 'Team name cannot be empty'}), 400
            team['name'] = team_name
        
        # Update description if provided
        if 'description' in data:
            team['description'] = data['description'].strip()
        
        team['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        if save_teams(teams):
            return jsonify({
                'success': True,
                'team': team
            })
        else:
            return jsonify({'error': 'Failed to update team'}), 500
            
    except Exception as e:
        print(f"Error updating team: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/teams/<team_id>/members', methods=['POST'])
def add_team_member(team_id):
    """Add a member to a team"""
    try:
        if 'user' not in session:
            return jsonify({'error': 'Must be logged in'}), 401
        
        current_user = session['user']['display_name']
        data = request.get_json()
        username = data.get('username', '').strip()
        
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        
        teams = load_teams()
        team = next((t for t in teams if t['id'] == team_id), None)
        
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        
        # Only team creator can add members
        if team['created_by'] != current_user:
            return jsonify({'error': 'Only the team creator can add members'}), 403
        
        # Check if user is already a member
        if username in team['members']:
            return jsonify({'error': 'User is already a member'}), 400
        
        team['members'].append(username)
        
        if save_teams(teams):
            return jsonify({
                'success': True,
                'team': team
            })
        else:
            return jsonify({'error': 'Failed to add member'}), 500
            
    except Exception as e:
        print(f"Error adding team member: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/teams/<team_id>/members/<username>', methods=['DELETE'])
def remove_team_member(team_id, username):
    """Remove a member from a team"""
    try:
        if 'user' not in session:
            return jsonify({'error': 'Must be logged in'}), 401
        
        current_user = session['user']['display_name']
        teams = load_teams()
        team = next((t for t in teams if t['id'] == team_id), None)
        
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        
        # Only team creator can remove members (or users can remove themselves)
        if team['created_by'] != current_user and username != current_user:
            return jsonify({'error': 'Permission denied'}), 403
        
        if username not in team['members']:
            return jsonify({'error': 'User is not a member'}), 400
        
        team['members'].remove(username)
        
        if save_teams(teams):
            return jsonify({
                'success': True,
                'message': 'Member removed successfully'
            })
        else:
            return jsonify({'error': 'Failed to remove member'}), 500
            
    except Exception as e:
        print(f"Error removing team member: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/teams/<team_id>/messages', methods=['GET'])
def get_team_messages(team_id):
    """Get messages for a team"""
    try:
        if 'user' not in session:
            return jsonify({'error': 'Must be logged in'}), 401
        
        current_user = session['user']['display_name']
        
        # Check if user is a member of the team
        teams = load_teams()
        team = next((t for t in teams if t['id'] == team_id), None)
        
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        
        if current_user not in team['members'] and team['created_by'] != current_user:
            return jsonify({'error': 'You are not a member of this team'}), 403
        
        # Get messages for this team
        all_messages = load_team_messages()
        team_messages = [msg for msg in all_messages if msg['team_id'] == team_id]
        
        # Sort by creation date
        team_messages.sort(key=lambda x: x.get('created_at', ''))
        
        return jsonify({
            'success': True,
            'messages': team_messages
        })
    except Exception as e:
        print(f"Error getting team messages: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/teams/<team_id>/messages', methods=['POST'])
def send_team_message(team_id):
    """Send a message to a team"""
    try:
        if 'user' not in session:
            return jsonify({'error': 'Must be logged in'}), 401
        
        current_user = session['user']['display_name']
        data = request.get_json()
        
        # Check if user is a member of the team
        teams = load_teams()
        team = next((t for t in teams if t['id'] == team_id), None)
        
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        
        if current_user not in team['members'] and team['created_by'] != current_user:
            return jsonify({'error': 'You are not a member of this team'}), 403
        
        message_text = data.get('message', '').strip()
        if not message_text:
            return jsonify({'error': 'Message text is required'}), 400
        
        message = {
            'id': str(uuid.uuid4()),
            'team_id': team_id,
            'user': current_user,
            'message': message_text,
            'changeset_id': data.get('changeset_id'),  # Optional: link to a changeset
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        messages = load_team_messages()
        messages.append(message)
        
        if save_team_messages(messages):
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({'error': 'Failed to send message'}), 500
            
    except Exception as e:
        print(f"Error sending team message: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/teams/<team_id>/tasks', methods=['GET'])
def get_team_tasks(team_id):
    """Get all tasks for a specific team"""
    try:
        if 'user' not in session:
            return jsonify({'error': 'Must be logged in'}), 401
        
        current_user = session['user']['display_name']
        
        # Check if user is a member of the team
        teams = load_teams()
        team = next((t for t in teams if t['id'] == team_id), None)
        
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        
        if current_user not in team['members'] and team['created_by'] != current_user:
            return jsonify({'error': 'You are not a member of this team'}), 403
        
        # Load all tasks and filter by team_id
        all_tasks = load_team_tasks()
        team_tasks = [task for task in all_tasks if task.get('team_id') == team_id]
        
        # Sort by created_at (newest first)
        team_tasks.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return jsonify({
            'success': True,
            'tasks': team_tasks
        })
        
    except Exception as e:
        print(f"Error getting team tasks: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/teams/<team_id>/tasks', methods=['POST'])
def create_team_task(team_id):
    """Create a new task for a team"""
    try:
        if 'user' not in session:
            return jsonify({'error': 'Must be logged in'}), 401
        
        current_user = session['user']['display_name']
        data = request.get_json()
        
        # Check if user is a member of the team
        teams = load_teams()
        team = next((t for t in teams if t['id'] == team_id), None)
        
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        
        if current_user not in team['members'] and team['created_by'] != current_user:
            return jsonify({'error': 'You are not a member of this team'}), 403
        
        title = data.get('title', '').strip()
        if not title:
            return jsonify({'error': 'Task title is required'}), 400
        
        task_type = data.get('task_type', 'general')
        assignee = data.get('assignee', '')
        
        # Validate assignee is a team member
        if assignee and assignee not in team['members']:
            return jsonify({'error': 'Assignee must be a team member'}), 400
        
        task = {
            'id': str(uuid.uuid4()),
            'team_id': team_id,
            'title': title,
            'description': data.get('description', ''),
            'task_type': task_type,  # e.g., 'changeset', 'restriction', 'review', 'general'
            'assignee': assignee,
            'status': 'pending',  # 'pending', 'in_progress', 'completed'
            'priority': data.get('priority', 'medium'),  # 'low', 'medium', 'high'
            'due_date': data.get('due_date', ''),
            'changeset_id': data.get('changeset_id', ''),  # Optional: link to a changeset
            'location': data.get('location', ''),  # Optional: specific location/area
            'created_by': current_user,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        tasks = load_team_tasks()
        tasks.append(task)
        
        if save_team_tasks(tasks):
            return jsonify({
                'success': True,
                'task': task
            })
        else:
            return jsonify({'error': 'Failed to create task'}), 500
        
    except Exception as e:
        print(f"Error creating team task: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/teams/<team_id>/tasks/<task_id>', methods=['PUT'])
def update_team_task(team_id, task_id):
    """Update a task (status, assignee, etc.)"""
    try:
        if 'user' not in session:
            return jsonify({'error': 'Must be logged in'}), 401
        
        current_user = session['user']['display_name']
        data = request.get_json()
        
        # Check if user is a member of the team
        teams = load_teams()
        team = next((t for t in teams if t['id'] == team_id), None)
        
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        
        if current_user not in team['members'] and team['created_by'] != current_user:
            return jsonify({'error': 'You are not a member of this team'}), 403
        
        tasks = load_team_tasks()
        task_index = next((i for i, t in enumerate(tasks) if t['id'] == task_id and t['team_id'] == team_id), None)
        
        if task_index is None:
            return jsonify({'error': 'Task not found'}), 404
        
        # Update allowed fields
        if 'title' in data:
            tasks[task_index]['title'] = data['title']
        if 'description' in data:
            tasks[task_index]['description'] = data['description']
        if 'task_type' in data:
            tasks[task_index]['task_type'] = data['task_type']
        if 'assignee' in data:
            assignee = data['assignee']
            if assignee and assignee not in team['members']:
                return jsonify({'error': 'Assignee must be a team member'}), 400
            tasks[task_index]['assignee'] = assignee
        if 'status' in data:
            tasks[task_index]['status'] = data['status']
        if 'priority' in data:
            tasks[task_index]['priority'] = data['priority']
        if 'due_date' in data:
            tasks[task_index]['due_date'] = data['due_date']
        
        tasks[task_index]['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        if save_team_tasks(tasks):
            return jsonify({
                'success': True,
                'task': tasks[task_index]
            })
        else:
            return jsonify({'error': 'Failed to update task'}), 500
        
    except Exception as e:
        print(f"Error updating team task: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/teams/<team_id>/tasks/<task_id>', methods=['DELETE'])
def delete_team_task(team_id, task_id):
    """Delete a task (only by creator or team creator)"""
    try:
        if 'user' not in session:
            return jsonify({'error': 'Must be logged in'}), 401
        
        current_user = session['user']['display_name']
        
        # Check if user is a member of the team
        teams = load_teams()
        team = next((t for t in teams if t['id'] == team_id), None)
        
        if not team:
            return jsonify({'error': 'Team not found'}), 404
        
        if current_user not in team['members'] and team['created_by'] != current_user:
            return jsonify({'error': 'You are not a member of this team'}), 403
        
        tasks = load_team_tasks()
        task = next((t for t in tasks if t['id'] == task_id and t['team_id'] == team_id), None)
        
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        # Only task creator or team creator can delete
        if task['created_by'] != current_user and team['created_by'] != current_user:
            return jsonify({'error': 'Only task creator or team creator can delete tasks'}), 403
        
        tasks = [t for t in tasks if not (t['id'] == task_id and t['team_id'] == team_id)]
        
        if save_team_tasks(tasks):
            return jsonify({
                'success': True,
                'message': 'Task deleted successfully'
            })
        else:
            return jsonify({'error': 'Failed to delete task'}), 500
        
    except Exception as e:
        print(f"Error deleting team task: {e}")
        return jsonify({'error': str(e)}), 500


# ===== ATLAS AI API =====

def extract_changeset_id(message):
    """Extract changeset ID from user message"""
    import re
    # Look for patterns like "changeset 12345", "#12345", "id 12345", or just "12345"
    patterns = [
        r'changeset[:\s]+(\d+)',
        r'#(\d+)',
        r'id[:\s]+(\d+)',
        r'\b(\d{6,9})\b'  # 6-9 digit numbers (typical changeset IDs)
    ]
    
    for pattern in patterns:
        match = re.search(pattern, message.lower())
        if match:
            return match.group(1)
    return None


@lru_cache(maxsize=500)
def fetch_changeset_data(changeset_id):
    """Fetch changeset data from OSM API
    CACHED: Uses LRU cache to avoid redundant API calls"""
    try:
        # Fetch changeset metadata
        changeset_url = f'https://api.openstreetmap.org/api/0.6/changeset/{changeset_id}'
        response = requests.get(changeset_url, timeout=10)
        
        if response.status_code != 200:
            return None
        
        root = ET.fromstring(response.content)
        changeset = root.find('changeset')
        
        if changeset is None:
            return None
        
        # Extract changeset information
        data = {
            'id': changeset_id,
            'user': changeset.get('user', 'Unknown'),
            'uid': changeset.get('uid', ''),
            'created_at': changeset.get('created_at', ''),
            'closed_at': changeset.get('closed_at', ''),
            'open': changeset.get('open', 'false') == 'true',
            'min_lat': changeset.get('min_lat'),
            'max_lat': changeset.get('max_lat'),
            'min_lon': changeset.get('min_lon'),
            'max_lon': changeset.get('max_lon'),
            'changes_count': changeset.get('changes_count', '0'),
            'comments_count': changeset.get('comments_count', '0'),
            'tags': {}
        }
        
        # Extract tags
        for tag in changeset.findall('tag'):
            key = tag.get('k', '')
            value = tag.get('v', '')
            data['tags'][key] = value
        
        # Fetch download data to get actual changes
        try:
            download_url = f'https://api.openstreetmap.org/api/0.6/changeset/{changeset_id}/download'
            download_response = requests.get(download_url, timeout=10)
            
            if download_response.status_code == 200:
                download_root = ET.fromstring(download_response.content)
                
                # Count different types of changes
                # Look for elements inside create/modify/delete parent tags
                created = len(download_root.findall('.//create/*'))
                modified = len(download_root.findall('.//modify/*'))
                deleted = len(download_root.findall('.//delete/*'))
                
                data['created'] = created
                data['modified'] = modified
                data['deleted'] = deleted
                
                print(f"Changeset {changeset_id}: created={created}, modified={modified}, deleted={deleted}")
            else:
                print(f"Download endpoint returned status {download_response.status_code} for changeset {changeset_id}")
                data['created'] = 0
                data['modified'] = 0
                data['deleted'] = 0
        except Exception as e:
            print(f"Error fetching download data for changeset {changeset_id}: {e}")
            data['created'] = 0
            data['modified'] = 0
            data['deleted'] = 0
        
        return data
        
    except Exception as e:
        print(f"Error fetching changeset {changeset_id}: {e}")
        return None


def generate_comparison_response(changeset_id):
    """Generate a comparison view for a changeset"""
    try:
        # Fetch comparison data from the existing endpoint logic
        url = f"https://api.openstreetmap.org/api/0.6/changeset/{changeset_id}/download"
        response = requests.get(url, timeout=30)
        
        if response.status_code != 200:
            return f"❌ Couldn't fetch changeset #{changeset_id}. It might not exist or be inaccessible."
        
        root = ET.fromstring(response.content)
        
        # Count elements
        created_count = len(root.findall('.//create/*'))
        modified_count = len(root.findall('.//modify/*'))
        deleted_count = len(root.findall('.//delete/*'))
        total = created_count + modified_count + deleted_count
        
        if total == 0:
            return f"""## Changeset Comparison: #{changeset_id}

This changeset is **empty** - no changes were made.

Try analyzing a changeset with actual changes instead!"""
        
        # Get changeset bounds for map
        changeset_url = f'https://api.openstreetmap.org/api/0.6/changeset/{changeset_id}'
        changeset_response = requests.get(changeset_url, timeout=10)
        bounds = None
        if changeset_response.status_code == 200:
            changeset_root = ET.fromstring(changeset_response.content)
            changeset_elem = changeset_root.find('changeset')
            if changeset_elem is not None:
                min_lat = changeset_elem.get('min_lat')
                max_lat = changeset_elem.get('max_lat')
                min_lon = changeset_elem.get('min_lon')
                max_lon = changeset_elem.get('max_lon')
                if all([min_lat, max_lat, min_lon, max_lon]):
                    bounds = {
                        'minLat': float(min_lat),
                        'maxLat': float(max_lat),
                        'minLon': float(min_lon),
                        'maxLon': float(max_lon)
                    }
        
        # Build response with comparison data
        response_text = f"""## 📊 Changeset Comparison: #{changeset_id}

<div class="atlas-map-comparison" data-changeset-id="{changeset_id}" data-bounds='{json.dumps(bounds) if bounds else "null"}' style="display:none;"></div>

I'll show you the **side-by-side before and after** changes with interactive maps:

### 📈 **Summary**
- 🟢 **Created**: {created_count} elements
- 🟡 **Modified**: {modified_count} elements (with tag differences below)
- 🔴 **Deleted**: {deleted_count} elements
- **Total Changes**: {total}

---

"""
        
        # Show created elements (sample)
        if created_count > 0:
            response_text += "### 🟢 **Created Elements**\n\n"
            create_elem = root.find('create')
            if create_elem is not None:
                shown = 0
                for elem in create_elem:
                    if shown >= 5:  # Limit to first 5
                        response_text += f"\n*...and {created_count - shown} more created elements*\n"
                        break
                    
                    elem_type = elem.tag
                    elem_id = elem.get('id', 'unknown')
                    tags = {}
                    for tag in elem.findall('tag'):
                        tags[tag.get('k', '')] = tag.get('v', '')
                    
                    name = tags.get('name', 'Unnamed')
                    elem_tags = ', '.join([f"`{k}={v}`" for k, v in list(tags.items())[:3]])
                    
                    response_text += f"- **{elem_type.capitalize()} #{elem_id}**: {name}\n"
                    if elem_tags:
                        response_text += f"  - Tags: {elem_tags}\n"
                    shown += 1
                response_text += "\n"
        
        # Show modified elements with before/after tags
        if modified_count > 0:
            response_text += "### 🟡 **Modified Elements**\n\n"
            modify_elem = root.find('modify')
            if modify_elem is not None:
                shown = 0
                for elem in modify_elem:
                    if shown >= 3:  # Limit to first 3 for detailed view
                        response_text += f"\n*...and {modified_count - shown} more modified elements*\n"
                        break
                    
                    elem_type = elem.tag
                    elem_id = elem.get('id', 'unknown')
                    version = elem.get('version', '?')
                    prev_version = int(version) - 1 if version.isdigit() else None
                    
                    # Get current (new) tags
                    new_tags = {}
                    for tag in elem.findall('tag'):
                        new_tags[tag.get('k', '')] = tag.get('v', '')
                    
                    name = new_tags.get('name', f'{elem_type} #{elem_id}')
                    
                    response_text += f"#### **{elem_type.capitalize()} #{elem_id}**: {name}\n\n"
                    
                    # Try to fetch previous version for comparison
                    if prev_version:
                        try:
                            prev_url = f"https://api.openstreetmap.org/api/0.6/{elem_type}/{elem_id}/{prev_version}"
                            prev_response = requests.get(prev_url, timeout=5)
                            if prev_response.status_code == 200:
                                prev_root = ET.fromstring(prev_response.content)
                                prev_elem = prev_root.find(f'.//{elem_type}')
                                if prev_elem is not None:
                                    old_tags = {}
                                    for tag in prev_elem.findall('tag'):
                                        old_tags[tag.get('k', '')] = tag.get('v', '')
                                    
                                    # Compare tags
                                    all_keys = set(old_tags.keys()) | set(new_tags.keys())
                                    
                                    if all_keys:
                                        response_text += "<table class='atlas-comparison-table'>\n"
                                        response_text += "<thead><tr><th>Tag</th><th>Before</th><th>After</th></tr></thead>\n"
                                        response_text += "<tbody>\n"
                                        
                                        for key in sorted(all_keys):
                                            old_val = old_tags.get(key, '')
                                            new_val = new_tags.get(key, '')
                                            
                                            if old_val != new_val:
                                                if not old_val:
                                                    # Added tag
                                                    response_text += f"<tr class='atlas-added'><td><code>{key}</code></td><td><em>none</em></td><td><code>{new_val}</code></td></tr>\n"
                                                elif not new_val:
                                                    # Removed tag
                                                    response_text += f"<tr class='atlas-removed'><td><code>{key}</code></td><td><code>{old_val}</code></td><td><em>removed</em></td></tr>\n"
                                                else:
                                                    # Modified tag
                                                    response_text += f"<tr class='atlas-modified'><td><code>{key}</code></td><td><code>{old_val}</code></td><td><code>{new_val}</code></td></tr>\n"
                                        
                                        response_text += "</tbody></table>\n\n"
                                    else:
                                        response_text += "*No tag changes detected*\n\n"
                        except:
                            response_text += f"*Version {prev_version} → {version} (old tags unavailable)*\n\n"
                    else:
                        # Just show current tags
                        tag_list = ', '.join([f"`{k}={v}`" for k, v in list(new_tags.items())[:5]])
                        response_text += f"**Current tags**: {tag_list}\n\n"
                    
                    shown += 1
                
                # Add legend after first table
                if shown == 1:
                    response_text += """
<div style="display: flex; gap: 16px; font-size: 0.8rem; margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 6px;">
  <span style="color: #22c55e;">● Added tags</span>
  <span style="color: #f97316;">● Modified tags</span>
  <span style="color: #ef4444;">● Removed tags</span>
</div>

"""
                response_text += "\n"
        
        # Show deleted elements (sample)
        if deleted_count > 0:
            response_text += "### 🔴 **Deleted Elements**\n\n"
            delete_elem = root.find('delete')
            if delete_elem is not None:
                shown = 0
                for elem in delete_elem:
                    if shown >= 5:  # Limit to first 5
                        response_text += f"\n*...and {deleted_count - shown} more deleted elements*\n"
                        break
                    
                    elem_type = elem.tag
                    elem_id = elem.get('id', 'unknown')
                    tags = {}
                    for tag in elem.findall('tag'):
                        tags[tag.get('k', '')] = tag.get('v', '')
                    
                    name = tags.get('name', 'Unnamed')
                    elem_tags = ', '.join([f"`{k}={v}`" for k, v in list(tags.items())[:3]])
                    
                    response_text += f"- **{elem_type.capitalize()} #{elem_id}**: {name}\n"
                    if elem_tags:
                        response_text += f"  - Had tags: {elem_tags}\n"
                    shown += 1
                response_text += "\n"
        
        # Add links for full comparison
        response_text += """---

### 🗺️ **View on Interactive Map**

Want to see these changes **visualized on a map**?

1. Go to the **List View** tab in the dashboard
2. Find changeset #{} in the list
3. Click the **"Compare"** button

You'll see:
- Before/After map views side-by-side
- Element locations and geometries
- Visual validation of changes
- Full element details

**External Tools:**
- [OpenStreetMap](https://www.openstreetmap.org/changeset/{})
- [OSMCha](https://osmcha.org/changesets/{}) (Validation analysis)
- [Achavi Diff](https://overpass-api.de/achavi/?changeset={}) (Visual diff)

💡 *You're already seeing the tag comparison above! The dashboard comparison adds map visualization.*
""".format(changeset_id, changeset_id, changeset_id, changeset_id)
        
        return response_text
        
    except Exception as e:
        print(f"Error generating comparison for {changeset_id}: {e}")
        return f"""❌ Sorry, I encountered an error while fetching the comparison data for changeset #{changeset_id}.

**Possible reasons:**
- The changeset might be very large
- Network timeout
- Invalid changeset ID

Try analyzing it instead with: "analyze changeset {changeset_id}" """


def analyze_changeset(data):
    """Analyze changeset data and generate insights"""
    if not data:
        return "I couldn't fetch the changeset data. Please check the ID and try again."
    
    changeset_id = data['id']
    user = data['user']
    created = data.get('created', 0)
    modified = data.get('modified', 0)
    deleted = data.get('deleted', 0)
    total_changes = created + modified + deleted
    
    # Check if this is an empty changeset
    is_empty = total_changes == 0 and data.get('changes_count', '0') == '0'
    comment = data['tags'].get('comment', 'No comment provided')
    source = data['tags'].get('source', 'Not specified')
    created_by = data['tags'].get('created_by', 'Unknown editor')
    
    # Calculate date info
    try:
        created_at = date_parser.parse(data['created_at'])
        created_date = created_at.strftime('%B %d, %Y at %H:%M UTC')
    except:
        created_date = 'Unknown'
    
    # Analysis insights
    insights = []
    flags = []
    
    # Only check for issues if changeset has actual changes
    if not is_empty:
        # Check for suspicious patterns
        if deleted > created + modified and deleted > 10:
            flags.append("⚠️ **High deletion rate** - This changeset has more deletions than additions/modifications")
        
        if total_changes > 500:
            flags.append("📊 **Large changeset** - Contains a high number of changes")
        
        if not comment or comment == 'No comment provided':
            flags.append("💬 **Missing comment** - No changeset comment explaining the changes")
        
        if source == 'Not specified':
            flags.append("📍 **Missing source** - No source tag specified")
    
    # Positive indicators
    if comment and comment != 'No comment provided':
        insights.append(f"✅ **Good documentation** - Changeset comment: \"{comment}\"")
    
    if source != 'Not specified':
        insights.append(f"✅ **Source provided** - {source}")
    
    # Build the response
    response = f"""## Changeset Analysis: #{changeset_id}

### 📋 **Overview**
- **Mapper**: {user}
- **Date**: {created_date}
- **Editor**: {created_by}
- **Total Changes**: {total_changes}

### 📊 **Change Breakdown**
- 🟢 **Created**: {created} elements
- 🟡 **Modified**: {modified} elements
- 🔴 **Deleted**: {deleted} elements

"""
    
    # Special message for empty changesets
    if is_empty:
        response += """### 🔍 **Empty Changeset**

This changeset appears to be **empty** - it was opened but no changes were uploaded to it.

**Common reasons for empty changesets:**
- The mapper opened a changeset but didn't save any edits
- The upload was cancelled or failed
- The changeset was created for testing purposes
- Network issues interrupted the upload

**This is normal and not a cause for concern.** Empty changesets are automatically closed after 24 hours of inactivity.

"""
    
    if insights:
        response += "### ✅ **Positive Indicators**\n"
        for insight in insights:
            response += f"{insight}\n"
        response += "\n"
    
    if flags:
        response += "### ⚠️ **Potential Issues**\n"
        for flag in flags:
            response += f"{flag}\n"
        response += "\n"
    
    # Recommendations
    if not is_empty:
        response += """### 💡 **Recommendations**

"""
        
        if flags:
            response += "- Review the deleted elements to ensure they weren't removed by mistake\n"
            response += "- Check if the changes are appropriate for the area\n"
            response += "- Consider reaching out to the mapper if issues are found\n"
        else:
            response += "- This changeset appears to follow OSM guidelines\n"
            response += "- No immediate red flags detected\n"
    
    response += f"\n🔗 [View on OSM](https://www.openstreetmap.org/changeset/{changeset_id}) | "
    response += f"[View on OSMCha](https://osmcha.org/changesets/{changeset_id})"
    
    # ✅ Log to Google Sheets if suspicious
    if flags:  # If there are any warning flags
        log_changeset_needing_review(data, flags, response)
    
    return response


@app.route('/api/atlas-ai/chat', methods=['POST'])
def atlas_ai_chat():
    """Handle Atlas AI chat requests"""
    try:
        # Check if request contains image (FormData) or just text (JSON)
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Image upload request
            message = request.form.get('message', '')
            context = json.loads(request.form.get('context', '{}'))
            image = request.files.get('image')
            
            if not image:
                return jsonify({'error': 'Image is required'}), 400
            
            # Save image temporarily
            filename = secure_filename(f"{uuid.uuid4().hex}_{image.filename}")
            filepath = os.path.join('static', 'uploads', filename)
            image.save(filepath)
            
            # Analyze image
            response = analyze_image_with_ai(filepath, message, context)
            
            # Optionally delete the image after analysis
            # os.remove(filepath)
            
        else:
            # Text-only request
            data = request.get_json()
            message = data.get('message', '')
            context = data.get('context', {})
            
            if not message:
                return jsonify({'error': 'Message is required'}), 400
            
            # Generate response based on message content
            response = generate_atlas_response(message, context)
        
        return jsonify({'response': response})
        
    except Exception as e:
        print(f"Error in Atlas AI chat: {e}")
        return jsonify({'error': 'Failed to process your request'}), 500


def analyze_image_with_ai(image_path, message, context):
    """Handle image uploads - Groq doesn't support vision, provide helpful response"""
    
    # Get the filename for reference
    filename = os.path.basename(image_path) if image_path else "uploaded image"
    
    return f"""## 📸 Image Received!

I've received your image: **{filename}**

Your message: "{message or 'No message provided'}"

---

### ℹ️ About Image Analysis

Currently, Atlas AI uses **Groq** which provides lightning-fast text responses but doesn't support image analysis yet.

### 🛠️ What I Can Help With Instead:

**Without seeing the image, I can still assist if you describe what you're looking at:**

1. **Describe the issue** - Tell me what you see in the changeset or map
2. **Share changeset ID** - I can analyze changeset data directly: "Analyze changeset 12345678"
3. **Ask about tagging** - "How should I tag a building with shops on ground floor?"
4. **Validation questions** - "What does 'Needs Review' mean?"

### 💡 Pro Tip

For visual changeset comparison, use the **Compare** button in the dashboard - it shows before/after maps with color-coded changes!

---

**How can I help you with your mapping question?**"""


def generate_groq_text_response(message, context):
    """Generate AI response using Groq for text-only queries"""
    from groq import Groq
    
    # Check if API key is configured
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        return f"""Thanks for your message! I'm here to help with OpenStreetMap and this dashboard.

You asked: "{message}"

**Note:** For AI-powered responses, configure the `GROQ_API_KEY` environment variable.
Get your free API key at: https://console.groq.com

I can still assist you with:
• **Changeset analysis**: "Analyze changeset 12345678"
• **Compare changes**: "Compare changeset 12345678"
• **OSM tagging** guidelines
• **Dashboard features** and navigation

What specific aspect would you like to know more about?"""
    
    try:
        # Initialize Groq client
        client = Groq(api_key=api_key)
        
        # System prompt for Atlas AI
        system_prompt = """You are Atlas, an AI assistant for OpenStreetMap (OSM) integrated into the ATLAS Dashboard - a Singapore OpenStreetMap monitoring tool.

About Atlas:
- Atlas was created by Ikmal
- When asked "who made Atlas" or "who created Atlas", respond that it was made by Ikmal

Your expertise includes:
- OpenStreetMap tagging conventions and best practices
- Changeset analysis and quality control
- Singapore-specific mapping knowledge
- Geographic data and GIS concepts
- OSM editor tools (iD, JOSM, etc.)
- Community guidelines and contribution standards

Response guidelines:
- Be concise but helpful
- Use markdown formatting
- Provide actionable advice
- Reference OSM Wiki when appropriate
- For Singapore-specific questions, consider local context

Dashboard features you can help explain:
- Real-time changeset monitoring for Singapore
- Validation status (Valid, Needs Review)
- Map visualization with clustering
- Changeset comparison tool
- My Edits section for personal contributions
- Team collaboration features"""

        # Add context about the user if available
        user_context = ""
        if context:
            if context.get('username'):
                user_context += f"\nUser: {context.get('username')}"
            if context.get('changeset_id'):
                user_context += f"\nCurrent changeset: {context.get('changeset_id')}"
        
        full_system_prompt = f"{system_prompt}{user_context}"
        
        # Generate response using Groq
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": full_system_prompt},
                {"role": "user", "content": message}
            ],
            model="llama-3.1-8b-instant",  # Fast and capable model
            temperature=0.7,
            max_tokens=1024,
        )
        
        response_text = chat_completion.choices[0].message.content
        
        if not response_text:
            return "I couldn't generate a response. Please try rephrasing your question."
        
        return response_text
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Groq API Error: {error_msg}")
        app.logger.error(f"Groq text response error: {error_msg}")
        
        # Check for common error types and provide helpful messages
        if "invalid_api_key" in error_msg.lower() or "authentication" in error_msg.lower():
            return f"""## ⚠️ Groq API Key Error

Your Groq API key appears to be invalid or expired.

**To fix this:**
1. Go to https://console.groq.com
2. Generate a new API key
3. Update `GROQ_API_KEY` in `run.ps1`
4. Restart the server

Error: {error_msg}"""
        
        return f"""Thanks for your message! I encountered an issue generating an AI response.

You asked: "{message}"

**Error:** {error_msg}

I can still help with:
• **Changeset analysis**: "Analyze changeset 12345678"
• **Compare changes**: "Compare changeset 12345678"  
• **Tagging guidelines**: "How to tag roads"
• **Validation help**: "What is validation"

Please try one of these specific commands or rephrase your question."""


def generate_atlas_response(message, context):
    """Generate AI response (placeholder - integrate with actual AI service)"""
    message_lower = message.lower()
    
    # Check if message contains a changeset ID
    changeset_id = extract_changeset_id(message)
    
    # Check for comparison request
    if changeset_id and any(word in message_lower for word in ['compare', 'comparison', 'before', 'after', 'diff', 'difference', 'changes']):
        return generate_comparison_response(changeset_id)
    
    # Check for analysis request
    if changeset_id and any(word in message_lower for word in ['analyze', 'check', 'review', 'look', 'what', 'tell', 'show']):
        # Fetch and analyze the changeset
        changeset_data = fetch_changeset_data(changeset_id)
        return analyze_changeset(changeset_data)
    
    # OSM Guidelines and Help
    if any(word in message_lower for word in ['tag', 'tagging', 'how to tag']):
        return """For OSM tagging guidelines:

• **Roads**: Use `highway=*` with values like primary, secondary, residential
• **Buildings**: Use `building=yes` or specific types like `building=commercial`
• **Names**: Always add `name=*` tag with the proper name
• **Source**: Include `source=*` to document where the data came from

Check the OSM Wiki for detailed tagging schemas: https://wiki.openstreetmap.org/wiki/Map_Features"""
    
    # Changeset Analysis
    elif any(word in message_lower for word in ['analyze', 'changeset', 'suspicious']):
        return """I can help you analyze changesets in detail! 🔍

**To analyze a specific changeset**, just tell me:
- "Analyze changeset 12345678"
- "Check changeset #12345678"
- "Review 12345678"

I'll fetch the data from OSM and provide you with:
- 📋 Complete overview (mapper, date, editor, total changes)
- 📊 Detailed breakdown (created, modified, deleted elements)
- ✅ Positive indicators (good practices)
- ⚠️ Potential issues (red flags)
- 💡 Recommendations for action

**General tips for manual analysis:**
1. Check the comparison tool in the dashboard
2. Look for red flags (mass deletions, missing comments)
3. Review the user's edit history
4. Use OSMCha for detailed validation

Just give me a changeset ID and I'll do the heavy lifting! 🚀"""
    
    # Validation Issues
    elif 'validation' in message_lower or 'review' in message_lower:
        return """Changeset validation in ATLAS:

🟢 **Valid** - No issues detected

🔍 **Needs Review** - Triggered by:
   - Mass deletions (50+ deletions)
   - Requires manual review to ensure changes are appropriate

Ask me to analyze a specific changeset for details!"""
    
    # Dashboard Features
    elif any(word in message_lower for word in ['comparison', 'compare', 'tool']):
        return """The **Comparison Tool** lets you visualize changes:

✨ **Features**:
• Side-by-side maps showing before/after
• Color-coded changes (🟢 Created, 🟡 Modified, 🔴 Deleted)
• Detailed tag differences
• Timeline of changes
• Export capability

**How to use**: 
1. **In Dashboard**: Click the "Compare" button on any changeset
2. **With Atlas AI**: Just ask me! For example:
   - "Compare changeset 172640112"
   - "Show me the changes in #172640112"
   - "What's the diff for changeset 172640112"

I'll fetch the before/after data and summarize the key changes for you! 🚀"""
    
    # Teams and Collaboration
    elif 'team' in message_lower or 'collaborate' in message_lower:
        return """**Teams** help you collaborate with other mappers:

• Create teams for specific mapping projects
• Share tasks and assign them to team members
• Chat with your team in real-time
• Track progress on mapping tasks

To create a team, click the + button in the Teams section of the sidebar!"""
    
    # My Edits
    elif 'my edits' in message_lower or 'my changesets' in message_lower:
        username = context.get('username')
        if username:
            return f"""Your editing activity, **{username}**:

The **My Edits** section shows:
• All your changesets in Singapore
• Detailed breakdown of created/modified/deleted elements
• Map visualization of your contributions
• Quick access to comparison and analysis tools

Keep up the great mapping work! 🗺️"""
        else:
            return """The **My Edits** section shows your personal contributions:

• Your changesets in Singapore
• Created, modified, and deleted elements
• Geographic visualization
• Quick access to tools

Log in with your OSM account to see your edits!"""
    
    # General Help - Only match specific help requests
    elif any(phrase in message_lower for phrase in ['what can you do', 'what can you help', 'help me', 'how do you work', 'guide me']):
        return """I'm **Atlas**, your AI assistant for OpenStreetMap! I can help with:

🗺️ **Mapping Guidance**
• Tagging best practices
• OSM guidelines and documentation
• Quality control tips

🔍 **Analysis Tools**
• **Analyze changesets**: "analyze changeset 12345678"
• **Compare before/after**: "compare changeset 12345678"
• Validation issue explanation
• User contribution review

👥 **Collaboration**
• Team management
• Task assignment
• Project coordination

📊 **Dashboard Navigation**
• Feature explanations
• Tips and shortcuts

**Try asking me:**
- "Compare changeset [ID]" - See before/after changes
- "Analyze changeset [ID]" - Get detailed analysis
- "What are validation issues?" - Learn about OSM validation

What would you like to know more about?"""
    
    # Default response - Use Groq AI for general questions
    else:
        return generate_groq_text_response(message, context)


# Health check endpoint for uptime monitoring
@app.route('/api/health')
def health_check():
    """Health check endpoint for monitoring services"""
    return jsonify({
        'status': 'healthy',
        'service': 'ATLAS Dashboard',
        'timestamp': datetime.now(timezone.utc).isoformat()
    })

# Initialize JSON files with defaults if they don't exist
def initialize_data_files():
    """Ensure JSON data files exist with default values"""
    # Notes file
    if not os.path.exists(NOTES_FILE):
        with open(NOTES_FILE, 'w') as f:
            json.dump({}, f)
        print(f"📝 Created {NOTES_FILE}")
    
    # Teams file
    if not os.path.exists(TEAMS_FILE):
        with open(TEAMS_FILE, 'w') as f:
            json.dump([], f)
        print(f"👥 Created {TEAMS_FILE}")
    
    # Team messages file
    if not os.path.exists(TEAM_MESSAGES_FILE):
        with open(TEAM_MESSAGES_FILE, 'w') as f:
            json.dump({}, f)
        print(f"💬 Created {TEAM_MESSAGES_FILE}")
    
    # Team tasks file
    if not os.path.exists(TEAM_TASKS_FILE):
        with open(TEAM_TASKS_FILE, 'w') as f:
            json.dump({}, f)
        print(f"✅ Created {TEAM_TASKS_FILE}")

# Initialize data files on startup
initialize_data_files()

if __name__ == '__main__':
    # Get port from environment variable (Render/Railway set this automatically)
    port = int(os.environ.get('PORT', 5000))
    
    # Check if running in production (Render or Railway)
    is_production = (os.environ.get('RENDER') is not None or 
                     os.environ.get('RAILWAY_ENVIRONMENT') is not None)
    
    if is_production:
        print("🚀 Starting ATLAS - Singapore OpenStreetMap Monitor (Production)")
        print(f"   Running on port {port}")
        print(f"   Session Cookie Secure: {os.environ.get('SESSION_COOKIE_SECURE', 'False')}")
    else:
        print("🔧 Starting ATLAS - Singapore OpenStreetMap Monitor (Development)")
        print("   Navigate to http://localhost:5000")
    
    app.run(debug=not is_production, host='0.0.0.0', port=port)
