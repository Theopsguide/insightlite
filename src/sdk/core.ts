import { InsightLiteConfig, EventData, ViewportInfo, DeviceInfo } from './types';
import { PrivacyEngine } from './privacy';
import { EventTransport } from './transport';
import { PerformanceMonitor } from './performance';
import { SessionManager } from './session';
import { EventCollector } from './events';

export class InsightLiteSDK {
  private config: Required<InsightLiteConfig>;
  private sessionManager: SessionManager;
  private eventCollector: EventCollector;
  private transport: EventTransport;
  private privacyEngine: PrivacyEngine;
  private performanceMonitor: PerformanceMonitor;
  private isInitialized = false;
  private isDestroyed = false;

  constructor(config: InsightLiteConfig) {
    this.validateConfig(config);
    this.config = this.mergeWithDefaults(config);
    
    this.sessionManager = new SessionManager(this.config);
    this.privacyEngine = new PrivacyEngine(this.config.privacyMode);
    this.transport = new EventTransport(this.config);
    this.performanceMonitor = new PerformanceMonitor();
    this.eventCollector = new EventCollector(
      this.config,
      this.privacyEngine,
      this.performanceMonitor
    );

    if (this.shouldInitialize()) {
      this.initialize();
    }
  }

  private validateConfig(config: InsightLiteConfig): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration object is required');
    }
    
    if (!config.siteId || typeof config.siteId !== 'string' || config.siteId.trim() === '') {
      throw new Error('siteId is required and must be a non-empty string');
    }

    if (config.sampleRate !== undefined) {
      if (typeof config.sampleRate !== 'number' || config.sampleRate < 0 || config.sampleRate > 1) {
        throw new Error('sampleRate must be a number between 0 and 1');
      }
    }

    if (config.flushInterval !== undefined) {
      if (typeof config.flushInterval !== 'number' || config.flushInterval < 1000) {
        throw new Error('flushInterval must be a number >= 1000ms');
      }
    }

    if (config.flushSize !== undefined) {
      if (typeof config.flushSize !== 'number' || config.flushSize < 1) {
        throw new Error('flushSize must be a positive number');
      }
    }
  }

  private mergeWithDefaults(config: InsightLiteConfig): Required<InsightLiteConfig> {
    return {
      siteId: config.siteId,
      apiEndpoint: config.apiEndpoint || 'https://ingest.insightlite.com/events',
      wsEndpoint: config.wsEndpoint || 'wss://ws.insightlite.com',
      sampleRate: config.sampleRate ?? 0.2,
      flushInterval: config.flushInterval ?? 5000,
      flushSize: config.flushSize ?? 50,
      maxRetries: config.maxRetries ?? 3,
      enableReplay: config.enableReplay ?? true,
      enableHeatmaps: config.enableHeatmaps ?? true,
      privacyMode: config.privacyMode ?? 'balanced',
      debug: config.debug ?? false,
    };
  }

  private shouldInitialize(): boolean {
    // Check if we should track this session based on sampling
    const samplingDecision = this.sessionManager.shouldTrackSession(this.config.sampleRate);
    
    if (!samplingDecision) {
      if (this.config.debug) {
        console.log('[InsightLite] Session excluded by sampling');
      }
      return false;
    }

    // Check performance constraints
    const performanceScore = this.performanceMonitor.getDevicePerformanceScore();
    if (performanceScore < 0.3) {
      if (this.config.debug) {
        console.log('[InsightLite] Session excluded due to low device performance');
      }
      return false;
    }

    return true;
  }

  private initialize(): void {
    if (this.isInitialized || this.isDestroyed) {
      return;
    }

    try {
      this.setupEventListeners();
      this.transport.connect();
      this.startPerformanceMonitoring();
      this.trackPageView();
      this.schedulePeriodicFlush();
      
      this.isInitialized = true;
      
      if (this.config.debug) {
        console.log('[InsightLite] SDK initialized successfully', {
          sessionId: this.sessionManager.getSessionId(),
          siteId: this.config.siteId,
        });
      }
    } catch (error) {
      console.error('[InsightLite] Initialization failed:', error);
    }
  }

  private setupEventListeners(): void {
    // DOM events
    document.addEventListener('click', this.handleClick.bind(this), { capture: true, passive: true });
    document.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    document.addEventListener('mousemove', this.handleMouseMove.bind(this), { passive: true });
    
    // Form events
    document.addEventListener('focusin', this.handleFormFocus.bind(this), { passive: true });
    document.addEventListener('focusout', this.handleFormBlur.bind(this), { passive: true });
    document.addEventListener('input', this.handleFormInput.bind(this), { passive: true });
    
    // Error tracking
    window.addEventListener('error', this.handleError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    
    // Page lifecycle
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // SPA navigation
    this.hookHistoryAPI();
  }

  private removeEventListeners(): void {
    document.removeEventListener('click', this.handleClick.bind(this), { capture: true });
    document.removeEventListener('scroll', this.handleScroll.bind(this));
    document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    document.removeEventListener('focusin', this.handleFormFocus.bind(this));
    document.removeEventListener('focusout', this.handleFormBlur.bind(this));
    document.removeEventListener('input', this.handleFormInput.bind(this));
    
    window.removeEventListener('error', this.handleError.bind(this));
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
  }

  private handleClick = (event: MouseEvent): void => {
    if (!this.shouldTrackEvent()) return;
    
    const clickData = this.eventCollector.collectClickEvent(event);
    if (clickData) {
      this.track('click', clickData);
    }
  };

  private handleScroll = (): void => {
    if (!this.shouldTrackEvent()) return;
    
    const scrollData = this.eventCollector.collectScrollEvent();
    if (scrollData) {
      this.track('scroll', scrollData);
    }
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.shouldTrackEvent() || !this.config.enableHeatmaps) return;
    
    const mouseMoveData = this.eventCollector.collectMouseMoveEvent(event);
    if (mouseMoveData) {
      this.track('mousemove', mouseMoveData);
    }
  };

  private handleFormFocus = (event: FocusEvent): void => {
    if (!this.shouldTrackEvent()) return;
    
    const formData = this.eventCollector.collectFormEvent(event, 'focus');
    if (formData) {
      this.track('form', formData);
    }
  };

  private handleFormBlur = (event: FocusEvent): void => {
    if (!this.shouldTrackEvent()) return;
    
    const formData = this.eventCollector.collectFormEvent(event, 'blur');
    if (formData) {
      this.track('form', formData);
    }
  };

  private handleFormInput = (event: InputEvent): void => {
    if (!this.shouldTrackEvent()) return;
    
    const formData = this.eventCollector.collectFormEvent(event, 'input');
    if (formData) {
      this.track('form', formData);
    }
  };

  private handleError = (event: ErrorEvent): void => {
    const errorData = this.eventCollector.collectErrorEvent(event);
    if (errorData) {
      this.track('error', errorData);
    }
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const errorData = this.eventCollector.collectUnhandledRejectionEvent(event);
    if (errorData) {
      this.track('error', errorData);
    }
  };

  private handleBeforeUnload = (): void => {
    this.flush();
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.flush();
    } else {
      this.trackPageView();
    }
  };

  private hookHistoryAPI(): void {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => this.trackPageView(), 0);
    };
    
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.trackPageView(), 0);
    };
    
    window.addEventListener('popstate', () => {
      setTimeout(() => this.trackPageView(), 0);
    });
  }

  private trackPageView(): void {
    const pageData = {
      url: window.location.pathname + window.location.search,
      title: document.title,
      referrer: document.referrer,
      timestamp: Date.now(),
    };
    
    this.track('page', pageData);
    this.sessionManager.incrementPageCount();
  }

  private startPerformanceMonitoring(): void {
    this.performanceMonitor.startMonitoring();
    
    // Adjust sampling based on performance
    setInterval(() => {
      const metrics = this.performanceMonitor.getMetrics();
      this.eventCollector.updatePerformanceConstraints(metrics);
    }, 10000); // Check every 10 seconds
  }

  private schedulePeriodicFlush(): void {
    setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private shouldTrackEvent(): boolean {
    return this.isInitialized && 
           !this.isDestroyed && 
           this.sessionManager.shouldTrackEvent();
  }

  // Public API
  public track(eventType: string, data: any): void {
    if (!this.shouldTrackEvent()) {
      return;
    }

    try {
      const eventData: EventData = {
        sessionId: this.sessionManager.getSessionId(),
        timestamp: Date.now(),
        type: eventType,
        data: this.privacyEngine.sanitizeData(data),
        url: window.location.pathname,
        viewport: this.getViewportInfo(),
        device: this.getDeviceInfo(),
      };

      this.eventCollector.addEvent(eventData);
      this.sessionManager.incrementEventCount();

      if (this.config.debug) {
        console.log('[InsightLite] Event tracked:', eventType, eventData);
      }

      // Auto-flush if buffer is full
      if (this.eventCollector.getEventCount() >= this.config.flushSize) {
        this.flush();
      }
    } catch (error) {
      console.error('[InsightLite] Error tracking event:', error);
    }
  }

  public identify(traits: Record<string, any>): void {
    this.track('identify', this.privacyEngine.sanitizeData(traits));
  }

  public async flush(): Promise<void> {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    try {
      const events = this.eventCollector.getAndClearEvents();
      if (events.length > 0) {
        await this.transport.send(events);
        
        if (this.config.debug) {
          console.log(`[InsightLite] Flushed ${events.length} events`);
        }
      }
    } catch (error) {
      console.error('[InsightLite] Error flushing events:', error);
    }
  }

  public startReplay(): void {
    if (this.config.enableReplay) {
      this.eventCollector.startReplay();
    }
  }

  public stopReplay(): void {
    this.eventCollector.stopReplay();
  }

  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.flush();
    this.removeEventListeners();
    this.transport.disconnect();
    this.performanceMonitor.stopMonitoring();
    this.eventCollector.destroy();
    
    this.isDestroyed = true;
    this.isInitialized = false;
    
    if (this.config.debug) {
      console.log('[InsightLite] SDK destroyed');
    }
  }

  // Getters for testing
  public getConfig(): Required<InsightLiteConfig> {
    return { ...this.config };
  }

  public getSessionId(): string {
    return this.sessionManager.getSessionId();
  }

  public getEventCount(): number {
    return this.eventCollector.getEventCount();
  }

  public getBufferedEvents(): EventData[] {
    return this.eventCollector.getEvents();
  }

  public isReplayActive(): boolean {
    return this.eventCollector.isReplayActive();
  }

  public getPerformanceMetrics() {
    return this.performanceMonitor.getMetrics();
  }

  public getEffectiveSampleRate(): number {
    return this.eventCollector.getEffectiveSampleRate();
  }

  public getSessionMetadata() {
    return this.sessionManager.getMetadata();
  }

  private getViewportInfo(): ViewportInfo {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
  }

  private getDeviceInfo(): DeviceInfo {
    const screen = window.screen;
    const nav = navigator as any;
    
    return {
      type: this.detectDeviceType(),
      userAgent: navigator.userAgent,
      screen: {
        width: screen.width,
        height: screen.height,
      },
      memory: nav.deviceMemory,
      cores: nav.hardwareConcurrency,
    };
  }

  private detectDeviceType(): 'desktop' | 'tablet' | 'mobile' {
    const width = window.innerWidth;
    
    if (width < 768) {
      return 'mobile';
    } else if (width < 1024) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }
}

// Global API
declare global {
  interface Window {
    InsightLite: typeof InsightLiteSDK;
    insight?: InsightLiteSDK;
  }
}

// Export for module systems
export default InsightLiteSDK;

// Auto-initialization for script tag usage
if (typeof window !== 'undefined') {
  window.InsightLite = InsightLiteSDK;
}