# 📱 How to Build the Android APK

Follow these steps to turn this React code into a native Android app using Capacitor.

## 1. Prerequisites
Ensure you have the following installed on your computer:
- **Node.js** (v18+): [Download Here](https://nodejs.org/)
- **Android Studio**: [Download Here](https://developer.android.com/studio)
  - *During installation, ensure "Android SDK" and "Android Virtual Device" are selected.*

## 2. Project Setup
Open your terminal (Command Prompt or Terminal) in the project folder and run:

```bash
# 1. Install project dependencies (React, Tailwind, etc.)
npm install

# 2. Install Capacitor dependencies (Mobile runtime)
npm install @capacitor/core @capacitor/cli @capacitor/android
```

## 3. Initialize Capacitor
Set up the mobile configuration. You can change the App Name and ID if you want.

```bash
npx cap init TutorTrack com.tutortrack.app --web-dir=dist
```

## 4. Build the Web App
This compiles your TypeScript and React code into standard HTML/CSS/JS.

```bash
npm run build
```
*Success Check: You should see a `dist` folder appear in your project.*

## 5. Create Android Project
Add the Android native platform to your project.

```bash
npx cap add android
```

## 6. Open in Android Studio
This will copy your built app (`dist`) into the Android project and open Android Studio.

```bash
npx cap sync
npx cap open android
```

## 7. Generate the APK (In Android Studio)
Once Android Studio opens:
1.  Wait for the **Gradle Sync** to finish (look at the bottom right status bar).
2.  **To Test:** Connect your Android phone via USB (enable USB Debugging) or use the Emulator, then click the green **Play (▶)** button in the top toolbar.
3.  **To Build APK File:**
    *   Go to the top menu: **Build > Build Bundle(s) K(s) > Build APK(s)**.
    *   Wait for the notification "Build APK(s) generated successfully".
    *   Click **locate** in the notification to find your `app-debug.apk` file.

---

## 💡 Troubleshooting

### "Command not found"
If `npx` or `npm` fails, ensure Node.js is installed and restart your terminal.

### "JAVA_HOME is not set"
Capacitor needs Java. Installing Android Studio usually fixes this, but you might need to set the JAVA_HOME environment variable to point to the Android Studio jre/jdk folder.

### Updates
If you change the React code (e.g., update `App.tsx`), you must run these two commands to update the app:
```bash
npm run build
npx cap sync
```
Then rerun the app from Android Studio.
