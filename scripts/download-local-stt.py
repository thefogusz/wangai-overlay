"""Install the pinned official sherpa model archive, checking it before extraction."""
import hashlib
import shutil
import tarfile
import urllib.request
from pathlib import Path

NAME = "sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25"
SHA256 = "393f8a14e2f5fb96746aaab342997a40641001fbd5bf9592a080a8329178ee96"
URL = f"https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/{NAME}.tar.bz2"


def install():
    destination = Path(__file__).resolve().parents[1] / "output" / "models"
    destination.mkdir(parents=True, exist_ok=True)
    marker = destination / NAME / ".verified-sha256"
    if marker.exists() and marker.read_text() == SHA256:
        print(f"Model ready: {marker.parent}")
        return
    archive = destination / f"{NAME}.tar.bz2"
    if not archive.exists():
        partial = archive.with_suffix(".part")
        print("Downloading Qwen3-ASR INT8 (879 MB), once only...", flush=True)
        with urllib.request.urlopen(URL, timeout=60) as response, partial.open("wb") as output:
            shutil.copyfileobj(response, output)
        partial.replace(archive)
    with archive.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    if digest != SHA256:
        raise RuntimeError(f"Model checksum mismatch. Remove {archive} and run setup again.")
    print("Checksum verified. Extracting...", flush=True)
    with tarfile.open(archive) as source:
        for member in source:
            target = (destination / member.name).resolve()
            if not target.is_relative_to((destination / NAME).resolve()):
                raise RuntimeError("Unsafe model archive path")
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(member) as data, target.open("wb") as output:
                    shutil.copyfileobj(data, output)
            else:
                raise RuntimeError("Unexpected link or special file in model archive")
    marker.write_text(SHA256)
    print(f"Model ready: {marker.parent}")


if __name__ == "__main__":
    install()
