export type SiteType = 'blog' | 'forum' | 'showcase';
export type Role = 'owner' | 'administrator' | 'editor' | 'moderator' | 'author' | 'member';
export type ContentStatus = 'draft' | 'published' | 'archived';

export interface Site {
  publicId: string;
  name: string;
  type: SiteType;
  status: 'active' | 'suspended';
  locale: string;
  timezone: string;
  publicUrl: string;
  settingsVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  publicId: string;
  emailNormalized: string;
  displayName: string;
  avatarAssetId: string | null;
  status: 'active' | 'disabled';
  role: Role;
  createdAt: number;
  updatedAt: number;
}

export interface Credential {
  publicId: string;
  userId: string;
  algorithm: 'scrypt';
  algorithmVersion: 1;
  salt: string;
  hash: string;
  updatedAt: number;
}

export interface Session {
  publicId: string;
  userId: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
  lastSeenAt: number;
}

export interface Post {
  publicId: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyMarkdown: string;
  status: ContentStatus;
  authorId: string;
  featuredAssetId: string | null;
  tagIds: string[];
  publishedAt: number | null;
  scheduledFor: number | null;
  revision: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Thread {
  publicId: string;
  categoryId: string;
  authorId: string;
  title: string;
  status: 'open' | 'closed';
  pinned: boolean;
  locked: boolean;
  postCount: number;
  lastPostAt: number;
  lastPostPublicId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ForumReply {
  publicId: string;
  threadId: string;
  parentPostId: string | null;
  authorId: string;
  bodyMarkdown: string;
  revision: number;
  editedAt: number | null;
  createdAt: number;
  deletedAt: number | null;
  moderationState: 'visible' | 'removed' | 'hidden';
}

export interface Project {
  publicId: string;
  title: string;
  slug: string;
  summary: string;
  bodyMarkdown: string;
  status: ContentStatus;
  authorId: string;
  assetIds: string[];
  tagIds: string[];
  customFields: Record<string, string>;
  sortOrder: number;
  publishedAt: number | null;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

export interface Inquiry {
  publicId: string;
  projectId: string | null;
  name: string;
  email: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'closed';
  createdAt: number;
  updatedAt: number;
}

export interface Notification {
  publicId: string;
  userId: string;
  kind: 'reply' | 'inquiry' | 'moderation' | 'system';
  targetType: string;
  targetId: string;
  body: string;
  readAt: number | null;
  createdAt: number;
}

export interface AuditEvent {
  publicId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  requestId: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: number;
}

export interface MutationRecord {
  key: string;
  actorId: string;
  result: unknown;
  createdAt: number;
  expiresAt: number;
}

export interface InternalState {
  site: Site;
  setupComplete: boolean;
  setupToken: string;
  users: User[];
  credentials: Credential[];
  sessions: Session[];
  posts: Post[];
  threads: Thread[];
  replies: ForumReply[];
  projects: Project[];
  inquiries: Inquiry[];
  notifications: Notification[];
  audit: AuditEvent[];
  mutations: MutationRecord[];
  media: MediaAsset[];
}

export interface MediaAsset {
  publicId: string;
  digest: string;
  mediaType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  storageId: string | null;
  status: 'ready' | 'pending' | 'deleted';
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface PublicState {
  site: Site;
  setupComplete: boolean;
  currentUser: User | null;
  users: User[];
  posts: Post[];
  threads: Thread[];
  replies: ForumReply[];
  projects: Project[];
  inquiries: Inquiry[];
  notifications: Notification[];
  audit: AuditEvent[];
  media: MediaAsset[];
  realtime: 'live' | 'reconnecting' | 'offline' | 'error';
  setupToken?: string;
}

export type ActionName =
  | 'setup.complete'
  | 'auth.signIn'
  | 'auth.signOut'
  | 'posts.save'
  | 'posts.publish'
  | 'posts.unpublish'
  | 'posts.schedule'
  | 'posts.delete'
  | 'threads.create'
  | 'threads.lock'
  | 'threads.unlock'
  | 'forumPosts.create'
  | 'forumPosts.delete'
  | 'projects.save'
  | 'projects.publish'
  | 'inquiries.create'
  | 'inquiries.updateStatus'
  | 'notifications.markRead'
  | 'notifications.markAllRead'
  | 'users.create'
  | 'users.setRoles'
  | 'settings.update';

export interface ActionRequest {
  action: ActionName;
  clientMutationId?: string;
  payload?: Record<string, unknown>;
}
