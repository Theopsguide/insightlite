# 🚀 Deploy InsightLite on Replit

## Quick Deploy (30 seconds)

### Option 1: Fork from GitHub
1. Go to [Replit](https://replit.com)
2. Click "Create Repl" → "Import from GitHub"
3. Paste your GitHub repository URL
4. Click "Import from GitHub"

### Option 2: Upload Project
1. Go to [Replit](https://replit.com)
2. Click "Create Repl" → "Upload folder"
3. Upload the entire InsightLite project folder
4. Select "Node.js" as the template

## 🔧 Setup Steps

### 1. Install Dependencies
In the Replit Shell, run:
```bash
npm install
```

### 2. Build the SDK
```bash
npm run build:sdk
```

### 3. Start the Server
```bash
npm run dev
```

### 4. View Your Demo
Click the "Open in a new tab" button in the webview panel.

## 🌐 Your Live Endpoints

Once deployed, you'll have these endpoints:

- **Demo**: `https://your-repl-name.replit.app/`
- **SDK**: `https://your-repl-name.replit.app/sdk/insight-lite.min.js`
- **API**: `https://your-repl-name.replit.app/ingest`
- **Health**: `https://your-repl-name.replit.app/health`

## 📋 Configuration Files

The project includes all necessary Replit configuration:

### `.replit`
```
run = "npm run dev"
entrypoint = "src/index.js"

[deployment]
run = ["sh", "-c", "npm run build && npm start"]
deploymentTarget = "cloudrun"
```

### `replit.nix`
```nix
{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.npm-9_x
    pkgs.nodePackages.typescript
  ];
}
```

## 🔐 Environment Variables (Optional)

For production features, add these in the "Secrets" tab:

```bash
NODE_ENV=production
DATABASE_URL=your_clickhouse_connection
KAFKA_BROKERS=your_kafka_brokers
JWT_SECRET=your_jwt_secret_key
```

## 📊 Demo Features

Your deployed demo includes:

### Interactive Analytics Demo
- ✅ Real-time event tracking visualization
- ✅ Privacy protection demonstration
- ✅ Performance metrics display
- ✅ Interactive elements (buttons, forms, scroll)
- ✅ Live event console with JSON data

### SDK Integration Example
```html
<script src="https://your-repl-name.replit.app/sdk/insight-lite.min.js"></script>
<script>
  window.insight = new InsightLite({
    siteId: 'your-site-id',
    apiEndpoint: 'https://your-repl-name.replit.app/ingest',
    debug: true
  });
</script>
```

## 🎯 Testing the Deployment

### 1. Verify SDK Loading
Open browser dev tools and check:
- SDK loads without errors
- Bundle size is ≤35KB
- No console errors

### 2. Test Event Tracking
- Click demo buttons
- Fill out forms
- Scroll the page
- Watch events appear in real-time

### 3. Check API Endpoints
```bash
curl https://your-repl-name.replit.app/health
```

## 🔄 Continuous Deployment

Replit automatically redeploys when you:
1. Push changes to connected GitHub repo
2. Edit files directly in Replit
3. Use the "Deploy" button for production

## 🚀 Scaling to Production

### From Replit to Production:

1. **Export Your Code**
   - Download project from Replit
   - Push to your GitHub repository

2. **Choose Production Platform**
   - **Vercel/Netlify**: For SDK hosting
   - **Railway/Render**: For API backend
   - **Cloudflare Workers**: For edge computing

3. **Add Production Services**
   - **ClickHouse**: Analytics database
   - **Kafka/Redis**: Event streaming
   - **CDN**: Global SDK distribution

## 🛠️ Troubleshooting

### Common Issues:

**SDK Not Building**
```bash
npm install
npm run build:sdk
```

**Port Already in Use**
```bash
pkill -f node
npm run dev
```

**Dependencies Missing**
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📱 Mobile Testing

Test your deployed analytics on mobile:
1. Open demo URL on phone
2. Interact with elements
3. Verify responsive design
4. Check event tracking accuracy

## 🔍 Monitoring

Monitor your Replit deployment:
- **Logs**: Check Replit console for errors
- **Usage**: Monitor in Replit dashboard
- **Performance**: Use browser dev tools
- **Uptime**: Set up external monitoring

## 🎉 Next Steps

After successful Replit deployment:

1. **Share Your Demo**: Send the live URL to stakeholders
2. **Integrate on Your Site**: Use the hosted SDK
3. **Collect Feedback**: Monitor real user interactions
4. **Scale Up**: Move to production infrastructure when ready

## 💡 Pro Tips

- **Use Always On**: Keep your Repl running 24/7
- **Enable Deployments**: Use Replit's deployment features
- **Custom Domain**: Add your own domain in settings
- **Secrets Management**: Use Replit's secrets for API keys
- **Version Control**: Connect to GitHub for code backup

Your InsightLite analytics platform is now live! 🎊