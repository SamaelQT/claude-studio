# Checklist kiểm tra năng lực Content Studio — series VIRUS

> Dùng file này để hỏi/kiểm tra app Content Studio (local — Flux, FFmpeg, FPT AI Voice) hiện làm được tới đâu, trước khi chốt hẳn quy trình sản xuất.

## Quyết định sản xuất đã tạm chốt (chờ xác nhận app đáp ứng được)
- **Định dạng:** "kiểu chuyện" — ảnh tĩnh chất lượng cao (Flux) + hiệu ứng pan/zoom/crossfade (Ken Burns) + lồng tiếng (FPT Voice) + âm thanh nền, dựng bằng FFmpeg. Không phải video chuyển động thật.
- **Phong cách hình ảnh:** digital painting điện ảnh — vẽ số chi tiết cao, ánh sáng/bố cục như phim, không phải ảnh chụp thật (photorealistic), không anime/manga/cartoon.
- Toàn bộ 74 img-prompt trong kịch bản đã được cập nhật theo style suffix chung này — có thể dùng thử ngay để test app.

## 1. Ảnh (Flux)
- Prompt dài ~50–70 từ như trong kịch bản — Flux có xử lý tốt không, hay cần rút gọn?
- Có giữ được **nhất quán nhân vật** giữa các shot khác nhau không (cùng một gương mặt/trang phục cho bạn gái, phản diện, tên tàn bạo, hậu phương xuyên suốt nhiều tập)? App có hỗ trợ reference image / character LoRA / seed cố định không?
- Có xuất được đúng tỷ lệ khung hình cần dùng không (dọc 9:16 cho Short, ngang 16:9 cho video dài)?
- Tốc độ + chi phí gen 1 ảnh là bao nhiêu? Với ~74 shot hiện tại (chưa tính phát sinh) thì tổng chi phí/thời gian ước tính ra sao?

## 2. Giọng đọc (FPT AI Voice)
- Có hỗ trợ nhiều giọng khác nhau trong cùng video không (giọng kể chuyện của Samael + giọng phản diện + giọng bạn gái + tên tàn bạo), hay chỉ 1 giọng cố định?
- Có điều chỉnh được sắc thái cảm xúc không (thì thầm, gằn giọng, hét, nghẹn ngào)?
- Xuất file có kèm timestamp/phụ đề để đồng bộ với ảnh không?

## 3. Dựng video (FFmpeg trong app)
- App có tự động làm hiệu ứng pan/zoom (Ken Burns) trên ảnh tĩnh không, hay phải tự cấu hình bằng tay cho từng ảnh?
- Có hỗ trợ crossfade / cut cứng giữa các shot không?
- Có tự đồng bộ độ dài ảnh theo đúng độ dài đoạn lồng tiếng tương ứng không (ví dụ shot-dur ghi trong kịch bản)?
- Có chèn được chữ trên nền đen (kiểu "Đây là giấc mơ tôi mơ mỗi đêm...") không?
- Có lớp âm thanh nền/SFX riêng (ví dụ tiếng còi báo động, tiếng bom) chồng lên giọng đọc không?

## 4. Pipeline tổng thể
- App có nhận input dạng có cấu trúc (ví dụ copy nguyên khối "Hình ảnh + img-prompt + Voiceover" từ file kịch bản HTML) hay phải nhập tay từng trường?
- Có xuất preview nhanh (ảnh + giọng đọc thô) trước khi render bản đầy đủ không, để duyệt trước khi tốn thời gian dựng?
- Giới hạn hiện tại: số ảnh/tập tối đa xử lý được 1 lần, dung lượng, thời gian render...?

## Việc cần làm sau khi có câu trả lời
- Nếu app đáp ứng đủ → tiếp tục hoàn thiện style bible (mô tả ngoại hình nhân vật cố định) rồi update toàn bộ img-prompt còn lại.
- Nếu có giới hạn (ví dụ không giữ nhất quán nhân vật, không multi-voice...) → cần điều chỉnh lại kịch bản hoặc quy trình cho phù hợp trước khi làm tiếp.
