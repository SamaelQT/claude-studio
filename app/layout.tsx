import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Content Studio",
  description: "Tạo video YouTube hoàn chỉnh từ ý tưởng",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
