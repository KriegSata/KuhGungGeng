import hashlib
import io
import socket
import struct
import warnings
from pathlib import Path

import numpy as np
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import Settings


def scan(content: bytes, settings: Settings) -> None:
    if not settings.clamav_host:
        return  # Development only; production startup requires a scanner.
    try:
        with socket.create_connection((settings.clamav_host, settings.clamav_port), timeout=10) as sock:
            sock.sendall(b"zINSTREAM\0")
            for offset in range(0, len(content), 65536):
                chunk = content[offset:offset + 65536]
                sock.sendall(struct.pack("!I", len(chunk)) + chunk)
            sock.sendall(struct.pack("!I", 0))
            response = b""
            while b"\0" not in response and len(response) < 4096:
                part = sock.recv(1024)
                if not part:
                    break
                response += part
            if response.strip(b"\0\r\n ") != b"stream: OK":
                raise HTTPException(422, "Upload failed content scanning")
    except OSError as exc:
        raise HTTPException(503, "Content scanner unavailable; retry later") from exc


def sanitize(content: bytes, destination: Path, settings: Settings) -> dict:
    Image.MAX_IMAGE_PIXELS = settings.max_pixels
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as original:
                if original.format not in {"JPEG", "PNG", "WEBP"} or getattr(original, "n_frames", 1) != 1:
                    raise HTTPException(415, "Use a single-frame JPEG, PNG, or WebP image")
                width, height = original.size
                if width * height > settings.max_pixels or max(width, height) > 12000:
                    raise HTTPException(422, "Image exceeds 24 megapixels or 12000 pixels on one side")
                if min(width, height) < 224:
                    raise HTTPException(422, "Image must be at least 224 pixels on each side")
                original.load()
                rgb = ImageOps.exif_transpose(original).convert("RGB")
                width, height = rgb.size
                small = np.asarray(rgb.resize((256, 256)).convert("L"), dtype=np.float32)
                flags = []
                if small.mean() < 35:
                    flags.append("underexposed")
                if small.mean() > 225:
                    flags.append("overexposed")
                # Advisory heuristic only; not a validated crab-quality classifier.
                gradient = np.abs(np.diff(small, axis=0)).mean() + np.abs(np.diff(small, axis=1)).mean()
                if gradient < 7:
                    flags.append("possible_blur_or_low_detail")
                if min(width, height) < 480:
                    flags.append("low_resolution")
                rgb.thumbnail((2048, 2048))
                clean = Image.fromarray(np.asarray(rgb))
                clean.save(destination, "JPEG", quality=90)
        return {"width": width, "height": height, "warnings": flags,
                "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(422, "Invalid, damaged, or excessively large image") from exc
