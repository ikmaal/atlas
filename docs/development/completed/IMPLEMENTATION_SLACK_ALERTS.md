# 🚨 Slack Alerts Implementation Guide

This guide shows you **exactly** where to add code for Slack alerts in your `app.py` file.

## 📝 Step-by-Step Code Changes

### ✅ Step 1: Add Configuration (After line 44)

**Location:** After `VALIDATION_THRESHOLDS` dictionary (around line 44)

**Add this code:**

```python
# Slack Alert Configuration
SLACK_WEBHOOK_URL = os.environ.get('SLACK_WEBHOOK_URL', '')  # Set this environment variable
SLACK_ALERTS_ENABLED = os.environ.get('SLACK_ALERTS_ENABLED', 'false').lower() == 'true'

# Track alerted changesets to avoid duplicates
alerted_changesets = set()

def send_slack_alert(changeset):
    """
    Send a Slack notification for suspicious/warning changesets
    """
    if not SLACK_WEBHOOK_URL or not SLACK_ALERTS_ENABLED:
        return False
    
    validation = changeset.get('validation', {})
    status = validation.get('status', 'valid')
    
    # Only alert for warnings and suspicious changesets
    if status not in ['warning', 'suspicious']:
        return False
    
    # Check if already alerted
    cs_id = changeset.get('id')
    if cs_id in alerted_changesets:
        return False
    
    # Prepare alert details
    user = changeset.get('user', 'Unknown')
    comment = changeset.get('comment', 'No comment')
    num_changes = changeset.get('num_changes', 0)
    reasons = validation.get('reasons', [])
    osm_link = f"https://www.openstreetmap.org/changeset/{cs_id}"
    
    # Get detailed stats if available
    details = changeset.get('details', {})
    stats_text = ""
    if details:
        stats_text = f"\n• Created: {details.get('total_created', 0)}\n• Modified: {details.get('total_modified', 0)}\n• Deleted: {details.get('total_deleted', 0)}"
    
    # Determine color and emoji based on status
    if status == 'suspicious':
        color = "#dc3545"  # Red
        emoji = "🚨"
        title = "SUSPICIOUS CHANGESET DETECTED"
    else:
        color = "#ffc107"  # Yellow
        emoji = "⚠️"
        title = "WARNING: High Activity Changeset"
    
    # Build Slack message with blocks
    slack_message = {
        "text": f"{emoji} {title} in Singapore",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} {title}",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*User:*\n{user}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Changeset ID:*\n#{cs_id}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Total Changes:*\n{num_changes:,}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Status:*\n{status.upper()}"
                    }
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Comment:*\n{comment[:200]}{'...' if len(comment) > 200 else ''}"
                }
            }
        ],
        "attachments": [
            {
                "color": color,
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*🔍 Detection Reasons:*\n" + "\n".join([f"• {reason}" for reason in reasons])
                        }
                    }
                ]
            }
        ]
    }
    
    # Add detailed stats if available
    if stats_text:
        slack_message["attachments"][0]["blocks"].append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*📊 Edit Breakdown:*{stats_text}"
            }
        })
    
    # Add action button to view on OSM
    slack_message["attachments"][0]["blocks"].append({
        "type": "actions",
        "elements": [
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "View on OpenStreetMap",
                    "emoji": True
                },
                "url": osm_link,
                "style": "danger" if status == "suspicious" else "primary"
            }
        ]
    })
    
    try:
        response = requests.post(
            SLACK_WEBHOOK_URL,
            json=slack_message,
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
        
        if response.status_code == 200:
            alerted_changesets.add(cs_id)
            print(f"✅ Slack alert sent for changeset #{cs_id} ({status})")
            return True
        else:
            print(f"❌ Failed to send Slack alert: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error sending Slack alert: {e}")
        return False
```

---

### ✅ Step 2: Integrate Alerts into Validation (Around line 260-264)

**Location:** In the `fetch_osm_changesets()` function, after the validation loop

**Find this code:**
```python
        # Validate all changesets
        for cs in changesets:
            cs['validation'] = validate_changeset(cs)
        
        return changesets
```

**Replace with:**
```python
        # Validate all changesets and send alerts for suspicious ones
        for cs in changesets:
            cs['validation'] = validate_changeset(cs)
            
            # Send Slack alert for suspicious/warning changesets
            if SLACK_ALERTS_ENABLED:
                send_slack_alert(cs)
        
        return changesets
```

---

### ✅ Step 3: Add Startup Message (Around line 506)

**Location:** In the `if __name__ == '__main__':` section

**Find this code:**
```python
if __name__ == '__main__':
    print("Starting ATLAS - Singapore OpenStreetMap Monitor...")
    print("Navigate to http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
```

**Replace with:**
```python
if __name__ == '__main__':
    print("Starting ATLAS - Singapore OpenStreetMap Monitor...")
    print("Navigate to http://127.0.0.1:5000")
    
    # Show Slack alert status
    if SLACK_ALERTS_ENABLED and SLACK_WEBHOOK_URL:
        print("✅ Slack alerts ENABLED")
    elif SLACK_ALERTS_ENABLED and not SLACK_WEBHOOK_URL:
        print("⚠️  Slack alerts enabled but no webhook URL configured")
    else:
        print("ℹ️  Slack alerts disabled")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
```

---

## 🎯 Quick Copy-Paste Summary

If you want to implement this quickly, here are the three changes:

1. **After line 44:** Add the entire `send_slack_alert()` function and configuration
2. **Around line 262:** Add `send_slack_alert(cs)` call in the validation loop
3. **Around line 507:** Add the Slack status messages

---

## 🧪 Testing Your Implementation

### 1. Set Environment Variables
```powershell
$env:SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
$env:SLACK_ALERTS_ENABLED="true"
```

### 2. Start the Dashboard
```bash
py app.py
```

You should see:
```
Starting ATLAS - Singapore OpenStreetMap Monitor...
Navigate to http://127.0.0.1:5000
✅ Slack alerts ENABLED
```

### 3. Check Console Output
When suspicious changesets are found, you'll see:
```
✅ Slack alert sent for changeset #123456789 (suspicious)
✅ Slack alert sent for changeset #987654321 (warning)
```

### 4. Check Your Slack Channel
You should receive formatted alerts with all changeset details!

---

## 📊 What Gets Alerted?

### 🚨 Suspicious (Red Alert)
- 1000+ total changes
- 500+ deletions
- Multiple red flags combined

### ⚠️ Warning (Yellow Alert)
- 500-1000 total changes
- 200-500 deletions
- 80%+ deletion ratio (for changesets >50 changes)

### ✓ Valid (No Alert)
- Normal changesets under thresholds

---

## 🔄 Alert Frequency

- Alerts are sent **immediately** when suspicious changesets are detected
- Dashboard auto-refreshes every **5 minutes**
- **No duplicate alerts** for the same changeset during a session
- Server restart clears the duplicate tracking (intentional for fresh monitoring)

---

## 🛡️ Best Practices

✅ **DO:**
- Set up a dedicated `#osm-alerts` channel
- Test with lower thresholds first
- Monitor console for errors
- Keep webhook URL secret

❌ **DON'T:**
- Set thresholds too low (spam alerts)
- Commit webhook URL to git
- Share webhook URL publicly
- Ignore critical alerts

---

## 📞 Need Help?

See [SLACK_SETUP.md](SLACK_SETUP.md) for:
- How to create a Slack webhook
- Detailed configuration options
- Troubleshooting guide
- Advanced customization
