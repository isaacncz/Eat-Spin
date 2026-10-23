import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AudioFixture } from '@/test/spin-audio-fixture';

export function mountSpinAudioFixture() {
  createRoot(document.getElementById('root')!).render(<StrictMode><AudioFixture /></StrictMode>);
}
