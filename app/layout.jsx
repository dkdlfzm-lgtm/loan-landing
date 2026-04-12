import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://www.andifinancial.com"),
  title: "엔디파이낸셜 | 내 상황에 맞는 대출 상담을 빠르게",
  description:
    "복잡한 대출, 혼자 고민하지 마세요. 현재 이용 중인 대출부터 추가 한도, 갈아타기, 담보대출까지 내 상황에 맞는 방향을 빠르게 상담해드립니다.",
  keywords: [
    "대출상담",
    "담보대출",
    "아파트담보대출",
    "대환대출",
    "추가대출",
    "퇴거자금",
    "시세조회",
    "엔디파이낸셜",
  ],
  openGraph: {
    title: "엔디파이낸셜 | 내 상황에 맞는 대출 상담을 빠르게",
    description:
      "복잡한 대출, 혼자 고민하지 마세요. 현재 이용 중인 대출부터 추가 한도, 갈아타기, 담보대출까지 내 상황에 맞는 방향을 빠르게 상담해드립니다.",
    url: "https://www.andifinancial.com",
    siteName: "엔디파이낸셜",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "엔디파이낸셜 대표 이미지",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "엔디파이낸셜 | 내 상황에 맞는 대출 상담을 빠르게",
    description:
      "복잡한 대출, 혼자 고민하지 마세요. 현재 이용 중인 대출부터 추가 한도, 갈아타기, 담보대출까지 내 상황에 맞는 방향을 빠르게 상담해드립니다.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/andi-logo.png",
    shortcut: "/andi-logo.png",
    apple: "/andi-logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
