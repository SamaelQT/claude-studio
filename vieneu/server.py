"""
VieNeu-TTS local server — giong tieng Viet 48kHz, chay hoan toan tren may, khong gioi han luot.

Chay:
  C:/Users/quang.ho/AppData/Local/Programs/Python/Python312/python.exe vieneu/server.py

Model duoc nap MOT LAN luc khoi dong (~15-20s) roi giu am, nen moi request sau do
khong phai nap lai. App goi sang qua HTTP giong nhu goi mot API binh thuong.
"""
import io
import os
import sys
import time
import threading

import numpy as np
import soundfile as sf
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

PORT = int(os.environ.get("VIENEU_PORT", "8899"))

app = FastAPI(title="VieNeu TTS local")

_tts = None
_lock = threading.Lock()   # ONNX engine khong an toan khi goi song song
_ready = False


def _load():
    """Nap model mot lan khi server khoi dong."""
    global _tts, _ready
    import vieneu
    t0 = time.time()
    _tts = vieneu.Vieneu(mode="v3turbo")
    _ready = True
    print(f"[vieneu] san sang sau {time.time() - t0:.1f}s "
          f"| backend={_tts.backend} | sr={_tts.sample_rate} "
          f"| {len(_tts.list_preset_voices())} giong", flush=True)


class TTSRequest(BaseModel):
    text: str
    voice: str | None = None
    style: str | None = None
    # cao = da dang hon nhung kem on dinh; thap = deu va an toan hon
    temperature: float = 0.8
    top_k: int = 25
    top_p: float = 0.95
    # ty le khoang lang giua cac cum — tang len cho nhip cham rai
    silence_p: float = 0.15


@app.get("/health")
def health():
    return {"ready": _ready}


@app.get("/voices")
def voices():
    if not _ready:
        raise HTTPException(503, "Model dang nap")
    out = []
    for label, vid in _tts.list_preset_voices():
        # label dang: "Thanh Binh — Nam · Bac · Phong cach ke chuyen"
        desc = label.split("—", 1)[1].strip() if "—" in label else ""
        parts = [p.strip() for p in desc.split("·")]
        out.append({
            "id": vid,
            "name": vid,
            "gender": parts[0] if len(parts) > 0 else "",
            "region": parts[1] if len(parts) > 1 else "",
            "style": parts[2] if len(parts) > 2 else "",
            "label": label,
        })
    return {"voices": out, "sample_rate": _tts.sample_rate}


@app.post("/tts")
def tts(req: TTSRequest):
    if not _ready:
        raise HTTPException(503, "Model dang nap, thu lai sau vai giay")
    if not req.text.strip():
        raise HTTPException(400, "text rong")

    t0 = time.time()
    try:
        # Engine ONNX khong reentrant → serialize
        with _lock:
            audio: np.ndarray = _tts.infer(
                req.text,
                voice=req.voice,
                style=req.style,
                temperature=req.temperature,
                top_k=req.top_k,
                top_p=req.top_p,
                silence_p=req.silence_p,
                apply_watermark=False,
            )
    except Exception as e:
        raise HTTPException(500, f"infer loi: {e}")

    buf = io.BytesIO()
    sf.write(buf, audio, _tts.sample_rate, format="WAV", subtype="PCM_16")
    data = buf.getvalue()

    dur = len(audio) / _tts.sample_rate
    gen = time.time() - t0
    print(f"[tts] {req.voice or 'default':<14} {dur:5.1f}s audio / {gen:5.1f}s tao", flush=True)

    return Response(
        content=data,
        media_type="audio/wav",
        headers={"X-Audio-Duration": f"{dur:.3f}", "X-Gen-Seconds": f"{gen:.3f}"},
    )


if __name__ == "__main__":
    # tranh loi encoding tieng Viet tren console Windows
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(f"[vieneu] dang nap model, cho khoang 15-20s...", flush=True)
    _load()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
