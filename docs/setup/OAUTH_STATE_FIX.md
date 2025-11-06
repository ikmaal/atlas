# OAuth "Invalid State Parameter" Fix

## Problem
You were getting this error when trying to log in with OSM:
```json
{
  "error": "Invalid state parameter",
  "debug": {
    "stored_state_prefix": "None",
    "session_id": "No session ID"
  }
}
```

## Root Cause
The OAuth state parameter was being stored in **session cookies**, which weren't persisting during the OAuth redirect flow. This is a common issue with OAuth implementations.

## Solution Applied ✅

### 1. **Server-Side State Storage**
- Changed from session cookie storage to **server-side memory storage**
- States now stored in a Python dictionary with timestamps
- Automatic cleanup of expired states (10-minute timeout)
- No longer depends on session cookies working correctly

### 2. **Persistent SECRET_KEY**
- SECRET_KEY now saved to `.secret_key` file
- Survives server restarts
- Sessions remain valid across restarts

### 3. **Fixed URL Mismatch**
- Changed default from `http://127.0.0.1:5000` to `http://localhost:5000`
- Ensures consistency with OSM OAuth app registration

## How to Test

### Step 1: Restart Your Server
```powershell
# Stop the current server (Ctrl+C)
# Then restart:
py app.py
```

### Step 2: Check Startup Messages
You should see:
```
🔑 Loaded SECRET_KEY from file
🔧 OAuth Configuration:
   Client ID: [your client ID]...
   Client Secret: ✓ Set
   Redirect URI: http://localhost:5000/oauth/callback

⚠️  IMPORTANT: Access your app at http://localhost:5000
   (Don't use 127.0.0.1 if your redirect URI uses localhost, or vice versa)
```

### Step 3: Access the App Correctly
⚠️ **CRITICAL**: Use the same URL format as your redirect URI!

- If your OSM app uses `http://localhost:5000/oauth/callback`, access at: **http://localhost:5000**
- If your OSM app uses `http://127.0.0.1:5000/oauth/callback`, access at: **http://127.0.0.1:5000**

### Step 4: Try Logging In
1. Click **"Login with OSM"**
2. Authorize on OSM
3. You should be redirected back and logged in successfully

### Step 5: Check Console Output
When you click login, you should see:
```
🔐 Initiating OAuth login...
   Generated state: [state]...
   Total active states: 1
```

When OSM redirects you back:
```
🔐 OAuth callback received...
   Received state: [state]...
   Active states in storage: 1
✅ State validated (age: 2.3s)
🔐 Attempting OAuth token exchange...
✅ Token received successfully
✅ Logged in as: [your username]
```

## Troubleshooting

### Still Getting "Invalid State Parameter"?

**Check Active States Count:**
If the callback shows `"active_states_count": 0`, it means:
- The server restarted between login and callback, OR
- More than 10 minutes passed, OR
- You're accessing the app via a different domain/port

**Check Your OSM App Settings:**
1. Go to https://www.openstreetmap.org/oauth2/applications
2. Find your application
3. Check the **Redirect URI** exactly matches what's in your code
4. Common mismatches:
   - `localhost` vs `127.0.0.1`
   - `http://` vs `https://`
   - Port numbers (`:5000`, `:8000`, etc.)

**Check Your Browser URL:**
Make sure you're accessing the app using the **exact same URL** as the redirect URI base:
- ✅ Redirect URI: `http://localhost:5000/oauth/callback` → Access at: `http://localhost:5000`
- ❌ Redirect URI: `http://localhost:5000/oauth/callback` → Access at: `http://127.0.0.1:5000`

### "State not found in server storage"

This can happen if:
1. **Server restarted**: States are stored in memory, so they're lost on restart
2. **Expired**: States expire after 10 minutes
3. **Already used**: States are one-time use only

**Solution**: Just try logging in again. Don't restart the server while logging in.

### OAuth Credentials Not Set

If you see:
```
❌ NOT SET
```

You need to set your OAuth credentials:

**Option 1: Environment Variables (Recommended)**
```powershell
$env:OSM_CLIENT_ID="your_client_id_here"
$env:OSM_CLIENT_SECRET="your_client_secret_here"
py app.py
```

**Option 2: Edit app.py directly**
Find these lines and replace with your actual credentials:
```python
OSM_CLIENT_ID = os.environ.get('OSM_CLIENT_ID', 'your_actual_client_id')
OSM_CLIENT_SECRET = os.environ.get('OSM_CLIENT_SECRET', 'your_actual_client_secret')
```

## Technical Details

### Before (Using Session Cookies)
```python
# Login route
session['oauth_state'] = state  # Stored in cookie

# Callback route
stored_state = session.get('oauth_state')  # Cookie not sent back = None!
```

### After (Using Server-Side Storage)
```python
# Login route
oauth_states[state] = datetime.now(timezone.utc)  # Stored on server

# Callback route
if received_state in oauth_states:  # Always works!
    # Validate and remove (one-time use)
    oauth_states.pop(received_state)
```

## Summary

✅ OAuth state now stored **server-side** (not in cookies)  
✅ SECRET_KEY persists across server restarts  
✅ Better debugging with detailed console output  
✅ Automatic cleanup of expired states  
✅ URL consistency (localhost vs 127.0.0.1)  

The login should now work reliably! 🎉

