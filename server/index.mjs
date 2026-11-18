import { app } from './app.mjs';
import { runReminderCheck } from './communications.mjs';
const port = Number(process.env.PORT || 3005);
app.listen(port, '0.0.0.0', () => console.log(`Solace server listening on port ${port}`));
const checkReminders = () => { try { runReminderCheck(); } catch (error) { console.error('Reminder check failed:', error); } };
checkReminders();
setInterval(checkReminders, 30_000);
