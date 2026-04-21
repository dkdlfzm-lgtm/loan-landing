import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.andifinancial.com";
const ogImage = `${siteUrl}/og-image.png`;
const siteName = "엔드아이에셋대부";
const defaultTitle = "엔드아이에셋대부 | 아파트 시세조회 · 주택담보대출 · 대환대출 상담";
const defaultDescription = "아파트 시세조회부터 주택담보대출, 대환대출, 전세퇴거자금 상담까지 빠르고 안정적으로 도와드립니다. 전화·카카오톡으로 간편하게 상담 신청하세요.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: defaultTitle,
  description: defaultDescription,
  keywords: [
    "엔드아이에셋대부",
    "아파트 시세조회",
    "주택담보대출",
    "대환대출",
    "전세퇴거자금",
    "부동산 담보대출",
    "대출 상담",
    "아파트 시세",
    "주택 시세조회",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName,
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "엔드아이에셋대부",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    other: process.env.NAVER_SITE_VERIFICATION
      ? {
          "naver-site-verification": process.env.NAVER_SITE_VERIFICATION,
        }
      : undefined,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
