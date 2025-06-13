import { PrivacyEngine } from '../../src/sdk/privacy';
import { FormEvent, ClickEvent } from '../../src/sdk/types';

describe('PrivacyEngine', () => {
  let privacyEngine: PrivacyEngine;

  beforeEach(() => {
    privacyEngine = new PrivacyEngine();
  });

  describe('Input Field Masking', () => {
    test('should mask password fields', () => {
      const input = document.createElement('input');
      input.type = 'password';
      input.value = 'secret123';

      const formEvent: FormEvent = {
        target: {
          tagName: 'INPUT',
          type: 'password',
          name: 'password',
          value: 'secret123',
        },
        eventType: 'input',
      };

      const sanitized = privacyEngine.sanitizeFormEvent(formEvent);

      expect(sanitized.target.value).toBe('●●●●●●●●●');
    });

    test('should mask email fields', () => {
      const formEvent: FormEvent = {
        target: {
          tagName: 'INPUT',
          type: 'email',
          name: 'email',
          value: 'user@example.com',
        },
        eventType: 'input',
      };

      const sanitized = privacyEngine.sanitizeFormEvent(formEvent);

      expect(sanitized.target.value).toBe('●●●●●●●●●●●●●●●●');
    });

    test('should mask fields with sensitive names', () => {
      const sensitiveFields = [
        { name: 'firstName', value: 'John' },
        { name: 'lastName', value: 'Doe' },
        { name: 'phoneNumber', value: '555-123-4567' },
        { name: 'creditCard', value: '4111-1111-1111-1111' },
        { name: 'ssn', value: '123-45-6789' },
      ];

      sensitiveFields.forEach(field => {
        const formEvent: FormEvent = {
          target: {
            tagName: 'INPUT',
            type: 'text',
            name: field.name,
            value: field.value,
          },
          eventType: 'input',
        };

        const sanitized = privacyEngine.sanitizeFormEvent(formEvent);
        expect(sanitized.target.value).toBe('●'.repeat(field.value.length));
      });
    });

    test('should not mask non-sensitive fields', () => {
      const formEvent: FormEvent = {
        target: {
          tagName: 'INPUT',
          type: 'text',
          name: 'product',
          value: 'laptop',
        },
        eventType: 'input',
      };

      const sanitized = privacyEngine.sanitizeFormEvent(formEvent);

      expect(sanitized.target.value).toBe('laptop');
    });

    test('should respect data-sensitive attribute', () => {
      // Mock element with data-sensitive attribute
      const formEvent: FormEvent = {
        target: {
          tagName: 'INPUT',
          type: 'text',
          name: 'custom',
          value: 'sensitive data',
        },
        eventType: 'input',
      };

      // Mock element has data-sensitive attribute
      const mockElement = {
        hasAttribute: jest.fn(() => true),
        getAttribute: jest.fn(() => 'true'),
      };

      const sanitized = privacyEngine.sanitizeFormEvent(formEvent, mockElement as any);

      expect(sanitized.target.value).toBe('●●●●●●●●●●●●●●');
    });
  });

  describe('Text Content Anonymization', () => {
    test('should replace text with blocks', () => {
      const text = 'Confidential information';
      const anonymized = privacyEngine.anonymizeText(text);

      expect(anonymized).toBe('████████████████████████');
      expect(anonymized.length).toBe(text.length);
    });

    test('should handle empty text', () => {
      const anonymized = privacyEngine.anonymizeText('');
      expect(anonymized).toBe('');
    });

    test('should handle whitespace preservation', () => {
      const text = 'Hello World';
      const anonymized = privacyEngine.anonymizeText(text);

      expect(anonymized).toBe('████████████');
    });
  });

  describe('Element Attribute Sanitization', () => {
    test('should remove sensitive attributes', () => {
      const clickEvent: ClickEvent = {
        x: 100,
        y: 200,
        target: {
          tagName: 'BUTTON',
          className: 'btn-primary',
          id: 'submit-btn',
          textContent: 'Submit Form',
        },
        button: 0,
      };

      const mockElement = {
        getAttribute: jest.fn((attr) => {
          const attrs: Record<string, string> = {
            'data-user-id': '12345',
            'data-session': 'abc123',
            'data-customer': 'john-doe',
          };
          return attrs[attr];
        }),
        hasAttribute: jest.fn((attr) => {
          return ['data-user-id', 'data-session', 'data-customer'].includes(attr);
        }),
        attributes: [
          { name: 'data-user-id', value: '12345' },
          { name: 'data-session', value: 'abc123' },
          { name: 'data-customer', value: 'john-doe' },
        ],
      };

      const sanitized = privacyEngine.sanitizeClickEvent(clickEvent, mockElement as any);

      expect(sanitized.target).not.toHaveProperty('data-user-id');
      expect(sanitized.target).not.toHaveProperty('data-session');
      expect(sanitized.target).not.toHaveProperty('data-customer');
    });

    test('should preserve non-sensitive attributes', () => {
      const clickEvent: ClickEvent = {
        x: 100,
        y: 200,
        target: {
          tagName: 'BUTTON',
          className: 'btn-primary',
          id: 'submit-btn',
          textContent: 'Submit',
        },
        button: 0,
      };

      const sanitized = privacyEngine.sanitizeClickEvent(clickEvent);

      expect(sanitized.target.tagName).toBe('BUTTON');
      expect(sanitized.target.className).toBe('btn-primary');
      expect(sanitized.target.id).toBe('submit-btn');
    });

    test('should anonymize text content', () => {
      const clickEvent: ClickEvent = {
        x: 100,
        y: 200,
        target: {
          tagName: 'SPAN',
          className: 'user-name',
          id: 'name-display',
          textContent: 'John Doe',
        },
        button: 0,
      };

      const sanitized = privacyEngine.sanitizeClickEvent(clickEvent);

      expect(sanitized.target.textContent).toBe('████████');
    });
  });

  describe('Pattern-Based Data Sanitization', () => {
    test('should detect and mask email patterns', () => {
      const text = 'Contact us at support@example.com for help';
      const sanitized = privacyEngine.sanitizeTextPatterns(text);

      expect(sanitized).toBe('Contact us at ●●●●●●●●●●●●●●●●●●● for help');
    });

    test('should detect and mask phone patterns', () => {
      const patterns = [
        '555-123-4567',
        '(555) 123-4567',
        '555.123.4567',
        '5551234567',
      ];

      patterns.forEach(phone => {
        const text = `Call us at ${phone}`;
        const sanitized = privacyEngine.sanitizeTextPatterns(text);
        
        expect(sanitized).toBe(`Call us at ${'●'.repeat(phone.length)}`);
      });
    });

    test('should detect and mask credit card patterns', () => {
      const cardNumbers = [
        '4111-1111-1111-1111',
        '4111 1111 1111 1111',
        '4111111111111111',
      ];

      cardNumbers.forEach(card => {
        const text = `Card: ${card}`;
        const sanitized = privacyEngine.sanitizeTextPatterns(text);
        
        expect(sanitized).toBe(`Card: ${'●'.repeat(card.length)}`);
      });
    });

    test('should detect and mask SSN patterns', () => {
      const text = 'SSN: 123-45-6789';
      const sanitized = privacyEngine.sanitizeTextPatterns(text);

      expect(sanitized).toBe('SSN: ●●●●●●●●●●●');
    });

    test('should handle multiple patterns in same text', () => {
      const text = 'Email: user@test.com Phone: 555-123-4567';
      const sanitized = privacyEngine.sanitizeTextPatterns(text);

      expect(sanitized).toBe('Email: ●●●●●●●●●●●● Phone: ●●●●●●●●●●●●');
    });
  });

  describe('Privacy Mode Configurations', () => {
    test('should apply strict privacy mode', () => {
      const strictEngine = new PrivacyEngine('strict');

      const formEvent: FormEvent = {
        target: {
          tagName: 'INPUT',
          type: 'text',
          name: 'search',
          value: 'normal search term',
        },
        eventType: 'input',
      };

      const sanitized = strictEngine.sanitizeFormEvent(formEvent);

      // In strict mode, all input values should be masked
      expect(sanitized.target.value).toBe('●●●●●●●●●●●●●●●●●●');
    });

    test('should apply balanced privacy mode', () => {
      const balancedEngine = new PrivacyEngine('balanced');

      const formEvent: FormEvent = {
        target: {
          tagName: 'INPUT',
          type: 'text',
          name: 'search',
          value: 'product search',
        },
        eventType: 'input',
      };

      const sanitized = balancedEngine.sanitizeFormEvent(formEvent);

      // In balanced mode, non-sensitive fields should not be masked
      expect(sanitized.target.value).toBe('product search');
    });

    test('should apply permissive privacy mode', () => {
      const permissiveEngine = new PrivacyEngine('permissive');

      const formEvent: FormEvent = {
        target: {
          tagName: 'INPUT',
          type: 'email',
          name: 'email',
          value: 'user@example.com',
        },
        eventType: 'input',
      };

      const sanitized = permissiveEngine.sanitizeFormEvent(formEvent);

      // In permissive mode, only explicitly marked fields are masked
      expect(sanitized.target.value).toBe('user@example.com');
    });
  });

  describe('Coordinate Truncation', () => {
    test('should truncate coordinates for privacy', () => {
      const coordinates = { x: 123.456, y: 789.123 };
      const truncated = privacyEngine.truncateCoordinates(coordinates);

      expect(truncated.x).toBe(120); // Rounded to nearest 10
      expect(truncated.y).toBe(790);
    });

    test('should handle edge coordinates', () => {
      const coordinates = { x: 0, y: 5 };
      const truncated = privacyEngine.truncateCoordinates(coordinates);

      expect(truncated.x).toBe(0);
      expect(truncated.y).toBe(0);
    });
  });

  describe('Session ID Anonymization', () => {
    test('should hash session ID with site salt', () => {
      const sessionId = 'original-session-123';
      const siteId = 'site-456';

      const hashed1 = privacyEngine.hashSessionId(sessionId, siteId);
      const hashed2 = privacyEngine.hashSessionId(sessionId, siteId);

      expect(hashed1).toBe(hashed2); // Should be consistent
      expect(hashed1).not.toBe(sessionId); // Should be different from original
      expect(typeof hashed1).toBe('string');
      expect(hashed1.length).toBeGreaterThan(0);
    });

    test('should produce different hashes for different sites', () => {
      const sessionId = 'session-123';
      const siteId1 = 'site-1';
      const siteId2 = 'site-2';

      const hash1 = privacyEngine.hashSessionId(sessionId, siteId1);
      const hash2 = privacyEngine.hashSessionId(sessionId, siteId2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('URL Sanitization', () => {
    test('should remove query parameters with sensitive data', () => {
      const urls = [
        'https://example.com?email=user@test.com&token=abc123',
        'https://example.com?user_id=12345&session=xyz789',
        'https://example.com?api_key=secret&password=hidden',
      ];

      urls.forEach(url => {
        const sanitized = privacyEngine.sanitizeUrl(url);
        
        expect(sanitized).not.toContain('user@test.com');
        expect(sanitized).not.toContain('abc123');
        expect(sanitized).not.toContain('12345');
        expect(sanitized).not.toContain('secret');
      });
    });

    test('should preserve non-sensitive query parameters', () => {
      const url = 'https://example.com?page=1&category=electronics&sort=price';
      const sanitized = privacyEngine.sanitizeUrl(url);

      expect(sanitized).toBe(url); // Should remain unchanged
    });

    test('should handle URLs without query parameters', () => {
      const url = 'https://example.com/products/laptop';
      const sanitized = privacyEngine.sanitizeUrl(url);

      expect(sanitized).toBe(url);
    });
  });

  describe('Error Handling', () => {
    test('should handle null/undefined inputs gracefully', () => {
      expect(() => {
        privacyEngine.sanitizeFormEvent(null as any);
      }).not.toThrow();

      expect(() => {
        privacyEngine.sanitizeClickEvent(undefined as any);
      }).not.toThrow();

      expect(() => {
        privacyEngine.anonymizeText(null as any);
      }).not.toThrow();
    });

    test('should handle malformed data structures', () => {
      const malformedEvent = {
        target: null,
        eventType: 'input',
      } as any;

      expect(() => {
        privacyEngine.sanitizeFormEvent(malformedEvent);
      }).not.toThrow();
    });

    test('should handle circular references', () => {
      const circular: any = { value: 'test' };
      circular.self = circular;

      expect(() => {
        privacyEngine.sanitizeData(circular);
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    test('should sanitize large datasets efficiently', () => {
      const largeData = {
        events: Array.from({ length: 1000 }, (_, i) => ({
          type: 'click',
          data: {
            x: i,
            y: i * 2,
            target: {
              textContent: `Button ${i}`,
              className: 'btn',
            },
          },
        })),
      };

      const start = performance.now();
      privacyEngine.sanitizeData(largeData);
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Should complete in under 100ms
    });

    test('should cache compiled regex patterns', () => {
      const text = 'Email: user@test.com Phone: 555-123-4567';

      // First call
      const start1 = performance.now();
      privacyEngine.sanitizeTextPatterns(text);
      const end1 = performance.now();

      // Second call should be faster due to caching
      const start2 = performance.now();
      privacyEngine.sanitizeTextPatterns(text);
      const end2 = performance.now();

      expect(end2 - start2).toBeLessThanOrEqual(end1 - start1);
    });
  });
});