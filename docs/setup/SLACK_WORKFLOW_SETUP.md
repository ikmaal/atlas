# Slack Workflow Setup for OSM Changeset Alerts

This guide shows you how to set up Slack notifications for changesets needing review using Slack Workflow Builder and Google Apps Script.

## 📋 Overview

When a changeset with 50+ deletions is logged to your Google Sheet, it will automatically send a formatted notification to your Slack channel.

---

## 🔧 Step-by-Step Setup

### Step 1: Create Slack Workflow

1. **Open Slack** and go to your `#osm-changeset-alert` channel
2. Click the channel name → **Integrations** → **Workflows**
3. Click **"Create Workflow"**
4. Choose **"From a webhook"**
5. Click **"Add Variable"** for each of these (click 16 times):

   **Add these variables:**
   - `changeset_id`
   - `user`
   - `total_changes`
   - `created`
   - `modified`
   - `deleted`
   - `warning_flags`
   - `comment`
   - `source`
   - `logged_at`
   - `created_at`
   - `osm_link`
   - `osmcha_link`
   - `sheet_link`
   - `status`
   - `row_number`

6. Click **"Next"**
7. Click **"Add Step"** → **"Send a message to a channel"**
8. Select your **#osm-changeset-alert** channel

---

### Step 2: Format the Message

In the **"Add a message"** field, copy and paste this template:

```
🔍 *New Changeset Needs Review*

*Changeset ID:* #{{changeset_id}}
*User:* {{user}}
*Total Changes:* {{total_changes}}

📊 *Breakdown:*
• Created: {{created}} 🟢
• Modified: {{modified}} 🟡  
• Deleted: {{deleted}} 🔴

⚠️ *Warning Flags:* {{warning_flags}}

💬 *Comment:* {{comment}}

📍 *Source:* {{source}}

⏰ *Logged at:* {{logged_at}}
📅 *Created at:* {{created_at}}

🔗 *Quick Links:*
• <{{osm_link}}|View on OSM>
• <{{osmcha_link}}|View on OSMCha>  
• <{{sheet_link}}|View in Sheet>

📋 *Status:* {{status}} (Row {{row_number}})
```

**IMPORTANT:** After pasting, you need to replace each `{{variable}}` with the actual variable:

1. Select `{{changeset_id}}` text
2. Delete it
3. Click **"Insert a variable"** button
4. Select `changeset_id` from the dropdown
5. Repeat for ALL variables

---

### Step 3: Save and Get Webhook URL

1. Click **"Save"** (bottom right)
2. Give it a name: **"OSM Changeset Alert"**
3. Click **"Publish"**
4. **Copy the Webhook URL** - it looks like:
   ```
   https://hooks.slack.com/triggers/T01234567/5678901234/abcdefghijklmnopqrstuvwxyz123456
   ```

---

### Step 4: Add Apps Script to Google Sheet

1. **Open your "OSM Changesets Needing Review" Google Sheet**
2. Click **Extensions** → **Apps Script**
3. Delete any existing code
4. **Copy the code from `slack_appscript.js`** (in your project folder)
5. **Replace line 7** with your webhook URL:
   ```javascript
   const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/triggers/YOUR_ACTUAL_URL_HERE';
   ```
6. Click **"Save"** (disk icon)

---

### Step 5: Set Up Trigger

1. In Apps Script, click the **clock icon** (Triggers) on the left
2. Click **"+ Add Trigger"**
3. Configure:
   - **Function to run:** `onRowAdded`
   - **Deployment:** Head
   - **Event source:** Time-driven
   - **Type of time based trigger:** Minutes timer
   - **Select minute interval:** Every minute
4. Click **"Save"**
5. **Authorize** the script when prompted (click "Review Permissions" → your Google account → "Allow")

---

### Step 6: Test It!

#### Manual Test:

1. In Apps Script editor, select **`testNotification`** from the dropdown
2. Click **"Run"**
3. Check **Execution log** (bottom) for "Test notification sent!"
4. **Check your Slack channel** - you should see a beautifully formatted message!

#### Live Test:

1. Make sure your dashboard is deployed on Render with Google Sheets enabled
2. Use Atlas AI to analyze a changeset with 50+ deletions
3. Within 1 minute, check:
   - ✅ New row in Google Sheet
   - ✅ Notification in Slack channel

---

## 📱 What You'll See in Slack

```
🔍 New Changeset Needs Review

Changeset ID: #172640112
User: username
Total Changes: 523

📊 Breakdown:
• Created: 200 🟢
• Modified: 173 🟡
• Deleted: 150 🔴

⚠️ Warning Flags: Mass deletion

💬 Comment: Updated road network in Jurong

📍 Source: Bing imagery

⏰ Logged at: 2025-11-10 14:30:00
📅 Created at: 2025-11-10 12:15:00

🔗 Quick Links:
• View on OSM
• View on OSMCha
• View in Sheet

📋 Status: Pending (Row 5)
```

With clickable links! 🎉

---

## 🎨 Customization Ideas

### Add Emoji Reactions

In Slack workflow, after the message step:
1. Click **"Add Step"** → **"Send a message"** → **"Add emoji reaction"**
2. Choose emoji like 🔍 or ⚠️

### Add Priority Colors

Modify the Apps Script to include a priority field:

```javascript
const priority = deleted > 200 ? '🚨 HIGH PRIORITY' : '⚠️ NEEDS REVIEW';
```

Then add `priority` to the payload and use it in your Slack message.

### Weekly Summary

Instead of every-minute trigger, set it to run once daily and summarize all pending changesets.

---

## 🛠️ Troubleshooting

### Issue: "This field is required" error in Slack

**Cause:** You didn't set up all the variables in the workflow

**Fix:** Go back to workflow settings and add all 16 variables listed in Step 1

---

### Issue: Still showing "new changeset alert"

**Cause:** Variables aren't inserted properly in the message

**Fix:** 
1. Edit your workflow
2. Make sure you clicked "Insert a variable" for each `{{variable}}`
3. Don't just type `{{variable}}` - you must use the variable button

---

### Issue: No notifications appearing

**Cause:** Trigger not set up or webhook URL wrong

**Fix:**
1. Check Apps Script Triggers (clock icon) - should have one active trigger
2. Verify webhook URL in line 7 of the script matches exactly
3. Run `testNotification` manually and check for errors in Execution log

---

### Issue: Duplicate notifications

**Cause:** Multiple triggers running at once

**Fix:**
1. Go to Triggers in Apps Script
2. Delete extra triggers
3. Keep only ONE time-based trigger (every 1 minute)

---

## 🔒 Security Notes

- Webhook URL is like a password - don't share it publicly
- Anyone with the URL can send messages to your channel
- You can regenerate the webhook URL in Slack workflow settings if needed

---

## ✅ Complete Setup Checklist

- [ ] Slack workflow created with all 16 variables
- [ ] Message formatted with variables (using "Insert a variable" button)
- [ ] Workflow published and webhook URL copied
- [ ] Apps Script added to Google Sheet
- [ ] Webhook URL configured in Apps Script (line 7)
- [ ] Trigger created (every 1 minute)
- [ ] Script authorized (permissions granted)
- [ ] Manual test successful (`testNotification`)
- [ ] Live test successful (new row triggers Slack message)

---

## 📊 File Reference

- **Apps Script Code:** `slack_appscript.js` (copy to Google Apps Script editor)
- **This Guide:** `SLACK_WORKFLOW_SETUP.md`

---

**Need help?** Check the troubleshooting section above or run a manual test to see error messages in the Apps Script execution log! 🚀

