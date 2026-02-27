#!/usr/bin/env python3
import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def resolve_tools() -> tuple[str, str]:
    yt_dlp_bin = shutil.which("yt-dlp")
    if yt_dlp_bin is None:
        user_bin = Path.home() / "Library/Python/3.9/bin/yt-dlp"
        if user_bin.exists():
            yt_dlp_bin = str(user_bin)

    ffmpeg_bin = shutil.which("ffmpeg")
    if ffmpeg_bin is None:
        try:
            import imageio_ffmpeg  # type: ignore

            ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            ffmpeg_bin = None

    if yt_dlp_bin and ffmpeg_bin:
        return yt_dlp_bin, ffmpeg_bin

    missing = []
    if not yt_dlp_bin:
        missing.append("yt-dlp")
    if not ffmpeg_bin:
        missing.append("ffmpeg")
    print(
        "Missing required tools: " + ", ".join(missing) +
        "\nInstall and retry. Examples: brew install yt-dlp ffmpeg OR pip install --user yt-dlp imageio-ffmpeg",
        file=sys.stderr,
    )
    sys.exit(1)


def download_one(song_query: str, output_dir: Path, yt_dlp_bin: str, ffmpeg_bin: str) -> int:
    output_template = str(output_dir / "%(title)s.%(ext)s")
    cmd = [
        yt_dlp_bin,
        f"ytsearch1:{song_query}",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "--embed-metadata",
        "--embed-thumbnail",
        "--no-playlist",
        "--extractor-args",
        "youtube:player_client=android",
        "--ffmpeg-location",
        ffmpeg_bin,
        "-o",
        output_template,
    ]

    print(f"Downloading: {song_query}")
    completed = subprocess.run(cmd)
    if completed.returncode == 0:
        print(f"Done: {song_query}")
    else:
        print(f"Failed: {song_query}", file=sys.stderr)
    return completed.returncode


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download MP3 by song name into ~/Downloads"
    )
    parser.add_argument(
        "songs",
        nargs="+",
        help="One or more song queries, e.g. 'Shape of You Ed Sheeran'",
    )
    args = parser.parse_args()

    yt_dlp_bin, ffmpeg_bin = resolve_tools()

    output_dir = Path.home() / "Downloads"
    output_dir.mkdir(parents=True, exist_ok=True)

    failures = 0
    for song in args.songs:
        failures += 1 if download_one(song, output_dir, yt_dlp_bin, ffmpeg_bin) != 0 else 0

    if failures:
        print(f"Completed with {failures} failure(s).", file=sys.stderr)
        return 1

    print(f"All downloads saved in: {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
