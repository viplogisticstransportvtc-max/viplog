# Secure Admin + Database Gallery

The V.I.P LOGISTICS TRANSPORT VTC admin now includes a database-backed VTC Gallery.

## Supabase

Run `supabase-schema.sql` in the Supabase SQL Editor. It creates:

- `gallery` — gallery image records
- `admin_sessions` — hashed session tokens used by the secure admin login

## Vercel environment variables

Set these server-side variables:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD_HASH=your-bcrypt-hash
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` with a `VITE_` prefix.

Generate a bcrypt password hash locally with Node after installing `bcryptjs`, for example:

```bash
npx bcryptjs hash YOUR_PASSWORD 12
```

If the CLI is unavailable, use a small Node script with `bcrypt.hash(password, 12)`. Store only the resulting hash in `ADMIN_PASSWORD_HASH`.

## Gallery management

Open `/admin`, sign in, then choose **Gallery**. You can add, edit, reorder and delete images. Public visitors read gallery records through the server API.

Gallery fields:

- Title
- Image URL
- Category
- Description
- Sort order

If the database gallery is empty, the public website temporarily displays the built-in demo gallery so the section is never blank. Once images are added to Supabase, the database gallery takes precedence.
