import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MathBlocks Live',
  description:
    'Build the same block-coding project with your teacher, live, and learn 2nd grade maths by doing it.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Children drag blocks with a finger; pinch-zoom fighting the drag is worse
  // than no zoom, and the editor has its own zoom controls.
  maximumScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
