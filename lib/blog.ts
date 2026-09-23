import { contentSlug, id } from './store';
import type { InternalState, Post, PostRevision, Tag } from './types';

export function normalizeTags(state: InternalState, values: string[]) {
  const names = [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 20);
  const tags: Tag[] = names.map((name) => {
    const slug = contentSlug(name);
    const existing = state.tags.find((tag) => tag.slug === slug);
    if (existing) return existing;
    const timestamp = Date.now();
    const tag: Tag = { publicId: id(), name: name.slice(0, 80), slug, createdAt: timestamp, updatedAt: timestamp };
    state.tags.push(tag);
    return tag;
  });
  return tags;
}

export function snapshotPost(post: Post, editorId: string): PostRevision {
  return { publicId: id(), postId: post.publicId, revision: post.revision, title: post.title, slug: post.slug, excerpt: post.excerpt, bodyMarkdown: post.bodyMarkdown, editorId, createdAt: Date.now() };
}
