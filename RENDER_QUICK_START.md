# 🚀 Quick Start: Deploy to Render in 5 Minutes

## Step-by-Step Guide

### 1️⃣ Push to GitHub (2 minutes)

```bash
# If not already initialized
git init
git add .
git commit -m "Deploy to Render"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/atlas-dashboard.git
git branch -M main
git push -u origin main
```

### 2️⃣ Deploy on Render (2 minutes)

1. Go to **https://render.com** and sign up with GitHub
2. Click **"New +"** → **"Blueprint"**
3. Select your `atlas-dashboard` repository
4. Click **"Apply"**
5. Wait 3-5 minutes for deployment

### 3️⃣ Configure Environment Variables (1 minute)

In Render dashboard, go to **Environment** tab and add:

```
OSM_CLIENT_ID=your_osm_client_id
OSM_CLIENT_SECRET=your_osm_client_secret
OSM_REDIRECT_URI=https://YOUR-APP-NAME.onrender.com/oauth/callback
```

Replace `YOUR-APP-NAME` with your actual Render app name (shown in dashboard).

Click **"Save Changes"** - it will redeploy automatically.

### 4️⃣ Update OSM OAuth (30 seconds)

1. Go to https://www.openstreetmap.org/oauth2/applications
2. Edit your application
3. Update **Redirect URIs** to:
   ```
   https://YOUR-APP-NAME.onrender.com/oauth/callback
   ```
4. Save

### 5️⃣ Test! ✅

Visit: `https://YOUR-APP-NAME.onrender.com`

**First load takes 30-60 seconds (cold start) - this is normal!**

---

## 🎯 Next Steps

### Keep Your App Awake (Avoid Cold Starts)

Sign up for **UptimeRobot** (free): https://uptimerobot.com

1. Add a new monitor
2. Monitor Type: HTTP(s)
3. URL: `https://YOUR-APP-NAME.onrender.com`
4. Monitoring Interval: 5 minutes
5. Save

This pings your app every 5 minutes to keep it warm!

---

## ⚠️ Important: Data Persistence

**Your notes, teams, and uploaded images will disappear when Render restarts your app.**

This is because Render's free tier uses **ephemeral storage**.

### Solutions:

**Option 1: Accept It** (Good for testing)
- Just use it for viewing changesets
- Don't rely on saved notes/teams

**Option 2: Add Database** (15 min setup)
- I can help you add PostgreSQL (free on Render)
- Your data will persist forever

Let me know if you want Option 2! Just say "add database" and I'll set it up.

---

## 🆘 Troubleshooting

**App won't load?**
- Wait 60 seconds for first cold start
- Check Render **Logs** tab for errors

**Can't login with OSM?**
- Verify redirect URI matches exactly
- Check environment variables are set

**App keeps sleeping?**
- Set up UptimeRobot monitoring
- Or upgrade to $7/month paid plan

---

## 📞 Need Help?

Check the full guide: `DEPLOYMENT.md`

Or share your error message and I'll help! 🚀

