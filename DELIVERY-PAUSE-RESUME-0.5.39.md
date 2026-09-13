# Delivery Pause / Resume – v0.5.39

This update changes delivery sessions from a single active job into resumable delivery sessions.

## Driver flow

1. Delivery A starts.
2. Driver switches ETS2/ATS profile and takes Delivery B.
3. The desktop app pauses Delivery A automatically.
4. Delivery B starts normally.
5. Driver switches back to the profile/job for Delivery A.
6. The app pauses B and resumes A automatically when the job signature matches.
7. A's accumulated KM excludes the kilometres driven on B.

Explicit TruckTel `job.cancelled` still cancels the current delivery. A normal job/profile switch no longer cancels the previous delivery.

## Database migration

Run the updated `supabase-schema.sql` in Supabase SQL Editor. It adds:

- `PAUSED` and `CANCELLED` delivery states
- `paused_at` / `resumed_at`
- `segment_start_km`
- `job_signature`
- cumulative `distance_km` support

Existing active deliveries are kept active and receive `segment_start_km = start_km`.

## API additions

`PATCH /api/deliveries`

- `{ "action": "PAUSE", "id": "...", "pause_km": 12345 }`
- `{ "action": "RESUME", "id": "...", "resume_km": 12345 }`

`GET /api/deliveries?active=<username>` now returns:

```json
{
  "active": {},
  "paused": []
}
```

The existing `START`, `COMPLETE`, and `CANCEL` actions remain supported.

## Deployment order

1. Run the Supabase migration.
2. Deploy the modified Vercel project.
3. Build/release the modified desktop client as v0.5.39.
