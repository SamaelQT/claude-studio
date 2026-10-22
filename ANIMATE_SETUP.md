# Cho nhân vật cử động — hướng dẫn dựng trên PC nhà

> Đọc file này khi ngồi vào **PC có GPU**. Phần code phía claude-studio đã xong và đã test;
> việc còn lại là dựng ComfyUI rồi trỏ vào.

---

## 1. Phân biệt 2 thứ (đừng nhầm)

| | `lib/tools/motion.ts` | `lib/tools/animate.ts` |
|---|---|---|
| Làm gì | di chuyển **khung hình** trên ảnh chết | sinh lại **từng khung hình** |
| Nhân vật có cử động? | **KHÔNG** | **CÓ** — thở, lay tóc, nghiêng đầu |
| Cần GPU | không | **có** |
| Chi phí | 0đ | 0đ (ComfyUI nhà) |
| Trạng thái | ✅ xong, đã test | ✅ code xong, **chờ GPU để test thật** |

Cả hai dùng chung một field `motion` trong JSON kịch bản. Scene nào animate được thì
nhân vật cử động; scene nào hỏng thì **tự động lùi về ảnh tĩnh + Ken Burns**, không làm
hỏng cả video.

---

## 2. Kiểm tra GPU trước

```bash
nvidia-smi --query-gpu=name,memory.total --format=csv
```

| VRAM | Model nên dùng | Ghi chú |
|---|---|---|
| < 8GB | AnimateDiff (SD1.5) | Wan chạy không nổi |
| 8–12GB | Wan 2.1 I2V-14B bản **fp8** + offload, hoặc LTX-Video | chậm nhưng chạy được |
| 16GB | Wan 2.1 I2V-14B 480p | ngưỡng dễ chịu |
| 24GB+ | Wan 2.2 I2V-A14B | tốt nhất hiện tại |

⚠️ Nếu là GPU AMD hoặc Intel: ComfyUI chạy được qua DirectML/ROCm nhưng chậm hơn nhiều và
hay lỗi. Kiểm tra kỹ trước khi tải model 15GB về.

---

## 3. Cài ComfyUI

```bash
git clone https://github.com/comfyanonymous/ComfyUI
```

Rồi cài theo README của repo (bản Desktop cũng được). Khởi động mặc định ở `http://127.0.0.1:8188`.

**Model cần tải cho Wan i2v** — đặt vào các thư mục tương ứng trong `ComfyUI/models/`:

| Loại | Thư mục |
|---|---|
| Wan i2v diffusion model | `diffusion_models/` |
| umt5 text encoder | `text_encoders/` |
| Wan VAE | `vae/` |
| CLIP vision (i2v cần) | `clip_vision/` |

> Tên file cụ thể thay đổi theo phiên bản — lấy đúng danh sách từ trang
> **ComfyUI_examples/wan** hoặc repo Comfy-Org trên HuggingFace tại thời điểm cài.
> Đừng tin tên file chép từ hướng dẫn cũ.

Wan 2.1/2.2 là **Apache 2.0** — dùng thương mại thoải mái, an toàn cho kênh YouTube.

---

## 4. Xuất workflow và gắn token

1. Trong ComfyUI, dựng workflow i2v và **chạy thử tay 1 lần cho ra clip**. Chưa chạy được tay thì đừng nối vào app.
2. Menu → **Workflow → Export (API)**. Bắt buộc bản **API format**, không phải bản thường.
3. Lưu vào `comfy/workflows/wan-i2v.json` trong project này.
4. Mở file, thay giá trị bằng token:

| Token | Thay vào chỗ | Kiểu |
|---|---|---|
| `__IMAGE__` | `LoadImage.image` | chuỗi |
| `__PROMPT__` | CLIPTextEncode **positive** | chuỗi |
| `__NEGATIVE__` | CLIPTextEncode **negative** | chuỗi |
| `__FRAMES__` | số khung (`length`) | **số, không có nháy** |
| `__FPS__` | `frame_rate` của node lưu video | **số** |
| `__SEED__` | seed của sampler | **số** |

Xem [comfy/workflows/example-tokens.json](comfy/workflows/example-tokens.json) để biết hình dạng.
File đó **chỉ minh hoạ token**, không chạy được trên ComfyUI thật.

Kiểm tra JSON vẫn hợp lệ sau khi thay:

```bash
node -e "JSON.parse(require('fs').readFileSync('comfy/workflows/wan-i2v.json','utf8').replace(/__FRAMES__|__SEED__|__FPS__/g,'1'));console.log('OK')"
```

---

## 5. Trỏ app vào ComfyUI

Thêm vào `.env.local`:

```env
COMFY_URL=http://127.0.0.1:8188
```

Chạy claude-studio ở máy khác thì thay bằng IP LAN của PC, và khởi động ComfyUI với
`--listen` để nó nhận kết nối ngoài.

---

## 6. Bật animate trong kịch bản

Thêm vào JSON script (ngay cấp gốc, cạnh `project_name`):

```json
{
  "project_name": "...",
  "channel": "wansee",
  "animate": true,
  "animate_provider": "comfy",
  "animate_workflow": "wan-i2v",
  "scenes": [ ... ]
}
```

Không có `"animate": true` thì pipeline chạy y như cũ.

---

## 7. Quy trình test — làm đúng thứ tự này

**Đừng chạy cả video 22 scene ngay.** Mỗi clip mất vài phút, sai style thì mất cả buổi.

1. Lấy 1 kịch bản Wansee cũ, **cắt còn 2 scene**, bật `animate: true`.
2. Chạy. Xem log server: `[animate]` báo lỗi gì không.
3. Mở clip trong `output/wansee/{project}/clips/` và soi kỹ:

| Soi cái gì | Đạt | Hỏng |
|---|---|---|
| Nét mực | vẫn sắc, vẫn đen trắng | nhoè, xám, mất crosshatch |
| Mặt nhân vật | giữ nguyên | méo, trôi, đổi người |
| Tay/ngón | yên hoặc động tự nhiên | mọc thêm ngón, dính vào nhau |
| Cường độ | thở nhẹ, tóc lay | ngoáy đầu, múa tay |
| Chi tiết SAI ẩn | còn nguyên | bị model xoá mất |

4. Động quá tay → giảm `intensity` trong `motion` xuống 0.15–0.25.
5. Chảy nét → xem mục 8.

---

## 8. Nếu Wan phá style manga

Khả năng này có thật: Wan train chủ yếu trên **video người thật**, tranh mực 2D không phải
sở trường. Thứ tự thử:

1. **Giảm denoise / tăng trọng số ảnh gốc** trong workflow — giữ ảnh gốc chặt hơn.
2. **Giảm số khung** (49 thay vì 81) — clip ngắn thì ít cơ hội trôi.
3. **Đổi sang AnimateDiff + checkpoint SD1.5 anime/manga**. Nền SD1.5 hiểu thẩm mỹ 2D hơn hẳn,
   VRAM thấp hơn, hệ LoRA phong phú. Đổi provider không cần sửa code — chỉ cần workflow khác:
   `"animate_workflow": "animatediff"`.
4. **ToonCrafter** — làm riêng cho hoạt hình 2D, đáng thử nếu 3 cách trên đều hỏng.

Kết luận nào cũng ghi lại vào đây để lần sau khỏi thử lại.

---

## 9. Train LoRA (giai đoạn sau)

Chỉ làm khi mục 7 đã cho kết quả chấp nhận được.

- **Không train from scratch** — cần hàng nghìn GPU-giờ, không khả thi. Chỉ LoRA fine-tune.
- **Dữ liệu:** dùng ảnh do chính pipeline này sinh ra, hoặc LoRA có license rõ ràng.
- **TUYỆT ĐỐI không** cào video kênh gốc (Wansee Entertainment…) làm dữ liệu train.
  Nó phá đúng ranh giới bản quyền mà `AGENTS.md` đã đặt ra, và rủi ro Content ID cao hơn
  hẳn so với việc chỉ đọc transcript lấy tone.

---

## 10. Cách hệ thống tự chống lỗi

`animateScene()` **không bao giờ ném lỗi lên trên**. Mọi trường hợp dưới đây đều trả `null`
và scene rơi về ảnh tĩnh + Ken Burns:

- `animate_provider` = `off`
- `motion.type` = `none` (scene cố ý đóng băng)
- không tìm thấy file workflow
- ComfyUI không chạy / sai địa chỉ
- workflow chạy lỗi hoặc không ra file video
- quá 15 phút

Nghĩa là bật `animate: true` khi chưa dựng xong ComfyUI **không làm hỏng gì** — chỉ là
video ra giống hệt bây giờ. Cứ bật rồi dò dần.

Clip đã tạo được **cache** theo tên file. Muốn tạo lại thì xoá file trong
`output/{channel}/{project}/clips/`.
