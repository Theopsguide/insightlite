# Product Requirements Document
**Product Name**: InsightLite – Lightweight, privacy-first session analytics

## 1. Purpose & Vision
Modern product and marketing teams need qualitative insights (session replays, heatmaps, click maps) without burdening site performance or risking visitor privacy. InsightLite will deliver Hotjar-class behavior analytics via a snippet small enough to load through Google Tag Manager (GTM) and a data pipeline that stores only anonymous, non-PII session data.

## 2. Goals & Success Metrics
| Goal | Metric | Target |
|------|--------|--------|
| Zero meaningful performance impact | Script weight | ≤ 35 KB gzipped |
| Privacy by design | PII stored | 0 bytes |
| Fast insights | Time from event to dashboard | < 5 min |
| Adoption | Sites with >10k sessions/month within 6 months | 50 |

## 3. Key User Stories
- As a Product Manager, I can watch anonymized session replays so I can diagnose UX issues
- As a Growth Marketer, I can view aggregated heatmaps for any page so I can optimize CTAs  
- As a CTO, I can prove no personal data is stored so I can pass compliance audits
- As a Developer, I can deploy via GTM with no code changes so I can launch in minutes

## 4. Core Features

### 4.1 Client SDK (≤ 35 KB gzipped)
- Single JavaScript snippet (async, tree-shaken)
- Tracks: page views, clicks, scroll depth, mouse movement, form focus/blur, console errors
- Adaptive sampling (default 1 in 5 sessions; configurable)
- Manual event API: window.insight.track('event', {...})

### 4.2 Session Replay
- Real-time streaming to server using WebSocket fallback to XHR
- Playback UI with timeline, click overlay, scroll indicator

### 4.3 Heatmaps & Analytics
- Click, move, and scroll heatmaps per URL path
- Device filter (desktop/tablet/mobile), date range filter
- Funnels and retention cohorts
- Error & rage-click detection

### 4.4 Privacy & Anonymization
- No IP storage (hash then truncated), no cookies by default
- Automatic masking of input fields
- Canvas rendering replaces text with generic blocks in replay
- Encryption in transit (TLS) and at rest (AES-256)

### 4.5 Integrations
- GTM tag template (custom html + data-layer config)
- Direct <script> embed for non-GTM users
- SPA compatibility via history API hook
- Webhooks & REST API for exporting aggregates

## 5. Technical Architecture
- **Client SDK**: Tiny ES module, event buffer, gzip + binary encoding
- **Edge Ingest**: Cloudflare Workers to accept events
- **Stream Pipeline**: Kafka/Kinesis -> anonymization processor -> S3 + ClickHouse
- **API & Auth**: GraphQL + JWT; rate-limited
- **Dashboard**: React + Tailwind, server-side rendered

## 6. Performance Requirements
- Initial payload ≤ 35 KB gzipped
- < 50 ms blocking time, < 2% CPU on average client device
- Runtime memory ≤ 2 MB
- 99.9% monthly uptime
- Auto-scale to 100k events/sec

## 7. Compliance
- GDPR, CCPA, LGPD compliant
- No PII stored (0 bytes)
- Data residency option (US/EU)
- ISO 27001 SOC2 alignment

## 8. Data Model
bash# Save your PRD as the requirements file
cat > InsightLite-PRD.md << 'EOF'
# Product Requirements Document
**Product Name**: InsightLite – Lightweight, privacy-first session analytics

## 1. Purpose & Vision
Modern product and marketing teams need qualitative insights (session replays, heatmaps, click maps) without burdening site performance or risking visitor privacy. InsightLite will deliver Hotjar-class behavior analytics via a snippet small enough to load through Google Tag Manager (GTM) and a data pipeline that stores only anonymous, non-PII session data.

## 2. Goals & Success Metrics
| Goal | Metric | Target |
|------|--------|--------|
| Zero meaningful performance impact | Script weight | ≤ 35 KB gzipped |
| Privacy by design | PII stored | 0 bytes |
| Fast insights | Time from event to dashboard | < 5 min |
| Adoption | Sites with >10k sessions/month within 6 months | 50 |

## 3. Key User Stories
- As a Product Manager, I can watch anonymized session replays so I can diagnose UX issues
- As a Growth Marketer, I can view aggregated heatmaps for any page so I can optimize CTAs  
- As a CTO, I can prove no personal data is stored so I can pass compliance audits
- As a Developer, I can deploy via GTM with no code changes so I can launch in minutes

## 4. Core Features

### 4.1 Client SDK (≤ 35 KB gzipped)
- Single JavaScript snippet (async, tree-shaken)
- Tracks: page views, clicks, scroll depth, mouse movement, form focus/blur, console errors
- Adaptive sampling (default 1 in 5 sessions; configurable)
- Manual event API: window.insight.track('event', {...})

### 4.2 Session Replay
- Real-time streaming to server using WebSocket fallback to XHR
- Playback UI with timeline, click overlay, scroll indicator

### 4.3 Heatmaps & Analytics
- Click, move, and scroll heatmaps per URL path
- Device filter (desktop/tablet/mobile), date range filter
- Funnels and retention cohorts
- Error & rage-click detection

### 4.4 Privacy & Anonymization
- No IP storage (hash then truncated), no cookies by default
- Automatic masking of input fields
- Canvas rendering replaces text with generic blocks in replay
- Encryption in transit (TLS) and at rest (AES-256)

### 4.5 Integrations
- GTM tag template (custom html + data-layer config)
- Direct <script> embed for non-GTM users
- SPA compatibility via history API hook
- Webhooks & REST API for exporting aggregates

## 5. Technical Architecture
- **Client SDK**: Tiny ES module, event buffer, gzip + binary encoding
- **Edge Ingest**: Cloudflare Workers to accept events
- **Stream Pipeline**: Kafka/Kinesis -> anonymization processor -> S3 + ClickHouse
- **API & Auth**: GraphQL + JWT; rate-limited
- **Dashboard**: React + Tailwind, server-side rendered

## 6. Performance Requirements
- Initial payload ≤ 35 KB gzipped
- < 50 ms blocking time, < 2% CPU on average client device
- Runtime memory ≤ 2 MB
- 99.9% monthly uptime
- Auto-scale to 100k events/sec

## 7. Compliance
- GDPR, CCPA, LGPD compliant
- No PII stored (0 bytes)
- Data residency option (US/EU)
- ISO 27001 SOC2 alignment

## 8. Data Model
session_id  STRING  (UUID v4, no linkage to user ID)
site_id     STRING
ts          TIMESTAMP
event_type  ENUM('page','click','input','scroll','error', ...)
event_blob  JSONB (compressed payload)
bash# Save your PRD as the requirements file
cat > InsightLite-PRD.md << 'EOF'
# Product Requirements Document
**Product Name**: InsightLite – Lightweight, privacy-first session analytics

## 1. Purpose & Vision
Modern product and marketing teams need qualitative insights (session replays, heatmaps, click maps) without burdening site performance or risking visitor privacy. InsightLite will deliver Hotjar-class behavior analytics via a snippet small enough to load through Google Tag Manager (GTM) and a data pipeline that stores only anonymous, non-PII session data.

## 2. Goals & Success Metrics
| Goal | Metric | Target |
|------|--------|--------|
| Zero meaningful performance impact | Script weight | ≤ 35 KB gzipped |
| Privacy by design | PII stored | 0 bytes |
| Fast insights | Time from event to dashboard | < 5 min |
| Adoption | Sites with >10k sessions/month within 6 months | 50 |

## 3. Key User Stories
- As a Product Manager, I can watch anonymized session replays so I can diagnose UX issues
- As a Growth Marketer, I can view aggregated heatmaps for any page so I can optimize CTAs  
- As a CTO, I can prove no personal data is stored so I can pass compliance audits
- As a Developer, I can deploy via GTM with no code changes so I can launch in minutes

## 4. Core Features

### 4.1 Client SDK (≤ 35 KB gzipped)
- Single JavaScript snippet (async, tree-shaken)
- Tracks: page views, clicks, scroll depth, mouse movement, form focus/blur, console errors
- Adaptive sampling (default 1 in 5 sessions; configurable)
- Manual event API: window.insight.track('event', {...})

### 4.2 Session Replay
- Real-time streaming to server using WebSocket fallback to XHR
- Playback UI with timeline, click overlay, scroll indicator

### 4.3 Heatmaps & Analytics
- Click, move, and scroll heatmaps per URL path
- Device filter (desktop/tablet/mobile), date range filter
- Funnels and retention cohorts
- Error & rage-click detection

### 4.4 Privacy & Anonymization
- No IP storage (hash then truncated), no cookies by default
- Automatic masking of input fields
- Canvas rendering replaces text with generic blocks in replay
- Encryption in transit (TLS) and at rest (AES-256)

### 4.5 Integrations
- GTM tag template (custom html + data-layer config)
- Direct <script> embed for non-GTM users
- SPA compatibility via history API hook
- Webhooks & REST API for exporting aggregates

## 5. Technical Architecture
- **Client SDK**: Tiny ES module, event buffer, gzip + binary encoding
- **Edge Ingest**: Cloudflare Workers to accept events
- **Stream Pipeline**: Kafka/Kinesis -> anonymization processor -> S3 + ClickHouse
- **API & Auth**: GraphQL + JWT; rate-limited
- **Dashboard**: React + Tailwind, server-side rendered

## 6. Performance Requirements
- Initial payload ≤ 35 KB gzipped
- < 50 ms blocking time, < 2% CPU on average client device
- Runtime memory ≤ 2 MB
- 99.9% monthly uptime
- Auto-scale to 100k events/sec

## 7. Compliance
- GDPR, CCPA, LGPD compliant
- No PII stored (0 bytes)
- Data residency option (US/EU)
- ISO 27001 SOC2 alignment

## 8. Data Model
session_id  STRING  (UUID v4, no linkage to user ID)
site_id     STRING
ts          TIMESTAMP
event_type  ENUM('page','click','input','scroll','error', ...)
event_blob  JSONB (compressed payload)

## 9. Acceptance Criteria
- Script verified by WebPageTest shows < 50 ms CPU blocking and ≤ 35 KB transfer
- GDPR DPIA passes with no PII stored
- 90% of events visible in dashboard within 5 minutes
- Session replay accuracy ±1 px cursor position on reference browsers

**Owner**: Luke Thompson  
**Last Updated**: June 13 2025
