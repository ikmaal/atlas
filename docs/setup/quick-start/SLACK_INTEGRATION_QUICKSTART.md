# ⚡ Quick Start: Google Sheets → Slack Alerts

**5-Minute Setup Checklist**

---

## ☑️ Step 1: Get Slack Webhook (2 min)

1. Go to: https://api.slack.com/apps
2. Create New App → "From scratch"
3. Name: `OSM Alerts`, select workspace
4. Incoming Webhooks → Toggle **ON**
5. Add New Webhook → Select channel → **Allow**
6. **Copy the webhook URL** ✅

---

## ☑️ Step 2: Add Script to Google Sheets (2 min)

1. Open: `OSM Suspicious Changesets` sheet
2. **Extensions** → **Apps Script**
3. Delete default code
4. **Paste** the script from `GOOGLE_SHEETS_SLACK_INTEGRATION.md`
5. **Replace line 8** with your webhook URL:
   ```javascript
   const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T.../B.../XXX';
   ```
6. **Save** (Ctrl+S)

---

## ☑️ Step 3: Test It (1 min)

1. Function dropdown → Select `testSlackNotification`
2. Click **▶️ Run**
3. Allow permissions (first time only)
4. **Check Slack** - should see test message! 🎉

---

## ☑️ Step 4: Enable Auto-Trigger (1 min)

1. Click **⏰ Triggers** icon (left sidebar)
2. **+ Add Trigger**
3. Settings:
   - Function: `onEdit`
   - Event: `On edit`
4. **Save** → Allow permissions

---

## ✅ Done!

Now test end-to-end:
1. Atlas AI → Analyze suspicious changeset
2. Check Google Sheet → New row appears
3. Check Slack → Notification appears instantly! 📢

---

## 🎨 Optional: Customize

Edit these in the script (lines 11-16):

```javascript
const CONFIG = {
  minChangesForAlert: 0,      // Change to 500 for large changesets only
  skipPendingStatus: false    // Change to true to skip "Pending" 
};
```

---

## 🆘 Troubleshooting

**No Slack message?**
- Check webhook URL is correct
- Run `testSlackNotification` manually
- Check Apps Script → Executions for errors

**Multiple notifications?**
- Each sheet edit triggers once
- Normal behavior

---

**Full Guide:** See `GOOGLE_SHEETS_SLACK_INTEGRATION.md`




