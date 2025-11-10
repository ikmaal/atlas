// ============================================
// Configuration
// ============================================

// Your Slack Webhook URL from the workflow
const SLACK_WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE';

// Which column is "Status" (N = 14th column in this case)
const STATUS_COLUMN = 14;

// Track processed rows to avoid duplicates
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

// ============================================
// Main Function - Triggers on Sheet Edit
// ============================================

function onEdit(e) {
  // Only trigger on row additions (when data is appended)
  if (!e || !e.range) return;
  
  const sheet = e.source.getActiveSheet();
  const editedRow = e.range.getRow();
  
  // Skip if header row or if we've already processed this row
  if (editedRow === 1) return;
  
  // Get all data from the edited row
  const rowData = sheet.getRange(editedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Check if this is a new changeset (has data but not processed)
  if (rowData[1] && !isRowProcessed(editedRow)) {
    sendSlackNotification(rowData, editedRow);
    markRowAsProcessed(editedRow);
  }
}

// Alternative: Trigger when rows are appended (more reliable)
function onRowAdded(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  // Skip header
  if (lastRow <= 1) return;
  
  // Check if we've already processed this row
  if (isRowProcessed(lastRow)) return;
  
  // Get the last row data
  const rowData = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // If there's data in the changeset ID column, send notification
  if (rowData[1]) {
    sendSlackNotification(rowData, lastRow);
    markRowAsProcessed(lastRow);
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
// Helper Functions - Track Processed Rows
// ============================================

function isRowProcessed(rowNumber) {
  const processed = SCRIPT_PROPERTIES.getProperty('processed_rows');
  if (!processed) return false;
  
  const processedRows = JSON.parse(processed);
  return processedRows.includes(rowNumber);
}

function markRowAsProcessed(rowNumber) {
  const processed = SCRIPT_PROPERTIES.getProperty('processed_rows');
  let processedRows = processed ? JSON.parse(processed) : [];
  
  if (!processedRows.includes(rowNumber)) {
    processedRows.push(rowNumber);
    
    // Keep only last 100 rows to avoid storage limits
    if (processedRows.length > 100) {
      processedRows = processedRows.slice(-100);
    }
    
    SCRIPT_PROPERTIES.setProperty('processed_rows', JSON.stringify(processedRows));
  }
}

// ============================================
// Manual Test Function
// ============================================

function testNotification() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    Logger.log("No data to test with");
    return;
  }
  
  const rowData = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  sendSlackNotification(rowData, lastRow);
  Logger.log("Test notification sent!");
}

