import { InsightLiteSDK } from '../../src/sdk/core';
import { InsightLiteConfig } from '../../src/sdk/types';

// Mock DOM APIs
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

// Mock WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  readyState: WebSocket.OPEN,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

// Mock XMLHttpRequest
const mockXMLHttpRequest = {
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  addEventListener: jest.fn(),
  readyState: 4,
  status: 200,
};

// Setup global mocks
Object.defineProperty(global, 'document', {
  value: {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
  },
});

Object.defineProperty(global, 'window', {
  value: {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    location: { pathname: '/test' },
    localStorage: mockLocalStorage,
    WebSocket: jest.fn(() => mockWebSocket),
    XMLHttpRequest: jest.fn(() => mockXMLHttpRequest),
    navigator: {
      userAgent: 'Mozilla/5.0 (Test Browser)',
      deviceMemory: 8,
      hardwareConcurrency: 4,
      connection: { effectiveType: '4g' },
    },
    screen: { width: 1920, height: 1080 },
    innerWidth: 1920,
    innerHeight: 1080,
    scrollX: 0,
    scrollY: 0,
    performance: {
      now: jest.fn(() => Date.now()),
      memory: { usedJSHeapSize: 1024 * 1024 },
    },
  },
});

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid-123'),
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

describe('InsightLiteSDK Core', () => {
  let sdk: InsightLiteSDK;
  let config: InsightLiteConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      siteId: 'test-site',
      apiEndpoint: 'https://api.test.com',
      wsEndpoint: 'wss://ws.test.com',
      sampleRate: 1.0, // Always track in tests
      flushInterval: 1000,
      flushSize: 10,
      maxRetries: 3,
      enableReplay: true,
      enableHeatmaps: true,
      privacyMode: 'balanced',
      debug: true,
    };
  });

  afterEach(() => {
    if (sdk) {
      sdk.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default config', () => {
      sdk = new InsightLiteSDK({ siteId: 'test-site' });
      
      expect(sdk).toBeDefined();
      expect(sdk.getConfig()).toMatchObject({
        siteId: 'test-site',
        sampleRate: 0.2,
        flushInterval: 5000,
        flushSize: 50,
        maxRetries: 3,
        enableReplay: true,
        enableHeatmaps: true,
        privacyMode: 'balanced',
      });
    });

    test('should merge custom config with defaults', () => {
      sdk = new InsightLiteSDK(config);
      
      expect(sdk.getConfig()).toMatchObject(config);
    });

    test('should generate unique session ID', () => {
      sdk = new InsightLiteSDK(config);
      const sessionId = sdk.getSessionId();
      
      expect(sessionId).toBe('test-uuid-123');
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    test('should setup event listeners on initialization', () => {
      sdk = new InsightLiteSDK(config);
      
      expect(mockAddEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('focusin', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('focusout', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    test('should track initial page view', () => {
      const trackSpy = jest.spyOn(InsightLiteSDK.prototype, 'track');
      sdk = new InsightLiteSDK(config);
      
      expect(trackSpy).toHaveBeenCalledWith('page', {
        url: '/test',
        title: '',
        referrer: '',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Sampling', () => {
    test('should respect sampling rate', () => {
      // Test with 0% sampling
      const configNoSampling = { ...config, sampleRate: 0 };
      sdk = new InsightLiteSDK(configNoSampling);
      
      const trackSpy = jest.spyOn(sdk, 'track');
      sdk.track('test', { data: 'test' });
      
      expect(trackSpy).toHaveBeenCalled();
      expect(sdk.getEventCount()).toBe(0); // Should not track due to sampling
    });

    test('should track when sampling rate is 100%', () => {
      sdk = new InsightLiteSDK(config);
      
      sdk.track('test', { data: 'test' });
      
      expect(sdk.getEventCount()).toBe(2); // Page view + test event
    });

    test('should make consistent sampling decision per session', () => {
      sdk = new InsightLiteSDK(config);
      
      const shouldTrack1 = sdk.shouldTrackEvent();
      const shouldTrack2 = sdk.shouldTrackEvent();
      
      expect(shouldTrack1).toBe(shouldTrack2);
    });
  });

  describe('Event Tracking', () => {
    beforeEach(() => {
      sdk = new InsightLiteSDK(config);
    });

    test('should track custom events', () => {
      const eventData = { action: 'button_click', target: 'signup' };
      
      sdk.track('custom', eventData);
      
      const events = sdk.getBufferedEvents();
      const customEvent = events.find(e => e.type === 'custom');
      
      expect(customEvent).toBeDefined();
      expect(customEvent.data).toMatchObject(eventData);
      expect(customEvent.sessionId).toBe('test-uuid-123');
      expect(customEvent.timestamp).toBeGreaterThan(0);
    });

    test('should automatically track click events', () => {
      const clickEvent = new MouseEvent('click', {
        clientX: 100,
        clientY: 200,
        button: 0,
      });
      
      Object.defineProperty(clickEvent, 'target', {
        value: {
          tagName: 'BUTTON',
          className: 'btn-primary',
          id: 'signup-btn',
          textContent: 'Sign Up',
          getBoundingClientRect: () => ({ x: 100, y: 200 }),
        },
      });
      
      document.dispatchEvent(clickEvent);
      
      const events = sdk.getBufferedEvents();
      const clickEventData = events.find(e => e.type === 'click');
      
      expect(clickEventData).toBeDefined();
      expect(clickEventData.data).toMatchObject({
        x: 100,
        y: 200,
        button: 0,
        target: {
          tagName: 'BUTTON',
          className: 'btn-primary',
          id: 'signup-btn',
        },
      });
    });

    test('should track scroll events with throttling', (done) => {
      const scrollEvent = new Event('scroll');
      
      // Dispatch multiple scroll events rapidly
      for (let i = 0; i < 5; i++) {
        document.dispatchEvent(scrollEvent);
      }
      
      // Check after throttle delay
      setTimeout(() => {
        const events = sdk.getBufferedEvents();
        const scrollEvents = events.filter(e => e.type === 'scroll');
        
        // Should be throttled to fewer events
        expect(scrollEvents.length).toBeLessThan(5);
        expect(scrollEvents.length).toBeGreaterThan(0);
        done();
      }, 100);
    });

    test('should track mouse movement with sampling', () => {
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 250,
      });
      
      // Dispatch multiple mouse move events
      for (let i = 0; i < 10; i++) {
        document.dispatchEvent(mouseMoveEvent);
      }
      
      const events = sdk.getBufferedEvents();
      const mouseMoveEvents = events.filter(e => e.type === 'mousemove');
      
      // Should be sampled to fewer events
      expect(mouseMoveEvents.length).toBeLessThan(10);
    });

    test('should track form events', () => {
      const focusEvent = new FocusEvent('focusin');
      const input = document.createElement('input');
      input.type = 'email';
      input.name = 'email';
      input.value = 'test@example.com';
      
      Object.defineProperty(focusEvent, 'target', { value: input });
      
      document.dispatchEvent(focusEvent);
      
      const events = sdk.getBufferedEvents();
      const formEvent = events.find(e => e.type === 'form');
      
      expect(formEvent).toBeDefined();
      expect(formEvent.data.target.type).toBe('email');
      expect(formEvent.data.target.name).toBe('email');
      // Value should be masked for email fields
      expect(formEvent.data.target.value).toBe('●●●●●●●●●●●●●●●●');
    });

    test('should track error events', () => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Test error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
        error: new Error('Test error'),
      });
      
      window.dispatchEvent(errorEvent);
      
      const events = sdk.getBufferedEvents();
      const errorEventData = events.find(e => e.type === 'error');
      
      expect(errorEventData).toBeDefined();
      expect(errorEventData.data).toMatchObject({
        message: 'Test error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
      });
    });
  });

  describe('Event Buffering and Flushing', () => {
    beforeEach(() => {
      sdk = new InsightLiteSDK(config);
    });

    test('should buffer events until flush threshold', () => {
      // Track events but don't reach flush threshold
      for (let i = 0; i < 5; i++) {
        sdk.track('test', { index: i });
      }
      
      expect(sdk.getEventCount()).toBe(6); // 5 + initial page view
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    test('should auto-flush when buffer size reaches threshold', () => {
      // Track enough events to trigger flush
      for (let i = 0; i < 10; i++) {
        sdk.track('test', { index: i });
      }
      
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(sdk.getEventCount()).toBe(0); // Buffer should be cleared
    });

    test('should auto-flush after time interval', (done) => {
      sdk.track('test', { data: 'test' });
      
      // Wait for flush interval
      setTimeout(() => {
        expect(mockWebSocket.send).toHaveBeenCalled();
        expect(sdk.getEventCount()).toBe(0);
        done();
      }, 1100); // Slightly longer than flush interval
    });

    test('should manually flush events', async () => {
      sdk.track('test', { data: 'test' });
      
      await sdk.flush();
      
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(sdk.getEventCount()).toBe(0);
    });

    test('should compress events before sending', async () => {
      for (let i = 0; i < 5; i++) {
        sdk.track('test', { index: i, data: 'x'.repeat(100) });
      }
      
      await sdk.flush();
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    });
  });

  describe('Transport Layer', () => {
    beforeEach(() => {
      sdk = new InsightLiteSDK(config);
    });

    test('should prefer WebSocket when available', async () => {
      await sdk.flush();
      
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockXMLHttpRequest.send).not.toHaveBeenCalled();
    });

    test('should fallback to XHR when WebSocket fails', async () => {
      // Mock WebSocket failure
      mockWebSocket.readyState = WebSocket.CLOSED;
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('WebSocket closed');
      });
      
      await sdk.flush();
      
      expect(mockXMLHttpRequest.open).toHaveBeenCalledWith('POST', config.apiEndpoint, true);
      expect(mockXMLHttpRequest.send).toHaveBeenCalled();
    });

    test('should implement exponential backoff on retry', async () => {
      // Mock XHR failure
      mockXMLHttpRequest.status = 500;
      mockWebSocket.readyState = WebSocket.CLOSED;
      
      const delaySpy = jest.spyOn(global, 'setTimeout');
      
      sdk.track('test', { data: 'test' });
      await sdk.flush();
      
      // Should schedule retries with increasing delays
      expect(delaySpy).toHaveBeenCalledWith(expect.any(Function), 1000); // First retry
      expect(delaySpy).toHaveBeenCalledWith(expect.any(Function), 2000); // Second retry
    });

    test('should respect max retry limit', async () => {
      mockXMLHttpRequest.status = 500;
      mockWebSocket.readyState = WebSocket.CLOSED;
      
      sdk.track('test', { data: 'test' });
      
      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await sdk.flush();
      }
      
      // Should not exceed max retries
      expect(mockXMLHttpRequest.send).toHaveBeenCalledTimes(config.maxRetries);
    });
  });

  describe('Privacy Engine', () => {
    beforeEach(() => {
      sdk = new InsightLiteSDK(config);
    });

    test('should mask sensitive input fields', () => {
      const input = document.createElement('input');
      input.type = 'password';
      input.value = 'secret123';
      
      const focusEvent = new FocusEvent('focusin');
      Object.defineProperty(focusEvent, 'target', { value: input });
      
      document.dispatchEvent(focusEvent);
      
      const events = sdk.getBufferedEvents();
      const formEvent = events.find(e => e.type === 'form');
      
      expect(formEvent.data.target.value).toBe('●●●●●●●●●');
    });

    test('should anonymize element attributes', () => {
      const button = document.createElement('button');
      button.setAttribute('data-user-id', '12345');
      button.textContent = 'Personal Info';
      
      const clickEvent = new MouseEvent('click');
      Object.defineProperty(clickEvent, 'target', { value: button });
      
      document.dispatchEvent(clickEvent);
      
      const events = sdk.getBufferedEvents();
      const clickEventData = events.find(e => e.type === 'click');
      
      expect(clickEventData.data.target).not.toHaveProperty('data-user-id');
      expect(clickEventData.data.target.textContent).toBe('████████████');
    });

    test('should handle different privacy modes', () => {
      const strictConfig = { ...config, privacyMode: 'strict' as const };
      sdk.destroy();
      sdk = new InsightLiteSDK(strictConfig);
      
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'normal text';
      
      const focusEvent = new FocusEvent('focusin');
      Object.defineProperty(focusEvent, 'target', { value: input });
      
      document.dispatchEvent(focusEvent);
      
      const events = sdk.getBufferedEvents();
      const formEvent = events.find(e => e.type === 'form');
      
      // In strict mode, all input values should be masked
      expect(formEvent.data.target.value).toBe('●●●●●●●●●●●');
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(() => {
      sdk = new InsightLiteSDK(config);
    });

    test('should monitor CPU usage', () => {
      const metrics = sdk.getPerformanceMetrics();
      
      expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpuUsage).toBeLessThan(1);
    });

    test('should monitor memory usage', () => {
      const metrics = sdk.getPerformanceMetrics();
      
      expect(metrics.memoryUsage).toBeGreaterThan(0);
      expect(metrics.memoryUsage).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    });

    test('should throttle when performance degrades', () => {
      // Mock high CPU usage
      Object.defineProperty(window.performance, 'memory', {
        value: { usedJSHeapSize: 5 * 1024 * 1024 }, // 5MB
      });
      
      const initialSampleRate = sdk.getEffectiveSampleRate();
      
      // Should reduce sampling rate under load
      expect(initialSampleRate).toBeLessThan(config.sampleRate);
    });
  });

  describe('Session Management', () => {
    beforeEach(() => {
      sdk = new InsightLiteSDK(config);
    });

    test('should maintain session across page loads', () => {
      const sessionId1 = sdk.getSessionId();
      
      // Simulate page reload
      sdk.destroy();
      sdk = new InsightLiteSDK(config);
      
      const sessionId2 = sdk.getSessionId();
      
      expect(sessionId1).toBe(sessionId2);
    });

    test('should create new session after timeout', () => {
      const sessionId1 = sdk.getSessionId();
      
      // Mock session expiry
      const pastTime = Date.now() - (30 * 60 * 1000 + 1); // 30 minutes + 1ms ago
      mockLocalStorage.getItem.mockReturnValue(pastTime.toString());
      
      sdk.destroy();
      sdk = new InsightLiteSDK(config);
      
      const sessionId2 = sdk.getSessionId();
      
      expect(sessionId1).not.toBe(sessionId2);
    });

    test('should track session metadata', () => {
      const metadata = sdk.getSessionMetadata();
      
      expect(metadata).toMatchObject({
        sessionId: 'test-uuid-123',
        startTime: expect.any(Number),
        pageCount: 1,
        eventCount: expect.any(Number),
        deviceType: 'desktop',
      });
    });
  });

  describe('API Surface', () => {
    beforeEach(() => {
      sdk = new InsightLiteSDK(config);
    });

    test('should expose public API methods', () => {
      expect(typeof sdk.track).toBe('function');
      expect(typeof sdk.identify).toBe('function');
      expect(typeof sdk.flush).toBe('function');
      expect(typeof sdk.startReplay).toBe('function');
      expect(typeof sdk.stopReplay).toBe('function');
      expect(typeof sdk.destroy).toBe('function');
    });

    test('should allow identify calls', () => {
      sdk.identify({ plan: 'pro', company: 'Acme Inc' });
      
      const events = sdk.getBufferedEvents();
      const identifyEvent = events.find(e => e.type === 'identify');
      
      expect(identifyEvent).toBeDefined();
      expect(identifyEvent.data).toMatchObject({
        plan: 'pro',
        company: 'Acme Inc',
      });
    });

    test('should control session replay', () => {
      expect(sdk.isReplayActive()).toBe(false);
      
      sdk.startReplay();
      expect(sdk.isReplayActive()).toBe(true);
      
      sdk.stopReplay();
      expect(sdk.isReplayActive()).toBe(false);
    });

    test('should cleanup on destroy', () => {
      sdk.destroy();
      
      expect(mockRemoveEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      sdk = new InsightLiteSDK(config);
    });

    test('should handle malformed events gracefully', () => {
      expect(() => {
        sdk.track('test', null);
      }).not.toThrow();
      
      expect(() => {
        sdk.track('test', { circular: {} });
        // @ts-ignore
        sdk.track('test', { circular: { ref: sdk.track } });
      }).not.toThrow();
    });

    test('should handle network failures gracefully', async () => {
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Network error');
      });
      mockXMLHttpRequest.status = 0; // Network error
      
      expect(async () => {
        await sdk.flush();
      }).not.toThrow();
    });

    test('should handle invalid configuration gracefully', () => {
      expect(() => {
        new InsightLiteSDK({} as any);
      }).toThrow('siteId is required');
      
      expect(() => {
        new InsightLiteSDK({ siteId: '', sampleRate: -1 });
      }).toThrow();
    });
  });
});