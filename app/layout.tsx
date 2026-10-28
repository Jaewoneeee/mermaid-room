import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Mermaid Room — 흐름을 더 선명하게",
  description:
    "Mermaid 다이어그램을 확대하고, 참여자 헤더를 고정해 긴 흐름도 편하게 읽으세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
