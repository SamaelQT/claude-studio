# comfy/workflows

Workflow ComfyUI ở **API format** dùng cho `lib/tools/animate.ts`.

- `wan-i2v.json` — bạn phải tự tạo (chưa có trong repo). Xem [ANIMATE_SETUP.md](../../ANIMATE_SETUP.md) mục 4.
- `example-tokens.json` — **chỉ minh hoạ cách đặt token**, không chạy được trên ComfyUI thật.

Token được thay lúc chạy: `__IMAGE__`, `__PROMPT__`, `__NEGATIVE__` (chuỗi) và
`__FRAMES__`, `__FPS__`, `__SEED__` (số — không để trong nháy kép).

Không có file workflow thì `animateScene()` trả `null` và scene tự lùi về ảnh tĩnh +
chuyển động camera. Không làm hỏng lượt chạy.
