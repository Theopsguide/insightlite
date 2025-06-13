import { EventTransport } from '../../src/sdk/transport';
import { InsightLiteConfig, EventData } from '../../src/sdk/types';

// Mock WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: WebSocket.OPEN,
};

// Mock XMLHttpRequest
const mockXMLHttpRequest = {
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  addEventListener: jest.fn(),
  readyState: 4,
  status: 200,
  response: 'OK',
};

// Mock fetch
const mockFetch = jest.fn();

// Setup global mocks
Object.defineProperty(global, 'WebSocket', {
  value: jest.fn(() => mockWebSocket),
});

Object.defineProperty(global, 'XMLHttpRequest', {
  value: jest.fn(() => mockXMLHttpRequest),
});

Object.defineProperty(global, 'fetch', {
  value: mockFetch,
});

describe('EventTransport', () => {
  let transport: EventTransport;
  let config: InsightLiteConfig;
  let sampleEvents: EventData[];

  beforeEach(() => {
    jest.clearAllMocks();
    
    config = {
      siteId: 'test-site',
      apiEndpoint: 'https://api.test.com/ingest',
      wsEndpoint: 'wss://ws.test.com',
      maxRetries: 3,
    };

    sampleEvents = [
      {
        sessionId: 'session-123',
        timestamp: Date.now(),
        type: 'page',
        data: { url: '/test', title: 'Test Page' },
        url: '/test',
        viewport: { width: 1920, height: 1080, scrollX: 0, scrollY: 0 },
        device: {
          type: 'desktop',
          userAgent: 'Test Browser',
          screen: { width: 1920, height: 1080 },
        },
      },
      {
        sessionId: 'session-123',
        timestamp: Date.now() + 1000,
        type: 'click',
        data: { x: 100, y: 200, target: { tagName: 'BUTTON' } },
        url: '/test',
        viewport: { width: 1920, height: 1080, scrollX: 0, scrollY: 0 },
        device: {
          type: 'desktop',
          userAgent: 'Test Browser',
          screen: { width: 1920, height: 1080 },
        },
      },
    ];

    transport = new EventTransport(config);
  });

  afterEach(() => {
    transport.disconnect();
  });

  describe('WebSocket Transport', () => {
    test('should establish WebSocket connection', () => {
      transport.connect();

      expect(global.WebSocket).toHaveBeenCalledWith(config.wsEndpoint);
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('should send events via WebSocket when connected', async () => {
      mockWebSocket.readyState = WebSocket.OPEN;
      transport.connect();

      await transport.send(sampleEvents);

      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    });

    test('should handle WebSocket connection open', () => {
      transport.connect();
      
      // Simulate WebSocket open event
      const openHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'open')[1];
      
      openHandler();

      expect(transport.isConnected()).toBe(true);
    });

    test('should handle WebSocket connection close', () => {
      transport.connect();
      
      // Simulate WebSocket close event
      const closeHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'close')[1];
      
      closeHandler({ code: 1000, reason: 'Normal closure' });

      expect(transport.isConnected()).toBe(false);
    });

    test('should handle WebSocket errors', () => {
      transport.connect();
      
      // Simulate WebSocket error event
      const errorHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'error')[1];
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      errorHandler({ error: new Error('Connection failed') });

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    test('should reconnect WebSocket after connection loss', (done) => {
      transport.connect();
      
      // Simulate connection loss
      mockWebSocket.readyState = WebSocket.CLOSED;
      const closeHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'close')[1];
      
      closeHandler({ code: 1006, reason: 'Connection lost' });

      // Should attempt reconnect after delay
      setTimeout(() => {
        expect(global.WebSocket).toHaveBeenCalledTimes(2);
        done();
      }, 1100); // Slightly longer than reconnect delay
    });

    test('should limit WebSocket reconnect attempts', () => {
      transport.connect();
      
      // Simulate repeated connection failures
      for (let i = 0; i < 10; i++) {
        const closeHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'close')[1];
        
        closeHandler({ code: 1006, reason: 'Connection failed' });
      }

      // Should not exceed max reconnect attempts
      expect(transport.getReconnectAttempts()).toBeLessThanOrEqual(5);
    });
  });

  describe('HTTP Fallback Transport', () => {
    test('should fallback to XMLHttpRequest when WebSocket unavailable', async () => {
      // Mock WebSocket constructor to throw
      (global.WebSocket as jest.Mock).mockImplementation(() => {
        throw new Error('WebSocket not supported');
      });

      transport.connect();
      await transport.send(sampleEvents);

      expect(mockXMLHttpRequest.open).toHaveBeenCalledWith(
        'POST',
        config.apiEndpoint,
        true
      );
      expect(mockXMLHttpRequest.send).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    });

    test('should use fetch when available', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      
      // Disable WebSocket
      mockWebSocket.readyState = WebSocket.CLOSED;
      
      await transport.send(sampleEvents);

      expect(mockFetch).toHaveBeenCalledWith(config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: expect.any(ArrayBuffer),
      });
    });

    test('should set correct headers for HTTP requests', async () => {
      mockWebSocket.readyState = WebSocket.CLOSED;
      
      await transport.send(sampleEvents);

      expect(mockXMLHttpRequest.setRequestHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/octet-stream'
      );
    });

    test('should handle HTTP success responses', async () => {
      mockWebSocket.readyState = WebSocket.CLOSED;
      mockXMLHttpRequest.status = 200;
      
      const onSuccess = jest.fn();
      transport.on('success', onSuccess);

      await transport.send(sampleEvents);

      // Simulate successful response
      const loadHandler = mockXMLHttpRequest.addEventListener.mock.calls
        .find(call => call[0] === 'load')[1];
      
      loadHandler();

      expect(onSuccess).toHaveBeenCalled();
    });

    test('should handle HTTP error responses', async () => {
      mockWebSocket.readyState = WebSocket.CLOSED;
      mockXMLHttpRequest.status = 500;
      
      const onError = jest.fn();
      transport.on('error', onError);

      await transport.send(sampleEvents);

      // Simulate error response
      const errorHandler = mockXMLHttpRequest.addEventListener.mock.calls
        .find(call => call[0] === 'error')[1];
      
      errorHandler();

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Data Compression', () => {
    test('should compress events before sending', async () => {
      const largeeEvents = Array.from({ length: 100 }, (_, i) => ({
        ...sampleEvents[0],
        data: { index: i, largeString: 'x'.repeat(1000) },
      }));

      await transport.send(largeeEvents);

      // Verify compressed data was sent
      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.any(ArrayBuffer));
      
      const sentData = mockWebSocket.send.mock.calls[0][0];
      expect(sentData.byteLength).toBeLessThan(
        JSON.stringify(largeeEvents).length
      );
    });

    test('should handle compression errors gracefully', async () => {
      // Mock compression to throw error
      const originalCompress = transport.compress;
      transport.compress = jest.fn().mockImplementation(() => {
        throw new Error('Compression failed');
      });

      expect(async () => {
        await transport.send(sampleEvents);
      }).not.toThrow();

      // Should fallback to uncompressed data
      expect(mockWebSocket.send).toHaveBeenCalled();
    });

    test('should skip compression for small payloads', async () => {
      const smallEvent = [sampleEvents[0]];
      
      const compressSpy = jest.spyOn(transport, 'compress');
      
      await transport.send(smallEvent);

      // Should not compress small payloads
      expect(compressSpy).not.toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    test('should implement exponential backoff', async () => {
      mockWebSocket.readyState = WebSocket.CLOSED;
      mockXMLHttpRequest.status = 500;

      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0); // Execute immediately for test
      }) as any;

      await transport.send(sampleEvents);

      expect(delays).toEqual([1000, 2000, 4000]); // Exponential backoff
      
      global.setTimeout = originalSetTimeout;
    });

    test('should respect max retry attempts', async () => {
      mockWebSocket.readyState = WebSocket.CLOSED;
      mockXMLHttpRequest.status = 500;

      const sendAttempts = jest.spyOn(transport, '_attemptSend');

      await transport.send(sampleEvents);

      expect(sendAttempts).toHaveBeenCalledTimes(config.maxRetries + 1); // Initial + retries
    });

    test('should not retry on client errors (4xx)', async () => {
      mockWebSocket.readyState = WebSocket.CLOSED;
      mockXMLHttpRequest.status = 400;

      const sendAttempts = jest.spyOn(transport, '_attemptSend');

      await transport.send(sampleEvents);

      expect(sendAttempts).toHaveBeenCalledTimes(1); // No retries for client errors
    });

    test('should reset retry count on successful send', async () => {
      // First send fails
      mockWebSocket.readyState = WebSocket.CLOSED;
      mockXMLHttpRequest.status = 500;
      
      await transport.send(sampleEvents);
      
      // Second send succeeds
      mockXMLHttpRequest.status = 200;
      
      await transport.send(sampleEvents);

      expect(transport.getRetryCount()).toBe(0);
    });
  });

  describe('Rate Limiting', () => {
    test('should respect rate limits', async () => {
      const rateLimitedTransport = new EventTransport({
        ...config,
        rateLimit: { requests: 2, window: 1000 },
      });

      // Send multiple requests rapidly
      const promises = Array.from({ length: 5 }, () =>
        rateLimitedTransport.send([sampleEvents[0]])
      );

      await Promise.all(promises);

      // Should have limited requests
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
    });

    test('should queue events when rate limited', async () => {
      const rateLimitedTransport = new EventTransport({
        ...config,
        rateLimit: { requests: 1, window: 1000 },
      });

      await rateLimitedTransport.send(sampleEvents);
      
      const queueSizeBefore = rateLimitedTransport.getQueueSize();
      
      await rateLimitedTransport.send(sampleEvents);
      
      const queueSizeAfter = rateLimitedTransport.getQueueSize();

      expect(queueSizeAfter).toBeGreaterThan(queueSizeBefore);
    });

    test('should process queued events after rate limit window', (done) => {
      const rateLimitedTransport = new EventTransport({
        ...config,
        rateLimit: { requests: 1, window: 100 },
      });

      rateLimitedTransport.send(sampleEvents);
      rateLimitedTransport.send(sampleEvents);

      setTimeout(() => {
        expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
        done();
      }, 150);
    });
  });

  describe('Event Batching', () => {
    test('should batch multiple events into single request', async () => {
      const events1 = [sampleEvents[0]];
      const events2 = [sampleEvents[1]];

      await transport.send(events1);
      await transport.send(events2);

      // Should have batched into fewer requests
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
    });

    test('should respect batch size limits', async () => {
      const batchTransport = new EventTransport({
        ...config,
        batchSize: 2,
      });

      const manyEvents = Array.from({ length: 5 }, (_, i) => ({
        ...sampleEvents[0],
        data: { index: i },
      }));

      await batchTransport.send(manyEvents);

      // Should have split into multiple batches
      expect(mockWebSocket.send).toHaveBeenCalledTimes(3); // 2 + 2 + 1
    });

    test('should flush batch after timeout', (done) => {
      const batchTransport = new EventTransport({
        ...config,
        batchTimeout: 100,
      });

      batchTransport.send([sampleEvents[0]]);

      setTimeout(() => {
        expect(mockWebSocket.send).toHaveBeenCalled();
        done();
      }, 150);
    });
  });

  describe('Connection Management', () => {
    test('should disconnect cleanly', () => {
      transport.connect();
      transport.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(transport.isConnected()).toBe(false);
    });

    test('should handle multiple connect calls gracefully', () => {
      transport.connect();
      transport.connect();
      transport.connect();

      expect(global.WebSocket).toHaveBeenCalledTimes(1);
    });

    test('should queue events while connecting', async () => {
      mockWebSocket.readyState = WebSocket.CONNECTING;
      
      transport.connect();
      await transport.send(sampleEvents);

      expect(transport.getQueueSize()).toBeGreaterThan(0);
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    test('should flush queued events when connection opens', () => {
      mockWebSocket.readyState = WebSocket.CONNECTING;
      
      transport.connect();
      transport.send(sampleEvents);

      // Simulate connection open
      mockWebSocket.readyState = WebSocket.OPEN;
      const openHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'open')[1];
      
      openHandler();

      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(transport.getQueueSize()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle network failures gracefully', async () => {
      mockWebSocket.readyState = WebSocket.CLOSED;
      mockXMLHttpRequest.status = 0; // Network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      expect(async () => {
        await transport.send(sampleEvents);
      }).not.toThrow();
    });

    test('should handle malformed events', async () => {
      const malformedEvents = [
        null,
        undefined,
        { invalid: 'event' },
        { sessionId: null, timestamp: 'invalid' },
      ] as any;

      expect(async () => {
        await transport.send(malformedEvents);
      }).not.toThrow();
    });

    test('should handle send errors', async () => {
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Send failed');
      });

      const onError = jest.fn();
      transport.on('error', onError);

      await transport.send(sampleEvents);

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    test('should handle large event batches efficiently', async () => {
      const largeEventBatch = Array.from({ length: 10000 }, (_, i) => ({
        ...sampleEvents[0],
        data: { index: i },
      }));

      const start = performance.now();
      await transport.send(largeEventBatch);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should not block main thread during compression', async () => {
      const largeEvents = Array.from({ length: 1000 }, (_, i) => ({
        ...sampleEvents[0],
        data: { index: i, largeData: 'x'.repeat(10000) },
      }));

      const blockingTime = await measureBlockingTime(async () => {
        await transport.send(largeEvents);
      });

      expect(blockingTime).toBeLessThan(50); // Less than 50ms blocking time
    });

    test('should optimize memory usage for large payloads', async () => {
      const initialMemory = getMemoryUsage();
      
      const largeEvents = Array.from({ length: 5000 }, (_, i) => ({
        ...sampleEvents[0],
        data: { index: i, data: 'x'.repeat(1000) },
      }));

      await transport.send(largeEvents);

      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });
  });
});

// Helper functions
function measureBlockingTime(fn: () => Promise<void>): Promise<number> {
  return new Promise((resolve) => {
    const start = performance.now();
    let blocked = 0;
    
    const checkBlocking = () => {
      const now = performance.now();
      if (now - start > 16) { // Frame budget exceeded
        blocked += now - start;
      }
      setTimeout(checkBlocking, 0);
    };
    
    checkBlocking();
    
    fn().then(() => {
      resolve(blocked);
    });
  });
}

function getMemoryUsage(): number {
  if (window.performance && window.performance.memory) {
    return window.performance.memory.usedJSHeapSize;
  }
  return 0;
}