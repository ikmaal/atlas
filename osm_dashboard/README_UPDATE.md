# README Update - Add This to Your README.md

## In the Features Section (around line 11)

Add this new feature after the validation system line:

```markdown
- 🔔 **Slack Alerts** - Real-time notifications for suspicious changesets
```

So the Features section becomes:

```markdown
## Features

- 🗺️ Real-time changeset tracking for Singapore
- 📊 Visual statistics and metrics
- 👥 User contribution tracking
- 🗓️ Timeline view of recent changes
- ⚠️ **Validation System** - Automatic detection of suspicious changesets
- 🔔 **Slack Alerts** - Real-time notifications for suspicious changesets
- 🔐 **OAuth Login** - Login with your OSM account to view your profile and edits
- 📝 **My Edits** - View all your changesets in Singapore
- 🗺️ **Map Search** - Search for locations in Singapore
- 🎨 Modern, responsive UI with tabbed interface
```

## In the Installation Section (around line 27)

Add a new step 2.5 (after OAuth setup, before running the app):

```markdown
2.5. **(Optional) Set up Slack Alerts:**
   - See [SLACK_SETUP.md](SLACK_SETUP.md) for detailed instructions
   - Create a Slack incoming webhook at https://api.slack.com/apps
   - Set your webhook URL and enable alerts via environment variables
```

