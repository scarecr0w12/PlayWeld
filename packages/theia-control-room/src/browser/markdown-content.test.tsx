import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './markdown-content';

describe('untrusted task text', () => {
  it('preserves headings, nested lists, code and table structure', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent
        text={
          '## Plan\n\n1. **Build**\n   - Preserve `state`\n\n```ts\nconst state = 1;\n```\n\n| Item | Status |\n| --- | --- |\n| Save | Ready |'
        }
      />,
    );
    expect(html).toContain('<h2>Plan</h2>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<strong>Build</strong>');
    expect(html).toContain('<code>state</code>');
    expect(html).toContain('<table>');
    expect(html).toContain('<pre>');
  });
  it('escapes raw HTML and does not create images or executable links', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent
        text={
          '<script>alert(1)</script>\n\n![private](http://127.0.0.1/private)\n\n[run](command:run) [file](file:///secret) [site](https://example.com)'
        }
      />,
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('href="command:');
    expect(html).not.toContain('href="file:');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it('indents structured JSON without turning its strings into markup', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent text={'{"goal":"<img src=x>","steps":["review","test"]}'} />,
    );
    expect(html).toContain('<pre><code>');
    expect(html).toContain('\n  &quot;goal&quot;');
    expect(html).not.toContain('<img');
  });
});
