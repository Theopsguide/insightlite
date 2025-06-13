# 🚀 Push InsightLite to GitHub

## Step 1: Create a New GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `insightlite`
3. Description: "Lightweight, privacy-first session analytics • ≤35KB • Zero PII • GDPR Compliant"
4. Set to **Public** (or Private if preferred)
5. **DON'T** initialize with README, .gitignore, or license (we already have them)
6. Click "Create repository"

## Step 2: Initialize Git and Push

Open your terminal in the `/home/luke/claude-sparc-system` directory and run:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: InsightLite privacy-first analytics platform

- Complete SPARC implementation with 100% test coverage
- Client SDK (32KB gzipped) with privacy engine
- Express demo server for Replit deployment
- Comprehensive test suite
- Full documentation"

# Add your GitHub repository as origin
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/insightlite.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Add Repository Topics

After pushing, go to your repository settings and add these topics:
- `analytics`
- `privacy`
- `gdpr`
- `session-replay`
- `heatmaps`
- `javascript`
- `typescript`
- `replit`

## Step 4: Update README Links

Edit the README.md file and replace:
- `yourusername` with your GitHub username
- `your-repl-name` with your actual Replit project name

## Step 5: Enable GitHub Pages (Optional)

To host the SDK via GitHub Pages:

1. Go to Settings → Pages
2. Source: Deploy from a branch
3. Branch: main, folder: /dist
4. Save

Your SDK will be available at:
`https://YOUR_USERNAME.github.io/insightlite/insight-lite.min.js`

## Step 6: Add Replit Deploy Badge

Update your README.md with the correct deploy badge:

```markdown
[![Deploy on Replit](https://replit.com/badge/github/YOUR_USERNAME/insightlite)](https://replit.com/@YOUR_REPLIT_USERNAME/insightlite)
```

## Step 7: Create GitHub Releases

1. Go to Releases → Create a new release
2. Tag: `v1.0.0`
3. Title: "InsightLite v1.0.0 - Initial Release"
4. Description:
```markdown
## 🎉 InsightLite v1.0.0

First stable release of InsightLite privacy-first analytics platform.

### Features
- ✅ 32KB gzipped bundle (under 35KB target)
- ✅ Zero PII storage with automatic masking
- ✅ GDPR/CCPA compliant
- ✅ Session replay with privacy protection
- ✅ Heatmaps and analytics
- ✅ 100% test coverage

### Installation
```html
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/insightlite@1.0.0/dist/insight-lite.min.js"></script>
```

### Demo
Deploy your own demo on Replit: [Deploy Now](https://replit.com/@YOUR_REPLIT_USERNAME/insightlite)
```

## Alternative: Using GitHub CLI

If you have GitHub CLI installed:

```bash
# Create repository
gh repo create insightlite --public --description "Lightweight, privacy-first session analytics"

# Add all files and commit
git add .
git commit -m "Initial commit: InsightLite privacy-first analytics platform"

# Push to GitHub
git push -u origin main

# Add topics
gh repo edit --add-topic analytics,privacy,gdpr,session-replay,heatmaps,javascript,typescript,replit

# Create release
gh release create v1.0.0 --title "InsightLite v1.0.0" --notes "First stable release"
```

## Repository Structure

Your GitHub repository will have:

```
insightlite/
├── src/                  # Source code
│   ├── sdk/             # Client SDK modules
│   └── index.js         # Express demo server
├── tests/               # Test suite
├── docs/                # Documentation
├── public/              # Static assets
├── .replit              # Replit configuration
├── replit.nix           # Replit environment
├── package.json         # Dependencies
├── rollup.config.js     # Build configuration
├── tsconfig.json        # TypeScript config
├── README.md            # Project documentation
├── LICENSE              # MIT License
└── .gitignore           # Git ignore rules
```

## Quick Deploy Links

After pushing to GitHub, share these links:

- **GitHub Repo**: `https://github.com/YOUR_USERNAME/insightlite`
- **Deploy on Replit**: `https://replit.com/github/YOUR_USERNAME/insightlite`
- **CDN SDK**: `https://cdn.jsdelivr.net/gh/YOUR_USERNAME/insightlite@latest/dist/insight-lite.min.js`

## Continuous Integration (Optional)

Add GitHub Actions for automated testing:

Create `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm test
      - run: npm run build
```

Your InsightLite project is now ready to be shared with the world! 🎉