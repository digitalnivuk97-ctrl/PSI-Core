# Simple Setup Guide

This guide uses Docker. You can follow it even if you have never used Docker before.

## What you need

- A computer or server with internet access.
- Docker Desktop or Docker Engine.
- Docker Compose.
- Node.js 20 or newer and pnpm 10 or newer if you want to run the release check.
- A domain name and HTTPS reverse proxy for a public website.

Docker runs the website and its Convex database. The reverse proxy is the front door that turns `https://your-domain.example` into the Docker service.

## First try on your own computer

1. Open a terminal in the project folder.
2. Install the packages:

   ```bash
   pnpm install
   ```

3. Start Core:

   ```bash
   pnpm dev
   ```

4. Open this page in your browser:

   ```text
   http://127.0.0.1:3000/setup
   ```

5. Follow the three screens:

   - Choose Blog, Forum, or Showcase.
   - Create the owner name, email, and password.
   - Review the information and click **Create site**.

6. You will arrive at `/admin`, where you can create posts, forums, projects, and media.

The setup code is filled in automatically when the page is opened from `localhost` or `127.0.0.1`.

## Start a real server with Docker

### 1. Get the project

```bash
git clone https://github.com/digitalnivuk97-ctrl/PSI-Core.git
cd PSI-Core
```

### 2. Make the server settings file

```bash
cp deployment/compose/.env.example deployment/compose/.env
```

Open `deployment/compose/.env` in a text editor. Do not upload this file to GitHub.

### 3. Make three private passwords

Run this command three times:

```bash
openssl rand -hex 32
```

Put a different result into each of these settings:

```text
CONVEX_INTERNAL_KEY=one-result
INSTANCE_SECRET=another-result
PORTABLE_CORE_SETUP_TOKEN=a-third-result
```

Never put these values into the setup wizard. The wizard only needs the Core owner email and password.

### 4. Set the Convex image versions

The example file contains placeholders:

```text
CONVEX_BACKEND_IMAGE=...REPLACE_WITH_RELEASE_DIGEST
CONVEX_DASHBOARD_IMAGE=...REPLACE_WITH_RELEASE_DIGEST
```

Replace both with the approved, digest-pinned Convex image references for your server. Do not use `latest` in production.

### 5. Set the web addresses

For a normal same-machine installation, keep this:

```text
CONVEX_SELF_HOSTED_MODE=local
CONVEX_SELF_HOSTED_URL=http://backend:3210
CONVEX_BIND_ADDRESS=127.0.0.1
CONVEX_BACKEND_PORT=3210
```

Set `NEXT_PUBLIC_CONVEX_URL` to the HTTPS address browsers will use for Convex. For example, if your reverse proxy uses `convex.example.com`, use:

```text
NEXT_PUBLIC_CONVEX_URL=https://convex.example.com
```

Set `COOKIE_SECURE=true` and `PORTABLE_CORE_REQUIRE_HTTPS=true` when HTTPS is working.

### 6. Check the settings

```bash
pnpm release:check
```

Do not continue if this reports a placeholder, missing password, floating image tag, or exposed admin key.

### 7. Start everything

```bash
docker compose --env-file deployment/compose/.env --profile self-hosted up -d --build
```

This starts the Convex database, creates a protected admin key, deploys the Convex functions, and then starts Core. The admin key is not shown in the browser.

### 8. Create the website

Open your Core HTTPS address, such as:

```text
https://core.example.com/setup
```

Copy the `PORTABLE_CORE_SETUP_TOKEN` value from your protected `.env` file into the setup code box. Then finish the wizard.

The wizard asks whether to use Docker Convex on this server or an external Convex service. Choose **Docker Convex on this server** for this guide.

### 9. Check that it is working

```bash
curl -fsS https://core.example.com/health/ready
```

A healthy new installation may say `setup-required` before the wizard is finished. After setup, it should say `ready`.

You can also check Docker:

```bash
docker compose --env-file deployment/compose/.env --profile self-hosted ps
```

## Use an external Convex service

Use this only when somebody else already runs Convex for you.

1. Ask the Convex owner for the public Convex URL and the server URL.
2. Ask for a server-only `CONVEX_INTERNAL_KEY` and a `PORTABLE_CORE_SETUP_TOKEN`.
3. Make sure the Convex functions in `convex/` are already deployed.
4. Set this in `.env`:

   ```text
   CONVEX_SELF_HOSTED_MODE=external
   NEXT_PUBLIC_CONVEX_URL=https://their-convex-service.example
   CONVEX_SELF_HOSTED_URL=https://their-convex-service.example
   ```

5. Start Core without the local Convex profile:

   ```bash
   docker compose --env-file deployment/compose/.env up -d --build
   ```

The wizard will explain the same choice, but it will never ask for a Convex admin key. Admin keys belong only on the server.

## If something goes wrong

- **Page says `setup-required`:** open `/setup` and finish the wizard.
- **Page says `not-ready`:** check `deployment/compose/.env`, then run `pnpm release:check`.
- **Docker says an image is missing:** check the two Convex image values and their digests.
- **Port is already used:** change `PORTABLE_CORE_PORT` or the reverse-proxy port.
- **Setup code is rejected:** copy the current `PORTABLE_CORE_SETUP_TOKEN` exactly. Do not remove spaces or change capitalization.
- **Need to stop the site:** run `docker compose --env-file deployment/compose/.env --profile self-hosted down`.

## Remember these three rules

1. Never share `.env` files or private keys.
2. Never use `latest` images for production.
3. Take regular backups of the Docker data volumes and test a restore before you need it.
