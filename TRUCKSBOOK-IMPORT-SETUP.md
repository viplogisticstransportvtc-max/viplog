# TrucksBook delivery import

The website now supports importing delivery records from TrucksBook's VTC Log Overview CSV export.

## Important
TrucksBook currently documents CSV export from **Log Overview**, but does not document a public API for third-party websites to pull a company's delivery records automatically. This implementation therefore uses the supported CSV export rather than scraping or storing TrucksBook passwords.

## How to use
1. In TrucksBook, open your VTC/company **Log Overview**.
2. Choose the month/period you want.
3. Export the selected data as CSV.
4. Open your website's Admin → Deliveries & Progress.
5. Under **TRUCKSBOOK DELIVERY IMPORT**, choose the CSV and click **IMPORT TRUCKSBOOK**.
6. The importer matches TrucksBook usernames to website drivers by name and ignores duplicate rows.

The imported records feed the existing 10,000 KM monthly progress system.
