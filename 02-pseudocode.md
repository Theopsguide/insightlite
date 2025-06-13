# InsightLite - High-Level Architecture & Pseudocode

## System Components Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client SDK    │───▶│   Edge Ingest    │───▶│ Stream Pipeline │
│   (Browser)     │    │ (Cloudflare CDN) │    │  (Kafka/Kinesis)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
┌─────────────────┐    ┌──────────────────┐            ▼
│   Dashboard     │◀───│   GraphQL API    │    ┌─────────────────┐
│   (React SPA)   │    │   (Node.js)      │    │   Data Storage  │
└─────────────────┘    └──────────────────┘    │ (S3 + ClickHouse)│
                                               └─────────────────┘
```

## Core Algorithms & Business Logic

### 1. Client SDK Core Engine

```javascript
// Main InsightLite Client SDK
class InsightLiteSDK {
    constructor(config) {
        this.config = mergeConfig(defaultConfig, config)
        this.sessionId = generateUUID()
        this.eventBuffer = new CircularBuffer(1000)
        this.transport = new EventTransport(this.config)
        this.privacy = new PrivacyEngine()
        this.sampler = new AdaptiveSampler(this.config.sampleRate)
        
        if (this.sampler.shouldTrack()) {
            this.initialize()
        }
    }
    
    initialize() {
        this.setupEventListeners()
        this.startHeartbeat()
        this.transport.connect()
        this.trackPageView()
    }
    
    setupEventListeners() {
        // DOM Events
        document.addEventListener('click', this.handleClick.bind(this))
        document.addEventListener('scroll', this.handleScroll.bind(this))
        document.addEventListener('mousemove', this.handleMouseMove.bind(this))
        
        // Form Events
        document.addEventListener('focusin', this.handleFormFocus.bind(this))
        document.addEventListener('focusout', this.handleFormBlur.bind(this))
        
        // Error Tracking
        window.addEventListener('error', this.handleError.bind(this))
        window.addEventListener('unhandledrejection', this.handleError.bind(this))
        
        // SPA Navigation
        this.hookHistoryAPI()
    }
    
    track(eventType, data) {
        if (!this.sampler.shouldTrack()) return
        
        const event = {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            type: eventType,
            data: this.privacy.sanitize(data),
            url: window.location.pathname,
            viewport: getViewportInfo(),
            device: getDeviceInfo()
        }
        
        this.eventBuffer.push(event)
        this.maybeFlush()
    }
    
    maybeFlush() {
        if (this.eventBuffer.size() >= this.config.flushSize || 
            this.timeSinceLastFlush() > this.config.flushInterval) {
            this.flush()
        }
    }
    
    flush() {
        const events = this.eventBuffer.drain()
        const compressed = compressEvents(events)
        this.transport.send(compressed)
    }
}
```

### 2. Privacy Engine

```javascript
class PrivacyEngine {
    constructor() {
        this.inputSelectors = [
            'input[type="password"]',
            'input[type="email"]', 
            'input[name*="name"]',
            'input[name*="phone"]',
            '[data-sensitive]'
        ]
        this.maskChar = '●'
    }
    
    sanitize(data) {
        if (data.type === 'click' || data.type === 'input') {
            return this.sanitizeInteraction(data)
        }
        return data
    }
    
    sanitizeInteraction(data) {
        const element = data.target
        
        // Mask sensitive inputs
        if (this.isSensitiveInput(element)) {
            data.value = this.maskValue(data.value)
            data.target = this.anonymizeElement(element)
        }
        
        // Remove text content for privacy
        if (data.textContent) {
            data.textContent = this.replaceWithBlocks(data.textContent)
        }
        
        return data
    }
    
    isSensitiveInput(element) {
        return this.inputSelectors.some(selector => 
            element.matches(selector)
        )
    }
    
    maskValue(value) {
        return this.maskChar.repeat(value.length)
    }
    
    anonymizeElement(element) {
        return {
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            type: element.type,
            // Remove specific identifying attributes
            bounds: element.getBoundingClientRect()
        }
    }
    
    replaceWithBlocks(text) {
        // Replace text with generic blocks for canvas rendering
        return '█'.repeat(Math.ceil(text.length / 3))
    }
}
```

### 3. Event Transport Layer

```javascript
class EventTransport {
    constructor(config) {
        this.config = config
        this.websocket = null
        this.isConnected = false
        this.retryCount = 0
        this.backoffDelay = 1000
    }
    
    connect() {
        try {
            this.websocket = new WebSocket(this.config.wsEndpoint)
            this.websocket.onopen = this.handleOpen.bind(this)
            this.websocket.onclose = this.handleClose.bind(this)
            this.websocket.onerror = this.handleError.bind(this)
        } catch (error) {
            this.fallbackToXHR()
        }
    }
    
    send(data) {
        if (this.isConnected && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(data)
        } else {
            this.sendViaXHR(data)
        }
    }
    
    sendViaXHR(data) {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', this.config.httpEndpoint, true)
        xhr.setRequestHeader('Content-Type', 'application/octet-stream')
        
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status !== 200) {
                    this.handleRetry(data)
                }
            }
        }
        
        xhr.send(data)
    }
    
    handleRetry(data) {
        if (this.retryCount < this.config.maxRetries) {
            setTimeout(() => {
                this.retryCount++
                this.send(data)
            }, this.backoffDelay * Math.pow(2, this.retryCount))
        }
    }
}
```

### 4. Adaptive Sampling Algorithm

```javascript
class AdaptiveSampler {
    constructor(baseSampleRate = 0.2) { // 1 in 5 sessions
        this.baseSampleRate = baseSampleRate
        this.sessionDecision = null
        this.performanceMetrics = new PerformanceTracker()
    }
    
    shouldTrack() {
        if (this.sessionDecision === null) {
            this.sessionDecision = this.makeDecision()
        }
        return this.sessionDecision
    }
    
    makeDecision() {
        // Check performance constraints
        if (this.performanceMetrics.getCPUUsage() > 0.02) {
            return false // Skip if CPU usage too high
        }
        
        if (this.performanceMetrics.getMemoryUsage() > 2 * 1024 * 1024) {
            return false // Skip if memory usage > 2MB
        }
        
        // Apply sampling rate
        return Math.random() < this.getAdjustedSampleRate()
    }
    
    getAdjustedSampleRate() {
        const devicePerformance = this.getDevicePerformanceScore()
        const connectionQuality = this.getConnectionQuality()
        
        // Reduce sampling on lower-end devices
        const performanceAdjustment = devicePerformance < 0.5 ? 0.5 : 1.0
        const connectionAdjustment = connectionQuality < 0.5 ? 0.7 : 1.0
        
        return this.baseSampleRate * performanceAdjustment * connectionAdjustment
    }
    
    getDevicePerformanceScore() {
        const memory = navigator.deviceMemory || 4
        const cores = navigator.hardwareConcurrency || 4
        
        // Normalized score 0-1
        return Math.min((memory * cores) / 16, 1.0)
    }
    
    getConnectionQuality() {
        const connection = navigator.connection
        if (!connection) return 1.0
        
        const effectiveTypes = {
            'slow-2g': 0.1,
            '2g': 0.3,
            '3g': 0.6,
            '4g': 1.0
        }
        
        return effectiveTypes[connection.effectiveType] || 1.0
    }
}
```

## Data Processing Pipeline

### 5. Edge Ingest (Cloudflare Worker)

```javascript
// Cloudflare Worker for event ingestion
export default {
    async fetch(request, env) {
        if (request.method === 'POST') {
            return handleEventIngestion(request, env)
        }
        return handleWebSocketUpgrade(request)
    }
}

async function handleEventIngestion(request, env) {
    try {
        const eventData = await request.arrayBuffer()
        const decompressed = await decompressGzip(eventData)
        const events = parseEventBatch(decompressed)
        
        // Basic validation
        if (!validateEventBatch(events)) {
            return new Response('Invalid event data', { status: 400 })
        }
        
        // Privacy-first processing
        const anonymizedEvents = events.map(anonymizeEvent)
        
        // Forward to Kafka/Kinesis
        await publishToStream(anonymizedEvents, env.KAFKA_ENDPOINT)
        
        return new Response('OK', { status: 200 })
    } catch (error) {
        console.error('Ingestion error:', error)
        return new Response('Internal error', { status: 500 })
    }
}

function anonymizeEvent(event) {
    // Remove any potential PII
    delete event.userAgent
    delete event.ip
    
    // Hash session ID for additional privacy
    event.sessionId = hashSessionId(event.sessionId, event.siteId)
    
    // Truncate coordinates to reduce precision
    if (event.data && event.data.coordinates) {
        event.data.coordinates = truncateCoordinates(event.data.coordinates)
    }
    
    return event
}
```

### 6. Stream Processing Pipeline

```javascript
// Kafka Consumer for real-time processing
class EventProcessor {
    constructor() {
        this.kafka = new KafkaConsumer({
            groupId: 'insightlite-processor',
            topics: ['raw-events']
        })
        this.clickHouse = new ClickHouseClient()
        this.s3 = new S3Client()
    }
    
    async processEventBatch(events) {
        const processedEvents = []
        const heatmapUpdates = []
        
        for (const event of events) {
            // Process individual event
            const processed = await this.processEvent(event)
            processedEvents.push(processed)
            
            // Generate heatmap data
            if (this.isHeatmapEvent(event)) {
                const heatmapData = this.generateHeatmapData(event)
                heatmapUpdates.push(heatmapData)
            }
        }
        
        // Batch writes
        await Promise.all([
            this.clickHouse.insertBatch('events', processedEvents),
            this.updateHeatmapAggregates(heatmapUpdates),
            this.archiveToS3(processedEvents)
        ])
    }
    
    async processEvent(event) {
        return {
            session_id: event.sessionId,
            site_id: event.siteId,
            ts: new Date(event.timestamp),
            event_type: event.type,
            event_blob: JSON.stringify(event.data),
            device_type: this.detectDeviceType(event.viewport),
            url_path: this.normalizeUrlPath(event.url)
        }
    }
    
    generateHeatmapData(event) {
        if (event.type === 'click' || event.type === 'mousemove') {
            return {
                site_id: event.siteId,
                url_path: this.normalizeUrlPath(event.url),
                device_type: this.detectDeviceType(event.viewport),
                date_bucket: this.getDateBucket(event.timestamp),
                interaction_type: event.type === 'click' ? 'click' : 'move',
                coordinates: {
                    x: Math.floor(event.data.x / 10) * 10, // 10px grid
                    y: Math.floor(event.data.y / 10) * 10
                },
                count: 1
            }
        }
        return null
    }
}
```

## Test Strategy for 100% Coverage

### 7. Test Architecture

```javascript
// Test Suite Structure
describe('InsightLite SDK', () => {
    describe('Core Functionality', () => {
        test('initializes with default config')
        test('respects sampling rate')
        test('tracks page views automatically')
        test('buffers events correctly')
        test('flushes on interval and size limits')
    })
    
    describe('Privacy Engine', () => {
        test('masks sensitive input fields')
        test('anonymizes element attributes')
        test('replaces text with blocks')
        test('handles nested sensitive data')
    })
    
    describe('Event Transport', () => {
        test('prefers WebSocket when available')
        test('falls back to XHR gracefully')
        test('implements exponential backoff')
        test('handles connection failures')
    })
    
    describe('Performance', () => {
        test('stays under 35KB gzipped')
        test('blocking time < 50ms')
        test('memory usage < 2MB')
        test('CPU usage < 2%')
    })
    
    describe('Integration', () => {
        test('GTM integration works')
        test('SPA navigation tracking')
        test('cross-browser compatibility')
        test('CSP compliance')
    })
})

// Edge Cases & Error Handling
describe('Error Handling', () => {
    test('handles malformed events gracefully')
    test('recovers from network failures')
    test('degrades performance under load')
    test('respects rate limits')
})
```

### 8. Mock Test Data

```javascript
// Test Data Generation
class TestDataGenerator {
    generateSessionData() {
        return {
            sessionId: 'test-session-123',
            siteId: 'test-site',
            events: [
                this.generatePageViewEvent(),
                this.generateClickEvent(),
                this.generateScrollEvent(),
                this.generateErrorEvent()
            ]
        }
    }
    
    generateClickEvent() {
        return {
            type: 'click',
            timestamp: Date.now(),
            data: {
                x: 100,
                y: 200,
                target: {
                    tagName: 'BUTTON',
                    className: 'btn-primary',
                    textContent: 'Click Me'
                }
            },
            url: '/test-page',
            viewport: { width: 1920, height: 1080 }
        }
    }
}

// Performance Benchmarks
describe('Performance Benchmarks', () => {
    test('bundle size verification', async () => {
        const bundleSize = await getBundleSize('./dist/insight-lite.min.js')
        expect(bundleSize.gzipped).toBeLessThan(35 * 1024) // 35KB
    })
    
    test('initialization performance', () => {
        const start = performance.now()
        new InsightLiteSDK({ siteId: 'test' })
        const end = performance.now()
        expect(end - start).toBeLessThan(50) // 50ms
    })
})
```

This pseudocode provides the foundation for implementing InsightLite with complete test coverage and adherence to all performance requirements.