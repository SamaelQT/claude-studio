SHARED FOLDER — Dùng chung giữa các task Claude
================================================

Cấu trúc:
/shared
  /channel-context     → Thông tin kênh, tone, format (đọc trước khi làm)
  /storyboards         → Storyboard từng video (từ task Content Manager)
  /scripts             → JSON script hoàn chỉnh (từ task Script JSON)
  /prompts             → fal prompts đã tạo
  /assets              → Link ảnh, video đã render

WORKFLOW:
1. Task Content Manager → bàn ý tưởng → lưu storyboard vào /storyboards
2. Task Script JSON → đọc storyboard → tạo fal prompts → lưu vào /scripts + /prompts
3. Cả 2 task đều đọc /channel-context/CHANNEL_CONTEXT.json trước khi bắt đầu

Files quan trọng:
- channel-context/CHANNEL_CONTEXT.json   → thông tin toàn bộ hệ thống kênh
- storyboards/introvert_ep01_storyboard.json → Tập 1 kênh Người Hướng Nội
