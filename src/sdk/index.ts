// Main SDK export
export { InsightLiteSDK as default } from './core';
export { InsightLiteSDK } from './core';

// Type exports
export type {
  InsightLiteConfig,
  EventData,
  ViewportInfo,
  DeviceInfo,
  ClickEvent,
  ScrollEvent,
  MouseMoveEvent,
  FormEvent,
  ErrorEvent,
  PerformanceMetrics,
} from './types';

// Privacy engine export
export { PrivacyEngine } from './privacy';
export type { PrivacyMode } from './privacy';

// Performance monitoring export
export { PerformanceMonitor } from './performance';

// Transport layer export
export { EventTransport } from './transport';

// Session management export
export { SessionManager } from './session';

// Event collection export
export { EventCollector } from './events';

// Version info
export const VERSION = '1.0.0';

// Browser detection utilities
export const isSupported = (): boolean => {
  return !!(
    window &&
    document &&
    localStorage &&
    JSON &&
    typeof addEventListener === 'function' &&
    typeof removeEventListener === 'function'
  );
};

// Quick initialization helper
export const init = (config: { siteId: string; [key: string]: any }) => {
  if (!isSupported()) {
    console.warn('[InsightLite] Browser not supported');
    return null;
  }

  return new (require('./core').InsightLiteSDK)(config);
};