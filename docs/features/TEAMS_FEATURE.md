# Teams Collaboration Feature

## Overview
The Teams feature allows users to create teams, invite members, and have discussions about OpenStreetMap changesets.

## Features

### ✅ Team Management
- **Create Teams**: Any logged-in user can create a team
- **Team Info**: Each team has a name and description
- **Member Management**: Team creators can add/remove members
- **Multiple Teams**: Users can join multiple teams

### ✅ Team Chat
- **Real-time Messaging**: Send messages to team members
- **Changeset Links**: (Optional) Link messages to specific changesets
- **Message History**: View all past conversations
- **Member List**: See who's on the team

### ✅ Permissions
- **Team Creator**: Can add/remove members, has full control
- **Team Members**: Can send messages and participate in discussions
- **Privacy**: Only team members can see messages

## How to Use

### Creating a Team

1. **Login** to your OSM account (required)
2. In the sidebar, find the **"Teams"** section
3. Click the **"+"** button next to "Teams"
4. Enter:
   - **Team Name** (required): e.g., "Grab Mappers"
   - **Description** (optional): What the team is about
5. Click **"Create Team"**

### Joining/Adding Members

1. **Open a team** by clicking on it in the sidebar
2. Click the **"Members"** button in the top right
3. Enter the **OSM username** of the person you want to add
4. Click **"Add"**

**Note:** Only the team creator can add members.

### Chatting with Your Team

1. Click on a team name in the sidebar
2. Type your message in the input box at the bottom
3. Press **Enter** or click **"Send"**
4. Your message will appear instantly

### Linking Changesets

To discuss a specific changeset:
1. Note the changeset ID (e.g., #173330428)
2. Mention it in your message
3. (Future enhancement: auto-link changesets)

### Removing Members

1. Open the team chat
2. Click **"Members"** button
3. Click **"Remove"** next to the member's name
4. Confirm the removal

**Note:** Team creators cannot be removed. Members can remove themselves.

## Example Use Cases

### Grab Mapping Team
- **Team Name**: "Grab Mappers"
- **Members**: All Grab employees who map
- **Use**: Coordinate mapping efforts, discuss changeset quality, plan mapping events

### Quality Control Team
- **Team Name**: "SG Quality Checkers"
- **Members**: Experienced mappers
- **Use**: Review suspicious changesets, discuss validation issues

### Regional Team
- **Team Name**: "East Region Mappers"
- **Members**: Mappers focused on eastern Singapore
- **Use**: Coordinate regional mapping tasks

## Technical Details

### Data Storage
- **Teams**: Stored in `teams.json`
- **Messages**: Stored in `team_messages.json`
- **Format**: JSON with UTF-8 encoding

### API Endpoints
- `GET /api/teams` - List user's teams
- `POST /api/teams` - Create a team
- `POST /api/teams/<team_id>/members` - Add member
- `DELETE /api/teams/<team_id>/members/<username>` - Remove member
- `GET /api/teams/<team_id>/messages` - Get messages
- `POST /api/teams/<team_id>/messages` - Send message

### Security
- **Authentication Required**: Must be logged in via OSM OAuth
- **Permission Checks**: API validates team membership for all operations
- **XSS Protection**: All user input is escaped before display

## Future Enhancements

Potential improvements:
- **Notifications**: Get notified of new messages
- **@Mentions**: Tag specific users in messages
- **Auto-link Changesets**: Automatically detect and link changeset IDs
- **Message Reactions**: React to messages with emojis
- **File Attachments**: Share images/documents
- **Search**: Search messages within a team
- **Team Avatars**: Custom team profile pictures

## Troubleshooting

### Can't Create Team
- **Solution**: Make sure you're logged in via OSM OAuth

### Can't Add Member
- **Check**: Are you the team creator?
- **Check**: Is the username spelled correctly?
- **Check**: Is the user already a member?

### Messages Not Appearing
- **Refresh**: Reload the chat by closing and reopening it
- **Check Connection**: Ensure you have internet connection

### Team Not Showing
- **Verify**: Make sure you're a member of the team
- **Refresh**: Reload the page

## Tips

1. **Clear Team Names**: Use descriptive names like "Grab Mappers" instead of "Team 1"
2. **Add Description**: Help members understand the team's purpose
3. **Be Specific**: When discussing changesets, include the changeset ID
4. **Stay Organized**: Create separate teams for different purposes
5. **Regular Cleanup**: Remove inactive members periodically

## Support

If you encounter issues:
1. Check the browser console for errors (F12)
2. Check the server logs
3. Verify your OSM OAuth is working
4. Make sure you're logged in

---

**Enjoy collaborating with your mapping team!** 🗺️✨


