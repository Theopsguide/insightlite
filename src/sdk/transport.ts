import { EventData, InsightLiteConfig } from './types';

interface TransportConfig {
  apiEndpoint: string;
  wsEndpoint: string;
  maxRetries: number;
  batchSize?: number;
  batchTimeout?: number;
  rateLimit?: {
    requests: number;
    window: number;
  };
}

interface QueuedEvent {
  events: EventData[];
  timestamp: number;
  retryCount: number;
}

export class EventTransport {
  private config: TransportConfig;
  private websocket: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventQueue: QueuedEvent[] = [];
  private batchQueue: EventData[] = [];
  private batchTimer: number | null = null;
  private rateLimitQueue: Array<{ timestamp: number; resolve: Function; reject: Function }> = [];
  private eventHandlers: Map<string, Function[]> = new Map();
  private retryCount = 0;

  constructor(config: InsightLiteConfig) {
    this.config = {
      apiEndpoint: config.apiEndpoint!,
      wsEndpoint: config.wsEndpoint!,
      maxRetries: config.maxRetries!,
      batchSize: 100,
      batchTimeout: 5000,
    };
  }

  public connect(): void {
    if (this.websocket?.readyState === WebSocket.OPEN || 
        this.websocket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      this.websocket = new WebSocket(this.config.wsEndpoint);
      
      this.websocket.addEventListener('open', this.handleWebSocketOpen.bind(this));
      this.websocket.addEventListener('close', this.handleWebSocketClose.bind(this));
      this.websocket.addEventListener('error', this.handleWebSocketError.bind(this));
      this.websocket.addEventListener('message', this.handleWebSocketMessage.bind(this));
    } catch (error) {
      console.error('[Transport] WebSocket creation failed:', error);
      this.fallbackToHttp();
    }
  }

  public disconnect(): void {
    if (this.websocket) {
      this.websocket.close(1000, 'Client disconnect');
      this.websocket = null;
    }
    
    this.isConnected = false;
    this.reconnectAttempts = 0;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  public async send(events: EventData[]): Promise<void> {
    if (!events || events.length === 0) {
      return;
    }

    // Apply rate limiting if configured
    if (this.config.rateLimit) {
      await this.checkRateLimit();
    }

    // Add to batch queue
    this.batchQueue.push(...events);

    // Process batch if size limit reached or force flush
    if (this.batchQueue.length >= (this.config.batchSize || 100)) {
      await this.processBatch();
    } else if (!this.batchTimer) {
      // Set timer for batch timeout
      this.batchTimer = window.setTimeout(() => {
        this.processBatch();
      }, this.config.batchTimeout || 5000);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    const batch = [...this.batchQueue];
    this.batchQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    await this.sendBatch(batch);
  }

  private async sendBatch(events: EventData[]): Promise<void> {
    const queuedEvent: QueuedEvent = {
      events,
      timestamp: Date.now(),
      retryCount: 0,
    };

    try {
      await this._attemptSend(queuedEvent);
      this.retryCount = 0; // Reset on success
      this.emit('success', { eventCount: events.length });
    } catch (error) {
      await this.handleSendError(queuedEvent, error);
    }
  }

  public async _attemptSend(queuedEvent: QueuedEvent): Promise<void> {
    const { events } = queuedEvent;
    
    // Validate events
    const validEvents = events.filter(this.validateEvent);
    if (validEvents.length === 0) {
      throw new Error('No valid events to send');
    }

    // Compress events
    const compressedData = await this.compressEvents(validEvents);

    // Try WebSocket first, fallback to HTTP
    if (this.isConnected && this.websocket?.readyState === WebSocket.OPEN) {
      await this.sendViaWebSocket(compressedData);
    } else {
      await this.sendViaHttp(compressedData);
    }
  }

  private async sendViaWebSocket(data: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not ready'));
        return;
      }

      try {
        this.websocket.send(data);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async sendViaHttp(data: ArrayBuffer): Promise<void> {
    // Try fetch first, fallback to XMLHttpRequest
    if (typeof fetch !== 'undefined') {
      return this.sendViaFetch(data);
    } else {
      return this.sendViaXHR(data);
    }
  }

  private async sendViaFetch(data: ArrayBuffer): Promise<void> {
    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: data,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private async sendViaXHR(data: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });
      
      xhr.addEventListener('timeout', () => {
        reject(new Error('Request timeout'));
      });

      xhr.open('POST', this.config.apiEndpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.timeout = 30000; // 30 second timeout
      xhr.send(data);
    });
  }

  private async handleSendError(queuedEvent: QueuedEvent, error: any): Promise<void> {
    const isRetryableError = this.isRetryableError(error);
    
    if (isRetryableError && queuedEvent.retryCount < this.config.maxRetries) {
      await this.retryWithBackoff(queuedEvent);
    } else {
      this.emit('error', { error, events: queuedEvent.events });
      console.error('[Transport] Failed to send events after retries:', error);
    }
  }

  private async retryWithBackoff(queuedEvent: QueuedEvent): Promise<void> {
    queuedEvent.retryCount++;
    this.retryCount++;
    
    const delay = Math.min(1000 * Math.pow(2, queuedEvent.retryCount - 1), 30000);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this._attemptSend(queuedEvent);
      this.retryCount = 0;
      this.emit('success', { eventCount: queuedEvent.events.length });
    } catch (error) {
      await this.handleSendError(queuedEvent, error);
    }
  }

  private isRetryableError(error: any): boolean {
    if (error.message?.includes('Network error')) return true;
    if (error.message?.includes('timeout')) return true;
    
    // HTTP status codes
    const status = this.extractHttpStatus(error);
    if (status) {
      return status >= 500 || status === 429; // Server errors and rate limiting
    }
    
    return true; // Default to retryable
  }

  private extractHttpStatus(error: any): number | null {
    const match = error.message?.match(/HTTP (\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private async compressEvents(events: EventData[]): Promise<ArrayBuffer> {
    const jsonString = JSON.stringify(events);
    
    // Skip compression for small payloads
    if (jsonString.length < 1024) {
      return new TextEncoder().encode(jsonString);
    }

    try {
      return await this.gzipCompress(jsonString);
    } catch (error) {
      console.warn('[Transport] Compression failed, using uncompressed data:', error);
      return new TextEncoder().encode(jsonString);
    }
  }

  public compress = this.gzipCompress; // Exposed for testing

  private async gzipCompress(data: string): Promise<ArrayBuffer> {
    if (typeof CompressionStream !== 'undefined') {
      // Use native compression if available
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(new TextEncoder().encode(data));
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result.buffer;
    } else {
      // Fallback: simple compression using deflate
      return this.simpleCompress(data);
    }
  }

  private simpleCompress(data: string): ArrayBuffer {
    // Simple RLE compression as fallback
    let compressed = '';
    let count = 1;
    let current = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i] === current && count < 255) {
        count++;
      } else {
        compressed += count > 1 ? `${count}${current}` : current;
        current = data[i];
        count = 1;
      }
    }
    
    compressed += count > 1 ? `${count}${current}` : current;
    return new TextEncoder().encode(compressed);
  }

  private validateEvent(event: EventData): boolean {
    return !!(
      event &&
      typeof event === 'object' &&
      event.sessionId &&
      event.timestamp &&
      event.type &&
      typeof event.timestamp === 'number' &&
      event.timestamp > 0
    );
  }

  private async checkRateLimit(): Promise<void> {
    if (!this.config.rateLimit) return;

    const now = Date.now();
    const windowStart = now - this.config.rateLimit.window;
    
    // Clean old entries
    this.rateLimitQueue = this.rateLimitQueue.filter(entry => 
      entry.timestamp > windowStart
    );

    if (this.rateLimitQueue.length >= this.config.rateLimit.requests) {
      // Wait for rate limit window to pass
      const oldestEntry = this.rateLimitQueue[0];
      const waitTime = oldestEntry.timestamp + this.config.rateLimit.window - now;
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    return new Promise((resolve, reject) => {
      this.rateLimitQueue.push({ timestamp: now, resolve, reject });
      resolve();
    });
  }

  private handleWebSocketOpen(): void {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.emit('connected');
    
    // Flush any queued events
    this.flushQueuedEvents();
  }

  private handleWebSocketClose(event: CloseEvent): void {
    this.isConnected = false;
    this.emit('disconnected', { code: event.code, reason: event.reason });
    
    // Attempt reconnection for non-normal closures
    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleWebSocketError(error: Event): void {
    console.error('[Transport] WebSocket error:', error);
    this.emit('error', { error });
  }

  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const response = JSON.parse(event.data);
      this.emit('message', response);
    } catch (error) {
      console.warn('[Transport] Invalid WebSocket message:', event.data);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }

  private fallbackToHttp(): void {
    this.isConnected = false;
    // HTTP fallback is handled in sendBatch
  }

  private async flushQueuedEvents(): Promise<void> {
    const queuedEvents = [...this.eventQueue];
    this.eventQueue = [];
    
    for (const queuedEvent of queuedEvents) {
      try {
        await this._attemptSend(queuedEvent);
      } catch (error) {
        await this.handleSendError(queuedEvent, error);
      }
    }
  }

  // Event emitter functionality
  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[Transport] Error in ${event} handler:`, error);
        }
      });
    }
  }

  // Getters for testing
  public isConnected(): boolean {
    return this.isConnected;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public getRetryCount(): number {
    return this.retryCount;
  }

  public getQueueSize(): number {
    return this.eventQueue.length + this.batchQueue.length;
  }
}