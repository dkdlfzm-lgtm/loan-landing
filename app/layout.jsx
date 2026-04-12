import "./globals.css";

export const metadata = {
  title: "엔드아이에셋대부 | 주택담보대출 · 대환대출 · 전세퇴거자금 상담",
  description: "아파트 시세 확인부터 맞춤 대출 상담까지. 빠르고 안정적인 대출 컨설팅 서비스를 제공합니다.",
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