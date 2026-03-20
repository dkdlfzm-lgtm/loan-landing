import "./globals.css";

export const metadata = {
  title: "대출 상담 홈페이지",
  description: "대출 상담 접수형 랜딩페이지 예시",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}