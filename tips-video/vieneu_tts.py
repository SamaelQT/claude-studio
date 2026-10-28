"""
Giọng VieNeu-TTS (chạy local, CPU) cho tts.mjs — Quang chọn giọng "Mai Anh", nói nhanh hơn chút (28/10).
Đọc TỪNG CÂU rồi ghép (model đỡ vấp), tăng tốc bằng ffmpeg atempo (giữ cao độ), rồi cho faster-whisper nghe lại
để lấy mốc từng chữ — VieNeu không trả mốc như Edge WordBoundary.

  py -3.12 -I -S vieneu_tts.py <job.json>
job.json: {"voice", "temperature", "tempo", "gap", "items": [{"text", "wav", "meta"}]}
meta ghi ra cùng dạng Edge: {"cau": [{"text", "start", "end"}], "words": [{"start", "end"}]} (giây).

Chạy bằng -S: bỏ .pth của pip-system-certs (nó tiêm truststore của pip, huggingface_hub tiêm thêm bản riêng
→ đệ quy SSL khi tải model). Tự thêm site-packages và tiêm truststore MỘT lần — vẫn dùng kho chứng chỉ Windows.
"""
import json, os, re, subprocess, sys, wave
sys.path.append(os.path.join(os.path.dirname(sys.executable), "Lib", "site-packages"))
import truststore
truststore.inject_into_ssl()
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
WHISPER = os.environ.get("WHISPER_MODEL", r"D:\cache\huggingface\fw-small")

job = json.load(open(sys.argv[1], encoding="utf-8"))
voice = job.get("voice", "Mai Anh")
temp = float(job.get("temperature", 0.6))
tempo = float(job.get("tempo", 1.08))
gap = float(job.get("gap", 0.18))

from vieneu import Vieneu
from faster_whisper import WhisperModel

tts = Vieneu()
sr = getattr(tts, "sample_rate", None) or 48000
asr = WhisperModel(WHISPER, device="cpu", compute_type="int8")


def ghi_wav(path, a, rate):
    a = np.clip(np.asarray(a, dtype=np.float32), -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes((a * 32767).astype(np.int16).tobytes())


for it in job["items"]:
    cau = [c.strip() for c in re.findall(r"[^.?!]+[.?!]?", it["text"]) if c.strip()]
    phan, moc, t = [], [], 0.0
    lang = np.zeros(int(sr * gap), dtype=np.float32)
    for c in cau:
        a = np.asarray(tts.infer(c, voice=voice, temperature=temp, repetition_penalty=1.35), dtype=np.float32).flatten()
        moc.append({"text": re.sub(r"\s*\[[^\]]+\]", "", c).strip(), "start": t / tempo, "end": (t + len(a) / sr) / tempo})
        phan += [a, lang]
        t += (len(a) + len(lang)) / sr
    tho = it["wav"] + ".tho.wav"
    ghi_wav(tho, np.concatenate(phan), sr)
    subprocess.run([FFMPEG, "-y", "-v", "error", "-i", tho, "-af", f"atempo={tempo}", "-ar", "48000", it["wav"]], check=True)
    os.remove(tho)
    # Mốc từng chữ: whisper nghe lại file đã tăng tốc (đưa mảng số thẳng vào, tránh PyAV lệch phiên bản).
    pcm = subprocess.run([FFMPEG, "-v", "error", "-i", it["wav"], "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    segs, _ = asr.transcribe(audio, language="vi", beam_size=1, word_timestamps=True)
    words = [{"start": w.start, "end": w.end} for s in segs for w in (s.words or [])]
    json.dump({"cau": moc, "words": words}, open(it["meta"], "w", encoding="utf-8"), ensure_ascii=False)
    print(f"  VieNeu: {len(cau)} câu, {len(words)} chữ — {it['text'][:40]}…", flush=True)
