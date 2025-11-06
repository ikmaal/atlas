# ✅ Render Deployment Checklist

Use this checklist to ensure smooth deployment to Render.

## 📋 Pre-Deployment Checklist

### 1. OSM OAuth Application
- [ ] Go to https://www.openstreetmap.org/oauth2/applications
- [ ] Create or edit your application
- [ ] Set as **"Confidential application"** (checked)
- [ ] Add permissions: **read_prefs** (checked)
- [ ] Add redirect URI: `http://localhost:5000/oauth/callback` (for testing)
- [ ] Add redirect URI: `https://YOUR-APP-NAME.onrender.com/oauth/callback` (for production)
- [ ] Note down your **Client ID**
- [ ] Note down your **Client Secret**

### 2. GitHub Repository
- [ ] Your code is in a GitHub repository
- [ ] Repository is public or Render has access
- [ ] All files are committed (check with `git status`)

### 3. Required Files (All Created ✅)
- [x] `render.yaml` - Render configuration
- [x] `requirements.txt` - Python dependencies
- [x] `runtime.txt` - Python version
- [x] `flask_session/.gitkeep` - Session directory
- [x] `static/uploads/.gitkeep` - Uploads directory

---

## 🚀 Deployment Steps

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Prepare for Render deployment"
git push
```

### Step 2: Deploy on Render
1. Go to https://render.com
2. Sign up/in with GitHub
3. Click **"New +"** → **"Blueprint"**
4. Select your repository: `atlas-dashboard`
5. Click **"Apply"**
6. Wait 3-5 minutes for build

### Step 3: Get Your App URL
After deployment:
- [ ] Copy your app URL (e.g., `https://atlas-dashboard-xyz.onrender.com`)
- [ ] Note it down: ____________________________________

### Step 4: Configure Environment Variables
In Render dashboard, go to **Environment** tab:

```
OSM_CLIENT_ID = [your OSM client ID]
OSM_CLIENT_SECRET = [your OSM client secret]
OSM_REDIRECT_URI = https://[your-app-name].onrender.com/oauth/callback
SESSION_COOKIE_SECURE = True
```

Optional (if you want Atlas AI):
```
ANTHROPIC_API_KEY = [your Anthropic API key]
```

- [ ] All environment variables added
- [ ] Click **"Save Changes"**
- [ ] Wait for automatic redeploy (~2 min)

### Step 5: Update OSM OAuth Redirect URI
1. Go back to https://www.openstreetmap.org/oauth2/applications
2. Edit your application
3. Update redirect URI to your actual Render URL:
   ```
   https://atlas-dashboard-xyz.onrender.com/oauth/callback
   ```
4. Save

### Step 6: Test Your Deployment
- [ ] Visit your Render URL
- [ ] Wait 30-60 seconds for first load (cold start)
- [ ] Dashboard loads successfully
- [ ] Click "Login with OSM"
- [ ] Successfully login with your OSM account
- [ ] Can view changesets
- [ ] Map displays correctly

---

## 🎯 Post-Deployment (Optional but Recommended)

### Keep Your App Awake
To avoid 30-60 second cold starts:

1. Sign up at https://uptimerobot.com (free)
2. Add New Monitor:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: ATLAS Dashboard
   - **URL**: `https://your-app-name.onrender.com/api/health`
   - **Monitoring Interval**: 5 minutes
3. Save

- [ ] UptimeRobot monitoring configured

### Share with Your Team
- [ ] Share URL: `https://your-app-name.onrender.com`
- [ ] Tell them to login with their OSM accounts
- [ ] Share documentation link (this repo)

---

## ⚠️ Known Limitations (Free Tier)

### What Works ✅
- ✅ Viewing changesets
- ✅ Interactive maps
- ✅ Atlas AI (if API key provided)
- ✅ User login (OSM OAuth)
- ✅ Basic notes and teams

### What Doesn't Persist ⚠️
- ⚠️ Notes will be lost on app restart
- ⚠️ Teams will be lost on app restart
- ⚠️ Uploaded images will be lost on app restart
- ⚠️ Sessions may be lost on app restart

### Why?
Render's free tier uses **ephemeral storage** - files are reset when the app restarts.

### Solution Options:

**Option A: Accept It** (Good for testing)
- Just use for viewing changesets
- Don't rely on saved data

**Option B: Add Database** (15 min setup)
- Add PostgreSQL (free on Render)
- Data persists forever
- Let me know if you want this!

---

## 🆘 Troubleshooting

### ❌ App Won't Load
**Symptom**: Site can't be reached

**Solutions**:
1. Wait 60 seconds (cold start)
2. Check Render **Logs** tab for errors
3. Verify deployment completed successfully
4. Check all environment variables are set

### ❌ Can't Login with OSM
**Symptom**: "Invalid state parameter" or redirect errors

**Solutions**:
1. Verify `OSM_REDIRECT_URI` matches exactly (including https://)
2. Check OSM application redirect URI matches
3. Ensure `SESSION_COOKIE_SECURE=True` is set
4. Clear browser cookies and try again

### ❌ App is Very Slow
**Symptom**: Takes 30-60 seconds to load

**Solutions**:
1. This is normal for first load after sleep
2. Set up UptimeRobot to keep app awake
3. Or upgrade to paid plan ($7/month - no sleep)

### ❌ Notes/Teams Disappear
**Symptom**: Data is lost after some time

**Solutions**:
1. This is expected (ephemeral storage)
2. Add PostgreSQL database for persistence
3. Or upgrade to Render paid plan with persistent disk

### ❌ "Application Error" on Render
**Solutions**:
1. Check Render **Logs** tab
2. Look for Python errors
3. Verify all environment variables are set
4. Check `requirements.txt` has all dependencies
5. Trigger manual deploy: **Manual Deploy** → **Deploy latest commit**

---

## 📊 Monitoring Your App

### Render Dashboard
- **Logs**: View real-time application logs
- **Metrics**: CPU, memory usage
- **Events**: Deployment history
- **Environment**: Manage variables

### What to Monitor
- Deployment success/failure
- Error logs
- Response times
- Uptime (if using UptimeRobot)

---

## 💰 Upgrade Options

If you love it and want better performance:

### Render Starter Plan - $7/month
- ✅ No cold starts (always on)
- ✅ More CPU/RAM
- ✅ Faster response times
- ⚠️ Still ephemeral storage

### Render Starter + PostgreSQL - $7/month + $7/month
- ✅ No cold starts
- ✅ Persistent database
- ✅ All data saved forever
- ✅ Production ready

---

## ✅ Deployment Complete!

Once everything is checked off, your ATLAS dashboard is live! 🎉

**Your Dashboard URL**: `https://your-app-name.onrender.com`

Share it with your team and start monitoring OSM changesets in Singapore!

---

## 📞 Need Help?

- **Quick Guide**: `RENDER_QUICK_START.md`
- **Full Documentation**: `DEPLOYMENT.md`
- **Render Docs**: https://render.com/docs
- **OSM OAuth**: https://www.openstreetmap.org/oauth2/applications

If you encounter issues, check the **Logs** tab in Render dashboard first!

