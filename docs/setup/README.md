# Setup Documentation

This folder contains all setup and configuration guides for ATLAS.

## 📖 Setup Guides

### Core Setup
- **[OAuth Setup](OAUTH_SETUP.md)** - Configure OpenStreetMap OAuth authentication
  - Register your OSM application
  - Set up client credentials
  - Configure redirect URIs

- **[OAuth State Fix](OAUTH_STATE_FIX.md)** - Troubleshooting OAuth authentication
  - Common OAuth errors
  - State parameter issues
  - Session configuration

### Integrations
- **[Google Sheets Setup](GOOGLE_SHEETS_SETUP.md)** - Connect Google Sheets for task management
  - Service account setup
  - API credentials
  - Sheet configuration

- **[Slack Setup](SLACK_SETUP.md)** - Configure Slack notifications
  - Webhook setup
  - Channel configuration
  - Message customization

## ⚡ Quick Start Guides

For rapid setup, check the [quick-start](quick-start/) folder:
- [Quick Start: Colors](quick-start/QUICK_START_COLORS.md)
- [Quick Start: Slack](quick-start/QUICK_START_SLACK.md)
- [Slack Integration Quickstart](quick-start/SLACK_INTEGRATION_QUICKSTART.md)

## 🚀 Getting Started

1. **Start with OAuth** - [OAuth Setup](OAUTH_SETUP.md) is required for the dashboard to work
2. **Add Integrations** - Optional but recommended:
   - Google Sheets for task management
   - Slack for notifications
3. **Troubleshoot** - If you have issues, see [OAuth State Fix](OAUTH_STATE_FIX.md)

## 💡 Tips

- Keep your credentials secure - never commit them to git
- Use environment variables for production deployments
- Test OAuth with `http://localhost:5000` first before deploying

---

[← Back to Documentation](../README.md)






