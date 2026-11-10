import type { Metadata, Viewport } from 'next';
import ServiceWorker from '@/components/ServiceWorker';
import './globals.css';

export const metadata: Metadata = {
  title: 'MathBlocks Live',
  description:
    'Build the same block-coding project with your teacher, live, and learn 2nd grade maths by doing it.',
  applicationName: 'MathBlocks Live',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'MathBlocks',
    // Matches the editor's top bar, so the iOS status bar blends into it.
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: {
    // Stops iOS turning "move 5 steps" into a phone-number link.
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Children drag blocks with a finger; pinch-zoom fighting the drag is worse
  // than no zoom, and the editor has its own zoom controls.
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
  // Lets the app paint under the notch when installed on a phone.
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
