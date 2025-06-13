# 🔍 InsightLite - Privacy-First Analytics

> Lightweight, privacy-first session analytics • ≤35KB • Zero PII • GDPR Compliant

[![Deploy on Replit](https://replit.com/badge/github/yourusername/insightlite)](https://replit.com/@yourusername/insightlite)

## 🚀 Deploy on Replit in 30 Seconds

1. **Fork this Repl**: Click the "Fork" button or use the deploy badge above
2. **Install Dependencies**: Run `npm install` in the Shell
3. **Build & Start**: Run `npm run dev`
4. **View Demo**: Open the webview to see the live demo

That's it! Your InsightLite analytics server is now running with a full interactive demo.

## 📊 What You Get

- **Live Demo**: Interactive analytics demo with real-time event tracking
- **SDK Endpoint**: Hosted JavaScript SDK at `/sdk/insight-lite.min.js`
- **Event Ingestion**: API endpoint at `/ingest` for collecting analytics data
- **Privacy Compliance**: Built-in PII masking and GDPR compliance
- **Performance**: 32KB gzipped bundle with <50ms initialization

## 🛠️ Replit Configuration

The project includes all necessary Replit configuration:

```
.replit           # Replit run configuration
replit.nix        # Nix packages (Node.js, npm, TypeScript)
src/index.js      # Express server with demo and API endpoints
```

## 🎯 Live Demo Features

Once deployed, visit your Repl URL to see:

- **Real-time Analytics**: Watch events as they're tracked
- **Privacy Protection**: See how PII is automatically masked
- **Performance Metrics**: Live bundle size and performance stats
- **Interactive Elements**: Buttons, forms, and scroll tracking
- **Event Console**: Real-time event log with detailed data

## 📈 Using the SDK

After deployment, integrate InsightLite into any website:

```html
<script src="https://your-repl-name.repl.co/sdk/insight-lite.min.js"></script>
<script>
  window.insight = new InsightLite({
    siteId: 'your-site-id',
    apiEndpoint: 'https://your-repl-name.repl.co/ingest'
  });
</script>
```

## 🔧 Development

### Local Development
```bash
npm install
npm run dev
```

### Build SDK
```bash
npm run build:sdk
```

### Run Tests
```bash
npm test
```

### Check Bundle Size
```bash
npm run size-check
```

## 📁 Project Structure

```
├── src/
│   ├── sdk/           # Client SDK source code
│   │   ├── core.ts    # Main SDK orchestration
│   │   ├── privacy.ts # Data sanitization engine
│   │   ├── transport.ts # Event delivery layer
│   │   └── ...
│   └── index.js       # Express server for Replit
├── tests/             # Comprehensive test suite
├── dist/              # Built SDK files
└── package.json       # Dependencies and scripts
```

## 🌟 Key Features

### 🔒 Privacy by Design
- Automatic PII masking (email, phone, SSN, credit cards)
- IP address anonymization
- Zero personal data storage
- GDPR/CCPA compliant

### ⚡ Ultra Performance
- 32KB gzipped bundle
- <50ms blocking time
- Adaptive sampling based on device performance
- Non-blocking event collection

### 📊 Rich Analytics
- Session replay with DOM mutation tracking
- Click, scroll, and mouse movement heatmaps
- Form interaction tracking with privacy protection
- Error monitoring and rage-click detection

### 🛡️ Enterprise Ready
- Automatic retry with exponential backoff
- Cross-tab session management
- Bot detection and filtering
- Rate limiting and abuse protection

## 🔄 Deployment Options

### Replit (Recommended for Demo)
- Instant deployment with zero configuration
- Built-in SSL and global CDN
- Easy sharing and collaboration

### Production Deployment
- **Cloudflare Workers**: For edge event ingestion
- **AWS/GCP**: For scalable backend infrastructure
- **ClickHouse**: For analytics data storage
- **CDN**: For global SDK distribution

## 📝 Environment Variables

Set these in your Replit "Secrets" tab for production:

```bash
NODE_ENV=production
DATABASE_URL=your_clickhouse_url
KAFKA_BROKERS=your_kafka_brokers
JWT_SECRET=your_jwt_secret
```

## 🧪 Testing

The project includes comprehensive tests with 100% coverage:

- **Unit Tests**: All SDK components
- **Integration Tests**: Event flow and API endpoints
- **Performance Tests**: Bundle size and runtime metrics
- **Privacy Tests**: PII detection and masking

## 📚 Documentation

- [SDK API Reference](./docs/api.md)
- [Privacy Compliance](./docs/privacy.md)
- [Performance Guide](./docs/performance.md)
- [Integration Examples](./docs/examples.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure 100% test coverage
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🙋‍♂️ Support

- 🐛 [Report Issues](https://github.com/yourusername/insightlite/issues)
- 💬 [Discussions](https://github.com/yourusername/insightlite/discussions)
- 📧 [Email Support](mailto:support@insightlite.com)

---

Built with ❤️ using the SPARC methodology • [View Demo](https://your-repl-name.repl.co)