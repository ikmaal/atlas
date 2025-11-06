# ⚡ Quick Start: Slack Alerts in 5 Minutes

## 1️⃣ Create Slack Webhook (2 min)

1. Go to: https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Name: `ATLAS Alerts` → Select your workspace
4. Click **"Incoming Webhooks"** → Toggle **ON**
5. Click **"Add New Webhook to Workspace"**
6. Select channel (e.g., `#osm-alerts`) → **Allow**
7. **Copy the webhook URL** (looks like `https://hooks.slack.com/services/...`)

---

## 2️⃣ Add Code to app.py (2 min)

### Location 1: After line 44

Add this after `VALIDATION_THRESHOLDS = {...}`:

```python
# Slack Alert Configuration
SLACK_WEBHOOK_URL = os.environ.get('SLACK_WEBHOOK_URL', '')
SLACK_ALERTS_ENABLED = os.environ.get('SLACK_ALERTS_ENABLED', 'false').lower() == 'true'
alerted_changesets = set()

def send_slack_alert(changeset):
    """Send Slack notification for suspicious changesets"""
    if not SLACK_WEBHOOK_URL or not SLACK_ALERTS_ENABLED:
        return False
    
    validation = changeset.get('validation', {})
    status = validation.get('status', 'valid')
    
    if status not in ['warning', 'suspicious']:
        return False
    
    cs_id = changeset.get('id')
    if cs_id in alerted_changesets:
        return False
    
    user = changeset.get('user', 'Unknown')
    comment = changeset.get('comment', 'No comment')
    num_changes = changeset.get('num_changes', 0)
    reasons = validation.get('reasons', [])
    osm_link = f"https://www.openstreetmap.org/changeset/{cs_id}"
    
    details = changeset.get('details', {})
    stats_text = ""
    if details:
        stats_text = f"\n• Created: {details.get('total_created', 0)}\n• Modified: {details.get('total_modified', 0)}\n• Deleted: {details.get('total_deleted', 0)}"
    
    if status == 'suspicious':
        color = "#dc3545"
        emoji = "🚨"
        title = "SUSPICIOUS CHANGESET DETECTED"
    else:
        color = "#ffc107"
        emoji = "⚠️"
        title = "WARNING: High Activity Changeset"
    
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
                    {"type": "mrkdwn", "text": f"*User:*\n{user}"},
                    {"type": "mrkdwn", "text": f"*Changeset ID:*\n#{cs_id}"},
                    {"type": "mrkdwn", "text": f"*Total Changes:*\n{num_changes:,}"},
                    {"type": "mrkdwn", "text": f"*Status:*\n{status.upper()}"}
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
    
    if stats_text:
        slack_message["attachments"][0]["blocks"].append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*📊 Edit Breakdown:*{stats_text}"}
        })
    
    slack_message["attachments"][0]["blocks"].append({
        "type": "actions",
        "elements": [{
            "type": "button",
            "text": {"type": "plain_text", "text": "View on OpenStreetMap", "emoji": True},
            "url": osm_link,
            "style": "danger" if status == "suspicious" else "primary"
        }]
    })
    
    try:
        response = requests.post(SLACK_WEBHOOK_URL, json=slack_message, 
                                headers={'Content-Type': 'application/json'}, timeout=5)
        
        if response.status_code == 200:
            alerted_changesets.add(cs_id)
            print(f"✅ Slack alert sent for changeset #{cs_id} ({status})")
            return True
        else:
            print(f"❌ Failed to send Slack alert: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error sending Slack alert: {e}")
        return False
```

### Location 2: Around line 262

Find:
```python
        for cs in changesets:
            cs['validation'] = validate_changeset(cs)
```

Change to:
```python
        for cs in changesets:
            cs['validation'] = validate_changeset(cs)
            if SLACK_ALERTS_ENABLED:
                send_slack_alert(cs)
```

### Location 3: Around line 507

Find:
```python
if __name__ == '__main__':
    print("Starting ATLAS - Singapore OpenStreetMap Monitor...")
```

Add after:
```python
    if SLACK_ALERTS_ENABLED and SLACK_WEBHOOK_URL:
        print("✅ Slack alerts ENABLED")
    elif SLACK_ALERTS_ENABLED and not SLACK_WEBHOOK_URL:
        print("⚠️  Slack alerts enabled but no webhook URL configured")
    else:
        print("ℹ️  Slack alerts disabled")
```

---

## 3️⃣ Configure & Run (1 min)

**PowerShell:**
```powershell
$env:SLACK_WEBHOOK_URL="YOUR_WEBHOOK_URL_HERE"
$env:SLACK_ALERTS_ENABLED="true"
py app.py
```

**CMD:**
```cmd
set SLACK_WEBHOOK_URL=YOUR_WEBHOOK_URL_HERE
set SLACK_ALERTS_ENABLED=true
py app.py
```

---

## 4️⃣ Verify (30 sec)

Look for in console:
```
Starting ATLAS - Singapore OpenStreetMap Monitor...
Navigate to http://127.0.0.1:5000
✅ Slack alerts ENABLED
```

---

## ✅ Done!

You'll now receive Slack alerts like:

```
🚨 SUSPICIOUS CHANGESET DETECTED

User: badactor123
Changeset ID: #123456789
Total Changes: 1,234
Status: SUSPICIOUS

Comment: Mass import...

🔍 Detection Reasons:
• Very high edit count: 1234 changes
• High deletions: 567

📊 Edit Breakdown:
• Created: 400
• Modified: 267
• Deleted: 567

[View on OpenStreetMap] ← Click to review
```

---

## 🆘 Not Working?

**Check 1:** Environment variables set?
```powershell
echo $env:SLACK_ALERTS_ENABLED
echo $env:SLACK_WEBHOOK_URL
```

**Check 2:** Webhook URL correct?
- Should start with `https://hooks.slack.com/services/`
- No spaces or line breaks

**Check 3:** Test webhook manually:
```powershell
Invoke-WebRequest -Uri "YOUR_WEBHOOK_URL" -Method Post -Body '{"text":"Test"}' -ContentType "application/json"
```

---

## 📚 More Details

- **Full setup guide:** `SLACK_SETUP.md`
- **Implementation details:** `IMPLEMENTATION_SLACK_ALERTS.md`
- **Complete summary:** `SLACK_ALERTS_SUMMARY.md`

---

**That's it! You're now protecting Singapore's OSM data! 🛡️**
