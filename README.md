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

The build runs TypeScript checking and writes the web assets to `dist/`. The server requires Node.js 24 and a private `BETTER_AUTH_SECRET` of at least 32 characters. `SOLACE_DATABASE_PATH` points to the SQLite file. Keep the `.env` file private and back up the database file regularly.

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Private session and token signing secret, 32 characters or longer |
| `BETTER_AUTH_URL` | Public HTTPS origin of the API server |
| `SOLACE_DATABASE_PATH` | Persistent SQLite database file |
| `SOLACE_ALLOWED_ORIGINS` | Comma-separated exact web and Android origins; include `https://localhost` for the Android WebView |
| `SOLACE_APP_URL` | Web app origin used in student invitation links |
| `VITE_API_URL` | API origin compiled into the web and Android app |
| `SOLACE_SETUP_EMAIL`, `SOLACE_SETUP_PASSWORD`, `SOLACE_SETUP_NAME` | One-time tutor creation; remove the password from `.env` afterward |
| `PORT` | Server port; defaults to 3005 |

Better Auth owns password hashes and session cookies. The local SQLite database stores tutor/student links, hashed single-use invitations, the imported tutoring records, communication, attachments, and notifications. The public signup route is disabled; only the one-time setup script and tutor-issued invitations can create users.

For one-address hosting, build the web app with `VITE_API_URL` set to the server's HTTPS origin, then run `npm run server`. The server serves `dist/` at `/` and the API at `/api`. Set `BETTER_AUTH_URL` and `SOLACE_APP_URL` to that same HTTPS origin, and set `SOLACE_ALLOWED_ORIGINS` to that origin plus `https://localhost` for the Android app. Use a TLS reverse proxy in front of port 3005 and keep `SOLACE_DATABASE_PATH` on persistent storage. The server must stay running for messages and reminder checks.

For a managed host such as Render, use one always-on Node.js web service with a persistent disk. Set its build command to `npm ci && npm run build`, start command to `npm run server`, `NODE_VERSION` to a Node.js 24 release, and `SOLACE_DATABASE_PATH` to a file on the mounted disk (for example `/var/data/solace.sqlite`). Set the three URL variables to the service's HTTPS origin. Set `SOLACE_ALLOWED_ORIGINS` to that origin and `https://localhost`. After deployment, run `npm run setup:tutor` once in the service shell with the setup email and password configured, then remove the setup password. Do not use an ephemeral filesystem for the SQLite file.

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
