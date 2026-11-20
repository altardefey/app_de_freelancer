import { distance, normalize } from './searchTools';

describe('searchTools', () => {
  it('normalizes accents, case and surrounding spaces', () => {
    expect(normalize('  Eletricista São Paulo  ')).toBe('eletricista sao paulo');
  });

  it('calculates the edit distance between two strings', () => {
    expect(distance('casa', 'caso')).toBe(1);
    expect(distance('', 'abc')).toBe(3);
  });
});

// para rodar este teste, instale jest e jest-expo como dependências de desenvolvimento
