import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export function renderMarkdown(markdown: string) {
  const rendered = marked.parse(markdown, { async: false, gfm: true, breaks: true });
  return sanitizeHtml(rendered, {
    allowedTags: ['p', 'br', 'strong', 'em', 'del', 'blockquote', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'a'],
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }, true) },
  });
}
