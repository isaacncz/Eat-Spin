import { createRoot } from 'react-dom/client';
import { GroupRoomFixture } from './group-room-fixture';
export function mountGroupRoomFixture() { createRoot(document.getElementById('root')!).render(<GroupRoomFixture />); }
