# 🚀 Deploying ATLAS Dashboard to Render (Free)

This guide will help you deploy your ATLAS dashboard to Render's free tier.

## ⚠️ Important Notes About Render Free Tier

1. **Cold Starts**: Your app will "sleep" after 15 minutes of inactivity. First load takes 30-60 seconds.
2. **Ephemeral Storage**: Files uploaded will be lost on restart. Consider disabling image uploads or using cloud storage.
3. **750 Hours/Month**: Enough for continuous use in a single month.
4. **Session Storage**: Will work but sessions may be lost on restart.

## 📋 Prerequisites

Before deploying, you need:

1. ✅ GitHub account
2. ✅ Render account (sign up at https://render.com - free, no credit card)
3. ✅ OSM OAuth credentials (from https://www.openstreetmap.org/oauth2/applications)
4. ✅ (Optional) Anthropic API key for Atlas AI

## 🔧 Step 1: Update OSM OAuth Application

Before deploying, you need to update your OSM OAuth redirect URI:

1. Go to https://www.openstreetmap.org/oauth2/applications
2. Find your application (or create a new one)
3. Add this redirect URI (you'll update with actual URL after deployment):
   ```
   https://YOUR-APP-NAME.onrender.com/oauth/callback
   ```
   **Note:** You'll replace `YOUR-APP-NAME` with the actual name after you create the service on Render.

For now, you can add both:
- `http://localhost:5000/oauth/callback` (for local testing)
- `https://YOUR-APP-NAME.onrender.com/oauth/callback` (for production)

## 🚀 Step 2: Push to GitHub

If you haven't already, push your code to GitHub:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Prepare for Render deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/atlas-dashboard.git
git branch -M main
git push -u origin main
```

## 🌐 Step 3: Deploy on Render

### Option A: Using Blueprint (Automatic)

1. Go to https://render.com and sign in with GitHub
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will detect `render.yaml` and set everything up automatically
5. Click **"Apply"**

### Option B: Manual Setup

1. Go to https://render.com and sign in with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `atlas-dashboard` (or your choice)
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT --timeout 120 --workers 1`
   - **Plan**: Free

## 🔑 Step 4: Set Environment Variables

In the Render dashboard, go to **Environment** tab and add:

### Required Variables:

```
OSM_CLIENT_ID=your_client_id_from_osm
OSM_CLIENT_SECRET=your_client_secret_from_osm
OSM_REDIRECT_URI=https://your-app-name.onrender.com/oauth/callback
SESSION_COOKIE_SECURE=True
```

### Optional Variables:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_for_atlas_ai
GOOGLE_SHEETS_ENABLED=False
```

**Note:** Render will automatically generate `SECRET_KEY` for you.

## 🔄 Step 5: Update Redirect URI

1. After deployment completes, you'll get a URL like: `https://atlas-dashboard-abc123.onrender.com`
2. Copy this URL
3. Go back to OSM OAuth applications
4. Update the redirect URI to: `https://atlas-dashboard-abc123.onrender.com/oauth/callback`
5. Also update the `OSM_REDIRECT_URI` environment variable in Render to match

## ✅ Step 6: Test Your Deployment

1. Visit your Render URL: `https://your-app-name.onrender.com`
2. Wait 30-60 seconds for first load (cold start)
3. Click "Login with OSM"
4. Test creating notes, teams, etc.

## 🎯 Post-Deployment Tips

### Keep Your App "Warm"
To avoid cold starts, use a free uptime monitoring service to ping your app every 14 minutes:
- **UptimeRobot** (https://uptimerobot.com) - Free, ping every 5 minutes
- **Cron-job.org** (https://cron-job.org) - Free
- **Pingdom** - Free tier available

Set it to ping: `https://your-app-name.onrender.com/api/health`

### Monitor Your App
- Check Render **Logs** tab for errors
- Monitor **Metrics** tab for performance
- Set up **Notifications** for deployment issues

### Updating Your App
Simply push to GitHub:
```bash
git add .
git commit -m "Update dashboard"
git push
```
Render will automatically redeploy! 🚀

## ⚠️ Known Limitations on Free Tier

### Data Persistence Issues:

1. **Session Files** - Will be lost on restart
   - **Impact**: Users may need to re-login
   - **Solution**: Use Redis sessions (Render free Redis available)

2. **JSON Files** (notes.json, teams.json, etc.) - Will be lost on restart
   - **Impact**: Notes and teams will disappear
   - **Solution**: Use Render PostgreSQL free tier

3. **Uploaded Images** - Will be lost on restart
   - **Impact**: Notes images will disappear
   - **Solution**: Use Cloudinary free tier or disable uploads

### Quick Fixes:

If you want persistence, I can help you:
1. Switch to PostgreSQL for data storage (free on Render)
2. Set up Cloudinary for image uploads (free tier)
3. Use Redis for sessions (free on Render)

## 🆘 Troubleshooting

### App Won't Start
- Check Render **Logs** tab for errors
- Verify all environment variables are set
- Make sure `requirements.txt` has all dependencies

### OAuth Not Working
- Verify redirect URI matches exactly (including https://)
- Check OSM application is set as "Confidential"
- Ensure `SESSION_COOKIE_SECURE=True` is set

### App is Slow
- First load after sleep takes 30-60 seconds (normal)
- Consider using UptimeRobot to keep it awake
- Or upgrade to paid tier ($7/month) for no cold starts

### Data Keeps Disappearing
- This is normal for free tier (ephemeral storage)
- Switch to PostgreSQL for persistence (see note above)

## 💰 Cost Reminder

**Render Free Tier:**
- ✅ 750 hours/month compute
- ✅ 100GB bandwidth
- ✅ Automatic HTTPS
- ⚠️ Sleeps after 15 min inactivity
- ⚠️ Ephemeral storage

**Need More?**
- $7/month - No sleep, more resources
- $15/month - More powerful instance

## 🎉 Success!

Once deployed, share your dashboard URL with your team:
```
https://your-app-name.onrender.com
```

They can now:
- ✅ Login with their OSM accounts
- ✅ View changesets in Singapore
- ✅ Use Atlas AI (if API key configured)
- ✅ Create teams and notes
- ✅ Visualize on interactive maps

---

**Questions?** Check the Render documentation: https://render.com/docs

