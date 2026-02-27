---
name: download-mp3-by-song-name
description: Download MP3 audio files by song name and save them directly to the user's Downloads directory. Use when the user asks to download music as MP3 from a song title (with optional artist name), batch-download multiple songs, or wants one-command music download automation.
---

# MP3 Download Workflow

Use this skill to download MP3 files by song name into `~/Downloads`.

## Execute

1. Ensure `yt-dlp` and `ffmpeg` are available.
2. Run:

```bash
python3 scripts/download_mp3.py "<song name>"
```

Examples:

```bash
python3 scripts/download_mp3.py "Shape of You Ed Sheeran"
python3 scripts/download_mp3.py "告白气球 周杰伦"
```

## Batch Mode

Pass multiple songs in one command:

```bash
python3 scripts/download_mp3.py "Song A" "Song B artist" "Song C"
```

## Notes

- Save outputs to `~/Downloads` by default.
- Prefer adding artist name in query for more accurate results.
- Download only content the user is authorized to save.
