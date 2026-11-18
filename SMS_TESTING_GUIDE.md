# Testing SMS in Solace

SMS sending works only in the Android app. The browser shows a preview but does not send a message or mark a test result as sent.

1. On a physical Android phone with an active SIM, add a parent contact with a valid phone number.
2. Add a test result. Open **Send to Parent** and review the message preview and recipient.
3. Send one test message to a number you control. Approve any Android SMS permission prompt.
4. Check that the recipient receives the message and that **Messages** records the attempt.
5. Try an invalid number and confirm that the app reports a failure without marking the result as sent.

The Android manifest requests `SEND_SMS`. A status of **sent** means the native SMS plugin returned successfully; it is not a network delivery receipt. Carrier charges may apply.
