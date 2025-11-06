# 📢 Google Sheets → Slack Integration Guide

Automatically send Slack notifications whenever a suspicious changeset is logged to your Google Sheet!

## ✨ How It Works

```
Atlas AI detects warning flags
    ↓
Logs to Google Sheets
    ↓
Apps Script trigger fires
    ↓
Slack notification sent instantly! 📢
```

---

## 🚀 Setup Steps (10 minutes)

### **Step 1: Get Your Slack Webhook URL**

1. **Go to**: https://api.slack.com/apps
2. **Sign in** to your Slack workspace
3. Click **"Create New App"**
4. Choose **"From scratch"**
5. **App Name**: `OSM Changeset Alerts`
6. **Workspace**: Select your workspace
7. Click **"Create App"**

#### Enable Incoming Webhooks:
1. In left sidebar, click **"Incoming Webhooks"**
2. Toggle **"Activate Incoming Webhooks"** to **ON**
3. Scroll down, click **"Add New Webhook to Workspace"**
4. **Select channel**: Choose where alerts go (e.g., `#osm-alerts` or `#suspicious-changesets`)
5. Click **"Allow"**

#### Copy Webhook URL:
You'll see a URL like:
```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

**📋 Copy this URL** - you'll need it in Step 3!

---

### **Step 2: Open Google Sheets Apps Script**

1. **Open** your Google Sheet: `OSM Suspicious Changesets`
2. Click **Extensions** in the menu bar
3. Click **Apps Script**
4. You'll see a blank code editor with `function myFunction() {}`

---

### **Step 3: Add the Script**

**Delete** the default code and **paste** this complete script:

```javascript
// ============================================
// Configuration
// ============================================

// 🔧 PASTE YOUR SLACK WEBHOOK URL HERE:
const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';

// 🎨 Customize notification settings
const CONFIG = {
  sheetName: 'Sheet1',  // Name of your sheet (usually Sheet1)
  enableNotifications: true,
  minChangesForAlert: 0,  // Minimum total changes to trigger alert (0 = all)
  skipPendingStatus: false  // Set true to only alert on non-Pending status
};

// ============================================
// Main Function - Triggers on Sheet Edit
// ============================================

function onEdit(e) {
  // Check if notifications are enabled
  if (!CONFIG.enableNotifications) {
    Logger.log('Notifications disabled in config');
    return;
  }
  
  // Validate webhook URL
  if (!SLACK_WEBHOOK_URL || SLACK_WEBHOOK_URL.includes('YOUR/WEBHOOK/URL')) {
    Logger.log('❌ Error: Slack webhook URL not configured!');
    return;
  }
  
  try {
    const sheet = e.source.getActiveSheet();
    const range = e.range;
    
    // Only process the configured sheet
    if (sheet.getName() !== CONFIG.sheetName) {
      return;
    }
    
    // Skip header row edits
    if (range.getRow() === 1) {
      Logger.log('Header row edited, skipping notification');
      return;
    }
    
    // Get the edited row number
    const row = range.getRow();
    
    // Get all data from the edited row (14 columns)
    const rowData = sheet.getRange(row, 1, 1, 14).getValues()[0];
    
    // Extract data from columns
    const data = {
      loggedAt: rowData[0],        // Column A
      changesetId: rowData[1],     // Column B
      user: rowData[2],            // Column C
      total: rowData[3],           // Column D
      created: rowData[4],         // Column E
      modified: rowData[5],        // Column F
      deleted: rowData[6],         // Column G
      flags: rowData[7],           // Column H
      comment: rowData[8],         // Column I
      source: rowData[9],          // Column J
      createdAt: rowData[10],      // Column K
      osmLink: rowData[11],        // Column L
      osmchaLink: rowData[12],     // Column M
      status: rowData[13]          // Column N
    };
    
    // Validate we have actual data (not empty row)
    if (!data.changesetId || data.changesetId === '') {
      Logger.log('Empty changeset ID, skipping');
      return;
    }
    
    // Check minimum changes threshold
    if (CONFIG.minChangesForAlert > 0 && data.total < CONFIG.minChangesForAlert) {
      Logger.log(`Total changes (${data.total}) below threshold (${CONFIG.minChangesForAlert})`);
      return;
    }
    
    // Skip if status is Pending and config says so
    if (CONFIG.skipPendingStatus && data.status === 'Pending') {
      Logger.log('Status is Pending, skipping per config');
      return;
    }
    
    // Send Slack notification
    sendSlackNotification(data, sheet.getUrl());
    
  } catch (error) {
    Logger.log('❌ Error in onEdit: ' + error.toString());
  }
}

// ============================================
// Send Slack Notification
// ============================================

function sendSlackNotification(data, sheetUrl) {
  try {
    // Determine alert severity
    const isCritical = data.total > 1000 || data.deleted > 500 || data.flags.includes('High deletion');
    const emoji = isCritical ? '🚨' : '⚠️';
    const color = isCritical ? '#e74c3c' : '#f39c12';
    
    // Format the comment (truncate if too long)
    const commentText = data.comment && data.comment !== 'No comment' 
      ? data.comment.substring(0, 200) + (data.comment.length > 200 ? '...' : '')
      : '_No comment provided_';
    
    // Format flags as bullet points
    const flagsList = data.flags.split(',').map(flag => `  • ${flag.trim()}`).join('\n');
    
    // Build the Slack message with Block Kit
    const message = {
      text: `${emoji} Suspicious Changeset #${data.changesetId} detected!`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${emoji} Suspicious Changeset #${data.changesetId}`,
            emoji: true
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Mapper:*\n${data.user}`
            },
            {
              type: "mrkdwn",
              text: `*Total Changes:*\n${data.total}`
            },
            {
              type: "mrkdwn",
              text: `*🟢 Created:*\n${data.created} elements`
            },
            {
              type: "mrkdwn",
              text: `*🟡 Modified:*\n${data.modified} elements`
            },
            {
              type: "mrkdwn",
              text: `*🔴 Deleted:*\n${data.deleted} elements`
            },
            {
              type: "mrkdwn",
              text: `*Status:*\n${data.status}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*⚠️ Warning Flags:*\n${flagsList}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*💬 Comment:*\n${commentText}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📅 Created:* ${data.createdAt}\n*📝 Source:* ${data.source || 'Not specified'}`
          }
        },
        {
          type: "divider"
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "🗺️ View on OSM",
                emoji: true
              },
              url: data.osmLink,
              style: "primary"
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "🔍 View on OSMCha",
                emoji: true
              },
              url: data.osmchaLink
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "📊 Open Sheet",
                emoji: true
              },
              url: sheetUrl
            }
          ]
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `🤖 Detected by Atlas AI • Logged at ${data.loggedAt}`
            }
          ]
        }
      ]
    };
    
    // Send to Slack
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(SLACK_WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      Logger.log(`✅ Slack notification sent for changeset #${data.changesetId}`);
    } else {
      Logger.log(`❌ Slack notification failed: ${responseCode} - ${response.getContentText()}`);
    }
    
  } catch (error) {
    Logger.log('❌ Error sending Slack notification: ' + error.toString());
  }
}

// ============================================
// Manual Test Function (Optional)
// ============================================

function testSlackNotification() {
  // Test data - modify this to test your notification
  const testData = {
    loggedAt: new Date().toLocaleString(),
    changesetId: '123456789',
    user: 'TestMapper',
    total: 1500,
    created: 200,
    modified: 300,
    deleted: 1000,
    flags: 'High deletion rate, Large changeset, Missing comment',
    comment: 'This is a test changeset comment for testing Slack integration',
    source: 'survey',
    createdAt: '2025-10-23 15:30 UTC',
    osmLink: 'https://www.openstreetmap.org/changeset/123456789',
    osmchaLink: 'https://osmcha.org/changesets/123456789',
    status: 'Pending'
  };
  
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  sendSlackNotification(testData, sheetUrl);
  
  Logger.log('✅ Test notification sent! Check your Slack channel.');
}
```

**⚠️ Important:** Replace this line with your actual webhook URL:
```javascript
const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';
```

---

### **Step 4: Save the Script**

1. Click the **💾 Save** icon (or press `Ctrl+S` / `Cmd+S`)
2. **Name your project**: `OSM Slack Alerts`
3. Click **OK**

---

### **Step 5: Test the Notification** 🧪

Before setting up automatic triggers, let's test it:

1. In the Apps Script editor, find the **function dropdown** at the top
2. Select **`testSlackNotification`** from the dropdown
3. Click the **▶️ Run** button

#### First-Time Authorization:
- Click **"Review permissions"**
- Choose your Google account
- Click **"Advanced"** → **"Go to OSM Slack Alerts (unsafe)"**
- Click **"Allow"**

#### Check Results:
- Look at your **Slack channel** - you should see a test notification! 🎉
- If it worked, proceed to Step 6
- If not, check **View** → **Logs** for error messages

---

### **Step 6: Set Up Automatic Trigger**

Now make it automatic - trigger on every new row:

1. In Apps Script editor, click the **⏰ Triggers** icon (clock on left sidebar)
2. Click **"+ Add Trigger"** (bottom right)
3. Configure the trigger:
   - **Function to run**: `onEdit`
   - **Deployment**: `Head`
   - **Event source**: `From spreadsheet`
   - **Event type**: `On edit`
   - **Failure notification**: `Notify me immediately`
4. Click **Save**

#### Grant Permissions (if asked):
- Click **"Review permissions"**
- Choose your account
- Click **"Allow"**

---

## ✅ You're Done! 

### **How to Test End-to-End:**

1. Go to your **OSM Dashboard**
2. Open **Atlas AI**
3. Analyze a changeset with warnings:
   ```
   analyze changeset 141486602
   ```
4. If it has warning flags:
   - ✅ It logs to Google Sheets
   - ✅ Apps Script trigger fires
   - ✅ Slack notification appears instantly! 🎉

---

## 🎨 Customization Options

### **Change Notification Settings:**

Edit these values at the top of the script:

```javascript
const CONFIG = {
  sheetName: 'Sheet1',           // Your sheet tab name
  enableNotifications: true,      // Toggle notifications on/off
  minChangesForAlert: 0,          // Only alert if total > this number
  skipPendingStatus: false        // Set true to skip "Pending" changesets
};
```

### **Examples:**

**Only alert for large changesets (>500 changes):**
```javascript
minChangesForAlert: 500
```

**Only alert after you've reviewed them (Status ≠ Pending):**
```javascript
skipPendingStatus: true
```

**Disable temporarily without deleting trigger:**
```javascript
enableNotifications: false
```

---

## 📊 What the Slack Message Includes

Your team will see:

```
🚨 Suspicious Changeset #173518595

Mapper: Mith252                  Total Changes: 1,234
🟢 Created: 100 elements         🟡 Modified: 134 elements
🔴 Deleted: 1000 elements        Status: Pending

⚠️ Warning Flags:
  • High deletion rate
  • Large changeset
  • Missing comment

💬 Comment:
Cleanup of duplicate data

📅 Created: October 23, 2025 at 14:30 UTC
📝 Source: survey

[🗺️ View on OSM]  [🔍 View on OSMCha]  [📊 Open Sheet]

🤖 Detected by Atlas AI • Logged at 2025-10-23 15:45:32
```

---

## 🔧 Troubleshooting

### **No Slack notification appears:**

1. **Check webhook URL:**
   - Make sure you replaced `YOUR/WEBHOOK/URL` with your actual URL
   - URL should start with `https://hooks.slack.com/services/`

2. **Check trigger is active:**
   - Apps Script → Triggers → Should see `onEdit` listed
   - Status should say "Active"

3. **Check logs:**
   - Apps Script → **Executions** (left sidebar)
   - Look for recent runs and any errors

4. **Test manually:**
   - Run `testSlackNotification` function
   - Check **View** → **Logs**

### **Getting "Webhook URL not configured" error:**

- You didn't replace the placeholder URL
- Edit the script and update line 8 with your actual webhook

### **Notifications work but missing data:**

- Check your Google Sheet column order matches:
  ```
  A: Logged At
  B: Changeset ID
  C: User
  D: Total Changes
  E: Created
  F: Modified
  G: Deleted
  H: Warning Flags
  I: Comment
  J: Source
  K: Created At
  L: OSM Link
  M: OSMCha Link
  N: Status
  ```

### **Too many notifications:**

Adjust the `CONFIG` settings:
```javascript
minChangesForAlert: 500,  // Only alert for large changesets
skipPendingStatus: true   // Only alert after review
```

---

## 🚀 Advanced: Add More Features

### **1. Daily Summary**

Add this function to send a daily summary at 9 AM:

```javascript
function sendDailySummary() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetName);
  const data = sheet.getDataRange().getValues();
  
  // Skip header
  const rows = data.slice(1);
  
  // Get today's entries
  const today = new Date().toDateString();
  const todayRows = rows.filter(row => {
    const logDate = new Date(row[0]).toDateString();
    return logDate === today;
  });
  
  if (todayRows.length === 0) {
    Logger.log('No suspicious changesets today');
    return;
  }
  
  const message = {
    text: `📊 Daily OSM Alert Summary - ${todayRows.length} suspicious changesets detected today`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `📊 Daily Summary: ${todayRows.length} Suspicious Changesets`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Detected ${todayRows.length} suspicious changesets today.\n\n<${sheet.getParent().getUrl()}|View Full Report>`
        }
      }
    ]
  };
  
  UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(message)
  });
}
```

**Set up daily trigger:**
- Triggers → Add Trigger
- Function: `sendDailySummary`
- Event source: `Time-driven`
- Type: `Day timer`
- Time: `9am to 10am`

### **2. @ Mention Specific Users**

Add user mentions for high-priority alerts:

```javascript
// In sendSlackNotification, add to message:
if (data.total > 2000) {
  message.text = `<!channel> 🚨 CRITICAL: Changeset #${data.changesetId}`;
}
```

### **3. Thread Replies for Status Updates**

Track changeset review in threads (advanced).

---

## 📈 Benefits of This Setup

✅ **Instant Notifications** - Team knows immediately  
✅ **No Dashboard Changes** - Works with existing setup  
✅ **Rich Formatting** - Beautiful Slack messages  
✅ **Clickable Links** - Direct access to OSM/OSMCha  
✅ **Customizable** - Adjust thresholds and filters  
✅ **Free Forever** - No third-party costs  
✅ **Reliable** - Google's infrastructure  

---

## 🎯 Next Steps

1. ✅ Complete the 6 setup steps above
2. ✅ Test with a real suspicious changeset
3. ✅ Customize notification settings to your needs
4. ✅ Share the Slack channel with your team
5. ✅ Review and update changeset status in the sheet

---

## 💡 Pro Tips

- **Use a dedicated Slack channel** like `#osm-alerts` or `#suspicious-changesets`
- **Pin the Google Sheet link** in the Slack channel
- **Set notification preferences** in Slack (desktop/mobile)
- **Add Status reactions** in Slack (✅ = reviewed, 🚫 = reverted, etc.)
- **Create a team workflow** for handling alerts

---

## 🆘 Need Help?

**Common Issues:**
- Webhook URL not working → Regenerate in Slack API
- Trigger not firing → Check trigger permissions
- Missing data → Verify column order in sheet

**Check Logs:**
- Apps Script → **Executions** → View all runs
- Apps Script → **View** → **Logs** → See debug output

---

**Status: Ready to Deploy! 🚀**

Follow the steps above and you'll have automatic Slack notifications whenever Atlas AI detects suspicious changesets!

