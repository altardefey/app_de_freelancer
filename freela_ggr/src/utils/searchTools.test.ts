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

//OBS: rodar o commando "npm install -D jest jest-expo @types/jest"
// Em caso de erro, acrescentar em "tsconfig.json" a propriedade "types": ["jest", "react-native"]
