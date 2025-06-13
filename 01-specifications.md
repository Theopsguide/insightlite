# InsightLite - Detailed Specifications

## Functional Requirements

### FR1: Client SDK Core
- **FR1.1**: Provide single JavaScript snippet ≤ 35 KB gzipped
- **FR1.2**: Support async loading without blocking page render
- **FR1.3**: Track page views, clicks, scroll depth, mouse movement, form interactions, console errors
- **FR1.4**: Implement adaptive sampling (default 1:5 sessions, configurable)
- **FR1.5**: Expose manual event API: `window.insight.track('event', {...})`
- **FR1.6**: Support tree-shaking for unused features

### FR2: Session Replay
- **FR2.1**: Stream session data in real-time via WebSocket
- **FR2.2**: Fallback to XHR for transport reliability
- **FR2.3**: Provide playback UI with timeline controls
- **FR2.4**: Display click overlays and scroll indicators
- **FR2.5**: Maintain ±1px cursor position accuracy

### FR3: Analytics & Heatmaps
- **FR3.1**: Generate click, move, and scroll heatmaps per URL path
- **FR3.2**: Filter by device type (desktop/tablet/mobile)
- **FR3.3**: Filter by date range
- **FR3.4**: Create funnel analysis and retention cohorts
- **FR3.5**: Detect and flag error events and rage-clicks

### FR4: Privacy & Anonymization
- **FR4.1**: Store zero PII (0 bytes)
- **FR4.2**: Hash and truncate IP addresses
- **FR4.3**: Automatically mask input fields
- **FR4.4**: Replace text with generic blocks in canvas rendering
- **FR4.5**: Encrypt data in transit (TLS) and at rest (AES-256)

### FR5: Integrations
- **FR5.1**: Provide GTM tag template with data-layer config
- **FR5.2**: Support direct `<script>` embed
- **FR5.3**: Hook into History API for SPA compatibility
- **FR5.4**: Expose webhooks and REST API for data export

## Non-Functional Requirements

### NFR1: Performance
- **NFR1.1**: Initial payload ≤ 35 KB gzipped
- **NFR1.2**: Blocking time < 50ms on page load
- **NFR1.3**: CPU usage < 2% on average client device
- **NFR1.4**: Runtime memory usage ≤ 2 MB
- **NFR1.5**: System uptime 99.9% monthly
- **NFR1.6**: Auto-scale to handle 100k events/second

### NFR2: Security
- **NFR2.1**: Implement TLS 1.3 for all data transmission
- **NFR2.2**: Use AES-256 encryption for data at rest
- **NFR2.3**: JWT-based authentication with rate limiting
- **NFR2.4**: Secure session ID generation (UUID v4, no user linkage)

### NFR3: Compliance
- **NFR3.1**: GDPR compliant - no personal data storage
- **NFR3.2**: CCPA compliant - respect user privacy rights
- **NFR3.3**: LGPD compliant - Brazilian data protection law
- **NFR3.4**: Align with ISO 27001 and SOC2 standards
- **NFR3.5**: Support data residency options (US/EU)

### NFR4: Reliability
- **NFR4.1**: Event processing latency < 5 minutes
- **NFR4.2**: 90% of events visible in dashboard within 5 minutes
- **NFR4.3**: Graceful degradation when services unavailable
- **NFR4.4**: Automatic retry mechanisms with exponential backoff

## Technical Constraints

### TC1: Client-Side Constraints
- **TC1.1**: Must work in browsers IE11+ (legacy support)
- **TC1.2**: No external dependencies beyond standard Web APIs
- **TC1.3**: Must not conflict with existing page JavaScript
- **TC1.4**: Memory footprint must not exceed 2MB
- **TC1.5**: Must support Content Security Policy (CSP)

### TC2: Infrastructure Constraints
- **TC2.1**: Use Cloudflare Workers for edge computing
- **TC2.2**: Implement streaming pipeline with Kafka/Kinesis
- **TC2.3**: Store processed data in S3 + ClickHouse
- **TC2.4**: GraphQL API with rate limiting
- **TC2.5**: React-based dashboard with server-side rendering

### TC3: Data Constraints
- **TC3.1**: Maximum event payload size: 64KB
- **TC3.2**: Session duration limit: 8 hours
- **TC3.3**: Data retention period: 13 months
- **TC3.4**: Binary encoding for payload compression
- **TC3.5**: JSONB format for flexible event storage

## User Stories & Acceptance Criteria

### Epic 1: Product Manager Experience
**Story**: As a Product Manager, I can watch anonymized session replays to diagnose UX issues

**Acceptance Criteria**:
- Given a session replay is available
- When I select a session from the dashboard
- Then I can view the replay with timeline controls
- And I can see click overlays and scroll indicators
- And no PII is visible in the replay
- And cursor position is accurate within ±1px

### Epic 2: Growth Marketer Experience
**Story**: As a Growth Marketer, I can view aggregated heatmaps for any page to optimize CTAs

**Acceptance Criteria**:
- Given sufficient session data exists for a page
- When I navigate to the heatmap view
- Then I can see click, move, and scroll heatmaps
- And I can filter by device type and date range
- And I can identify high-interaction areas
- And I can export heatmap data via API

### Epic 3: CTO Compliance Experience
**Story**: As a CTO, I can prove no personal data is stored to pass compliance audits

**Acceptance Criteria**:
- Given the system is operational
- When I review data storage and processing
- Then I can verify 0 bytes of PII are stored
- And I can see IP addresses are hashed and truncated
- And I can confirm encryption is applied at rest and in transit
- And I can generate compliance reports

### Epic 4: Developer Integration Experience
**Story**: As a Developer, I can deploy via GTM with no code changes to launch in minutes

**Acceptance Criteria**:
- Given I have GTM access
- When I add the InsightLite tag template
- Then the script loads asynchronously without blocking
- And tracking begins immediately
- And I can verify the script is ≤ 35KB gzipped
- And page performance impact is < 50ms blocking time

## Data Model Schema

```sql
-- Core Events Table
CREATE TABLE events (
    session_id UUID NOT NULL,
    site_id VARCHAR(50) NOT NULL,
    ts TIMESTAMP NOT NULL,
    event_type ENUM('page','click','input','scroll','error','custom') NOT NULL,
    event_blob JSONB NOT NULL,
    device_type ENUM('desktop','tablet','mobile') NOT NULL,
    url_path VARCHAR(500) NOT NULL,
    INDEX idx_session_ts (session_id, ts),
    INDEX idx_site_path_ts (site_id, url_path, ts),
    INDEX idx_event_type_ts (event_type, ts)
);

-- Aggregated Heatmap Data
CREATE TABLE heatmap_data (
    site_id VARCHAR(50) NOT NULL,
    url_path VARCHAR(500) NOT NULL,
    device_type ENUM('desktop','tablet','mobile') NOT NULL,
    date_bucket DATE NOT NULL,
    interaction_type ENUM('click','move','scroll') NOT NULL,
    coordinates JSONB NOT NULL,
    count INTEGER NOT NULL,
    INDEX idx_heatmap_lookup (site_id, url_path, device_type, date_bucket)
);
```

## System Boundaries

### In Scope
- Client-side event collection and transmission
- Real-time session replay functionality
- Heatmap generation and visualization
- Privacy-compliant data processing
- GTM and direct integration methods
- Basic analytics and reporting dashboard

### Out of Scope
- A/B testing functionality
- Advanced funnel analysis beyond basic metrics
- Custom dashboard theming
- Mobile app SDKs (web-only)
- Real-time alerting and notifications
- Advanced user segmentation