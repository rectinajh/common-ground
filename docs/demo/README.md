# Demo video

File: [`COMMON-GROUND-demo.mp4`](./COMMON-GROUND-demo.mp4)

- 2:31 · 1920×1080 · ~15 MB
- English voiceover
- Live site: https://commonground-demo.vercel.app
- No wallet. Title card → app → on-chain timeline → explorer txs → end card

Upload this to YouTube (unlisted) and paste the URL on the DoraHacks BUIDL.

Re-record:

```bash
cd docs/demo
say -v Samantha -r 148 -f narration.txt -o audio/narration.aiff
ffmpeg -y -i audio/narration.aiff -ar 44100 -ac 1 audio/narration.wav
ffmpeg -y -i audio/narration.wav -filter:a "atempo=0.86" audio/voice.wav
node record.mjs
ffmpeg -y -i raw/*.webm -i audio/voice.wav -filter_complex "[1:a]apad[a]" \
  -map 0:v:0 -map "[a]" -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 192k \
  -movflags +faststart -shortest COMMON-GROUND-demo.mp4
```
