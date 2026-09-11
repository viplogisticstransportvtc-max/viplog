# V.I.P Delivery Client 0.5.4

## Fixes

- TruckTel remains on `http://127.0.0.1:8080`.
- Automatic completion can use TruckTel `job.delivered` distance when the live odometer snapshot has not advanced yet.
- Prevents duplicate completion requests while an automatic submission is being processed.
- Management approval now resolves the site's `drivers.id` by driver name before considering TruckersMP `user_id`.
- If a synced TruckersMP member has no website driver profile, approval automatically creates a `TMP-<user_id>` driver profile.
- Approval is idempotent when the same V.I.P delivery record already exists.
- Added a compatibility fallback for databases that have not yet added the optional `source` and `external_id` columns to `delivery_records`.
