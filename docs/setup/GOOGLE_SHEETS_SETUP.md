# 📊 Google Sheets Integration Setup Guide

Your OSM Dashboard is now configured to automatically log **suspicious changesets** to Google Sheets!

## ✅ What's Already Done

- ✅ Packages installed (`gspread`, `google-auth`)
- ✅ Code integrated into `app.py`
- ✅ Automatic logging when Atlas AI detects warning flags
- ✅ `.gitignore` updated to protect credentials

## 🚀 Setup Steps (5 minutes)

### **Step 1: Create Google Cloud Project**

1. **Go to**: https://console.cloud.google.com/
2. **Sign in** with your Google account
3. Click **"Select a Project"** at the top
4. Click **"New Project"**
5. Name it: **"OSM Dashboard Logger"**
6. Click **"Create"**

---

### **Step 2: Enable Google Sheets API**

1. Make sure your new project is selected (top bar)
2. Go to **"APIs & Services"** → **"Library"**
3. Search for: **"Google Sheets API"**
4. Click on it → Click **"Enable"**
5. Also enable **"Google Drive API"** (same process)

---

### **Step 3: Create Service Account**

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"Service Account"**
3. Fill in:
   - **Name**: `osm-dashboard-logger`
   - **ID**: (auto-generated, that's fine)
4. Click **"Create and Continue"**
5. **Role**: Select **"Editor"** (under "Basic" roles)
6. Click **"Continue"** → **"Done"**

---

### **Step 4: Download JSON Credentials**

1. On the **Credentials** page, find your service account
2. Click on it (the email that looks like: `osm-dashboard-logger@...iam.gserviceaccount.com`)
3. Go to the **"Keys"** tab
4. Click **"Add Key"** → **"Create New Key"**
5. Choose **"JSON"** format
6. Click **"Create"**
7. A file will download (e.g., `osm-dashboard-logger-abc123.json`)

**Important**: 
- **Rename** this file to: `google_credentials.json`
- **Move** it to your dashboard folder: `C:\Users\ikmal.muhammad\Desktop\osm_dashboard\`
- **Keep it secret!** (Already added to `.gitignore`)

---

### **Step 5: Create Google Sheet**

1. Go to: https://sheets.google.com/
2. Click **"+ Blank"** to create a new sheet
3. **Name it**: `OSM Suspicious Changesets`
4. Leave it empty - the app will auto-create headers

---

### **Step 6: Share Sheet with Service Account**

**This is crucial!** 🔑

1. In your Google Sheet, click the **"Share"** button (top right)
2. Copy the **service account email** from your credentials file:
   - Open `google_credentials.json`
   - Find the line: `"client_email": "osm-dashboard-logger@..."`
   - Copy that entire email address
3. **Paste** the email in the "Share" dialog
4. Make sure it has **"Editor"** permissions
5. Click **"Send"** (or "Share")

**✅ Done!** The service account can now write to your sheet.

---

## 🧪 Test It

1. **Start your dashboard**:
   ```powershell
   py app.py
   ```

2. You should see:
   ```
   📊 Google Sheets: ✅ ENABLED
   ```

3. **Test Atlas AI**:
   - Go to Atlas AI page
   - Type: `analyze changeset 168495123`
   - If it has warnings, it will automatically log to your sheet!

4. **Check your Google Sheet**:
   - Refresh the page
   - You should see a new row with the suspicious changeset data

---

## 📋 What Gets Logged

Your sheet will have these columns:

| Column | Description |
|--------|-------------|
| **Logged At** | When Atlas detected it |
| **Changeset ID** | OSM changeset number |
| **User** | Mapper username |
| **Total Changes** | Sum of all edits |
| **Created** | New elements |
| **Modified** | Updated elements |
| **Deleted** | Removed elements |
| **Warning Flags** | What triggered the alert |
| **Comment** | Changeset comment |
| **Source** | Data source tag |
| **Created At** | When changeset was made |
| **OSM Link** | Direct link to OSM |
| **OSMCha Link** | Validation tool link |
| **Status** | Your review status (Pending/Reviewed/etc.) |

---

## 🎯 When Changesets Are Logged

Atlas AI automatically logs changesets that have **any** of these warning flags:

- ⚠️ **High deletion rate** - More deletions than additions/modifications (>10 deletions)
- 📊 **Large changeset** - Contains more than 500 changes
- 💬 **Missing comment** - No changeset comment provided
- 📍 **Missing source** - No source tag specified

---

## 🔧 Troubleshooting

### "Google Sheets: ⚠️ DISABLED"
- **Fix**: Make sure `google_credentials.json` is in your dashboard folder

### "Spreadsheet 'OSM Suspicious Changesets' not found"
- **Fix**: Create the sheet and make sure the name matches exactly (case-sensitive)

### "Permission denied" error
- **Fix**: Share the sheet with the service account email (see Step 6)

### Nothing gets logged
- **Fix**: Test with a changeset that has warnings, like:
  - `analyze changeset 141486602` (large changeset)
  - `analyze changeset 168495123` (empty comment)

---

## 🎨 Customize Your Sheet

You can:
- ✅ Add filters to columns
- ✅ Color-code rows by warning type
- ✅ Create charts/graphs
- ✅ Add a "Status" dropdown (Pending, Reviewed, False Positive, Reverted, etc.)
- ✅ Export to CSV/Excel
- ✅ Share with your team

---

## 🔒 Security Notes

- ✅ `google_credentials.json` is in `.gitignore` (won't be pushed to GitHub)
- ✅ Never share your credentials file publicly
- ✅ Service accounts have limited permissions (only the sheet you shared)
- ✅ You can revoke access anytime by removing the service account from the sheet

---

## 📊 Example Workflow

1. **Atlas AI analyzes a changeset** → Finds warning flags
2. **Automatically logs to your Google Sheet**
3. **You review the sheet** → Mark status as "Reviewed", "False Positive", or "Action Needed"
4. **Build a database** of suspicious patterns over time
5. **Share with your team** for collaborative review

---

## ✨ Next Steps

- Set up the Google Sheet and test it
- Analyze some recent changesets with Atlas AI
- Watch as suspicious ones get logged automatically
- Customize your sheet with filters and status tracking

---

**Need help?** Check the terminal output when your dashboard starts - it will show if Google Sheets is enabled and any errors.

Happy mapping! 🗺️

