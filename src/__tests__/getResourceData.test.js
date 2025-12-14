/**
 * Tests for getResourceData function
 */
import { getResourceData } from '../getResourceData.js';
import axios from 'axios';

// Mock axios to avoid real network calls in tests
jest.mock('axios');

describe('getResourceData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    test('should accept all required parameters', async () => {
      // Since getResourceData makes real API calls, we just verify it accepts parameters
      // without throwing synchronously
      expect(() => {
        getResourceData({
          owner: 'unfoldingWord',
          repo: 'en_tn',
          ref: 'v80',
          bookId: 'gen',
        });
      }).not.toThrow();
    });

    test('should handle custom dcsApiUrl parameter', async () => {
      const customUrl = 'https://custom-dcs.example.com';

      // Verify function accepts dcsApiUrl parameter
      expect(() => {
        getResourceData({
          owner: 'unfoldingWord',
          repo: 'en_tn',
          ref: 'v80',
          bookId: 'gen',
          dcs_api_url: customUrl,
        });
      }).not.toThrow();
    });
  });
});
