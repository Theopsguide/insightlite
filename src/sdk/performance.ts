import { PerformanceMetrics } from './types';

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private monitoring = false;
  private observers: PerformanceObserver[] = [];
  private intervalId: number | null = null;

  constructor() {
    this.metrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      networkLatency: 0,
      renderTime: 0,
    };
  }

  public startMonitoring(): void {
    if (this.monitoring) return;

    this.monitoring = true;
    this.setupPerformanceObservers();
    this.startContinuousMonitoring();
  }

  public stopMonitoring(): void {
    this.monitoring = false;
    
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getDevicePerformanceScore(): number {
    const nav = navigator as any;
    const memory = nav.deviceMemory || 4; // Default to 4GB
    const cores = nav.hardwareConcurrency || 4; // Default to 4 cores
    const connection = nav.connection;
    
    let score = 0.5; // Base score
    
    // Memory contribution (0-0.3)
    score += Math.min(memory / 16, 0.3); // Max score at 16GB+
    
    // CPU cores contribution (0-0.2)
    score += Math.min(cores / 8, 0.2); // Max score at 8+ cores
    
    // Connection quality contribution (0-0.2)
    if (connection) {
      const effectiveTypes: Record<string, number> = {
        'slow-2g': 0,
        '2g': 0.05,
        '3g': 0.1,
        '4g': 0.2,
      };
      score += effectiveTypes[connection.effectiveType] || 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  public getCPUUsage(): number {
    return this.metrics.cpuUsage;
  }

  public getMemoryUsage(): number {
    return this.metrics.memoryUsage;
  }

  private setupPerformanceObservers(): void {
    // Observe long tasks (CPU usage indicator)
    if ('PerformanceObserver' in window && 'PerformanceLongTaskTiming' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          this.processlongTasks(entries as PerformanceLongTaskTiming[]);
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (error) {
        console.warn('[PerformanceMonitor] Long task observer not supported:', error);
      }
    }

    // Observe layout shifts and rendering performance
    if ('PerformanceObserver' in window) {
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          this.processLayoutShifts(entries);
        });
        
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutShiftObserver);
      } catch (error) {
        console.warn('[PerformanceMonitor] Layout shift observer not supported:', error);
      }

      try {
        const paintObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          this.processPaintTiming(entries);
        });
        
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(paintObserver);
      } catch (error) {
        console.warn('[PerformanceMonitor] Paint observer not supported:', error);
      }
    }
  }

  private startContinuousMonitoring(): void {
    this.intervalId = window.setInterval(() => {
      this.updateMemoryMetrics();
      this.updateNetworkLatency();
      this.cleanupOldMetrics();
    }, 5000); // Update every 5 seconds
  }

  private processlongTasks(entries: PerformanceLongTaskTiming[]): void {
    let totalBlockingTime = 0;
    
    entries.forEach(entry => {
      // Tasks longer than 50ms are considered blocking
      if (entry.duration > 50) {
        totalBlockingTime += entry.duration - 50;
      }
    });
    
    // Calculate CPU usage as percentage of time spent in long tasks
    const windowSize = 5000; // 5 second window
    this.metrics.cpuUsage = Math.min(totalBlockingTime / windowSize, 1.0);
  }

  private processLayoutShifts(entries: PerformanceEntry[]): void {
    // Layout shifts can indicate rendering performance issues
    entries.forEach(entry => {
      if ('value' in entry && typeof entry.value === 'number') {
        // Cumulative Layout Shift (CLS) contribution
        this.metrics.renderTime += entry.value;
      }
    });
  }

  private processPaintTiming(entries: PerformanceEntry[]): void {
    entries.forEach(entry => {
      if (entry.name === 'first-contentful-paint') {
        this.metrics.renderTime = entry.startTime;
      }
    });
  }

  private updateMemoryMetrics(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize;
    } else {
      // Estimate memory usage based on performance
      this.metrics.memoryUsage = this.estimateMemoryUsage();
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation based on DOM complexity and script execution
    const elementCount = document.querySelectorAll('*').length;
    const scriptCount = document.querySelectorAll('script').length;
    
    // Very rough approximation: ~1KB per DOM element + script overhead
    return (elementCount * 1024) + (scriptCount * 10240);
  }

  private updateNetworkLatency(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection && connection.rtt) {
        this.metrics.networkLatency = connection.rtt;
      }
    } else {
      // Fallback: measure time for a small request
      this.measureNetworkLatency();
    }
  }

  private async measureNetworkLatency(): Promise<void> {
    try {
      const start = performance.now();
      
      // Make a small HEAD request to same origin
      await fetch(window.location.origin + '/favicon.ico', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const end = performance.now();
      this.metrics.networkLatency = end - start;
    } catch (error) {
      // Ignore network errors for latency measurement
    }
  }

  private cleanupOldMetrics(): void {
    // Reset accumulated metrics that shouldn't persist
    this.metrics.renderTime = Math.max(this.metrics.renderTime - 1, 0);
  }

  // Public methods for external performance monitoring
  public measureBlockingTime<T>(fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    const blockingTime = end - start;
    if (blockingTime > 50) {
      this.metrics.cpuUsage = Math.min(
        this.metrics.cpuUsage + (blockingTime / 1000),
        1.0
      );
    }
    
    return result;
  }

  public async measureAsyncBlockingTime<T>(fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    
    const blockingTime = end - start;
    if (blockingTime > 50) {
      this.metrics.cpuUsage = Math.min(
        this.metrics.cpuUsage + (blockingTime / 1000),
        1.0
      );
    }
    
    return result;
  }

  public trackMemoryUsage(operation: string): void {
    if ('memory' in performance) {
      const before = (performance as any).memory.usedJSHeapSize;
      
      // Use timeout to measure after next tick
      setTimeout(() => {
        const after = (performance as any).memory.usedJSHeapSize;
        const delta = after - before;
        
        if (delta > 0) {
          console.debug(`[PerformanceMonitor] ${operation} memory delta:`, delta);
        }
      }, 0);
    }
  }

  // Performance thresholds for adaptive behavior
  public shouldReduceActivity(): boolean {
    return (
      this.metrics.cpuUsage > 0.8 ||
      this.metrics.memoryUsage > 50 * 1024 * 1024 || // 50MB
      this.metrics.networkLatency > 1000 // 1 second
    );
  }

  public shouldThrottleEvents(): boolean {
    return (
      this.metrics.cpuUsage > 0.6 ||
      this.metrics.memoryUsage > 20 * 1024 * 1024 || // 20MB
      this.metrics.networkLatency > 500 // 500ms
    );
  }

  public getPerformanceGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    const score = this.calculatePerformanceScore();
    
    if (score >= 0.9) return 'A';
    if (score >= 0.8) return 'B';
    if (score >= 0.7) return 'C';
    if (score >= 0.6) return 'D';
    return 'F';
  }

  private calculatePerformanceScore(): number {
    let score = 1.0;
    
    // CPU usage penalty
    score -= Math.min(this.metrics.cpuUsage * 0.4, 0.4);
    
    // Memory usage penalty (normalize to 100MB max)
    const memoryPenalty = Math.min(this.metrics.memoryUsage / (100 * 1024 * 1024), 1.0) * 0.3;
    score -= memoryPenalty;
    
    // Network latency penalty (normalize to 2 seconds max)
    const latencyPenalty = Math.min(this.metrics.networkLatency / 2000, 1.0) * 0.2;
    score -= latencyPenalty;
    
    // Render time penalty (normalize to 3 seconds max)
    const renderPenalty = Math.min(this.metrics.renderTime / 3000, 1.0) * 0.1;
    score -= renderPenalty;
    
    return Math.max(score, 0);
  }

  // Adaptive sampling based on performance
  public getAdaptiveSampleRate(baseSampleRate: number): number {
    const performanceScore = this.calculatePerformanceScore();
    
    // Reduce sampling on poor performing devices
    if (performanceScore < 0.5) {
      return baseSampleRate * 0.5;
    } else if (performanceScore < 0.7) {
      return baseSampleRate * 0.75;
    }
    
    return baseSampleRate;
  }

  // Browser capability detection
  public getBrowserCapabilities(): {
    webSocket: boolean;
    fetch: boolean;
    performance: boolean;
    observer: boolean;
    compression: boolean;
    webWorker: boolean;
  } {
    return {
      webSocket: 'WebSocket' in window,
      fetch: 'fetch' in window,
      performance: 'performance' in window && 'now' in performance,
      observer: 'PerformanceObserver' in window,
      compression: 'CompressionStream' in window,
      webWorker: 'Worker' in window,
    };
  }
}

// Performance utility functions
export function measureRenderTime(element: HTMLElement): number {
  const start = performance.now();
  
  // Force reflow
  element.offsetHeight;
  
  const end = performance.now();
  return end - start;
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): T {
  let timeout: number | null = null;
  let previous = 0;
  const { leading = false, trailing = true } = options;

  return ((...args: Parameters<T>) => {
    const now = performance.now();
    
    if (!previous && !leading) {
      previous = now;
    }
    
    const remaining = wait - (now - previous);
    
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      
      previous = now;
      func.apply(null, args);
    } else if (!timeout && trailing) {
      timeout = window.setTimeout(() => {
        previous = leading ? 0 : performance.now();
        timeout = null;
        func.apply(null, args);
      }, remaining);
    }
  }) as T;
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): T {
  let inThrottle = false;
  
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  }) as T;
}