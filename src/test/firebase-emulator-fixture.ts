// Imported only by the Playwright route override, never by the production app.
import { initializeApp } from 'firebase/app';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
const uid = new URLSearchParams(location.search).get('fixture') ?? 'fixture';
const app = initializeApp({ projectId: 'demo-eat-spin-sharing', databaseURL: 'https://demo-eat-spin-sharing.firebaseio.com' }, `fixture-${uid}`);
export const firebaseDb = getDatabase(app);
connectDatabaseEmulator(firebaseDb, '127.0.0.1', 9000, { mockUserToken: { sub: uid, user_id: uid } });
export const isFirebaseConfigured = true;
export const firebaseConfigError = null;
export const ensureAnonymousAuthUser = async () => ({ uid });
