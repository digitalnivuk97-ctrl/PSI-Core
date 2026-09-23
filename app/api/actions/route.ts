import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentUser, publicState, createCredential, contentSlug, ensureForumDefaults, hasMutation, hasRole, hashToken, id, isValidPassword, newSession, normalizeEmail, readState, recordAudit, rememberMutation, verifyPassword, writeState } from '@/lib/store';
import { incrementCounter } from '@/lib/metrics';
import { enforceRateLimit, rateLimitHeaders, requestFingerprint } from '@/lib/rate-limit';
import { normalizeTags, snapshotPost } from '@/lib/blog';
import type { ActionName, ForumCategory, InternalState, Inquiry, ModerationAction, Post, Project, Reaction, ReadState, Report, Thread, User } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const editorRoles: User['role'][] = ['owner', 'administrator', 'editor', 'author'];
const moderatorRoles: User['role'][] = ['owner', 'administrator', 'moderator'];

function stringValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value.trim();
}

function optionalString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(payload: Record<string, unknown>, key: string, fallback = 0) {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function requireCurrentUser(state: InternalState, user: User | null) {
  if (!user) throw new Error('Sign in required');
  return user;
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host && new URL(origin).host !== host) throw new Error('Cross-origin request rejected');
    const body = await request.json() as { action: ActionName; clientMutationId?: string; payload?: Record<string, unknown> };
    const limit = body.action === 'inquiries.create' ? 10 : 120;
    const rate = enforceRateLimit(`${requestFingerprint(request)}:${body.action}`, limit, 60_000);
    if (!rate.allowed) {
      incrementCounter('rateLimitRejections');
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(limit, rate.remaining, rate.retryAfterSeconds) });
    }
    incrementCounter('requests');
    incrementCounter('mutations');
    const payload = body.payload ?? {};
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('pc_session')?.value;
    const state = await readState();
    const actor = await currentUser(state, sessionToken);
    const existing = hasMutation(state, actor?.publicId ?? 'anonymous', body.clientMutationId);
    if (existing) return NextResponse.json({ result: existing.result, state: publicState(state, actor) });

    let result: unknown = { ok: true };
    if (body.action === 'setup.complete') {
      if (state.setupComplete) throw new Error('Setup is already complete');
      if (payload.setupToken !== state.setupToken) throw new Error('The setup token is invalid or expired');
      const password = stringValue(payload, 'password');
      if (!isValidPassword(password)) throw new Error('Use at least 10 characters with a letter and a number');
      const email = normalizeEmail(stringValue(payload, 'email'));
      if (state.users.some((user) => user.emailNormalized === email)) throw new Error('An account with that email already exists');
      const timestamp = Date.now();
      const user: User = { publicId: id(), emailNormalized: email, displayName: stringValue(payload, 'displayName') || email.split('@')[0], avatarAssetId: null, status: 'active', role: 'owner', createdAt: timestamp, updatedAt: timestamp };
      state.users.push(user);
      state.credentials.push(await createCredential(user.publicId, password));
      state.site.name = stringValue(payload, 'siteName') || 'Portable Core';
      if (typeof payload.siteType === 'string' && ['blog', 'forum', 'showcase'].includes(payload.siteType)) state.site.type = payload.siteType as typeof state.site.type;
      if (typeof payload.publicUrl === 'string' && payload.publicUrl.trim()) state.site.publicUrl = payload.publicUrl.trim();
      ensureForumDefaults(state);
      state.setupComplete = true;
      state.setupToken = '';
      recordAudit(state, user.publicId, 'setup.complete', 'site', state.site.publicId, { siteType: state.site.type });
      const created = newSession(user.publicId);
      state.sessions.push(created.session);
      result = { ok: true, user };
      rememberMutation(state, user.publicId, body.clientMutationId, result);
      await writeState(state);
      return withSession(NextResponse.json({ result, state: publicState(state, user) }), created.token);
    }

    if (body.action === 'auth.signIn') {
      const email = normalizeEmail(stringValue(payload, 'email'));
      const password = stringValue(payload, 'password');
      const user = state.users.find((candidate) => candidate.emailNormalized === email);
      const credential = user && state.credentials.find((candidate) => candidate.userId === user.publicId);
      if (!user || !credential || !(await verifyPassword(password, credential))) throw new Error('Email or password is incorrect');
      const created = newSession(user.publicId);
      state.sessions.push(created.session);
      recordAudit(state, user.publicId, 'auth.signIn', 'user', user.publicId);
      result = { ok: true, user };
      rememberMutation(state, user.publicId, body.clientMutationId, result);
      await writeState(state);
      return withSession(NextResponse.json({ result, state: publicState(state, user) }), created.token);
    }

    if (body.action === 'auth.signOut') {
      if (sessionToken) {
        const session = state.sessions.find((candidate) => candidate.tokenHash === hashToken(sessionToken));
        if (session) session.revokedAt = Date.now();
      }
      await writeState(state);
      const response = NextResponse.json({ result: { ok: true }, state: publicState(state, null) });
      response.cookies.set('pc_session', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
      return response;
    }

    if (body.action === 'inquiries.create') {
      const inquiry: Inquiry = { publicId: id(), projectId: optionalString(payload, 'projectId'), name: stringValue(payload, 'name'), email: normalizeEmail(stringValue(payload, 'email')), message: stringValue(payload, 'message'), status: 'new', createdAt: Date.now(), updatedAt: Date.now() };
      state.inquiries.push(inquiry);
      for (const recipient of state.users.filter((candidate) => ['owner', 'administrator', 'editor'].includes(candidate.role))) state.notifications.push({ publicId: id(), userId: recipient.publicId, kind: 'inquiry', targetType: 'inquiry', targetId: inquiry.publicId, body: `New inquiry from ${inquiry.name}`, readAt: null, createdAt: inquiry.createdAt });
      result = { ok: true, inquiry };
      rememberMutation(state, actor?.publicId ?? 'anonymous', body.clientMutationId, result);
      await writeState(state);
      return NextResponse.json({ result, state: publicState(state, actor) });
    }

    const user = requireCurrentUser(state, actor);
    if (body.action === 'posts.save') {
      if (!hasRole(user, editorRoles)) throw new Error('You do not have permission to edit posts');
      const publicId = optionalString(payload, 'publicId') ?? id();
      const existingPost = state.posts.find((post) => post.publicId === publicId);
      const expectedRevision = numberValue(payload, 'expectedRevision', existingPost?.revision ?? 0);
      if (existingPost && existingPost.revision !== expectedRevision) throw new Error(`This post changed in another session. Current revision: ${existingPost.revision}`);
      const title = stringValue(payload, 'title');
      if (title.length < 1 || title.length > 160) throw new Error('Post titles must contain 1 to 160 characters');
      const bodyMarkdown = stringValue(payload, 'bodyMarkdown');
      if (bodyMarkdown.length > 500_000) throw new Error('Post content is too long');
      const slug = contentSlug(optionalString(payload, 'slug') || title);
      if (state.posts.some((post) => post.slug === slug && post.publicId !== publicId)) throw new Error('That slug is already in use');
      const timestamp = Date.now();
      const post: Post = existingPost ?? { publicId, title: '', slug: '', excerpt: '', bodyMarkdown: '', status: 'draft', authorId: user.publicId, featuredAssetId: null, tagIds: [], publishedAt: null, scheduledFor: null, revision: 0, createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
      post.title = title;
      post.slug = slug;
      post.excerpt = stringValue(payload, 'excerpt').slice(0, 500);
      post.bodyMarkdown = bodyMarkdown;
      post.status = payload.status === 'published' ? 'published' : payload.status === 'draft' ? 'draft' : existingPost?.status ?? 'draft';
      const featuredAssetId = optionalString(payload, 'featuredAssetId');
      if (featuredAssetId && !state.media.some((asset) => asset.publicId === featuredAssetId && asset.status === 'ready')) throw new Error('Featured asset not found');
      post.featuredAssetId = featuredAssetId;
      const tagNames = Array.isArray(payload.tagIds) ? payload.tagIds.filter((tag): tag is string => typeof tag === 'string') : [];
      post.tagIds = normalizeTags(state, tagNames).map((tag) => tag.publicId);
      post.revision += 1;
      post.updatedAt = timestamp;
      if (post.status === 'published') { post.scheduledFor = null; post.publishedAt ??= timestamp; }
      if (!existingPost) state.posts.push(post);
      state.postRevisions.push(snapshotPost(post, user.publicId));
      recordAudit(state, user.publicId, existingPost ? 'post.edit' : 'post.create', 'post', post.publicId, { revision: post.revision });
      result = { ok: true, post, revision: state.postRevisions.at(-1) };
    } else if (body.action === 'posts.publish' || body.action === 'posts.unpublish' || body.action === 'posts.delete' || body.action === 'posts.schedule') {
      if (!hasRole(user, editorRoles)) throw new Error('You do not have permission to edit posts');
      const post = state.posts.find((candidate) => candidate.publicId === stringValue(payload, 'publicId'));
      if (!post) throw new Error('Post not found');
      if (payload.expectedRevision !== undefined && post.revision !== numberValue(payload, 'expectedRevision', post.revision)) throw new Error(`This post changed in another session. Current revision: ${post.revision}`);
      if (body.action === 'posts.delete') post.deletedAt = Date.now();
      else if (body.action === 'posts.publish') { post.status = 'published'; post.scheduledFor = null; post.publishedAt ??= Date.now(); }
      else if (body.action === 'posts.schedule') { const scheduledFor = numberValue(payload, 'scheduledFor'); if (scheduledFor <= Date.now()) throw new Error('Scheduled time must be in the future'); post.status = 'draft'; post.scheduledFor = scheduledFor; }
      else { post.status = 'draft'; post.scheduledFor = null; }
      post.updatedAt = Date.now();
      recordAudit(state, user.publicId, body.action, 'post', post.publicId);
      result = { ok: true, post };
    } else if (body.action === 'categories.create' || body.action === 'categories.update') {
      if (!hasRole(user, ['owner', 'administrator', 'editor'])) throw new Error('You do not have permission to manage categories');
      const existingCategory = optionalString(payload, 'publicId') ? state.categories.find((category) => category.publicId === optionalString(payload, 'publicId')) : null;
      if (body.action === 'categories.update' && !existingCategory) throw new Error('Category not found');
      const name = stringValue(payload, 'name');
      if (name.length < 1 || name.length > 80) throw new Error('Category names must contain 1 to 80 characters');
      const slug = contentSlug(optionalString(payload, 'slug') || name);
      if (state.categories.some((category) => category.slug === slug && category.publicId !== existingCategory?.publicId)) throw new Error('That category slug is already in use');
      const timestamp = Date.now();
      const category: ForumCategory = existingCategory ?? { publicId: id(), name: '', slug: '', description: '', sortOrder: state.categories.length, createdAt: timestamp, updatedAt: timestamp };
      category.name = name;
      category.slug = slug;
      category.description = stringValue(payload, 'description').slice(0, 500);
      category.sortOrder = numberValue(payload, 'sortOrder', category.sortOrder);
      category.updatedAt = timestamp;
      if (!existingCategory) state.categories.push(category);
      recordAudit(state, user.publicId, body.action, 'forumCategory', category.publicId, { slug: category.slug });
      result = { ok: true, category };
    } else if (body.action === 'threads.create') {
      if (!user) throw new Error('Sign in required');
      const categoryId = optionalString(payload, 'categoryId') ?? state.categories[0]?.publicId ?? 'general';
      const category = state.categories.find((candidate) => candidate.publicId === categoryId) ?? state.categories[0];
      if (!category) throw new Error('Create a forum category before creating a thread');
      const title = stringValue(payload, 'title');
      const bodyMarkdown = stringValue(payload, 'bodyMarkdown');
      if (title.length < 1 || title.length > 160 || !bodyMarkdown) throw new Error('Thread title and body are required');
      const timestamp = Date.now();
      const thread: Thread = { publicId: id(), categoryId: category.publicId, authorId: user.publicId, title, status: 'open', pinned: false, locked: false, postCount: 1, lastPostAt: timestamp, lastPostPublicId: null, createdAt: timestamp, updatedAt: timestamp };
      state.threads.push(thread);
      const reply = { publicId: id(), threadId: thread.publicId, parentPostId: null, authorId: user.publicId, bodyMarkdown, revision: 1, editedAt: null, createdAt: timestamp, deletedAt: null, moderationState: 'visible' as const };
      thread.lastPostPublicId = reply.publicId;
      state.replies.push(reply);
      recordAudit(state, user.publicId, 'thread.create', 'thread', thread.publicId, { categoryId: category.publicId });
      result = { ok: true, thread, reply };
    } else if (body.action === 'threads.lock' || body.action === 'threads.unlock') {
      if (!hasRole(user, moderatorRoles)) throw new Error('You do not have permission to moderate threads');
      const thread = state.threads.find((candidate) => candidate.publicId === stringValue(payload, 'publicId'));
      if (!thread) throw new Error('Thread not found');
      thread.locked = body.action === 'threads.lock';
      thread.updatedAt = Date.now();
      const moderationAction: ModerationAction = { publicId: id(), moderatorId: user.publicId, action: thread.locked ? 'lock' : 'unlock', targetType: 'thread', targetId: thread.publicId, reason: stringValue(payload, 'reason') || 'Moderator action', createdAt: Date.now() };
      state.moderationActions.push(moderationAction);
      recordAudit(state, user.publicId, body.action, 'thread', thread.publicId);
      result = { ok: true, thread };
    } else if (body.action === 'forumPosts.create') {
      if (!user) throw new Error('Sign in required');
      const thread = state.threads.find((candidate) => candidate.publicId === stringValue(payload, 'threadId'));
      if (!thread || thread.locked) throw new Error(thread ? 'This thread is locked' : 'Thread not found');
      const bodyMarkdown = stringValue(payload, 'bodyMarkdown');
      if (!bodyMarkdown || bodyMarkdown.length > 50_000) throw new Error('Reply must contain 1 to 50,000 characters');
      const parentPostId = optionalString(payload, 'parentPostId');
      if (parentPostId && !state.replies.some((candidate) => candidate.publicId === parentPostId && candidate.threadId === thread.publicId)) throw new Error('Parent reply not found');
      const timestamp = Date.now();
      const reply = { publicId: id(), threadId: thread.publicId, parentPostId, authorId: user.publicId, bodyMarkdown, revision: 1, editedAt: null, createdAt: timestamp, deletedAt: null, moderationState: 'visible' as const };
      state.replies.push(reply);
      thread.postCount += 1;
      thread.lastPostAt = timestamp;
      thread.lastPostPublicId = reply.publicId;
      thread.updatedAt = timestamp;
      const threadAuthor = thread.authorId;
      if (threadAuthor !== user.publicId) state.notifications.push({ publicId: id(), userId: threadAuthor, kind: 'reply', targetType: 'thread', targetId: thread.publicId, body: `New reply in ${thread.title}`, readAt: null, createdAt: timestamp });
      recordAudit(state, user.publicId, 'forumPost.create', 'forumPost', reply.publicId, { threadId: thread.publicId, parentPostId: parentPostId ?? '' });
      result = { ok: true, reply };
    } else if (body.action === 'forumPosts.edit') {
      const reply = state.replies.find((candidate) => candidate.publicId === stringValue(payload, 'publicId'));
      if (!reply) throw new Error('Reply not found');
      if (reply.authorId !== user.publicId && !hasRole(user, moderatorRoles)) throw new Error('You do not have permission to edit this reply');
      if (reply.revision !== numberValue(payload, 'expectedRevision', reply.revision)) throw new Error(`This reply changed in another session. Current revision: ${reply.revision}`);
      const bodyMarkdown = stringValue(payload, 'bodyMarkdown');
      if (!bodyMarkdown || bodyMarkdown.length > 50_000) throw new Error('Reply must contain 1 to 50,000 characters');
      reply.bodyMarkdown = bodyMarkdown;
      reply.revision += 1;
      reply.editedAt = Date.now();
      recordAudit(state, user.publicId, 'forumPost.edit', 'forumPost', reply.publicId, { revision: reply.revision });
      result = { ok: true, reply };
    } else if (body.action === 'forumPosts.markRead') {
      const thread = state.threads.find((candidate) => candidate.publicId === stringValue(payload, 'threadId'));
      if (!thread) throw new Error('Thread not found');
      const timestamp = Date.now();
      const existingReadState = state.readStates.find((candidate) => candidate.userId === user.publicId && candidate.threadId === thread.publicId);
      const readState: ReadState = existingReadState ?? { publicId: id(), userId: user.publicId, threadId: thread.publicId, lastReadAt: timestamp, updatedAt: timestamp };
      readState.lastReadAt = timestamp;
      readState.updatedAt = timestamp;
      if (!existingReadState) state.readStates.push(readState);
      result = { ok: true, readState };
    } else if (body.action === 'reports.create') {
      const targetType = stringValue(payload, 'targetType') as Report['targetType'];
      if (!['thread', 'forumPost'].includes(targetType)) throw new Error('Invalid report target');
      const targetId = stringValue(payload, 'targetId');
      const targetExists = targetType === 'thread' ? state.threads.some((thread) => thread.publicId === targetId) : state.replies.some((reply) => reply.publicId === targetId && !reply.deletedAt);
      if (!targetExists) throw new Error('Report target not found');
      if (state.reports.some((report) => report.reporterId === user.publicId && report.targetId === targetId && report.status === 'open')) throw new Error('You already reported this item');
      const timestamp = Date.now();
      const report: Report = { publicId: id(), reporterId: user.publicId, targetType, targetId, reason: stringValue(payload, 'reason').slice(0, 1000), status: 'open', createdAt: timestamp, updatedAt: timestamp, resolvedBy: null };
      state.reports.push(report);
      for (const moderator of state.users.filter((candidate) => ['owner', 'administrator', 'moderator'].includes(candidate.role))) state.notifications.push({ publicId: id(), userId: moderator.publicId, kind: 'moderation', targetType: 'report', targetId: report.publicId, body: 'A new forum report needs review', readAt: null, createdAt: timestamp });
      result = { ok: true, report };
    } else if (body.action === 'reports.update') {
      if (!hasRole(user, moderatorRoles)) throw new Error('You do not have permission to review reports');
      const report = state.reports.find((candidate) => candidate.publicId === stringValue(payload, 'publicId'));
      if (!report) throw new Error('Report not found');
      const status = stringValue(payload, 'status') as Report['status'];
      if (!['open', 'reviewing', 'resolved', 'dismissed'].includes(status)) throw new Error('Invalid report status');
      report.status = status;
      report.updatedAt = Date.now();
      report.resolvedBy = ['resolved', 'dismissed'].includes(status) ? user.publicId : null;
      state.moderationActions.push({ publicId: id(), moderatorId: user.publicId, action: status === 'dismissed' ? 'dismiss_report' : 'resolve_report', targetType: 'report', targetId: report.publicId, reason: 'Report review', createdAt: Date.now() });
      result = { ok: true, report };
    } else if (body.action === 'moderation.remove' || body.action === 'moderation.restore') {
      if (!hasRole(user, moderatorRoles)) throw new Error('You do not have permission to moderate content');
      const targetType = stringValue(payload, 'targetType') as ModerationAction['targetType'];
      if (!['thread', 'forumPost'].includes(targetType)) throw new Error('Invalid moderation target');
      const targetId = stringValue(payload, 'targetId');
      if (targetType === 'thread') {
        const thread = state.threads.find((candidate) => candidate.publicId === targetId);
        if (!thread) throw new Error('Thread not found');
        thread.status = body.action === 'moderation.remove' ? 'closed' : 'open';
        thread.updatedAt = Date.now();
        state.moderationActions.push({ publicId: id(), moderatorId: user.publicId, action: body.action === 'moderation.remove' ? 'remove' : 'restore', targetType, targetId, reason: stringValue(payload, 'reason') || 'Moderator action', createdAt: Date.now() });
        result = { ok: true, thread };
      } else {
        const reply = state.replies.find((candidate) => candidate.publicId === targetId);
        if (!reply) throw new Error('Reply not found');
        reply.deletedAt = body.action === 'moderation.remove' ? Date.now() : null;
        reply.moderationState = body.action === 'moderation.remove' ? 'removed' : 'visible';
        state.moderationActions.push({ publicId: id(), moderatorId: user.publicId, action: body.action === 'moderation.remove' ? 'remove' : 'restore', targetType, targetId, reason: stringValue(payload, 'reason') || 'Moderator action', createdAt: Date.now() });
        result = { ok: true, reply };
      }
    } else if (body.action === 'reactions.toggle') {
      const targetType = stringValue(payload, 'targetType') as Reaction['targetType'];
      if (!['thread', 'forumPost'].includes(targetType)) throw new Error('Invalid reaction target');
      const targetId = stringValue(payload, 'targetId');
      const targetExists = targetType === 'thread' ? state.threads.some((thread) => thread.publicId === targetId) : state.replies.some((reply) => reply.publicId === targetId && !reply.deletedAt);
      if (!targetExists) throw new Error('Reaction target not found');
      const kind = stringValue(payload, 'kind').slice(0, 30);
      if (!kind) throw new Error('Reaction kind is required');
      const existing = state.reactions.find((reaction) => reaction.userId === user.publicId && reaction.targetType === targetType && reaction.targetId === targetId && reaction.kind === kind);
      if (existing) state.reactions = state.reactions.filter((reaction) => reaction.publicId !== existing.publicId);
      else state.reactions.push({ publicId: id(), userId: user.publicId, targetType, targetId, kind, createdAt: Date.now() });
      result = { ok: true, active: !existing, count: state.reactions.filter((reaction) => reaction.targetType === targetType && reaction.targetId === targetId && reaction.kind === kind).length };
    } else if (body.action === 'forumPosts.delete') {
      if (!hasRole(user, moderatorRoles)) throw new Error('You do not have permission to moderate replies');
      const reply = state.replies.find((candidate) => candidate.publicId === stringValue(payload, 'publicId'));
      if (!reply) throw new Error('Reply not found');
      reply.deletedAt = Date.now();
      reply.moderationState = 'removed';
      state.moderationActions.push({ publicId: id(), moderatorId: user.publicId, action: 'remove', targetType: 'forumPost', targetId: reply.publicId, reason: stringValue(payload, 'reason') || 'Moderator action', createdAt: Date.now() });
      recordAudit(state, user.publicId, 'forumPosts.delete', 'forumPost', reply.publicId);
      result = { ok: true, reply };
    } else if (body.action === 'projects.save') {
      if (!hasRole(user, editorRoles)) throw new Error('You do not have permission to edit projects');
      const publicId = optionalString(payload, 'publicId') ?? id();
      const existingProject = state.projects.find((project) => project.publicId === publicId);
      const expectedRevision = numberValue(payload, 'expectedRevision', existingProject?.revision ?? 0);
      if (existingProject && existingProject.revision !== expectedRevision) throw new Error(`This project changed in another session. Current revision: ${existingProject.revision}`);
      const title = stringValue(payload, 'title');
      if (title.length < 1 || title.length > 160) throw new Error('Project titles must contain 1 to 160 characters');
      const slug = contentSlug(optionalString(payload, 'slug') || title);
      if (state.projects.some((project) => project.slug === slug && project.publicId !== publicId)) throw new Error('That slug is already in use');
      const timestamp = Date.now();
      const project: Project = existingProject ?? { publicId, title: '', slug: '', summary: '', bodyMarkdown: '', status: 'draft', authorId: user.publicId, assetIds: [], tagIds: [], customFields: {}, sortOrder: 0, publishedAt: null, revision: 0, createdAt: timestamp, updatedAt: timestamp };
      project.title = title;
      project.slug = slug;
      project.summary = stringValue(payload, 'summary').slice(0, 500);
      project.bodyMarkdown = stringValue(payload, 'bodyMarkdown');
      project.status = payload.status === 'published' ? 'published' : 'draft';
      const assetIds = Array.isArray(payload.assetIds) ? payload.assetIds.filter((assetId): assetId is string => typeof assetId === 'string') : [];
      if (assetIds.some((assetId) => !state.media.some((asset) => asset.publicId === assetId && asset.status === 'ready'))) throw new Error('One or more project assets were not found');
      project.assetIds = assetIds;
      const projectTagNames = Array.isArray(payload.tagIds) ? payload.tagIds.filter((tag): tag is string => typeof tag === 'string') : [];
      project.tagIds = normalizeTags(state, projectTagNames).map((tag) => tag.publicId);
      const customFields = payload.customFields;
      project.customFields = customFields && typeof customFields === 'object' && !Array.isArray(customFields) ? Object.fromEntries(Object.entries(customFields).filter(([key, value]) => /^[a-zA-Z0-9_-]{1,40}$/.test(key) && typeof value === 'string').slice(0, 20).map(([key, value]) => [key, String(value).slice(0, 500)])) : {};
      project.sortOrder = numberValue(payload, 'sortOrder', project.sortOrder);
      if (project.status === 'published' && !project.publishedAt) project.publishedAt = timestamp;
      project.revision += 1;
      project.updatedAt = timestamp;
      if (!existingProject) state.projects.push(project);
      recordAudit(state, user.publicId, existingProject ? 'project.edit' : 'project.create', 'project', project.publicId, { revision: project.revision });
      result = { ok: true, project };
    } else if (body.action === 'projects.publish') {
      if (!hasRole(user, editorRoles)) throw new Error('You do not have permission to publish projects');
      const project = state.projects.find((candidate) => candidate.publicId === stringValue(payload, 'publicId'));
      if (!project) throw new Error('Project not found');
      if (payload.expectedRevision !== undefined && project.revision !== numberValue(payload, 'expectedRevision', project.revision)) throw new Error(`This project changed in another session. Current revision: ${project.revision}`);
      project.status = 'published';
      project.publishedAt ??= Date.now();
      project.updatedAt = Date.now();
      result = { ok: true, project };
    } else if (body.action === 'inquiries.updateStatus') {
      if (!hasRole(user, ['owner', 'administrator', 'editor'])) throw new Error('You do not have permission to update inquiries');
      const inquiry = state.inquiries.find((candidate) => candidate.publicId === stringValue(payload, 'publicId'));
      if (!inquiry) throw new Error('Inquiry not found');
      inquiry.status = stringValue(payload, 'status') as Inquiry['status'];
      inquiry.updatedAt = Date.now();
      result = { ok: true, inquiry };
    } else if (body.action === 'notifications.markRead' || body.action === 'notifications.markAllRead') {
      if (!user) throw new Error('Sign in required');
      if (body.action === 'notifications.markAllRead') state.notifications.filter((notification) => notification.userId === user.publicId && !notification.readAt).forEach((notification) => { notification.readAt = Date.now(); });
      else {
        const notification = state.notifications.find((candidate) => candidate.publicId === stringValue(payload, 'publicId') && candidate.userId === user.publicId);
        if (!notification) throw new Error('Notification not found');
        notification.readAt = Date.now();
      }
      result = { ok: true };
    } else if (body.action === 'users.create') {
      if (!hasRole(user, ['owner', 'administrator'])) throw new Error('You do not have permission to create users');
      const email = normalizeEmail(stringValue(payload, 'email'));
      if (state.users.some((candidate) => candidate.emailNormalized === email)) throw new Error('An account with that email already exists');
      const password = stringValue(payload, 'password');
      if (!isValidPassword(password)) throw new Error('Use at least 10 characters with a letter and a number');
      const timestamp = Date.now();
      const created: User = { publicId: id(), emailNormalized: email, displayName: stringValue(payload, 'displayName') || email.split('@')[0], avatarAssetId: null, status: 'active', role: ['administrator', 'editor', 'moderator', 'author', 'member'].includes(stringValue(payload, 'role')) ? stringValue(payload, 'role') as User['role'] : 'member', createdAt: timestamp, updatedAt: timestamp };
      state.users.push(created);
      state.credentials.push(await createCredential(created.publicId, password));
      recordAudit(state, user.publicId, 'user.create', 'user', created.publicId, { role: created.role });
      result = { ok: true, user: created };
    } else if (body.action === 'users.setRoles') {
      if (!hasRole(user, ['owner', 'administrator'])) throw new Error('You do not have permission to change roles');
      const target = state.users.find((candidate) => candidate.publicId === stringValue(payload, 'publicId'));
      if (!target) throw new Error('User not found');
      const nextRole = stringValue(payload, 'role') as User['role'];
      if (!['administrator', 'editor', 'moderator', 'author', 'member'].includes(nextRole)) throw new Error('Invalid role');
      target.role = nextRole;
      target.updatedAt = Date.now();
      recordAudit(state, user.publicId, 'user.role', 'user', target.publicId, { role: nextRole });
      result = { ok: true, user: target };
    } else if (body.action === 'settings.update') {
      if (!hasRole(user, ['owner', 'administrator'])) throw new Error('You do not have permission to update settings');
      state.site.name = stringValue(payload, 'name');
      state.site.publicUrl = stringValue(payload, 'publicUrl');
      state.site.timezone = stringValue(payload, 'timezone');
      state.site.locale = stringValue(payload, 'locale');
      state.site.settingsVersion += 1;
      state.site.updatedAt = Date.now();
      recordAudit(state, user.publicId, 'settings.update', 'site', state.site.publicId, { settingsVersion: state.site.settingsVersion });
      result = { ok: true, site: state.site };
    } else {
      throw new Error('Unknown action');
    }

    rememberMutation(state, user.publicId, body.clientMutationId, result);
    await writeState(state);
    return NextResponse.json({ result, state: publicState(state, user) });
  } catch (error) {
    incrementCounter('mutationFailures');
    if (error instanceof Error && /permission|forbidden|sign in|required/i.test(error.message)) incrementCounter('authorizationFailures');
    const message = error instanceof Error ? error.message : 'Action failed';
    const response = NextResponse.json({ error: message }, { status: 400 });
    response.headers.set('x-portable-core-action-error', message);
    return response;
  }
}

function withSession(response: NextResponse, token: string) {
  response.cookies.set('pc_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 14 });
  return response;
}
