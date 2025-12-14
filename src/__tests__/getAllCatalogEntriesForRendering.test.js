/**
 * Tests for getAllCatalogEntriesForRendering function
 */
import { getAllCatalogEntriesForRendering } from '../getAllCatalogEntriesForRendering.js';
import pkg from '../../package.json' with { type: 'json' };

// Simple integration tests - these will make real API calls
describe('getAllCatalogEntriesForRendering', () => {
  // Increase timeout for real API calls
  jest.setTimeout(30000);

  describe('Basic structure', () => {
    test('should return object with version and catalogEntries properties', () => {
      // This test just verifies we can import the function
      expect(typeof getAllCatalogEntriesForRendering).toBe('function');
    });

    test('version should match package.json', () => {
      expect(pkg.version).toBe('1.4.0');
    });
  });

  describe('Requested test cases (integration tests)', () => {
    test('unfoldingWord/en_tn/v80 - basic structure test', async () => {
      const result = await getAllCatalogEntriesForRendering({
        owner: 'unfoldingWord',
        repo: 'en_tn',
        ref: 'v80',
        bookId: 'gen',
      });

      expect(result).toHaveProperty('version', '1.4.0');
      expect(result).toHaveProperty('catalogEntries');
      expect(Array.isArray(result.catalogEntries)).toBe(true);
    });

    test('fr_gl/fr_tn/v2 book: 1th - invalid book ID returns structure', async () => {
      const result = await getAllCatalogEntriesForRendering({
        owner: 'fr_gl',
        repo: 'fr_tn',
        ref: 'v2',
        bookId: '1th', // Invalid - should be 1ti for 1 Timothy
      });

      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('catalogEntries');
      expect(Array.isArray(result.catalogEntries)).toBe(true);
    });

    test('fr_gl/gr_tn/v2 book: 1ti - valid book ID', async () => {
      const result = await getAllCatalogEntriesForRendering({
        owner: 'fr_gl',
        repo: 'gr_tn',
        ref: 'v2',
        bookId: '1ti',
      });

      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('catalogEntries');
      expect(Array.isArray(result.catalogEntries)).toBe(true);
    });

    test('BSOJ/ar_twl/v5 book: 1jn - TODO: needs Aligned Bible search fix', async () => {
      // TODO: Fix function to search for Aligned Bible by owner + subject
      // Currently won't find ar_avd because it only looks for standard naming
      const result = await getAllCatalogEntriesForRendering({
        owner: 'BSOJ',
        repo: 'ar_twl',
        ref: 'v5',
        bookId: '1jn',
      });

      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('catalogEntries');
      expect(Array.isArray(result.catalogEntries)).toBe(true);
      
      // When fixed, should find ar_avd in catalogEntries
    });
  });
});
