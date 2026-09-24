import { expect, test } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';

type JsonObject = {
  setupToken: string;
  result: { post: { status: string }; thread: { publicId: string }; reply: { publicId: string } };
  categories: { publicId: string }[];
  threads: { postCount: number }[];
  readStates: unknown[];
  reports: unknown[];
};

async function jsonRequest(context: BrowserContext, method: 'get' | 'post', path: string, data?: Record<string, unknown>) {
  const response = method === 'get' ? await context.request.get(path) : await context.request.post(path, { data });
  expect(response.ok(), `${method.toUpperCase()} ${path}`).toBeTruthy();
  return response.json() as Promise<JsonObject>;
}

test('two isolated browsers converge on forum replies without draft leakage', async ({ browser }) => {
  const owner = await browser.newContext();
  const visitor = await browser.newContext();
  const setupPage = await owner.newPage();
  await setupPage.goto('/setup');
  await setupPage.getByLabel('Site name').fill('E2E Forum');
  await setupPage.getByRole('button', { name: 'Forum Start conversations with threads and replies.', exact: true }).click();
  await setupPage.getByRole('button', { name: 'Continue' }).click();
  await setupPage.getByLabel('Your name').fill('Owner');
  await setupPage.getByLabel('Email').fill('owner-e2e@example.test');
  await setupPage.getByLabel('Password').fill('SecurePass123');
  await setupPage.getByRole('button', { name: 'Review setup' }).click();
  await expect(setupPage.getByLabel(/Setup code/)).toHaveValue(/[A-Z0-9-]+/);
  await setupPage.getByRole('button', { name: 'Create site' }).click();
  await setupPage.waitForURL('**/admin');
  await setupPage.close();
  const categoryId = (await jsonRequest(owner, 'get', '/api/state')).categories[0].publicId;
  const draft = await jsonRequest(owner, 'post', '/api/actions', { action: 'posts.save', clientMutationId: crypto.randomUUID(), payload: { title: 'Private draft must not leak', slug: 'private-draft', excerpt: 'hidden', bodyMarkdown: 'hidden', status: 'draft', expectedRevision: 0 } });
  expect(draft.result.post.status).toBe('draft');
  const visitorPage = await visitor.newPage();
  await visitorPage.goto('/');
  await expect(visitorPage.getByText('Private draft must not leak')).toHaveCount(0);
  const thread = await jsonRequest(owner, 'post', '/api/actions', { action: 'threads.create', clientMutationId: crypto.randomUUID(), payload: { categoryId, title: 'Realtime thread', bodyMarkdown: 'Opening post' } });
  await expect(visitorPage.getByText('Realtime thread')).toBeVisible();
  await visitorPage.getByText('Realtime thread').click();
  const replyPayload = { action: 'forumPosts.create', clientMutationId: crypto.randomUUID(), payload: { threadId: thread.result.thread.publicId, bodyMarkdown: 'Realtime reply' } };
  const reply = await jsonRequest(owner, 'post', '/api/actions', replyPayload);
  const duplicate = await jsonRequest(owner, 'post', '/api/actions', replyPayload);
  expect(duplicate.result.reply.publicId).toBe(reply.result.reply.publicId);
  await expect(visitorPage.getByText('Realtime reply')).toBeVisible();
  const visitorState = await jsonRequest(visitor, 'get', '/api/state');
  expect(visitorState.threads[0].postCount).toBe(2);
  expect(visitorState.readStates).toHaveLength(0);
  expect(visitorState.reports).toHaveLength(0);
  await visitorPage.reload();
  await expect(visitorPage.getByText('Realtime thread')).toBeVisible();
  await visitorPage.getByText('Realtime thread').click();
  await expect(visitorPage.getByText('Realtime reply')).toBeVisible();
  await owner.close();
  await visitor.close();
});
