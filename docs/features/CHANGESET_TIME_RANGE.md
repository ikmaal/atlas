# Changeset Time Range Configuration

The dashboard now fetches changesets from a **configurable time range** instead of the previous fixed 365-day period.

## 📊 What Changed

### **Before:**
- Fetched changesets from the last **365 days**
- Slower loading times
- More data to process
- Less focus on recent activity

### **After:**
- Fetches changesets from the last **24 hours** (default)
- Much faster loading
- More relevant, recent data
- Configurable via environment variable

---

## ⚙️ Configuration

### **Environment Variable:**

```
CHANGESET_TIME_RANGE_HOURS
```

### **Default Value:**
```
24 (hours)
```

### **Where It's Used:**

1. **Main Dashboard** - Fetching all changesets for Singapore
2. **My Edits** - Fetching user-specific changesets

---

## 🎯 Benefits

### **Performance:**
- ⚡ **Faster API calls** - Less data to fetch
- ⚡ **Quicker page load** - Smaller dataset to process
- ⚡ **Reduced server load** - Fewer requests needed

### **Relevance:**
- 🎯 **Recent activity** - Focus on what matters now
- 🎯 **Better validation** - Catch issues while they're fresh
- 🎯 **Timely review** - Issues are easier to revert when recent

### **Efficiency:**
- 📊 **Less noise** - No old changesets cluttering the view
- 📊 **Focused monitoring** - Track active patterns
- 📊 **Better UX** - Users see what's happening now

---

## 🔧 How to Change the Time Range

### **In Render Dashboard:**

1. Go to your service → **Environment** tab
2. Find `CHANGESET_TIME_RANGE_HOURS`
3. Change the value:
   - `12` = Last 12 hours
   - `24` = Last 24 hours (default)
   - `48` = Last 48 hours (2 days)
   - `168` = Last 7 days (1 week)
   - `720` = Last 30 days (1 month)
4. Click **"Save Changes"**
5. Render will auto-redeploy

### **For Local Development:**

Set the environment variable before running:

**PowerShell:**
```powershell
$env:CHANGESET_TIME_RANGE_HOURS = "24"
.\run.ps1
```

**Bash/Linux:**
```bash
export CHANGESET_TIME_RANGE_HOURS=24
python app.py
```

---

## 📈 Recommended Values

| Time Range | Use Case | Best For |
|------------|----------|----------|
| **12 hours** | High-activity areas | Very active communities |
| **24 hours** | Normal monitoring (default) | ✅ Most use cases |
| **48 hours** | Weekend coverage | When checking less frequently |
| **168 hours (7 days)** | Weekly reviews | Weekly validation cycles |
| **720 hours (30 days)** | Historical analysis | Research or reports |

---

## 💡 Why 24 Hours is the Default

For **Singapore OSM monitoring**, 24 hours is ideal because:

1. **Timely Detection** - Mass deletions are caught quickly
2. **Actionable** - Recent changesets are easier to review and revert
3. **Efficient** - Minimal API overhead
4. **Focused** - Clear view of current mapping activity
5. **Performance** - Fast dashboard loading

---

## 🔍 Technical Details

### **Code Location:**

**Configuration** (`app.py` line 103):
```python
CHANGESET_TIME_RANGE_HOURS = int(os.environ.get('CHANGESET_TIME_RANGE_HOURS', '24'))
```

**Main Changeset Fetching** (`app.py` line 492):
```python
start_time = current_end - timedelta(hours=CHANGESET_TIME_RANGE_HOURS)
```

**User Changesets** (`app.py` line 1390):
```python
start_time = end_time - timedelta(hours=CHANGESET_TIME_RANGE_HOURS)
```

### **Console Output:**

When fetching changesets, you'll see:
```
📊 Fetching up to 200 changesets from last 24 hours (max 2 API calls)...
```

The time range is now displayed in the logs!

---

## 🧪 Testing Different Time Ranges

To test different time ranges locally:

1. **12 hours:**
   ```powershell
   $env:CHANGESET_TIME_RANGE_HOURS = "12"
   ```

2. **48 hours:**
   ```powershell
   $env:CHANGESET_TIME_RANGE_HOURS = "48"
   ```

3. **7 days:**
   ```powershell
   $env:CHANGESET_TIME_RANGE_HOURS = "168"
   ```

Then run your dashboard and observe:
- Loading speed
- Number of changesets returned
- Relevance of data

---

## 📊 Impact on Features

### **Affected Features:**

✅ **Dashboard main view** - Shows changesets from time range  
✅ **My Edits** - Shows user's changesets from time range  
✅ **Validation system** - Only validates changesets in time range  
✅ **Google Sheets logging** - Only logs recent changesets  
✅ **Slack notifications** - Only notifies for recent changesets  

### **Not Affected:**

❌ **Atlas AI analysis** - Can analyze any changeset by ID  
❌ **Comparison tool** - Can compare any changeset by ID  
❌ **Direct changeset links** - Manual review still works  

---

## 🔄 Migration Notes

When you first deploy this change:

- Existing cached data may still show older changesets
- Refresh the page to see only recent changesets
- Google Sheets will only receive new entries from the time range
- No data is deleted; old logs remain in Google Sheets

---

## ✅ Deployment Checklist

- [x] Added `CHANGESET_TIME_RANGE_HOURS` configuration variable
- [x] Updated main changeset fetching function
- [x] Updated user changeset fetching function
- [x] Added environment variable to `render.yaml`
- [x] Updated console logging to show time range
- [x] Documentation created

---

**Need to adjust the time range?** Just change the `CHANGESET_TIME_RANGE_HOURS` environment variable in Render - no code changes needed! 🚀


