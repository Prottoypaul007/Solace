# Solace

## Version 1.3 additions

- Tutor and student accounts with invitation activation, server-side permissions, and an import path for existing device records.
- Private messaging with live updates and read receipts; targeted announcements; homework with protected attachments; scheduled classes and in-app reminders.

## Version 1.2 additions

- Edit student details, backdate or edit classes and payments, and undo deletions before leaving the student page.
- View monthly statements with opening balance, charges, payments, and CSV export. Earlier classes keep their charged rate after a rate change.
- Validate test scores and preview SMS text. Browser SMS sending is disabled, and a sent status does not mean delivered.
- Storage writes are checked and report failures. Backup restores verify each write and roll back on failure.
- Run `npm test` for backup, storage, balance, statement, and score checks. The test runner uses Node.js 24.

Before installing an APK over an existing phone installation, follow [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

Solace is a mobile-first tutoring tracker for an individual tutor. It keeps student profiles, class sessions, payments, test results, parent contacts, and a history of test-result messages in one place. The app runs in a browser and can be packaged as an Android app with Capacitor.

## What it does

- **Dashboard:** Shows student and class counts, payments received, outstanding balance, and test results that have not been sent.
- **Students:** Adds student profiles with a subject, phone number, and rate per class. Search profiles by name, subject, or phone.
- **Classes and payments:** Logs, backdates, edits, and deletes sessions and payments. The student history can undo a deletion before leaving the page.
- **Balances:** Calculates the sum of class charges minus payments received. New classes keep the rate charged, so later rate edits do not change previous bills. A negative balance represents an advance payment. Amounts are displayed in Bangladeshi taka (৳).
- **Monthly statements:** Shows opening balance, classes, payments, and closing balance, with a summary to share and a CSV export.
- **Test results:** Validates marks, calculates a percentage, and optionally stores notes. Results can be deleted.
- **Parent communication:** Stores parent or guardian contacts, marks a primary contact, sends a test result by SMS, and records each send attempt and its status.
- **Backup and restore:** Exports all six record types to a versioned JSON file. Restoring previews record counts and replaces the current device's records after confirmation.

## Tech stack

- React 18, TypeScript, React Router, and Vite
- Tailwind CSS, Lucide icons, and date-fns
- Capacitor 7 with an included Android project
- `@byteowls/capacitor-sms` for SMS on Android
- Better Auth, Express, and SQLite for accounts, sessions, invitations, and shared records
- Device storage as a tutor editing cache and migration source

## Run locally

Install Node.js 24 with npm. From this directory (`Mobileapp/`):

```bash
npm ci
npm test
copy .env.example .env
# Fill in BETTER_AUTH_SECRET, SOLACE_SETUP_EMAIL, and SOLACE_SETUP_PASSWORD in .env.
npm run migrate
npm run setup:tutor
# Remove SOLACE_SETUP_PASSWORD from .env after setup.
npm run server
# In another terminal:
npm run dev
```

Open the local URL printed by Vite. Browser use is suitable for exploring the app, but SMS sending is disabled in the browser. It does not contact the recipient or mark a result as sent.

To check the production web build:

```bash
npm run build
npm run preview
```

The build runs TypeScript checking and writes the web assets to `dist/`. The server requires Node.js 24 and a private `BETTER_AUTH_SECRET` of at least 32 characters. Without `DATABASE_URL`, `SOLACE_DATABASE_PATH` points to a local SQLite file. Keep `.env` private and back up the database regularly.

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Private session and token signing secret, 32 characters or longer |
| `BETTER_AUTH_URL` | Public HTTPS origin of the API server |
| `SOLACE_DATABASE_PATH` | Persistent SQLite database file |
| `DATABASE_URL` | Neon PostgreSQL connection string. When set, the SQLite working database is held in memory and saved as versioned snapshots in Neon. |
| `SOLACE_ALLOWED_ORIGINS` | Comma-separated exact web and Android origins; include `https://localhost` for the Android WebView |
| `SOLACE_APP_URL` | Web app origin used in student invitation links |
| `VITE_API_URL` | API origin compiled into the web and Android app |
| `SOLACE_SETUP_EMAIL`, `SOLACE_SETUP_PASSWORD`, `SOLACE_SETUP_NAME` | One-time tutor creation; remove the password from `.env` afterward |
| `PORT` | Server port; defaults to 3005 |

Better Auth owns password hashes and session cookies. The local SQLite database stores tutor/student links, hashed single-use invitations, the imported tutoring records, communication, attachments, and notifications. The public signup route is disabled; only the one-time setup script and tutor-issued invitations can create users.

For one-address hosting, build the web app with `VITE_API_URL` set to the server's HTTPS origin, then run `npm run server`. The server serves `dist/` at `/` and the API at `/api`. Set `BETTER_AUTH_URL` and `SOLACE_APP_URL` to that same HTTPS origin, and set `SOLACE_ALLOWED_ORIGINS` to that origin plus `https://localhost` for the Android app. Use a TLS reverse proxy in front of port 3005 and keep `SOLACE_DATABASE_PATH` on persistent storage. The server must stay running for messages and reminder checks.

### Free Render service with Neon storage

The existing API keeps its SQLite query engine. With `DATABASE_URL` set, it restores the SQLite database from a checksum-checked snapshot in Neon at startup. After a request changes the database, the HTTP response waits until a new snapshot is saved in Neon. A revision check stops an older Render instance from overwriting newer data. This is intended for a small, single-instance academic app; each write transfers the complete database snapshot. Keep separate JSON and server backups.

1. Create a free Neon PostgreSQL project. Copy its **pooled** connection string privately; never commit or send it in chat. Do not import phone records into the current Render SQLite database.
2. On your PC, put `DATABASE_URL` in the ignored `Mobileapp/.env`. Set `BETTER_AUTH_URL`, `SOLACE_APP_URL`, and `VITE_API_URL` to the exact Render HTTPS origin, and `SOLACE_ALLOWED_ORIGINS` to that origin plus `https://localhost`. Use the same `BETTER_AUTH_SECRET` value that Render uses. Set `SOLACE_SETUP_EMAIL` and a **new** `SOLACE_SETUP_PASSWORD` of at least 12 characters.
3. Run `npm ci` and `npm run setup:tutor` on your PC while connected to the internet. This creates the first tutor account and initial Neon snapshot. Remove `SOLACE_SETUP_PASSWORD` from `.env` afterward. This one-time command must run before deploying the Neon version to Render Free because the free service has no Shell.
4. In Render's **Environment**, set `DATABASE_URL` to the same Neon URL. Keep the existing auth secret and set all URL/origin variables to the Render URL. Build with `npm ci && npm run build`, start with `npm run server`, and use Node 24. Render refuses to start without `DATABASE_URL` or an existing snapshot, so it cannot silently fall back to temporary local storage. Save, rebuild, and deploy. The startup log should say `Neon snapshot loaded at revision ...`.
5. Sign in on the Render website and verify an empty tutor account before updating the phone. After the phone's JSON backup is safely saved outside the app, install the signed update over the old app and verify the imported record counts. Run `npm run backup:server` on the PC periodically to download a verified full server snapshot to the ignored `backups/` folder.

Render Free sleeps while idle. Messages become available when the service wakes, but the in-process class reminder timer does not run while it sleeps. Reminders may not appear at their scheduled time. Do not present this as an always-on reminder service.

For paid hosting with a persistent disk, the local SQLite mode remains available; set `SOLACE_DATABASE_PATH` to a file on the disk and leave `DATABASE_URL` unset.

## Run on Android

Install Android Studio, its Android SDK, and a compatible JDK. The `android/` platform and `capacitor.config.ts` are already present; do not run `cap init` or `cap add android` for this checkout.

```bash
npm ci
npm run build
npx cap sync android
npx cap open android
```

Run the project on a device or emulator from Android Studio, or build an APK there. After changing web code, run `npm run build` and `npx cap sync android` again before rebuilding the Android app. Native SMS requires a capable Android device, appropriate permission, and an available SMS service; carrier charges may apply. Verify actual sending on a physical device before relying on it.

Set `VITE_API_URL` to the HTTPS address of your running server before `npm run build`; set `BETTER_AUTH_URL` to the same server origin, `SOLACE_ALLOWED_ORIGINS` to the exact app origins, and `SOLACE_APP_URL` to the web activation page origin. The Android WebView uses `https://localhost` as its origin. `http://localhost:3005` in an Android build points to the phone, so a local desktop server is not reachable from it. Do not install the authentication update on the eight-month-data phone until the server is reachable and the saved JSON backup has been checked.

The app's display name is **Solace**. Its Android application ID is still `com.tutortrack.app`; the npm package name is `tutortrack-mobile`.

## Typical workflow

1. Add a student from **Students**.
2. Open the student to log classes and payments. The balance updates from those entries.
3. Open **Test Results** from the student page and add a result.
4. Add a parent contact under **Parents**, then choose **Send to Parent** on a test result.
5. View the attempt under **Messages** for that student.

## Data and current limits

On first tutor login, if the server has no records, the app imports the existing device records without changing their IDs. If this device and server both have different records, the app stops and shows both sets of counts before either side is replaced. Save a separate backup and choose which set to keep. Editing sends the six record collections to the server. A failed send leaves the local changes pending and shows a warning; **Settings** offers a retry. Signing out waits for pending changes and clears the tutor cache. Keep regular JSON exports and database backups; the JSON export contains personal information and is not encrypted.

When a backup contains records for a missing student profile, Solace keeps them under **Students → Imported records**. Adding a student whose name uniquely and exactly matches the name in those records' test-result messages adopts the imported student ID, so linked tests, parent contacts, and messages appear on that student's profile automatically. Name matching ignores letter case and repeated spaces. If the name is unknown or more than one imported entry matches, Solace leaves the records separate for manual review.

Student login is invitation only. Open a student profile and choose **Enable student login**, enter their email, and share the generated link privately. The link expires after 48 hours and is single use. Students see their own profile, completed class history, test results, scheduled classes, messages, announcements, homework, and notifications. The existing completed-class records have no attendance flag; the new scheduled-class table is separate so historical records remain intact.

## Communication

Open **Connect** for direct messages, announcements, homework, scheduled classes, and notifications. Messages and read receipts update through an authenticated server-sent events stream; history is paged and send retries use a client ID to prevent duplicates. Tutors can target announcements and homework to selected students and see read or completion status. Homework attachments are limited to PDF, PNG, or JPG up to 5 MB and are downloaded only through an authorized API request.

The server checks upcoming classes on startup and every 30 seconds. It creates an in-app reminder 30 minutes before class by default, or at the offset chosen by the tutor. A database key prevents duplicate reminders across restarts. Rescheduling or cancelling a class clears its pending reminder. Class times and homework deadlines are entered and displayed in **Asia/Dhaka**. The server must keep running for real-time updates and reminders; push notifications are not configured.

SMS is the only implemented send method. Parent email addresses can be saved and opened through a `mailto:` link, but the app does not send email. A `sent` status records a successful return from the SMS plugin; it is not a delivery receipt. The permission helper currently delegates permission handling to the native send operation.

Deleting a student also removes that student's classes, payments, test results, parent contacts, and communication history from this device. You can undo the deletion before leaving the student page.

The bottom navigation's **Settings** item contains backup and restore. `npm test` runs data checks, and GitHub Actions runs tests, the web build, and an Android debug build on pushes and pull requests.

## Project layout

```text
Mobileapp/
├── App.tsx                   # Hash-based routes
├── pages/                    # Dashboard and student, test, contact, message views
├── components/               # Shared layout and form controls
├── services/storage.ts       # Student, class, payment storage and balances
├── services/communication.ts # Results, contacts, message history and send flow
├── services/sms.ts           # Native SMS sending and message formatting
├── types.ts                  # Main data models
├── capacitor.config.ts       # Capacitor app configuration
├── android/                  # Native Android project
└── SMS_TESTING_GUIDE.md      # Additional manual SMS testing notes
```

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Check backup, storage, balances, statements, and marks |
