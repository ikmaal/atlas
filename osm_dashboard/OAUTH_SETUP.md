# OSM OAuth Setup Guide

This guide will help you set up OpenStreetMap OAuth authentication for your dashboard.

## Step 1: Register Your Application

1. Go to [OpenStreetMap OAuth Applications](https://www.openstreetmap.org/oauth2/applications)
2. Log in to your OSM account
3. Click **"Register new application"**

## Step 2: Fill in Application Details

Fill in the form with the following details:

- **Name**: `ATLAS - Singapore` (or any name you prefer)
- **Redirect URIs**: `http://localhost:5000/oauth/callback`
  - For production, add: `https://yourdomain.com/oauth/callback`
- **Confidential application**: ✅ Check this box
- **Permissions**: Check **`read_prefs`** (to read user preferences and profile)

Click **"Register"** to create your application.

## Step 3: Get Your Credentials

After registering, you'll see:
- **Client ID** - A long alphanumeric string
- **Client Secret** - Another long alphanumeric string

**IMPORTANT**: Keep these credentials secret! Never commit them to version control.

## Step 4: Configure Your Dashboard

You have two options to configure your OAuth credentials:

### Option A: Environment Variables (Recommended)

Set environment variables before running the app:

**Windows (PowerShell):**
```powershell
$env:OSM_CLIENT_ID="your_client_id_here"
$env:OSM_CLIENT_SECRET="your_client_secret_here"
py app.py
```

**Windows (CMD):**
```cmd
set OSM_CLIENT_ID=your_client_id_here
set OSM_CLIENT_SECRET=your_client_secret_here
py app.py
```

**Linux/Mac:**
```bash
export OSM_CLIENT_ID="your_client_id_here"
export OSM_CLIENT_SECRET="your_client_secret_here"
python app.py
```

### Option B: Direct Code Modification (Not Recommended for Production)

Edit `app.py` and replace these lines:

```python
OSM_CLIENT_ID = os.environ.get('OSM_CLIENT_ID', 'YOUR_CLIENT_ID_HERE')
OSM_CLIENT_SECRET = os.environ.get('OSM_CLIENT_SECRET', 'YOUR_CLIENT_SECRET_HERE')
```

With your actual credentials:

```python
OSM_CLIENT_ID = os.environ.get('OSM_CLIENT_ID', 'abc123def456...')
OSM_CLIENT_SECRET = os.environ.get('OSM_CLIENT_SECRET', 'xyz789uvw012...')
```

## Step 5: Install Dependencies

Make sure you have the new dependencies installed:

```bash
pip install -r requirements.txt
```

Or install them individually:

```bash
pip install Flask-Session requests-oauthlib
```

## Step 6: Run the Dashboard

Start your dashboard:

```bash
py app.py
```

Navigate to `http://localhost:5000` and you should see a **"Login with OSM"** button at the bottom of the sidebar.

## Features

Once logged in, you can:

✅ View your OSM profile in the sidebar
✅ See your total changeset count
✅ Access the **"My Edits"** tab to view all your changesets in Singapore
✅ View detailed information about each of your changesets

## Troubleshooting

### "Invalid Client" Error
- Double-check your Client ID and Client Secret
- Make sure they're properly set as environment variables
- Verify the redirect URI matches exactly: `http://localhost:5000/oauth/callback`

### "Redirect URI Mismatch" Error
- Ensure your redirect URI in the OSM application settings matches the one in your code
- For localhost: `http://localhost:5000/oauth/callback`
- For production: `https://yourdomain.com/oauth/callback`

### No Login Button Appearing
- Check browser console for JavaScript errors
- Verify that `static/script.js` is loading correctly
- Make sure Flask session is working (check for `flask_session` folder)

### Session Not Persisting
- Make sure Flask-Session is installed: `pip install Flask-Session`
- A `flask_session` folder should be created automatically when you first log in
- This folder stores session data (do not commit it to git - it's already in .gitignore)

## Production Deployment

When deploying to production:

1. **Update Redirect URI**: Add your production URL to the OSM application settings
2. **Use Environment Variables**: Never hardcode credentials
3. **HTTPS Required**: OSM OAuth requires HTTPS in production
4. **Set SECRET_KEY**: Generate a secure secret key for Flask sessions
   ```python
   import secrets
   print(secrets.token_hex(32))
   ```

## Security Notes

- ✅ `.gitignore` already includes `flask_session/` folder
- ✅ Never commit credentials to version control
- ✅ Use environment variables for sensitive data
- ✅ Keep your Client Secret confidential
- ✅ Regularly rotate your credentials if compromised

## Support

If you need help:
- [OSM OAuth Documentation](https://wiki.openstreetmap.org/wiki/OAuth)
- [OSM Help Forum](https://help.openstreetmap.org/)
- Check your OSM application settings at: https://www.openstreetmap.org/oauth2/applications
