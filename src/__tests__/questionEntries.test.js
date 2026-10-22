import { placeQuestions, renderQuestionArticle } from '../renderers/questionEntries.js';

const q = (ID) => [{ ID, Question: `Q ${ID}?`, Response: `A ${ID}.` }];
const groups = (placed) =>
  Object.fromEntries([...placed.questions].map(([k, gs]) => [k, gs.map((g) => g.key)]));

describe('placeQuestions', () => {
  test('a question on a verse with notes goes under that verse', () => {
    const placed = placeQuestions(['intro', '1', '2'], { 1: q('a'), 2: q('b') });
    expect(placed.keys).toEqual(['intro', '1', '2']);
    expect(groups(placed)).toEqual({ 1: ['1'], 2: ['2'] });
  });

  test('a range goes under the verse that covers its last verse', () => {
    const placed = placeQuestions(['1', '2', '3', '4'], { '1-3': q('a'), '2-4': q('b') });
    expect(placed.keys).toEqual(['1', '2', '3', '4']);
    expect(groups(placed)).toEqual({ 3: ['1-3'], 4: ['2-4'] });
  });

  test('a note range covering the last verse takes the question', () => {
    const placed = placeQuestions(['1', '2-4', '5'], { 3: q('a'), '1-4': q('b') });
    expect(groups(placed)).toEqual({ '2-4': ['3', '1-4'] });
  });

  test('of overlapping note ranges covering its last verse, the one read last wins', () => {
    const placed = placeQuestions(['1-5', '3-6'], { 4: q('a') });
    expect(groups(placed)).toEqual({ '3-6': ['4'] });
  });

  test('a question on verses without notes gets its own block, in reading order', () => {
    const placed = placeQuestions(['intro', '1', '5', '9'], {
      3: q('a'),
      '6-8': q('b'),
      7: q('c'),
      12: q('d'),
    });
    expect(placed.keys).toEqual(['intro', '1', '3', '5', '7', '6-8', '9', '12']);
    expect(groups(placed)).toEqual({ 3: ['3'], 7: ['7'], '6-8': ['6-8'], 12: ['12'] });
  });

  test('a chapter-level question goes after the last block', () => {
    const placed = placeQuestions(['intro', '1', '2'], { intro: q('a'), 1: q('b') });
    expect(placed.keys).toEqual(['intro', '1', '2']);
    expect(groups(placed)).toEqual({ 1: ['1'], 2: ['intro'] });
  });

  test('a chapter with questions and no notes keeps them all', () => {
    const placed = placeQuestions([], { 2: q('a'), intro: q('b') });
    expect(placed.keys).toEqual(['2']);
    expect(groups(placed)).toEqual({ 2: ['2', 'intro'] });
    expect(placeQuestions([], { intro: q('c') }).keys).toEqual(['intro']);
  });

  test('no questions leaves the note keys as they are', () => {
    const placed = placeQuestions(['intro', '1', '2-3'], {});
    expect(placed.keys).toEqual(['intro', '1', '2-3']);
    expect(placed.questions.size).toBe(0);
    expect(placeQuestions(['1'], { 2: [] }).keys).toEqual(['1']);
  });
});

describe('renderQuestionArticle', () => {
  const row = { ID: 'x1', Question: 'Who <wrote>?', Response: 'Paul & Timothy.' };
  const ctx = {
    anchor: 'nav-tit-1-1-x1',
    bookId: 'tit',
    chapterKey: '1',
    bibles: [],
    isObs: false,
  };

  test('the question heading is h4 by default and can be another level', () => {
    expect(renderQuestionArticle(row, ctx)).toContain(
      '<h4 class="tq-entry-question"><a href="#nav-tit-1-1-x1" class="header-link">Who &lt;wrote&gt;?</a></h4>'
    );
    expect(renderQuestionArticle(row, { ...ctx, headingTag: 'h5' })).toMatch(
      /<h5 class="tq-entry-question">.*<\/h5>/
    );
  });

  test('the answer sits behind its toggle', () => {
    const html = renderQuestionArticle(row, ctx);
    expect(html).toContain(
      '<input type="checkbox" class="response-show-checkbox" id="chk-nav-tit-1-1-x1">'
    );
    expect(html).toContain('<div class="tq-entry-response"><p>Paul &amp; Timothy.</p>');
  });

  test('the anchor is encoded in every attribute and the heading tag is h1-h6 only', () => {
    const html = renderQuestionArticle(row, {
      ...ctx,
      anchor: 'nav-x" onclick="alert(1)<b>',
      headingTag: 'script',
    });
    const safe = 'nav-x&quot; onclick=&quot;alert(1)&lt;b&gt;';
    expect(html).not.toContain('onclick="');
    expect(html).toContain(`<article class="tq-question" id="${safe}">`);
    expect(html).toContain(`href="#${safe}"`);
    expect(html).toContain(`id="chk-${safe}"`);
    expect(html).toContain(`for="chk-${safe}"`);
    expect(html.match(/<article/g)).toHaveLength(1);
    expect(html).toContain('<h4 class="tq-entry-question">');
  });
});
