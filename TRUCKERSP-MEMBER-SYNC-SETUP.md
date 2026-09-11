# TruckersMP Member Auto-Sync

This project synchronizes V.I.P LOGISTICS TRANSPORT VTC (TruckersMP VTC ID **91177**) through the official TruckersMP API.

## Supabase
Run the added `truckersmp_members` section in `supabase-schema.sql` in Supabase SQL Editor.

## Vercel environment variable
Add:

`CRON_SECRET` = a long random secret string

The scheduled Vercel job uses this secret to authorize automatic synchronization.

## What it does
- Imports TruckersMP VTC members automatically.
- Stores the VTC member ID separately from the TruckersMP user ID.
- Stores username, avatar, role and join date when provided by the API.
- Marks members who leave the VTC as inactive.
- Public website shows active TruckersMP members.
- Admin → TRUCKERSMP MEMBERS → SYNC NOW performs an immediate sync.
- Vercel cron runs the sync daily at 06:00 UTC.

The official TruckersMP API endpoint used is `GET /v2/vtc/91177/members`.
