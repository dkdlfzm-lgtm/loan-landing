import "./globals.css";

export const metadata = {
  title: "ANDI 대출상담센터",
  description: "주택담보대출, 전세퇴거자금, 사업자대출, 대환대출 상담을 빠르게 도와드립니다.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
