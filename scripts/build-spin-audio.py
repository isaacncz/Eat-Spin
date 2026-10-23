"""Extract the approved Arcade click stems without changing their sound or gain.

Uses only the Python standard library. Not required by the app or CI build.
The production wheel triggers ticks at segment crossings, rather than playing
the fixed-timing preview or an independently accelerating drumroll.
"""
from pathlib import Path
import wave

root = Path(__file__).resolve().parent.parent
master = root / "assets/audio/arcade-click-preview.wav"
output = root / "public/audio"
with wave.open(str(master), "rb") as source:
    params = source.getparams()
    pcm = source.readframes(source.getnframes())
    rate = source.getframerate()
frame_size = params.nchannels * params.sampwidth
first_tick = 0.5 + 5.8 * (1 - (1 - 1 / 42) ** (1 / 3))
output.mkdir(parents=True, exist_ok=True)
for name, start, duration in [("start", 0, 0.35), ("tick", first_tick, 0.04), ("win", 6.3, 1.1)]:
    first = int(start * rate)
    count = int(duration * rate)
    with wave.open(str(output / f"arcade-click-{name}.wav"), "wb") as target:
        target.setparams(params)
        target.writeframes(pcm[first * frame_size:(first + count) * frame_size])
