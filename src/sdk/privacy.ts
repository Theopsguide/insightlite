import { FormEvent, ClickEvent, PerformanceMetrics } from './types';

export type PrivacyMode = 'strict' | 'balanced' | 'permissive';

export class PrivacyEngine {
  private mode: PrivacyMode;
  private sensitiveInputSelectors: string[];
  private sensitiveAttributePatterns: RegExp[];
  private dataPatterns: Map<string, RegExp>;
  private maskChar = '●';
  private blockChar = '█';

  constructor(mode: PrivacyMode = 'balanced') {
    this.mode = mode;
    this.initializePatterns();
  }

  private initializePatterns(): void {
    this.sensitiveInputSelectors = [
      'input[type="password"]',
      'input[type="email"]',
      'input[name*="email"]',
      'input[name*="password"]',
      'input[name*="pass"]',
      'input[name*="pwd"]',
      'input[name*="firstName"]',
      'input[name*="first_name"]',
      'input[name*="first-name"]',
      'input[name*="lastName"]',
      'input[name*="last_name"]',
      'input[name*="last-name"]',
      'input[name*="phone"]',
      'input[name*="tel"]',
      'input[name*="mobile"]',
      'input[name*="ssn"]',
      'input[name*="social"]',
      'input[name*="creditcard"]',
      'input[name*="credit_card"]',
      'input[name*="credit-card"]',
      'input[name*="cardnumber"]',
      'input[name*="card_number"]',
      'input[name*="card-number"]',
      '[data-sensitive]',
      '[data-private]',
      '[data-personal]',
    ];

    this.sensitiveAttributePatterns = [
      /^data-user/i,
      /^data-customer/i,
      /^data-session/i,
      /^data-auth/i,
      /^data-token/i,
      /^data-key/i,
      /^data-id$/i,
      /userid/i,
      /customerid/i,
      /sessionid/i,
    ];

    this.dataPatterns = new Map([
      ['email', /\b[\w\.-]+@[\w\.-]+\.\w+\b/g],
      ['phone', /\b(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g],
      ['ssn', /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g],
      ['creditCard', /\b(?:\d{4}[-\s]?){3}\d{4}\b/g],
      ['ipAddress', /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g],
    ]);
  }

  public sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    try {
      return this._sanitizeValue(data, new Set());
    } catch (error) {
      console.warn('[PrivacyEngine] Error sanitizing data:', error);
      return data;
    }
  }

  private _sanitizeValue(value: any, visited: Set<any>): any {
    // Handle circular references
    if (visited.has(value)) {
      return '[Circular]';
    }

    if (typeof value === 'string') {
      return this.sanitizeTextPatterns(value);
    }

    if (Array.isArray(value)) {
      visited.add(value);
      const result = value.map(item => this._sanitizeValue(item, visited));
      visited.delete(value);
      return result;
    }

    if (typeof value === 'object' && value !== null) {
      visited.add(value);
      const result: any = {};
      
      for (const [key, val] of Object.entries(value)) {
        if (this.isSensitiveField(key)) {
          result[key] = this.maskValue(val);
        } else {
          result[key] = this._sanitizeValue(val, visited);
        }
      }
      
      visited.delete(value);
      return result;
    }

    return value;
  }

  public sanitizeFormEvent(formEvent: FormEvent, element?: HTMLElement): FormEvent {
    if (!formEvent || !formEvent.target) {
      return formEvent;
    }

    const sanitized = { ...formEvent };
    sanitized.target = { ...formEvent.target };

    // Check if field should be masked
    if (this.shouldMaskInput(formEvent.target, element)) {
      sanitized.target.value = this.maskValue(formEvent.target.value);
    }

    return sanitized;
  }

  public sanitizeClickEvent(clickEvent: ClickEvent, element?: HTMLElement): ClickEvent {
    if (!clickEvent || !clickEvent.target) {
      return clickEvent;
    }

    const sanitized = { ...clickEvent };
    sanitized.target = { ...clickEvent.target };

    // Remove sensitive attributes
    if (element) {
      this.removeSensitiveAttributes(sanitized.target, element);
    }

    // Anonymize text content
    if (sanitized.target.textContent) {
      sanitized.target.textContent = this.anonymizeText(sanitized.target.textContent);
    }

    return sanitized;
  }

  public sanitizeTextPatterns(text: string): string {
    if (typeof text !== 'string') {
      return text;
    }

    let sanitized = text;

    for (const [patternName, pattern] of this.dataPatterns) {
      sanitized = sanitized.replace(pattern, (match) => this.maskChar.repeat(match.length));
    }

    return sanitized;
  }

  public anonymizeText(text: string): string {
    if (typeof text !== 'string') {
      return text;
    }

    return this.blockChar.repeat(text.length);
  }

  public truncateCoordinates(coords: { x: number; y: number }): { x: number; y: number } {
    const precision = 10; // Round to nearest 10 pixels
    
    return {
      x: Math.floor(coords.x / precision) * precision,
      y: Math.floor(coords.y / precision) * precision,
    };
  }

  public hashSessionId(sessionId: string, siteId: string): string {
    // Simple hash implementation for session ID anonymization
    const combined = `${sessionId}:${siteId}`;
    let hash = 0;
    
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  public sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const sensitiveParams = [
        'email', 'token', 'key', 'password', 'pass', 'pwd',
        'user_id', 'userid', 'customer_id', 'customerid',
        'session', 'sessionid', 'auth', 'api_key', 'apikey'
      ];

      for (const param of sensitiveParams) {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, this.maskChar.repeat(8));
        }
      }

      return urlObj.toString();
    } catch {
      return url; // Return original if URL parsing fails
    }
  }

  private shouldMaskInput(target: any, element?: HTMLElement): boolean {
    if (!target) return false;

    switch (this.mode) {
      case 'strict':
        return true; // Mask all inputs in strict mode

      case 'permissive':
        // Only mask explicitly marked fields
        return element?.hasAttribute('data-sensitive') || 
               element?.hasAttribute('data-private') ||
               target.type === 'password';

      case 'balanced':
      default:
        // Mask sensitive fields based on type and name
        return this.isSensitiveInput(target, element);
    }
  }

  private isSensitiveInput(target: any, element?: HTMLElement): boolean {
    // Check input type
    if (target.type && ['password', 'email'].includes(target.type)) {
      return true;
    }

    // Check name attribute
    if (target.name && this.isSensitiveFieldName(target.name)) {
      return true;
    }

    // Check element attributes
    if (element) {
      for (const selector of this.sensitiveInputSelectors) {
        if (selector.startsWith('[') && selector.endsWith(']')) {
          const attrName = selector.slice(1, -1).split('=')[0];
          if (element.hasAttribute(attrName)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'email', 'password', 'pass', 'pwd', 'token', 'key',
      'firstname', 'lastname', 'phone', 'tel', 'mobile',
      'ssn', 'social', 'creditcard', 'cardnumber',
      'userid', 'customerid', 'sessionid'
    ];

    const normalizedField = fieldName.toLowerCase().replace(/[-_]/g, '');
    
    return sensitiveFields.some(sensitive => 
      normalizedField.includes(sensitive)
    );
  }

  private isSensitiveFieldName(name: string): boolean {
    return this.isSensitiveField(name);
  }

  private removeSensitiveAttributes(target: any, element: HTMLElement): void {
    if (!element.attributes) return;

    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      
      if (this.isSensitiveAttribute(attr.name)) {
        delete target[attr.name];
      }
    }
  }

  private isSensitiveAttribute(attrName: string): boolean {
    return this.sensitiveAttributePatterns.some(pattern => 
      pattern.test(attrName)
    );
  }

  private maskValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);
    return this.maskChar.repeat(stringValue.length);
  }

  // Public getters for testing
  public getMode(): PrivacyMode {
    return this.mode;
  }

  public setMode(mode: PrivacyMode): void {
    this.mode = mode;
  }
}