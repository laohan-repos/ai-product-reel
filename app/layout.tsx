import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '同款视频 — AI 产品视频创作工具',
  description: '参考视频结构，用你的产品生成同款风格视频。',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
  openGraph: {
    title: '同款视频 — AI 产品视频创作工具',
    description: '参考视频结构，用你的产品生成同款风格视频。',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '同款视频 — AI 产品视频创作工具',
    description: '参考视频结构，用你的产品生成同款风格视频。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
