# Automatic Delivery Completion – Admin Panel

The admin Delivery Operations panel is now monitoring-only for active deliveries.

- The manual **COMPLETE DRIVE** button and ending-KM prompt have been removed.
- The panel refreshes active deliveries automatically every 5 seconds.
- When the desktop V.I.P Logistics Delivery App receives TruckTel's `job.delivered` event, it calls `/api/deliveries` with `action: COMPLETE`.
- The API records the delivery as `APPROVED`, closes the active delivery, and adds the distance to the monthly progress.
- Management does not need to submit or approve automatically completed deliveries.

## Important

The website cannot read TruckTel directly from a driver's PC. The driver's desktop Delivery App must be running and connected to TruckTel so it can send the completion event to the Vercel API.

The optional management **START DELIVERY** form remains available for exceptional/manual starts. It does not require manual completion afterward.
