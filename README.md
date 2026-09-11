# V.I.P LOGISTICS TRANSPORT VTC Website

React + TypeScript + Vite + Tailwind CSS VTC website with a Vercel Function for recruitment applications.

## Local development

```bash
npm install
npm run dev
```

For local application testing, create a `.env.local` file with:

```text
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

The webhook is used only by the server-side `/api/apply` function and is never placed in the browser bundle.

## Deploy to Vercel

1. Push this project to GitHub, or upload the project through Vercel Drop.
2. In Vercel, add `DISCORD_WEBHOOK_URL` under Project Settings → Environment Variables.
3. Deploy/redeploy the project.
4. Submit a test application from the live site.

The supplied logo is `public/assets/logo.png` and is used as the website logo and favicon.
# viplog
# viplog
# viplogistics

## V.I.P Delivery Software
Drivers can submit completed deliveries from the public **Delivery Portal**. Submissions are stored as `PENDING` and must be approved by management before they count toward the 10,000 KM monthly progress target. Management reviews them under **Admin → Deliveries & Progress**. TrucksBook CSV import remains available as a backup/legacy import method.

Run the additional SQL in `supabase-schema.sql` to create the `delivery_submissions` table before using the portal.

## Desktop Delivery Client 0.5.3

The Windows delivery client uses TruckTel's ETS2 1.60 REST API on `127.0.0.1:8080` and its job event WebSocket. The TruckTel landing page remains on `127.0.0.1:8079`.
