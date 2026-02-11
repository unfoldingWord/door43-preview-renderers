import { createHTMLSnippet, renderHTML } from '../renderers/htmlRenderer.js';

describe('htmlRenderer', () => {
  test('renderHTML wraps string content in default container', () => {
    const html = renderHTML('Hello world');

    expect(html).toContain('class="door43-preview"');
    expect(html).toContain('Hello world');
  });

  test('renderHTML supports custom className and inline styles', () => {
    const html = renderHTML('Styled', {
      className: 'custom-preview',
      styles: {
        color: 'red',
        padding: '10px',
      },
    });

    expect(html).toContain('class="custom-preview"');
    expect(html).toContain('style="color: red; padding: 10px"');
  });

  test('renderHTML stringifies object input', () => {
    const html = renderHTML({ key: 'value' });

    expect(html).toContain('"key": "value"');
  });

  test('createHTMLSnippet includes title and metadata tags', () => {
    const html = createHTMLSnippet({
      title: 'Preview',
      content: '<p>Body</p>',
      metadata: {
        source: 'unit-test',
      },
    });

    expect(html).toContain('<title>Preview</title>');
    expect(html).toContain('<meta name="source" content="unit-test">');
    expect(html).toContain('<p>Body</p>');
  });
});
