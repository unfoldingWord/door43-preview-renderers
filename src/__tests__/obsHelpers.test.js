import { getObsContentPath } from '../obsHelpers.js';

const entry = (type, ingredients) => ({
  metadata_type: type,
  ingredients: ingredients.map(([identifier, path]) => ({ identifier, path })),
});

describe('getObsContentPath', () => {
  test.each([
    ['rc', [['obs', './content']], './content'],
    ['rc', [['obs', './content'], ['01', './content/01.md']], './content'],
    ['sb', [['obs', './ingredients'], ['01', './ingredients/content/01.md']], './ingredients'],
    ['ts', [['obs', '.']], '.'],
  ])('uses the obs folder DCS lists (%s %j)', (type, ingredients, path) => {
    expect(getObsContentPath(entry(type, ingredients))).toBe(path);
  });

  // rc2sb keeps its stories in ingredients/content, Scribe in ingredients, tS in the repo root
  test.each([
    ['sb', [['front', './ingredients/content/front']], './ingredients/content'],
    ['sb', [['01', './ingredients/content/01.md']], './ingredients/content'],
    ['sb', [['front', './ingredients/front.md'], ['01', './ingredients/01.md']], './ingredients'],
    ['ts', [['front', './front'], ['01', './01']], '.'],
  ])('uses the folder of the listed stories (%s %j)', (type, ingredients, path) => {
    expect(getObsContentPath(entry(type, ingredients))).toBe(path);
  });

  test.each([
    ['sb', './ingredients'],
    ['ts', '.'],
    ['rc', './content'],
  ])('falls back to where %s keeps its stories', (type, path) => {
    expect(getObsContentPath(entry(type, []))).toBe(path);
    expect(getObsContentPath({ metadata_type: type })).toBe(path);
  });
});
