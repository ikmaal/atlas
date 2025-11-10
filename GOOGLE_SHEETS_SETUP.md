# Google Sheets Setup Guide

Enable automatic logging of changesets needing review (50+ deletions) to Google Sheets.

## 📋 What This Does

When enabled, any changeset with **50+ deletions** will be automatically logged to a Google Sheet with:
- Changeset ID and user
- Total changes (created/modified/deleted)
- Warning flags
- Comment and source
- Direct links to OSM and OSMCha
- Status field for manual review

## 🔧 Setup Steps

### Step 1: Create Google Cloud Service Account

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create a New Project:**
   - Click the project dropdown at the top
   - Click "New Project"
   - Name it: `osm-dashboard` (or any name you prefer)
   - Click "Create"
   - Wait for project creation, then select it

3. **Enable Google Sheets API:**
   - In the left sidebar, click "APIs & Services" → "Library"
   - Search for: `Google Sheets API`
   - Click on it, then click "Enable"
   - Also search for and enable: `Google Drive API`

4. **Create Service Account:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Fill in:
     - **Service account name:** `osm-dashboard-sheets`
     - **Service account ID:** (auto-filled)
     - **Description:** `Service account for OSM Dashboard Google Sheets integration`
   - Click "Create and Continue"
   - Skip "Grant this service account access to project" (click "Continue")
   - Skip "Grant users access" (click "Done")

5. **Create JSON Key:**
   - You'll see your service account in the list
   - Click on the email address (looks like: `osm-dashboard-sheets@...`)
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Select "JSON"
   - Click "Create"
   - **A JSON file will download** - keep it safe!

6. **Copy Service Account Email:**
   - In the service account details, copy the email address
   - It looks like: `osm-dashboard-sheets@your-project-id.iam.gserviceaccount.com`
   - **You'll need this in Step 2!**

---

### Step 2: Create Google Sheet

1. **Create New Sheet:**
   - Go to: https://sheets.google.com/
   - Click "Blank" to create a new sheet
   - Name it exactly: **`OSM Changesets Needing Review`**

2. **Share with Service Account:**
   - Click the "Share" button (top right)
   - Paste your **service account email** from Step 1
   - Set permission to: **Editor**
   - **IMPORTANT:** Uncheck "Notify people"
   - Click "Share"

3. **Done!** The sheet is ready. Headers will be auto-created when the first changeset is logged.

---

### Step 3: Configure Render

1. **Open the Downloaded JSON File:**
   - Open the JSON key file you downloaded in Step 1
   - Select ALL the content (Ctrl+A)
   - Copy it (Ctrl+C)

2. **Go to Render Dashboard:**
   - Visit: https://render.com/dashboard
   - Click your service (atlas-dashboard)
   - Click "Environment" in the left sidebar

3. **Add Environment Variable:**
   - Click "Add Environment Variable"
   - **Key:** `GOOGLE_CREDENTIALS_JSON`
   - **Value:** Paste the entire JSON content
   - It should look like:
   ```json
   {
     "type": "service_account",
     "project_id": "your-project-id",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...",
     "client_email": "osm-dashboard-sheets@...",
     "client_id": "...",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "..."
   }
   ```
   - Click "Save Changes"

4. **Render will auto-deploy** (wait 2-3 minutes)

---

### Step 4: Test It!

1. **Check Logs:**
   - In Render, go to "Logs" tab
   - You should see: `📊 Google Sheets: ✅ ENABLED`

2. **Test Logging:**
   - In your dashboard, use Atlas AI to analyze a changeset with 50+ deletions
   - For example: `"Analyze changeset 172640112"`
   - Check the Render logs for: `✅ Logged changeset #... needing review to Google Sheets`

3. **Check Google Sheet:**
   - Open your "OSM Changesets Needing Review" sheet
   - You should see headers and the logged changeset!

---

## 📊 Sheet Structure

The sheet will have these columns:

| Column | Description |
|--------|-------------|
| Logged At | Timestamp when logged |
| Changeset ID | OSM changeset number |
| User | OSM username |
| Total Changes | Sum of all changes |
| Created | Elements created |
| Modified | Elements modified |
| Deleted | Elements deleted |
| Warning Flags | "Mass deletion" etc. |
| Comment | Changeset comment |
| Source | Source tag value |
| Created At | Changeset creation time |
| OSM Link | Direct link to view on OSM |
| OSMCha Link | Direct link to view on OSMCha |
| Status | "Pending" (for your review) |

---

## 🔍 What Gets Logged

**ONLY changesets with 50+ deletions** are logged. Valid changesets are NOT logged.

---

## 🛠️ Troubleshooting

### "Spreadsheet not found" error

**Cause:** Sheet name doesn't match exactly or service account doesn't have access

**Fix:**
1. Check sheet is named exactly: `OSM Changesets Needing Review`
2. Verify you shared it with the service account email
3. Check service account has "Editor" permission

---

### "Google Sheets not enabled" in logs

**Cause:** Environment variable not set correctly

**Fix:**
1. Check `GOOGLE_CREDENTIALS_JSON` exists in Render Environment
2. Verify the JSON is valid (no missing quotes/braces)
3. Make sure you saved changes and redeployed

---

### "Authentication error" or "Invalid credentials"

**Cause:** JSON credentials are invalid or APIs not enabled

**Fix:**
1. Check both Google Sheets API and Google Drive API are enabled
2. Make sure the JSON key is complete (not truncated)
3. Try creating a new key if the old one doesn't work

---

## 🔒 Security Notes

- **Never commit** `google_credentials.json` to Git (it's in `.gitignore`)
- Keep your JSON key file safe and private
- Only share sheets with the specific service account email
- You can revoke access anytime in Google Cloud Console

---

## 💡 Local Development

For local testing, you can also place the JSON file as `google_credentials.json` in your project root. The app will auto-detect it.

---

## ✅ Complete Checklist

Before using Google Sheets logging, confirm:

- [ ] Google Cloud project created
- [ ] Google Sheets API enabled
- [ ] Google Drive API enabled
- [ ] Service account created
- [ ] JSON key downloaded
- [ ] Google Sheet created with exact name
- [ ] Sheet shared with service account email
- [ ] Service account has "Editor" permission
- [ ] `GOOGLE_CREDENTIALS_JSON` set in Render
- [ ] Render redeployed successfully
- [ ] Logs show "Google Sheets: ✅ ENABLED"

---

**Need help?** Check Render logs for specific error messages and refer to the troubleshooting section above! 🚀

