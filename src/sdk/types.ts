export interface InsightLiteConfig {
  siteId: string;
  apiEndpoint?: string;
  wsEndpoint?: string;
  sampleRate?: number;
  flushInterval?: number;
  flushSize?: number;
  maxRetries?: number;
  enableReplay?: boolean;
  enableHeatmaps?: boolean;
  privacyMode?: 'strict' | 'balanced' | 'permissive';
  debug?: boolean;
}

export interface EventData {
  sessionId: string;
  timestamp: number;
  type: string;
  data: any;
  url: string;
  viewport: ViewportInfo;
  device: DeviceInfo;
}

export interface ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

export interface DeviceInfo {
  type: 'desktop' | 'tablet' | 'mobile';
  userAgent: string;
  screen: {
    width: number;
    height: number;
  };
  memory?: number;
  cores?: number;
}

export interface ClickEvent {
  x: number;
  y: number;
  target: {
    tagName: string;
    className: string;
    id: string;
    textContent?: string;
  };
  button: number;
}

export interface ScrollEvent {
  scrollX: number;
  scrollY: number;
  scrollTop: number;
  scrollLeft: number;
  documentHeight: number;
  documentWidth: number;
}

export interface MouseMoveEvent {
  x: number;
  y: number;
  timestamp: number;
}

export interface FormEvent {
  target: {
    tagName: string;
    type: string;
    name: string;
    value?: string;
  };
  eventType: 'focus' | 'blur' | 'input';
}

export interface ErrorEvent {
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  error?: Error;
  stack?: string;
}

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  renderTime: number;
}