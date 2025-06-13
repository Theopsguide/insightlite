import { EventData, ClickEvent, ScrollEvent, MouseMoveEvent, FormEvent, ErrorEvent, PerformanceMetrics, InsightLiteConfig } from './types';
import { PrivacyEngine } from './privacy';
import { PerformanceMonitor, throttle, debounce } from './performance';

export class EventCollector {
  private config: Required<InsightLiteConfig>;
  private privacyEngine: PrivacyEngine;
  private performanceMonitor: PerformanceMonitor;
  private events: EventData[] = [];
  private isReplayActive = false;
  private effectiveSampleRate: number;
  private lastScrollTime = 0;
  private lastMouseMoveTime = 0;
  private mouseMoveCounter = 0;
  private clickHistory: Array<{ x: number; y: number; timestamp: number }> = [];
  
  // Throttled event handlers
  private throttledScrollHandler: () => void;
  private throttledMouseMoveHandler: (event: MouseEvent) => void;
  private debouncedResizeHandler: () => void;

  constructor(
    config: Required<InsightLiteConfig>,
    privacyEngine: PrivacyEngine,
    performanceMonitor: PerformanceMonitor
  ) {
    this.config = config;
    this.privacyEngine = privacyEngine;
    this.performanceMonitor = performanceMonitor;
    this.effectiveSampleRate = config.sampleRate;
    
    // Setup throttled handlers
    this.throttledScrollHandler = throttle(this.collectScrollEventInternal.bind(this), 150);
    this.throttledMouseMoveHandler = throttle(this.collectMouseMoveEventInternal.bind(this), 100);
    this.debouncedResizeHandler = debounce(this.collectResizeEvent.bind(this), 250);
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', this.debouncedResizeHandler);
  }

  public addEvent(event: EventData): void {
    if (!this.shouldCollectEvent(event.type)) {
      return;
    }

    this.events.push(event);
    
    // Prevent memory leaks by limiting buffer size
    if (this.events.length > this.config.flushSize * 2) {
      this.events = this.events.slice(-this.config.flushSize);
    }
  }

  public getEvents(): EventData[] {
    return [...this.events];
  }

  public getAndClearEvents(): EventData[] {
    const events = [...this.events];
    this.events = [];
    return events;
  }

  public getEventCount(): number {
    return this.events.length;
  }

  public collectClickEvent(event: MouseEvent): ClickEvent | null {
    if (!event.target || !this.shouldCollectEvent('click')) {
      return null;
    }

    const target = event.target as HTMLElement;
    
    // Detect rage clicks
    const now = Date.now();
    const clickData = { x: event.clientX, y: event.clientY, timestamp: now };
    
    this.clickHistory.push(clickData);
    this.clickHistory = this.clickHistory.filter(click => now - click.timestamp < 2000); // Keep last 2 seconds
    
    const isRageClick = this.detectRageClick(clickData);
    
    const clickEvent: ClickEvent = {
      x: event.clientX,
      y: event.clientY,
      target: this.extractElementInfo(target),
      button: event.button,
      isRageClick,
      modifiers: {
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey,
      },
    };

    return this.privacyEngine.sanitizeClickEvent(clickEvent, target);
  }

  public collectScrollEvent(): ScrollEvent | null {
    if (!this.shouldCollectEvent('scroll')) {
      return null;
    }

    return this.throttledScrollHandler();
  }

  private collectScrollEventInternal(): ScrollEvent | null {
    const now = Date.now();
    
    // Throttle scroll events
    if (now - this.lastScrollTime < 150) {
      return null;
    }
    
    this.lastScrollTime = now;

    const scrollEvent: ScrollEvent = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scrollTop: document.documentElement.scrollTop,
      scrollLeft: document.documentElement.scrollLeft,
      documentHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      scrollPercentage: this.calculateScrollPercentage(),
    };

    return scrollEvent;
  }

  public collectMouseMoveEvent(event: MouseEvent): MouseMoveEvent | null {
    if (!this.config.enableHeatmaps || !this.shouldCollectEvent('mousemove')) {
      return null;
    }

    return this.throttledMouseMoveHandler(event);
  }

  private collectMouseMoveEventInternal(event: MouseEvent): MouseMoveEvent | null {
    const now = Date.now();
    
    // Aggressive throttling for mouse move events
    if (now - this.lastMouseMoveTime < 100) {
      return null;
    }
    
    this.lastMouseMoveTime = now;
    this.mouseMoveCounter++;

    // Sample mouse move events (only track every Nth event)
    const sampleRate = this.getMouseMoveSampleRate();
    if (this.mouseMoveCounter % sampleRate !== 0) {
      return null;
    }

    const mouseMoveEvent: MouseMoveEvent = {
      x: event.clientX,
      y: event.clientY,
      timestamp: now,
    };

    return mouseMoveEvent;
  }

  public collectFormEvent(event: Event, eventType: 'focus' | 'blur' | 'input'): FormEvent | null {
    if (!event.target || !this.shouldCollectEvent('form')) {
      return null;
    }

    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    
    if (!this.isFormElement(target)) {
      return null;
    }

    const formEvent: FormEvent = {
      target: {
        tagName: target.tagName,
        type: target.type || '',
        name: target.name || '',
        value: target.value || '',
        placeholder: (target as HTMLInputElement).placeholder || '',
      },
      eventType,
    };

    return this.privacyEngine.sanitizeFormEvent(formEvent, target);
  }

  public collectErrorEvent(event: ErrorEvent): ErrorEvent | null {
    // Always collect error events regardless of sampling
    const errorEvent: ErrorEvent = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: Date.now(),
      type: 'javascript',
    };

    return errorEvent;
  }

  public collectUnhandledRejectionEvent(event: PromiseRejectionEvent): ErrorEvent | null {
    const errorEvent: ErrorEvent = {
      message: String(event.reason),
      stack: event.reason?.stack,
      timestamp: Date.now(),
      type: 'promise',
    };

    return errorEvent;
  }

  private collectResizeEvent(): void {
    if (!this.shouldCollectEvent('resize')) {
      return;
    }

    const resizeEvent = {
      width: window.innerWidth,
      height: window.innerHeight,
      timestamp: Date.now(),
    };

    this.addEvent({
      sessionId: '', // Will be set by core
      timestamp: Date.now(),
      type: 'resize',
      data: resizeEvent,
      url: window.location.pathname,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      },
      device: this.getDeviceInfo(),
    });
  }

  // Session replay functionality
  public startReplay(): void {
    if (!this.config.enableReplay) {
      return;
    }

    this.isReplayActive = true;
    this.setupReplayObserver();
  }

  public stopReplay(): void {
    this.isReplayActive = false;
    // Cleanup replay observer if implemented
  }

  public isReplayActiveState(): boolean {
    return this.isReplayActive;
  }

  private setupReplayObserver(): void {
    if (!('MutationObserver' in window)) {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      if (!this.isReplayActive) {
        return;
      }

      mutations.forEach((mutation) => {
        this.collectDOMMutation(mutation);
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true,
      characterDataOldValue: true,
    });
  }

  private collectDOMMutation(mutation: MutationRecord): void {
    const mutationEvent = {
      type: mutation.type,
      target: this.extractElementInfo(mutation.target as HTMLElement),
      addedNodes: Array.from(mutation.addedNodes).map(node => 
        this.extractNodeInfo(node)
      ),
      removedNodes: Array.from(mutation.removedNodes).map(node => 
        this.extractNodeInfo(node)
      ),
      attributeName: mutation.attributeName,
      oldValue: mutation.oldValue,
      timestamp: Date.now(),
    };

    // Don't add directly to events array here, use the main addEvent method
    // This will be called from the core SDK
  }

  // Performance-aware event collection
  public updatePerformanceConstraints(metrics: PerformanceMetrics): void {
    // Adjust effective sample rate based on performance
    this.effectiveSampleRate = this.performanceMonitor.getAdaptiveSampleRate(
      this.config.sampleRate
    );

    // Reduce event collection frequency under load
    if (this.performanceMonitor.shouldThrottleEvents()) {
      this.throttledScrollHandler = throttle(this.collectScrollEventInternal.bind(this), 300);
      this.throttledMouseMoveHandler = throttle(this.collectMouseMoveEventInternal.bind(this), 200);
    }
  }

  public getEffectiveSampleRate(): number {
    return this.effectiveSampleRate;
  }

  // Helper methods
  private shouldCollectEvent(eventType: string): boolean {
    // Always collect error events
    if (eventType === 'error') {
      return true;
    }

    // Check performance constraints
    if (this.performanceMonitor.shouldReduceActivity()) {
      return false;
    }

    // Apply sampling
    return Math.random() < this.effectiveSampleRate;
  }

  private extractElementInfo(element: HTMLElement): any {
    if (!element) {
      return null;
    }

    return {
      tagName: element.tagName,
      className: element.className,
      id: element.id,
      textContent: element.textContent?.substring(0, 100), // Limit text content
      attributes: this.extractRelevantAttributes(element),
    };
  }

  private extractRelevantAttributes(element: HTMLElement): Record<string, string> {
    const relevantAttrs = ['href', 'src', 'alt', 'title', 'role', 'aria-label'];
    const attrs: Record<string, string> = {};

    relevantAttrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) {
        attrs[attr] = value.substring(0, 100); // Limit attribute length
      }
    });

    return attrs;
  }

  private extractNodeInfo(node: Node): any {
    if (node.nodeType === Node.ELEMENT_NODE) {
      return this.extractElementInfo(node as HTMLElement);
    } else if (node.nodeType === Node.TEXT_NODE) {
      return {
        nodeType: 'text',
        textContent: node.textContent?.substring(0, 100),
      };
    }
    return { nodeType: node.nodeType };
  }

  private isFormElement(element: Element): boolean {
    const formElements = ['INPUT', 'TEXTAREA', 'SELECT'];
    return formElements.includes(element.tagName);
  }

  private calculateScrollPercentage(): number {
    const scrollTop = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;
    
    const scrollableHeight = documentHeight - windowHeight;
    
    if (scrollableHeight <= 0) {
      return 100;
    }
    
    return Math.round((scrollTop / scrollableHeight) * 100);
  }

  private getMouseMoveSampleRate(): number {
    // Increase sampling rate under performance pressure
    if (this.performanceMonitor.shouldThrottleEvents()) {
      return 10; // Track every 10th mouse move
    } else if (this.performanceMonitor.shouldReduceActivity()) {
      return 20; // Track every 20th mouse move
    }
    
    return 5; // Track every 5th mouse move (default)
  }

  private detectRageClick(clickData: { x: number; y: number; timestamp: number }): boolean {
    const recentClicks = this.clickHistory.filter(click => 
      clickData.timestamp - click.timestamp < 1000 && // Within 1 second
      Math.abs(click.x - clickData.x) < 50 && // Within 50px radius
      Math.abs(click.y - clickData.y) < 50
    );
    
    return recentClicks.length >= 3; // 3+ clicks in same area within 1 second
  }

  private getDeviceInfo(): any {
    return {
      type: this.detectDeviceType(),
      userAgent: navigator.userAgent,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
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

  // Cleanup
  public destroy(): void {
    window.removeEventListener('resize', this.debouncedResizeHandler);
    this.stopReplay();
    this.events = [];
    this.clickHistory = [];
  }
}