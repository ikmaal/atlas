// ============================================
// Configuration
// ============================================

// Your Slack Webhook URL from the workflow
const SLACK_WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE';

// Which column is "Status" (N = 14th column in this case)
const STATUS_COLUMN = 14;

// Track processed changesets to avoid duplicates
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

// ============================================
// Main Function - Triggers on Sheet Edit
// ============================================

function onEdit(e) {
  // Only trigger on row insertions at row 2
  if (!e || !e.range) return;
  
  const sheet = e.source.getActiveSheet();
  const editedRow = e.range.getRow();
  
  // Only process row 2 (where new entries are inserted)
  if (editedRow !== 2) return;
  
  // Get all data from row 2
  const rowData = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Check if this is a new changeset (has data and not processed by changeset ID)
  if (rowData[1] && !isChangesetProcessed(rowData[1])) {
    sendSlackNotification(rowData, 2);
    markChangesetAsProcessed(rowData[1]);
  }
}

// Alternative: Trigger when rows are inserted (more reliable)
function onRowAdded(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Skip if only headers exist
  if (sheet.getLastRow() < 2) return;
  
  // Always check row 2 (where new entries are inserted at the top)
  const rowData = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // If there's data in the changeset ID column and not processed
  if (rowData[1] && !isChangesetProcessed(rowData[1])) {
    sendSlackNotification(rowData, 2);
    markChangesetAsProcessed(rowData[1]);
  }
}

// ============================================
// Send Slack Notification - WORKFLOW VERSION
// ============================================

function sendSlackNotification(rowData, rowNumber) {
  try {
    // Parse row data (matching your sheet structure)
    const loggedAt = rowData[0];
    const changesetId = rowData[1];
    const user = rowData[2];
    const totalChanges = rowData[3];
    const created = rowData[4];
    const modified = rowData[5];
    const deleted = rowData[6];
    const warningFlags = rowData[7];
    const comment = rowData[8];
    const source = rowData[9];
    const createdAt = rowData[10];
    const osmLink = rowData[11];
    const osmchaLink = rowData[12];
    const status = rowData[13];
    
    const sheetLink = `https://docs.google.com/spreadsheets/d/${SpreadsheetApp.getActiveSpreadsheet().getId()}/edit#gid=0&range=A${rowNumber}`;
    
    // For Slack Workflow webhooks, send as simple key-value pairs
    const slackPayload = {
      changeset_id: String(changesetId),
      user: String(user),
      total_changes: String(totalChanges),
      created: String(created),
      modified: String(modified),
      deleted: String(deleted),
      warning_flags: String(warningFlags || 'Mass deletion'),
      comment: String(comment || 'No comment'),
      source: String(source || 'Not specified'),
      logged_at: String(loggedAt),
      created_at: String(createdAt),
      osm_link: String(osmLink),
      osmcha_link: String(osmchaLink),
      sheet_link: String(sheetLink),
      status: String(status || 'Pending'),
      row_number: String(rowNumber)
    };
    
    // Send to Slack
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(slackPayload),
      'muteHttpExceptions': true
    };
    
    const response = UrlFetchApp.fetch(SLACK_WEBHOOK_URL, options);
    
    if (response.getResponseCode() === 200) {
      Logger.log(`✅ Sent Slack notification for changeset #${changesetId}`);
    } else {
      Logger.log(`❌ Failed to send Slack notification: ${response.getResponseCode()} - ${response.getContentText()}`);
    }
    
  } catch (error) {
    Logger.log(`❌ Error sending Slack notification: ${error}`);
  }
}

// ============================================
// Helper Functions - Track Processed Changesets by ID
// ============================================

function isChangesetProcessed(changesetId) {
  const processed = SCRIPT_PROPERTIES.getProperty('processed_changesets');
  if (!processed) return false;
  
  const processedIds = JSON.parse(processed);
  return processedIds.includes(String(changesetId));
}

function markChangesetAsProcessed(changesetId) {
  const processed = SCRIPT_PROPERTIES.getProperty('processed_changesets');
  let processedIds = processed ? JSON.parse(processed) : [];
  
  if (!processedIds.includes(String(changesetId))) {
    processedIds.push(String(changesetId));
    
    // Keep only last 100 changesets to avoid storage limits
    if (processedIds.length > 100) {
      processedIds = processedIds.slice(-100);
    }
    
    SCRIPT_PROPERTIES.setProperty('processed_changesets', JSON.stringify(processedIds));
  }
}

// ============================================
// Manual Test Function
// ============================================

function testNotification() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  if (sheet.getLastRow() < 2) {
    Logger.log("No data to test with");
    return;
  }
  
  // Test with row 2 (most recent entry at the top)
  const rowData = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
  sendSlackNotification(rowData, 2);
  Logger.log("Test notification sent for changeset at row 2!");
}


