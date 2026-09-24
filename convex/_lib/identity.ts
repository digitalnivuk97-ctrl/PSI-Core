export type PublicIdentity = { publicId?: unknown; subject?: unknown };

export function identityPublicId(identity: unknown) {
  if (!identity || typeof identity !== 'object') throw new Error('Authentication is required');
  const value = (identity as PublicIdentity).publicId;
  if (typeof value !== 'string' || value.length < 3) throw new Error('Authenticated identity is missing a publicId claim');
  return value;
}
