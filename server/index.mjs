import { app } from './app.mjs';
import { runReminderCheck } from './communications.mjs';
import { saveDatabase } from './db.mjs';
const port = Number(process.env.PORT || 3005);
app.listen(port, '0.0.0.0', () => console.log(`Solace server listening on port ${port}`));
let checkingReminders = false;
const checkReminders = async () => {
  if (checkingReminders) return;
  checkingReminders = true;
  try {
    if (runReminderCheck()) await saveDatabase();
  } catch (error) { console.error('Reminder check failed:', error); }
  finally { checkingReminders = false; }
};
void checkReminders();
setInterval(() => void checkReminders(), 30_000);
