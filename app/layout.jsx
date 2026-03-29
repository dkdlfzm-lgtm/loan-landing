import "./globals.css";

export const metadata = {
  title: "엔드아이에셋대부",
  description: "주택담보대출 · 대환대출 · 전세퇴거자금 상담",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}