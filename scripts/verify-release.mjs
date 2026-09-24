import { readFile } from 'node:fs/promises';

const compose = await readFile('deployment/compose/compose.yaml', 'utf8');
const env = await readFile('deployment/compose/.env', 'utf8').catch(() => '');
const errors = [];
const mode = env.match(/^CONVEX_SELF_HOSTED_MODE=(.*)$/m)?.[1]?.trim();
const required = ['CONVEX_SELF_HOSTED_MODE', 'NEXT_PUBLIC_CONVEX_URL', 'CONVEX_SELF_HOSTED_URL', 'CONVEX_INTERNAL_KEY', 'PORTABLE_CORE_SETUP_TOKEN'];
if (mode === 'local') required.push('CONVEX_BACKEND_IMAGE', 'CONVEX_DASHBOARD_IMAGE', 'INSTANCE_SECRET');
if (!env) errors.push('deployment/compose/.env is missing; copy deployment/compose/.env.example and pin every placeholder');
for (const key of required) {
  const value = env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();
  if (!value) errors.push(`${key} is required`);
  if (value && /latest|REPLACE|replace-|example\.test/.test(value)) errors.push(`${key} contains an unsafe placeholder or floating tag`);
}
if (mode !== 'local' && mode !== 'external') errors.push('CONVEX_SELF_HOSTED_MODE must be local or external');
const webBlock = compose.split('\n  backend:')[0];
if (webBlock.includes('CONVEX_SELF_HOSTED_ADMIN_KEY')) errors.push('The web service must not receive the Convex admin key');
if (!compose.includes('CONVEX_BACKEND_IMAGE') || !compose.includes('CONVEX_DASHBOARD_IMAGE')) errors.push('Compose must define Convex backend and dashboard images');
const webBlock = compose.split('\n  backend:')[0];
if (webBlock.includes('CONVEX_SELF_HOSTED_ADMIN_KEY')) errors.push('The web service must not receive the Convex admin key');
if (errors.length > 0) {
  console.error(errors.map((error) => `release check: ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('release check passed');
}
