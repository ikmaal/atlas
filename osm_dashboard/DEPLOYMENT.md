# 🚀 Deploying OSM Dashboard to Railway

This guide will help you deploy your OpenStreetMap Dashboard to Railway.

## 📋 Prerequisites

1. A [Railway account](https://railway.app) (free tier available)
2. Your code pushed to a GitHub repository
3. Git installed on your computer

## 🎯 Quick Deployment Steps

### Step 1: Push Code to GitHub

If you haven't already, initialize git and push to GitHub:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Prepare for Railway deployment"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git push -u origin main
```

### Step 2: Deploy to Railway

1. **Go to [Railway.app](https://railway.app)**
2. **Click "Start a New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Authorize Railway** to access your GitHub account
5. **Select your OSM Dashboard repository**
6. Railway will automatically:
   - Detect it's a Python/Flask app
   - Install dependencies from `requirements.txt`
   - Use the `Procfile` to start the app
   - Assign a public URL

### Step 3: Configure Environment Variables (Optional)

If you want to add environment variables:

1. Click on your deployed project
2. Go to "Variables" tab
3. Add any needed variables:
   - `SECRET_KEY`: Your Flask secret key (Railway generates one automatically)
   - `OSM_CLIENT_ID`: Your OSM OAuth client ID (if using OAuth)
   - `OSM_CLIENT_SECRET`: Your OSM OAuth secret (if using OAuth)

### Step 4: Get Your Public URL

1. Go to "Settings" tab
2. Under "Domains", you'll see your Railway URL (e.g., `your-app.up.railway.app`)
3. Click "Generate Domain" if not already generated

## 🔧 Files Created for Deployment

- ✅ `requirements.txt` - Python dependencies (updated with gunicorn)
- ✅ `Procfile` - Tells Railway how to run your app
- ✅ `railway.toml` - Railway-specific configuration
- ✅ `runtime.txt` - Specifies Python version
- ✅ `.gitignore` - Files to exclude from git
- ✅ `app.py` - Updated to use environment variables

## 🎨 Custom Domain (Optional)

To use your own domain:

1. Go to "Settings" → "Domains"
2. Click "Custom Domain"
3. Add your domain
4. Configure DNS records as shown

## 📊 Monitoring Your App

Railway provides:
- **Logs**: View real-time logs in the "Deployments" tab
- **Metrics**: CPU, memory, and network usage
- **Deployments**: History of all deployments

## 🔄 Updating Your App

To deploy updates:

```bash
# Make your changes
git add .
git commit -m "Your update message"
git push

# Railway automatically redeploys!
```

## 💰 Pricing

Railway offers:
- **Free Trial**: $5 credit (enough for ~1 month)
- **Hobby Plan**: $5/month for 500 hours
- **Pro Plan**: $20/month for unlimited usage

## 🐛 Troubleshooting

### App won't start?
- Check logs in Railway dashboard
- Verify all dependencies are in `requirements.txt`
- Make sure `Procfile` is correctly formatted

### OAuth not working?
- Update your OSM OAuth application callback URL to your Railway domain
- Add environment variables for `OSM_CLIENT_ID` and `OSM_CLIENT_SECRET`

### Session issues?
- Railway's filesystem is ephemeral
- Consider using a database for sessions in production
- Or use Railway's Redis addon

## 🎉 Success!

Your OSM Dashboard is now live! Share your Railway URL with your team.

Example: `https://osm-dashboard.up.railway.app`

## 📞 Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- OSM Dashboard Issues: GitHub Issues on your repo

