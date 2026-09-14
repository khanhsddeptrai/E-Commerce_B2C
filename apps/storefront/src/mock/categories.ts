import { Category } from "@/types/ecommerce";

export const MOCK_CATEGORIES: Category[] = [
  {
    id: "cat-audio",
    slug: "am-thanh-thong-minh",
    name: "Âm Thanh & Tai Nghe",
    description: "Tai nghe chống ồn chủ động ANC & Loa Bluetooth chuẩn âm thanh Hi-Res",
    icon: "Headphones",
    itemCount: 18,
    featuredImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "cat-wearables",
    slug: "dong-ho-thong-minh",
    name: "Đồng Hồ & Wearables",
    description: "Theo dõi sức khỏe sinh trắc học, định vị GPS kép, pin bền 14 ngày",
    icon: "Watch",
    itemCount: 12,
    featuredImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "cat-desk",
    slug: "phu-kien-desk-setup",
    name: "Desk Setup & Bàn Phím",
    description: "Bàn phím cơ Custom không dây, chuột công thái học, đèn thanh treo màn hình",
    icon: "Keyboard",
    itemCount: 24,
    featuredImage: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "cat-charging",
    slug: "sac-nhanh-power",
    name: "Năng Lượng & Sạc Nhanh",
    description: "Củ sạc công nghệ GaN III 140W, Trạm sạc không dây 3-in-1, Pin dự phòng MagSafe",
    icon: "Zap",
    itemCount: 16,
    featuredImage: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=80",
  },
];
