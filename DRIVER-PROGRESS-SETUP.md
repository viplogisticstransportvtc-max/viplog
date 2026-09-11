# Driver Deliveries & Distance Progress

This version adds a monthly Driver Progress system.

## 1. Run the Supabase SQL

Open **Supabase → SQL Editor**, paste the updated `supabase-schema.sql`, and run it. The new table is:

- `public.delivery_records`

It stores driver, delivery date, route, cargo and distance in kilometres.

## 2. Deploy to Vercel

Push the project to the same GitHub repository and let Vercel deploy the new commit.

No new environment variables are required. The existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and admin authentication variables are reused.

## 3. Log deliveries

Open `/admin`, sign in, then choose **Progress**.

Management can enter:

- Driver
- Delivery date
- Origin
- Destination
- Cargo
- Distance (KM)

Records can also be deleted.

## 4. Public progress page

The public website now has a **DRIVER PROGRESS** section with:

- Total deliveries for the current month
- Total kilometres for the current month
- Drivers that reached the 10,000 KM target
- Each driver's delivery count
- Each driver's distance
- A progress bar toward 10,000 KM

The month is calculated automatically from the current UTC month, so there is no manual monthly reset.

## Important

The public website only exposes aggregated driver progress. Delivery route/cargo records remain in the management view.
