import { convertMarkdown } from '../converters/markdownConverter.js';

describe('markdownConverter', () => {
  test('converts level 1-4 headers', () => {
    const input = ['# H1', '## H2', '### H3', '#### H4'].join('\n');
    const html = convertMarkdown(input);

    expect(html).toContain('<h1>H1</h1>');
    expect(html).toContain('<h2>H2</h2>');
    expect(html).toContain('<h3>H3</h3>');
    expect(html).toContain('<h4>H4</h4>');
  });
});
