import { InsightLiteConfig } from './types';

interface SessionMetadata {
  sessionId: string;
  startTime: number;
  pageCount: number;
  eventCount: number;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  lastActivity: number;
}

export class SessionManager {
  private config: Required<InsightLiteConfig>;
  private sessionId: string;
  private metadata: SessionMetadata;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private storageKey = 'insightlite_session';
  private samplingDecision: boolean | null = null;

  constructor(config: Required<InsightLiteConfig>) {
    this.config = config;
    this.sessionId = this.initializeSession();
    this.metadata = this.loadOrCreateMetadata();
  }

  private initializeSession(): string {
    // Try to restore existing session
    const existingSession = this.getStoredSession();
    
    if (existingSession && this.isSessionValid(existingSession)) {
      return existingSession.sessionId;
    }
    
    // Create new session
    return this.generateSessionId();
  }

  private getStoredSession(): SessionMetadata | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('[SessionManager] Failed to load session from storage:', error);
      return null;
    }
  }

  private isSessionValid(session: SessionMetadata): boolean {
    const now = Date.now();
    const timeSinceLastActivity = now - session.lastActivity;
    
    return timeSinceLastActivity < this.sessionTimeout;
  }

  private generateSessionId(): string {
    // Use crypto.randomUUID if available, fallback to custom implementation
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback UUID v4 generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private loadOrCreateMetadata(): SessionMetadata {
    const existing = this.getStoredSession();
    
    if (existing && existing.sessionId === this.sessionId) {
      // Update last activity
      existing.lastActivity = Date.now();
      this.saveMetadata(existing);
      return existing;
    }
    
    // Create new metadata
    const metadata: SessionMetadata = {
      sessionId: this.sessionId,
      startTime: Date.now(),
      pageCount: 0,
      eventCount: 0,
      deviceType: this.detectDeviceType(),
      lastActivity: Date.now(),
    };
    
    this.saveMetadata(metadata);
    return metadata;
  }

  private saveMetadata(metadata: SessionMetadata): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(metadata));
    } catch (error) {
      console.warn('[SessionManager] Failed to save session metadata:', error);
    }
  }

  private detectDeviceType(): 'desktop' | 'tablet' | 'mobile' {
    const width = window.innerWidth;
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Check user agent for mobile indicators
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const tabletRegex = /ipad|android(?!.*mobile)|tablet/i;
    
    if (mobileRegex.test(userAgent) && !tabletRegex.test(userAgent)) {
      return 'mobile';
    }
    
    if (tabletRegex.test(userAgent) || (width >= 768 && width < 1024)) {
      return 'tablet';
    }
    
    return 'desktop';
  }

  public shouldTrackSession(sampleRate: number): boolean {
    // Make sampling decision once per session
    if (this.samplingDecision === null) {
      this.samplingDecision = this.makeSamplingDecision(sampleRate);
    }
    
    return this.samplingDecision;
  }

  private makeSamplingDecision(sampleRate: number): boolean {
    // Use session ID as seed for deterministic sampling
    const hash = this.hashString(this.sessionId);
    const normalized = (hash % 10000) / 10000; // 0.0000 to 0.9999
    
    return normalized < sampleRate;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  public shouldTrackEvent(): boolean {
    // Update last activity
    this.updateActivity();
    
    // Always track if we decided to track this session
    return this.samplingDecision === true;
  }

  public updateActivity(): void {
    this.metadata.lastActivity = Date.now();
    this.saveMetadata(this.metadata);
  }

  public incrementPageCount(): void {
    this.metadata.pageCount++;
    this.updateActivity();
  }

  public incrementEventCount(): void {
    this.metadata.eventCount++;
    this.updateActivity();
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getMetadata(): SessionMetadata {
    return { ...this.metadata };
  }

  public getDuration(): number {
    return Date.now() - this.metadata.startTime;
  }

  public isNewSession(): boolean {
    return this.metadata.pageCount === 0 && this.metadata.eventCount === 0;
  }

  public extendSession(): void {
    this.updateActivity();
  }

  public endSession(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('[SessionManager] Failed to clear session:', error);
    }
  }

  // Session lifecycle hooks
  public onBeforeUnload(): void {
    // Final metadata update before page unload
    this.updateActivity();
  }

  public onVisibilityChange(): void {
    if (document.hidden) {
      this.updateActivity();
    } else {
      // Check if session should be extended or new session created
      if (!this.isSessionValid(this.metadata)) {
        this.createNewSession();
      } else {
        this.updateActivity();
      }
    }
  }

  private createNewSession(): void {
    this.sessionId = this.generateSessionId();
    this.metadata = this.loadOrCreateMetadata();
    this.samplingDecision = null; // Reset sampling decision
  }

  // Bot detection
  public isProbablyBot(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const botPatterns = [
      'bot', 'crawl', 'spider', 'scrape', 'curl', 'wget',
      'facebookexternalhit', 'twitterbot', 'linkedinbot',
      'slackbot', 'whatsapp', 'telegrambot', 'googlebot',
      'bingbot', 'yandexbot', 'duckduckbot', 'baiduspider'
    ];
    
    return botPatterns.some(pattern => userAgent.includes(pattern));
  }

  // Privacy-aware session tracking
  public getAnonymizedSessionId(): string {
    // Return a hashed version of the session ID for privacy
    const hash = this.hashString(`${this.sessionId}:${this.config.siteId}`);
    return hash.toString(36);
  }

  // Session quality scoring
  public getSessionQuality(): number {
    const duration = this.getDuration();
    const pageCount = this.metadata.pageCount;
    const eventCount = this.metadata.eventCount;
    
    let score = 0;
    
    // Duration scoring (up to 0.4 points)
    if (duration > 30000) score += 0.1; // 30+ seconds
    if (duration > 120000) score += 0.1; // 2+ minutes
    if (duration > 300000) score += 0.1; // 5+ minutes
    if (duration > 600000) score += 0.1; // 10+ minutes
    
    // Page count scoring (up to 0.3 points)
    score += Math.min(pageCount * 0.1, 0.3);
    
    // Event count scoring (up to 0.3 points)
    score += Math.min(eventCount * 0.01, 0.3);
    
    return Math.min(score, 1.0);
  }

  // Rate limiting per session
  private eventTimestamps: number[] = [];
  private readonly maxEventsPerMinute = 1000;

  public shouldRateLimit(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old timestamps
    this.eventTimestamps = this.eventTimestamps.filter(ts => ts > oneMinuteAgo);
    
    // Check if rate limit exceeded
    if (this.eventTimestamps.length >= this.maxEventsPerMinute) {
      return true;
    }
    
    // Add current timestamp
    this.eventTimestamps.push(now);
    return false;
  }

  // Session fingerprinting (privacy-aware)
  public getSessionFingerprint(): string {
    const factors = [
      window.innerWidth.toString(),
      window.innerHeight.toString(),
      navigator.language,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      String(new Date().getTimezoneOffset()),
    ];
    
    const fingerprint = factors.join('|');
    return this.hashString(fingerprint).toString(36);
  }

  // Multi-tab session management
  public handleStorageChange(event: StorageEvent): void {
    if (event.key === this.storageKey && event.newValue) {
      try {
        const newSession = JSON.parse(event.newValue);
        
        // If another tab created a new session, adopt it
        if (newSession.sessionId !== this.sessionId) {
          this.sessionId = newSession.sessionId;
          this.metadata = newSession;
          this.samplingDecision = null; // Reset sampling decision
        }
      } catch (error) {
        console.warn('[SessionManager] Failed to handle storage change:', error);
      }
    }
  }

  // Cross-domain session continuity (if enabled)
  public getCrossDomainSessionData(): string {
    if (!this.config.enableCrossDomain) {
      return '';
    }
    
    // Return minimal session data for cross-domain tracking
    return btoa(JSON.stringify({
      id: this.getAnonymizedSessionId(),
      ts: this.metadata.startTime,
      site: this.config.siteId,
    }));
  }
}