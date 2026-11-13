import { buildApiUrl } from './api';

describe('buildApiUrl', () => {
  it('uses relative /api path when VITE_API_BASE_URL is unset or blank', () => {
    expect(buildApiUrl('/api/analyze', undefined)).toBe('/api/analyze');
    expect(buildApiUrl('/api/draft', '   ')).toBe('/api/draft');
  });

  it('joins base URL without duplicate slashes', () => {
    expect(buildApiUrl('/api/analyze?now=2026-10-26T10:00:00Z', 'https://api.example.com/')).toBe(
      'https://api.example.com/api/analyze?now=2026-10-26T10:00:00Z',
    );
    expect(buildApiUrl('api/draft', 'https://api.example.com///')).toBe(
      'https://api.example.com/api/draft',
    );
  });
});
