# Arcade click

The user selected sound option 1, Arcade click: rounded wooden ticks and a short three-note win chime. The master is the original synthesized preview they approved; it contains no third-party recordings.

`python scripts/build-spin-audio.py` extracts the start, click and complete win samples into `public/audio`. No independent drumroll loop or delayed win-note timers are used. The app loads the samples once after a user gesture, plays clicks at actual wheel crossings, caps overly dense ticks and cancels all active samples on mute/leave/page hide. The existing mute preference and reduced-motion policy remain in effect.

Shipping WAVs are mono 44.1kHz/16-bit PCM and total about 129KiB. The full preview master is for reproducibility and is not copied into the production bundle. The existing service worker precaches the small shipping stems for subsequent/offline spins. These are static site assets; no Firebase or Google API calls are added.
