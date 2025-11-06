# Slack Alert Setup Guide

This guide will help you set up Slack notifications for suspicious OpenStreetMap changesets.

## 📋 Features

The alert system will automatically notify your Slack channel when:
- 🚨 **Suspicious changesets** are detected (1000+ changes, 500+ deletions, or high deletion ratios)
- ⚠️ **Warning-level changesets** are found (500-1000 changes, 200-500 deletions)

Each alert includes:
- User who made the changeset
- Changeset ID and total changes
- Detailed breakdown (created, modified, deleted)
- Reasons for flagging
- Direct link to view on OpenStreetMap
- Visual status indicators (red for suspicious, yellow for warning)

## 🔧 Step 1: Create a Slack Incoming Webhook

### 1.1 Go to Slack API
Visit: https://api.slack.com/apps

### 1.2 Create New App
1. Click **"Create New App"**
2. Choose **"From scratch"**
3. Give it a name: `ATLAS Alerts`
4. Select your workspace

### 1.3 Enable Incoming Webhooks
1. In the left sidebar, click **"Incoming Webhooks"**
2. Toggle **"Activate Incoming Webhooks"** to **ON**
3. Scroll down and click **"Add New Webhook to Workspace"**
4. Select the channel where you want alerts (e.g., `#osm-alerts`)
5. Click **"Allow"**

### 1.4 Copy Webhook URL
You'll see a webhook URL like:
```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

**Keep this URL secret!** It's like a password for posting to your Slack channel.

## 🔧 Step 2: Configure Your Dashboard

### Option A: Environment Variables (Recommended)

Set these environment variables before running the app:

**Windows (PowerShell):**
```powershell
$env:SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
$env:SLACK_ALERTS_ENABLED="true"
py app.py
```

**Windows (CMD):**
```cmd
set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
set SLACK_ALERTS_ENABLED=true
py app.py
```

**Linux/Mac:**
```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export SLACK_ALERTS_ENABLED="true"
python app.py
```

### Option B: Create a .env File

Create a `.env` file in your project root:

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_ALERTS_ENABLED=true
```

Then install python-dotenv:
```bash
pip install python-dotenv
```

And add this to the top of `app.py` (after imports):
```python
from dotenv import load_dotenv
load_dotenv()
```

## 🎯 Step 3: Test Your Setup

### 3.1 Start Your Dashboard
```bash
py app.py
```

### 3.2 Verify Configuration
When the app starts, check the console output. It should show:
```
Starting ATLAS - Singapore OpenStreetMap Monitor...
✅ Slack alerts enabled
```

### 3.3 Wait for Alerts
- The dashboard checks for changesets every time it fetches data
- Auto-refresh happens every 5 minutes
- You'll receive a Slack message when suspicious changesets are detected

### 3.4 Manual Test (Optional)
If you want to test immediately, you can temporarily lower the thresholds in `app.py`:

```python
VALIDATION_THRESHOLDS = {
    'max_changes_warning': 50,      # Temporarily lowered for testing
    'max_changes_suspicious': 100,  # Temporarily lowered for testing
    'max_deletions_warning': 20,
    'max_deletions_suspicious': 50,
    'deletion_ratio_warning': 0.8
}
```

Then refresh the dashboard. **Remember to restore the original values after testing!**

## 📊 Alert Example

When a suspicious changeset is detected, you'll receive a Slack message like:

```
🚨 SUSPICIOUS CHANGESET DETECTED

User: JohnDoe
Changeset ID: #123456789
Total Changes: 1,234
Status: SUSPICIOUS

Comment: Mass import of buildings

🔍 Detection Reasons:
• Very high edit count: 1234 changes
• High deletions: 567

📊 Edit Breakdown:
• Created: 400
• Modified: 267
• Deleted: 567

[View on OpenStreetMap] (button)
```

## ⚙️ Customization

### Adjust Alert Thresholds

Edit `VALIDATION_THRESHOLDS` in `app.py`:

```python
VALIDATION_THRESHOLDS = {
    'max_changes_warning': 500,      # Yellow warning
    'max_changes_suspicious': 1000,  # Red suspicious
    'max_deletions_warning': 200,    # Warning for high deletions
    'max_deletions_suspicious': 500, # Suspicious deletions
    'deletion_ratio_warning': 0.8    # 80% deletions is suspicious
}
```

### Disable Alerts Temporarily

Set environment variable:
```powershell
$env:SLACK_ALERTS_ENABLED="false"
```

Or remove the environment variable entirely.

### Change Alert Channel

1. Go back to your Slack App settings
2. Add a new webhook to a different channel
3. Update your `SLACK_WEBHOOK_URL` environment variable

## 🔍 Monitoring

### Check Alert Status
The dashboard console will show:
```
✅ Slack alert sent for changeset #123456789 (suspicious)
✅ Slack alert sent for changeset #987654321 (warning)
```

### Duplicate Prevention
The system automatically prevents duplicate alerts for the same changeset during a single session.

### Rate Limiting
Slack has rate limits (1 message per second). The dashboard respects this by:
- Sending alerts immediately when detected
- Using a 5-second timeout for requests
- Caching alerted changesets

## 🛠️ Troubleshooting

### No Alerts Received

**Check 1: Is it enabled?**
```powershell
echo $env:SLACK_ALERTS_ENABLED
# Should show: true
```

**Check 2: Is webhook URL set?**
```powershell
echo $env:SLACK_WEBHOOK_URL
# Should show your webhook URL
```

**Check 3: Are there any suspicious changesets?**
Check the dashboard's List View for warning/suspicious badges

**Check 4: Check console output**
Look for errors like:
```
❌ Failed to send Slack alert: 404
❌ Error sending Slack alert: timeout
```

### "Invalid Webhook URL" Error
- Verify your webhook URL is correct
- Make sure you copied the entire URL
- Check that the Slack app is still active

### "Channel Not Found" Error
- The channel was deleted or archived
- Create a new webhook for an active channel

### Alerts Stopped Working
- Webhook may have been revoked
- App may have been removed from workspace
- Generate a new webhook URL

## 🔒 Security

- ✅ Never commit webhook URLs to version control
- ✅ `.env` file is already in `.gitignore`
- ✅ Use environment variables
- ✅ Regenerate webhook if exposed
- ✅ Limit webhook to specific channels

## 📚 Advanced: Multiple Channels

To send different alerts to different channels:

1. Create multiple webhooks (one per channel)
2. Store them as separate variables:
   ```python
   SLACK_WEBHOOK_SUSPICIOUS = os.environ.get('SLACK_WEBHOOK_SUSPICIOUS')
   SLACK_WEBHOOK_WARNING = os.environ.get('SLACK_WEBHOOK_WARNING')
   ```
3. Modify `send_slack_alert()` to use different webhooks based on status

## 🤝 Support

- [Slack API Documentation](https://api.slack.com/messaging/webhooks)
- [OSM Changeset Documentation](https://wiki.openstreetmap.org/wiki/Changeset)
- Check dashboard console for error messages

## 🎉 You're All Set!

Your ATLAS dashboard will now automatically alert your team whenever suspicious activity is detected in Singapore. Stay vigilant! 🛡️
