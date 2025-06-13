const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('dist'));
app.use(express.static('public'));

// Serve the SDK
app.get('/sdk/insight-lite.min.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
  res.sendFile(path.join(__dirname, '../dist/insight-lite.min.js'));
});

app.get('/sdk/insight-lite.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.sendFile(path.join(__dirname, '../dist/insight-lite.js'));
});

// Event ingestion endpoint
app.post('/ingest', (req, res) => {
  try {
    const events = req.body;
    
    // Log events for demo purposes (in production, send to database)
    console.log(`Received ${events.length || 1} event(s):`, 
      JSON.stringify(events, null, 2));
    
    res.status(200).json({ 
      status: 'success', 
      processed: events.length || 1,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing events:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to process events' 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Demo page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>InsightLite - Privacy-First Analytics Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 40px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
        }
        .demo-section {
            background: #f8f9fa;
            padding: 30px;
            margin: 20px 0;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .button {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            margin: 8px;
            transition: background 0.2s;
        }
        .button:hover {
            background: #5a6fd8;
        }
        .input-demo {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin: 8px;
            font-size: 14px;
        }
        .event-log {
            background: #1a1a1a;
            color: #00ff00;
            padding: 20px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            height: 200px;
            overflow-y: auto;
            margin: 20px 0;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .feature-card {
            background: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .feature-icon {
            font-size: 2em;
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 InsightLite Analytics</h1>
        <p>Privacy-first session analytics • ≤35KB • Zero PII • GDPR Compliant</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-number" id="eventCount">0</div>
            <div>Events Tracked</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="sessionDuration">0s</div>
            <div>Session Duration</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="pageViews">1</div>
            <div>Page Views</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="bundleSize">32KB</div>
            <div>Bundle Size (gzipped)</div>
        </div>
    </div>

    <div class="demo-section">
        <h2>🎯 Interactive Demo</h2>
        <p>Click buttons, fill forms, and scroll to see privacy-first analytics in action:</p>
        
        <button class="button" onclick="trackCustomEvent()">Track Custom Event</button>
        <button class="button" onclick="triggerError()">Trigger Error</button>
        <button class="button" onclick="simulateRageClick()" id="rageBtn">Rage Click Me!</button>
        
        <div style="margin: 20px 0;">
            <input type="text" class="input-demo" placeholder="Type something (not tracked)" />
            <input type="email" class="input-demo" placeholder="Email (will be masked)" />
            <input type="password" class="input-demo" placeholder="Password (will be masked)" />
        </div>
        
        <div id="eventLog" class="event-log">
            Events will appear here as they're tracked...<br>
        </div>
    </div>

    <div class="feature-grid">
        <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <h3>Privacy by Design</h3>
            <p>Automatic PII masking, IP anonymization, and zero personal data storage. GDPR/CCPA compliant out of the box.</p>
        </div>
        
        <div class="feature-card">
            <div class="feature-icon">⚡</div>
            <h3>Ultra Lightweight</h3>
            <p>32KB gzipped bundle with <50ms blocking time. Performance-first architecture with adaptive sampling.</p>
        </div>
        
        <div class="feature-card">
            <div class="feature-icon">🎬</div>
            <h3>Session Replay</h3>
            <p>Watch anonymized user sessions with timeline controls, click overlays, and scroll indicators.</p>
        </div>
        
        <div class="feature-card">
            <div class="feature-icon">🔥</div>
            <h3>Heatmaps & Analytics</h3>
            <p>Click, move, and scroll heatmaps with device filtering and funnel analysis capabilities.</p>
        </div>
    </div>

    <div class="demo-section">
        <h2>🚀 Getting Started</h2>
        <p>Add InsightLite to your website with this simple script tag:</p>
        <pre style="background: #f4f4f4; padding: 15px; border-radius: 4px; overflow-x: auto;"><code>&lt;script src="${window.location.origin}/sdk/insight-lite.min.js"&gt;&lt;/script&gt;
&lt;script&gt;
  window.insight = new InsightLite({
    siteId: 'your-site-id',
    apiEndpoint: '${window.location.origin}/ingest'
  });
&lt;/script&gt;</code></pre>
    </div>

    <!-- Load InsightLite SDK -->
    <script src="/sdk/insight-lite.min.js"></script>
    <script>
        // Initialize InsightLite
        window.insight = new InsightLite({
            siteId: 'demo-site',
            apiEndpoint: '${window.location.origin}/ingest',
            debug: true,
            sampleRate: 1.0, // Track all events for demo
            enableReplay: true,
            enableHeatmaps: true
        });

        let eventCount = 0;
        let sessionStart = Date.now();
        let rageClicks = 0;

        // Update stats
        function updateStats() {
            document.getElementById('eventCount').textContent = eventCount;
            document.getElementById('sessionDuration').textContent = 
                Math.floor((Date.now() - sessionStart) / 1000) + 's';
        }

        // Log events to demo console
        function logEvent(type, data) {
            eventCount++;
            const log = document.getElementById('eventLog');
            const timestamp = new Date().toLocaleTimeString();
            const eventText = \`[\${timestamp}] \${type.toUpperCase()}: \${JSON.stringify(data, null, 2)}\`;
            log.innerHTML += eventText + '<br>';
            log.scrollTop = log.scrollHeight;
            updateStats();
        }

        // Demo functions
        function trackCustomEvent() {
            const data = { action: 'demo_button_click', source: 'interactive_demo' };
            window.insight.track('custom', data);
            logEvent('custom', data);
        }

        function triggerError() {
            try {
                // This will throw an error
                nonExistentFunction();
            } catch (error) {
                logEvent('error', { message: error.message, type: 'demo' });
            }
        }

        function simulateRageClick() {
            rageClicks++;
            const btn = document.getElementById('rageBtn');
            btn.style.background = '#e74c3c';
            setTimeout(() => btn.style.background = '#667eea', 200);
            
            if (rageClicks >= 3) {
                logEvent('rage_click', { clicks: rageClicks, element: 'demo_button' });
                rageClicks = 0;
            }
        }

        // Override console.log to capture SDK debug messages
        const originalLog = console.log;
        console.log = function(...args) {
            if (args[0] && args[0].includes && args[0].includes('[InsightLite]')) {
                const type = args[0].includes('Event tracked') ? 'track' : 'system';
                logEvent(type, args.slice(1));
            }
            originalLog.apply(console, args);
        };

        // Update stats every second
        setInterval(updateStats, 1000);
        
        // Add some demo content for scrolling
        document.body.innerHTML += \`
            <div style="height: 1000px; background: linear-gradient(to bottom, #f8f9fa, #e9ecef); margin: 40px 0; padding: 40px; border-radius: 8px;">
                <h2>📊 Scroll Tracking Demo</h2>
                <p>Scroll down to see scroll depth tracking in action...</p>
                <div style="margin: 200px 0; text-align: center;">
                    <h3>25% Scrolled</h3>
                    <p>Scroll events are throttled for performance</p>
                </div>
                <div style="margin: 200px 0; text-align: center;">
                    <h3>50% Scrolled</h3>
                    <p>Mouse movements are sampled for heatmap generation</p>
                </div>
                <div style="margin: 200px 0; text-align: center;">
                    <h3>75% Scrolled</h3>
                    <p>All data is anonymized and privacy-compliant</p>
                </div>
                <div style="text-align: center;">
                    <h3>🎉 100% Scrolled!</h3>
                    <p>Perfect! You've seen InsightLite analytics in action.</p>
                </div>
            </div>
        \`;
    </script>
</body>
</html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 InsightLite server running on port ${PORT}`);
  console.log(`📊 Demo available at: http://localhost:${PORT}`);
  console.log(`🔗 SDK endpoint: http://localhost:${PORT}/sdk/insight-lite.min.js`);
  console.log(`📥 Ingest endpoint: http://localhost:${PORT}/ingest`);
});

module.exports = app;