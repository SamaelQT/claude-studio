// Catalog story Wansee Entertainment — dùng làm nguồn ý tưởng clone tiếng Việt

export interface WanseeStory {
  id: string;
  title: string;          // Tiêu đề gốc
  titleVi: string;        // Tiêu đề Việt hóa
  setting: string;        // Bối cảnh Việt Nam
  hook: string;           // Câu mở đầu gợi ý
  tags: string[];
}

export const WANSEE_CATALOG: WanseeStory[] = [
  {
    id: "creepy_neighbor",
    title: "Creepy Neighbor Horror Story",
    titleVi: "Hàng Xóm Bí Ẩn",
    setting: "Chung cư cũ ở Hà Nội, tầng 8",
    hook: "Tôi chuyển đến căn hộ mới được 3 ngày thì bắt đầu nghe tiếng gõ tường lúc 3 giờ sáng...",
    tags: ["neighbor", "apartment", "night"],
  },
  {
    id: "home_alone",
    title: "Home Alone Horror Story",
    titleVi: "Một Mình Trong Đêm",
    setting: "Nhà riêng ở ngoại ô, bố mẹ đi vắng",
    hook: "Bố mẹ đi công tác 3 ngày, để tôi ở nhà một mình. Đêm đầu tiên, tôi thấy bóng người đứng ngoài cửa sổ...",
    tags: ["home", "alone", "intruder"],
  },
  {
    id: "abandoned_hospital",
    title: "Creepy Mental Hospital",
    titleVi: "Bệnh Viện Bỏ Hoang",
    setting: "Bệnh viện tâm thần cũ bị bỏ hoang 20 năm",
    hook: "Nhóm bạn tôi dám tôi một mình vào khu bệnh viện tâm thần đã đóng cửa từ năm 2003...",
    tags: ["hospital", "abandoned", "dare"],
  },
  {
    id: "childhood_memory",
    title: "True Childhood Horror Story",
    titleVi: "Ký Ức Tuổi Thơ Ám Ảnh",
    setting: "Làng quê miền Bắc, hồi nhỏ",
    hook: "Tôi 8 tuổi khi lần đầu thấy người đàn ông đứng giữa ruộng lúa vào lúc nửa đêm. Không ai tin tôi...",
    tags: ["childhood", "rural", "paranormal"],
  },
  {
    id: "new_house",
    title: "New House Horror Story",
    titleVi: "Ngôi Nhà Mới",
    setting: "Nhà mới mua giá rẻ bất thường ở ngoại ô",
    hook: "Nhà rộng, giá rẻ đến kỳ lạ. Chủ nhà cũ bán gấp không giải thích lý do. Tuần đầu tiên tôi hiểu tại sao...",
    tags: ["new_house", "haunted", "mystery"],
  },
  {
    id: "road_trip",
    title: "Weekend Trip Horror Story",
    titleVi: "Chuyến Đi Cuối Tuần",
    setting: "Đường đèo miền núi, đêm khuya xe bị hỏng",
    hook: "Xe chết máy lúc 1 giờ sáng giữa đèo vắng. Khi tôi nhìn lên, có ánh đèn leo lét từ ngôi nhà trên đồi...",
    tags: ["road_trip", "mountain", "stranded"],
  },
  {
    id: "gas_station",
    title: "Gas Station Horror Story",
    titleVi: "Trạm Xăng Lúc Nửa Đêm",
    setting: "Trạm xăng hẻo lánh trên quốc lộ vắng",
    hook: "Đổ xăng lúc 2 giờ sáng, nhân viên trạm cứ nhìn tôi với ánh mắt kỳ lạ rồi thì thầm: 'Anh đừng ra ngoài'...",
    tags: ["gas_station", "highway", "warning"],
  },
  {
    id: "break_in",
    title: "Break In Horror Story",
    titleVi: "Kẻ Đột Nhập",
    setting: "Căn hộ chung cư, đêm khuya",
    hook: "Tôi thức dậy lúc 2 giờ sáng và nhận ra có gì đó không đúng — tiếng bước chân trong phòng khách, dù tôi sống một mình...",
    tags: ["intruder", "apartment", "alone"],
  },
  {
    id: "dorm_room",
    title: "Dorm Room Horror Story",
    titleVi: "Phòng Ký Túc Xá",
    setting: "Ký túc xá đại học cũ, phòng có lịch sử kỳ lạ",
    hook: "Roommate mới của tôi ngủ suốt, không ăn, không nói chuyện. Đến ngày thứ 5, ban quản lý gọi lên hỏi tại sao phòng tôi lại ở một mình...",
    tags: ["dorm", "roommate", "university"],
  },
  {
    id: "night_shift",
    title: "Night Shift Horror Story",
    titleVi: "Ca Đêm",
    setting: "Siêu thị lớn, ca làm việc lúc 12 đêm",
    hook: "Ca đêm tại siêu thị vắng chỉ có 2 người. Đến 3 giờ sáng, camera an ninh bắt đầu ghi lại thứ gì đó di chuyển ở khu hàng hóa tầng B...",
    tags: ["night_shift", "supermarket", "cctv"],
  },
  {
    id: "online_stranger",
    title: "Online Stranger Horror Story",
    titleVi: "Người Lạ Trên Mạng",
    setting: "Quen qua mạng xã hội, gặp ngoài đời",
    hook: "Người đó biết tất cả mọi thứ về tôi trước khi tôi kịp kể. Địa chỉ nhà, tên bố mẹ, thói quen hàng ngày...",
    tags: ["online", "stalker", "social_media"],
  },
  {
    id: "camping",
    title: "Camping Horror Story",
    titleVi: "Đêm Cắm Trại Trong Rừng",
    setting: "Khu rừng nguyên sinh, nhóm 4 người",
    hook: "Đêm thứ hai cắm trại, chúng tôi tìm thấy lều của mình đã bị ai đó sắp xếp lại từ bên trong khi tất cả đang ra ngoài...",
    tags: ["camping", "forest", "group"],
  },
  {
    id: "elevator",
    title: "Elevator Horror Story",
    titleVi: "Thang Máy Tầng Âm",
    setting: "Tòa nhà văn phòng cũ, làm thêm giờ một mình",
    hook: "Thang máy dừng ở tầng âm 2 — tầng không có trong danh sách. Cửa mở ra và tôi thấy hành lang dài tối tăm...",
    tags: ["elevator", "office", "basement"],
  },
  {
    id: "hitchhiker",
    title: "Hitchhiker Horror Story",
    titleVi: "Người Đi Nhờ Xe",
    setting: "Đường vắng đêm khuya, đi xe một mình",
    hook: "Tôi dừng xe cho một phụ nữ đứng giữa đường mưa. Đến nơi cô ấy muốn đến, người hàng xóm nhìn tôi bàng hoàng: 'Cô ấy mất 3 năm trước rồi'...",
    tags: ["hitchhiker", "ghost", "driving"],
  },
  {
    id: "old_photo",
    title: "Old Photo Horror Story",
    titleVi: "Bức Ảnh Cũ",
    setting: "Tìm thấy album ảnh cũ trong nhà ông bà",
    hook: "Trong album ảnh gia đình từ 40 năm trước, tôi thấy một người đứng sau bố mình. Khuôn mặt đó — giống tôi đến kỳ lạ...",
    tags: ["photo", "family", "mystery"],
  },
];

// Style ảnh chuẩn Wansee — dùng làm prefix cho mọi image prompt
export const WANSEE_IMAGE_STYLE =
  "Wansee Entertainment flat 2D cel animation style, American horror cartoon meets Korean webtoon, thick bold black ink outlines on everything, flat solid color fills with NO gradients NO photorealism NO 3D rendering, muted earth tone palette: tan and brown skin tones, dark navy or charcoal grey backgrounds, mustard yellow or olive green as accent color, horror character expressions: large round white eyes wide open in shock, heavy dark eyebrows, teeth slightly showing, simple elongated face proportions, flat colored architectural backgrounds (simple block shapes for buildings walls roads), dark oppressive atmosphere through dark flat background colors NOT through lighting effects, clean vector-like appearance, NO film grain, NO photographic textures, NO complex lighting, NO shadows gradients, NO anime style, NO realistic rendering, flat horror illustration like a dark animated TV show, 16:9 widescreen, NO text NO watermark";

// Style voice/script chuẩn Wansee
export const WANSEE_SCRIPT_STYLE = `
Kể chuyện ngôi thứ nhất (tôi), theo đúng công thức Wansee:
1. Giới thiệu bản thân + bối cảnh bình thường (2-3 scene)
2. Dấu hiệu đầu tiên kỳ lạ — nhỏ, dễ bỏ qua (3-4 scene)
3. Sự việc leo thang, nghi ngờ tăng dần (4-5 scene)
4. Khám phá sự thật đáng sợ (4-5 scene)
5. Cao trào kinh dị (3-4 scene)
6. Kết thúc ám ảnh — để lại câu hỏi "what if?" (2-3 scene)
Giọng văn: bình thản kể lại, không kêu la, sự sợ hãi thể hiện qua chi tiết chứ không qua cảm thán.`;
