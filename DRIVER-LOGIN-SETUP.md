# V.I.P Delivery Client — Driver Username & Password Login

The desktop client now uses a secure **VTC username + password** instead of asking drivers to enter the VTC website URL and their TruckersMP username.

The VTC website/API address is built into the application:

`https://viplogisticstransportvtc.vercel.app`

Drivers never need to type that address.

## 1. Run the Supabase SQL

Open Supabase → SQL Editor and run the latest `supabase-schema.sql` from this project.

The new tables are:

- `driver_accounts`
- `driver_sessions`

Passwords are stored as bcrypt hashes. The desktop app never receives the Supabase service-role key.

## 2. Deploy the website

Push the updated project to GitHub and deploy it to Vercel as usual.

No new Vercel environment variable is required for driver login. The existing Supabase variables are used server-side.

## 3. Create driver accounts

1. Open `/admin` on the VTC website.
2. Log in with the management account.
3. Open **DRIVER ACCOUNTS**.
4. Select the driver's website profile.
5. Enter the exact TruckersMP username.
6. Choose a login username.
7. Set an initial password of at least 8 characters.
8. Click **CREATE DRIVER ACCOUNT**.

Management can also:

- Reset a driver's password.
- Disable an account.
- Re-enable an account.
- Revoke active sessions when disabling or resetting a password.

## 4. Driver experience

The desktop application now opens with:

- Username
- Password
- LOGIN

There is no website URL field and no TruckersMP username field.

After successful login, the server supplies the linked TruckersMP username automatically. Delivery requests use the authenticated account rather than trusting a username supplied by the client.

## 5. Session security

The desktop client receives a short random session token after login. On Windows, the token is encrypted using Electron's OS-backed `safeStorage` facility before it is saved locally.

The server stores only a SHA-256 hash of the session token.

Driver delivery actions require a valid driver session:

- Start delivery
- View the driver's active delivery
- Complete delivery

Management-only delivery actions still require the existing management session.

## 6. Build the Windows client

From `desktop-client`:

```powershell
npm install
npm run build:win
```

The installer is produced by electron-builder.

## Important

The VTC URL is intentionally compiled into this client version. If the VTC domain changes later, update `VTC_API_BASE` in:

`desktop-client/src/renderer.js`

and rebuild the installer.


## Self-registration (0.5.9)
Drivers can now click **CREATE ACCOUNT** in the desktop client. They enter a VTC username, password, confirmation, and exact TruckersMP username. The API verifies that the TruckersMP username is an active synchronized VTC member, creates a pending account, and management approves or rejects it from **DRIVER ACCOUNTS** in the admin panel. Only approved accounts can log in.

Run the updated `supabase-schema.sql` once before deploying this version. Existing approved accounts remain approved.
