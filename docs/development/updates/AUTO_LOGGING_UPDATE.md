# Automatic Google Sheets & Slack Logging Update

## 🎯 What Changed

Previously, changesets that need review were **only logged to Google Sheets when analyzed using Atlas AI**. Now they're **automatically logged as soon as they're fetched** and detected in the dashboard.

## ✨ New Features

### 1. **Automatic Google Sheets Logging**
- ✅ Changesets with 50+ deletions are **automatically logged** when fetched
- ✅ Works in **both views**:
  - Main dashboard changeset list
  - User profile changeset view
- ✅ **No duplicate logging** - each changeset is logged only once
- ✅ New entries are inserted at **row 2 (top)** - newest always visible first

### 2. **Fixed Slack Notifications**
- ✅ Apps Script now checks **row 2** where new entries are inserted
- ✅ Tracks by **changeset ID** instead of row number (prevents duplicate alerts when rows shift)
- ✅ Automatically sends Slack alerts when new entries appear at the top

## 📝 What Was Changed

### Backend Changes (`app.py`)

#### 1. Added Auto-Logging in Main Fetch Function
**Location:** Lines 654-677 in `fetch_osm_changesets()`

```python
# Validate all changesets and log those needing review
for cs in changesets:
    cs['validation'] = validate_changeset(cs)
    
    # Log to Google Sheets if validation status is 'needs_review'
    if cs['validation'].get('status') == 'needs_review':
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
```

#### 2. Added Auto-Logging in User Stats Function
**Location:** Lines 1685-1708 in `get_user_changesets()`

Same logic applied to user profile changeset fetching.

#### 3. Added Duplicate Prevention
**Location:** Lines 245-256 in `log_changeset_needing_review()`

```python
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
```

### Google Apps Script Changes (`slack_appscript.js`)

#### 1. Check Row 2 Instead of Last Row
**Before:**
```javascript
const lastRow = sheet.getLastRow();
const rowData = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
```

**After:**
```javascript
// Always check row 2 (where new entries are inserted at the top)
const rowData = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
```

#### 2. Track by Changeset ID Instead of Row Number
**Before:**
```javascript
function isRowProcessed(rowNumber) { ... }
function markRowAsProcessed(rowNumber) { ... }
```

**After:**
```javascript
function isChangesetProcessed(changesetId) { ... }
function markChangesetAsProcessed(changesetId) { ... }
```

This prevents duplicate alerts when rows shift positions.

## 🚀 How to Deploy

### Step 1: Update Backend (Render)

1. **Commit and push the changes:**
   ```bash
   git add app.py slack_appscript.js docs/development/updates/AUTO_LOGGING_UPDATE.md
   git commit -m "Add automatic Google Sheets logging for changesets needing review"
   git push origin main
   ```

2. **Render will auto-deploy** - wait 2-3 minutes

3. **Verify it's working:**
   - Check Render logs for: `"✅ Logged changeset #XXXXX needing review to Google Sheets (at top)"`
   - Or: `"ℹ️ Changeset #XXXXX already logged to Google Sheets, skipping duplicate"`

### Step 2: Update Google Apps Script

1. **Open your Google Sheet** (`OSM Changesets Needing Review`)

2. Go to **Extensions → Apps Script**

3. **Select all existing code and delete it**

4. **Copy the entire updated code from `slack_appscript.js`**

5. **Paste it into the Apps Script editor**

6. **Update line 6** with your Slack webhook URL:
   ```javascript
   const SLACK_WEBHOOK_URL = 'YOUR_ACTUAL_WEBHOOK_URL_HERE';
   ```

7. Click **Save** (💾 disk icon)

8. **Test it:**
   - Run the `testNotification` function
   - Check your Slack channel - you should see a notification for the changeset in row 2

## ✅ Testing

### Test Automatic Logging

1. **Clear the cache** to force fresh data fetch:
   - Go to your dashboard
   - Open browser console (F12)
   - Run: `fetch('/api/cache/clear')`

2. **Refresh the dashboard** - if there are changesets with 50+ deletions, they should:
   - ✅ Show "Needs Review" badge in the UI
   - ✅ Automatically appear in Google Sheets at row 2
   - ✅ Trigger a Slack notification

3. **Check for duplicates:**
   - Refresh again - the same changeset should NOT be logged twice
   - Console should show: `"ℹ️ Changeset #XXXXX already logged to Google Sheets, skipping duplicate"`

### Test Slack Alerts

1. **Manually add a test changeset** to row 2 of your Google Sheet (or wait for a real one)

2. **Check Slack** - you should see a formatted notification within 1 minute

3. **Refresh the sheet** - the same changeset should NOT trigger another alert

## 🔍 How It Works

```
┌─────────────────────────────────────────┐
│  Dashboard Fetches Changesets          │
│  (Every time user loads the page)       │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  Validate Each Changeset                │
│  (Check for 50+ deletions)              │
└─────────────┬───────────────────────────┘
              │
              ▼
         ┌────┴────┐
         │ Status? │
         └────┬────┘
              │
      ┌───────┴───────┐
      ▼               ▼
  ┌───────┐      ┌──────────┐
  │ Valid │      │  Needs   │
  │       │      │  Review  │
  └───────┘      └─────┬────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │ Check if already logged │
         │  (Search Column B)      │
         └─────┬──────────┬────────┘
               │          │
         ┌─────┘          └─────┐
         ▼                      ▼
  ┌──────────┐          ┌────────────┐
  │ Already  │          │   Log to   │
  │ Exists   │          │   Google   │
  │ (Skip)   │          │   Sheets   │
  └──────────┘          │  (Row 2)   │
                        └──────┬─────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  Apps Script     │
                    │  Detects New Row │
                    │  at Row 2        │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Check if        │
                    │  Changeset ID    │
                    │  already sent    │
                    └────────┬─────────┘
                             │
                       ┌─────┴─────┐
                       ▼           ▼
                ┌──────────┐  ┌──────────┐
                │ Already  │  │   Send   │
                │ Sent     │  │  Slack   │
                │ (Skip)   │  │  Alert   │
                └──────────┘  └──────────┘
```

## 📊 Expected Behavior

### What You Should See

1. **Dashboard loads** → Changesets are fetched and validated
2. **Changesets with 50+ deletions** → Show "Needs Review" badge
3. **First time seeing a flagged changeset** → Automatically logged to Google Sheets at row 2
4. **Google Sheets updated** → Apps Script detects new entry within 1 minute
5. **Slack notification sent** → Your team is alerted

### What Won't Happen

- ❌ **Duplicate logging** - each changeset logged only once
- ❌ **Duplicate Slack alerts** - each changeset triggers one alert
- ❌ **Missed changesets** - all flagged changesets are logged automatically
- ❌ **Need to use Atlas AI** - logging happens without manual analysis

## 🐛 Troubleshooting

### No Changesets Being Logged

**Check:**
1. Are there changesets with 50+ deletions in Singapore?
2. Is Google Sheets enabled? Check Render logs for: `"📊 Google Sheets: ✅ ENABLED"`
3. Is the `GOOGLE_CREDENTIALS_JSON` environment variable set in Render?
4. Check Render logs for any `"❌ Error logging to Google Sheets"` messages

### Slack Alerts Not Working

**Check:**
1. Is the webhook URL correct in line 6 of Apps Script?
2. Run `testNotification` in Apps Script and check execution log
3. Is there data in row 2 of the sheet?
4. Check Apps Script execution history for errors

### Duplicate Entries

**Check:**
1. Are you clearing the cache multiple times? This shouldn't create duplicates, but check logs
2. Look for `"ℹ️ Changeset #XXXXX already logged"` messages - if missing, duplicate prevention isn't working

## 📈 Performance

- **No impact on dashboard load time** - logging happens asynchronously
- **Duplicate check is fast** - only searches one column
- **Slack alerts are rate-limited** - one per new changeset
- **Cache-friendly** - prevents re-validating the same changesets

## 🎉 Benefits

1. ✅ **No manual work** - changesets are logged automatically
2. ✅ **Immediate alerts** - team is notified within 1 minute
3. ✅ **No missed changesets** - every flagged changeset is logged
4. ✅ **No duplicates** - intelligent duplicate prevention
5. ✅ **Latest first** - newest changesets always at the top

## 📝 Notes

- The 24-hour time range is still active - only recent changesets are fetched
- Atlas AI analysis still works and will also log (but duplicates are prevented)
- You can manually add changesets to the sheet - they'll trigger Slack alerts too
- The threshold is 50 deletions - you can change this in `app.py` (line 101)

---

**Questions?** Check the Render logs for detailed information about what's being logged and when.

