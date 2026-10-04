import React from 'react';
import MarkdownIt from '@theia/core/shared/markdown-it';

const parser = new MarkdownIt({ html: false, breaks: true }).disable('image');
type Token = ReturnType<typeof parser.parse>[number];
const tags = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'strong',
  'em',
  's',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'a',
]);

/** Render untrusted task text as React nodes, never HTML or automatically loaded media. */
export function MarkdownContent({ text }: { text: string }): React.ReactElement {
  let json: string | undefined;
  if (/^\s*[\[{]/.test(text)) {
    try {
      const value: unknown = JSON.parse(text);
      if (value !== null && typeof value === 'object') json = JSON.stringify(value, null, 2);
    } catch {
      /* Ordinary Markdown can also start with a bracket. */
    }
  }
  const render = (tokens: Token[]): React.ReactNode[] => {
    type Frame = { tag: string; props: Record<string, unknown>; children: React.ReactNode[] };
    const root: Frame = { tag: 'div', props: {}, children: [] };
    const stack = [root];
    for (const [index, token] of tokens.entries()) {
      if (token.hidden) continue;
      const parent = stack[stack.length - 1]!;
      if (token.nesting === 1) {
        const props: Record<string, unknown> = { key: index };
        let tag = tags.has(token.tag) ? token.tag : 'span';
        if (tag === 'a') {
          const href = token.attrGet('href') ?? '';
          let allowed = /^#[\w.-]+$/.test(href);
          try {
            allowed ||= ['https:', 'http:'].includes(new URL(href).protocol);
          } catch {
            /* Relative/command/file links are not navigation permissions. */
          }
          if (allowed) Object.assign(props, { href, target: '_blank', rel: 'noopener noreferrer' });
          else {
            tag = 'span';
            props.title = 'Link target is not available in task text';
          }
        }
        if (tag === 'ol' && token.attrGet('start')) props.start = Number(token.attrGet('start'));
        if (tag === 'th' || tag === 'td') {
          const align = /^text-align:(left|right|center)$/.exec(token.attrGet('style') ?? '');
          if (align) props.style = { textAlign: align[1] };
        }
        stack.push({ tag, props, children: [] });
      } else if (token.nesting === -1 && stack.length > 1) {
        const frame = stack.pop()!;
        stack[stack.length - 1]!.children.push(
          React.createElement(frame.tag, frame.props, ...frame.children),
        );
      } else if (token.type === 'inline') parent.children.push(...render(token.children ?? []));
      else if (token.type === 'fence' || token.type === 'code_block')
        parent.children.push(
          <pre key={index}>
            <code>{token.content}</code>
          </pre>,
        );
      else if (token.type === 'code_inline')
        parent.children.push(<code key={index}>{token.content}</code>);
      else if (token.type === 'softbreak' || token.type === 'hardbreak')
        parent.children.push(<br key={index} />);
      else if (token.type === 'hr') parent.children.push(<hr key={index} />);
      else parent.children.push(token.content);
    }
    return root.children;
  };
  return (
    <div className="gamecrafter-markdown-content">
      {json ? (
        <pre>
          <code>{json}</code>
        </pre>
      ) : (
        render(parser.parse(text, {}))
      )}
    </div>
  );
}
