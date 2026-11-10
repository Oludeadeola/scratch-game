import type { MetadataRoute } from 'next';

/**
 * The web app manifest, which is what lets a child add MathBlocks to her home
 * screen and open it like any other app. It stays a web app — nothing is
 * installed from a store and nothing needs updating by hand.
 *
 * `display: standalone` drops the browser chrome, which matters on an iPad
 * where the address bar eats stage height. `orientation: any` is deliberate:
 * children hold tablets whichever way they like, and the layout handles both.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MathBlocks Live',
    short_name: 'MathBlocks',
    description:
      'Build block-coding projects with your teacher, live, and learn maths by doing it.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f1f5f9',
    theme_color: '#0f172a',
    categories: ['education', 'kids'],
    lang: 'en',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: "This week's lesson",
        short_name: 'Lesson',
        url: '/',
      },
      {
        name: 'Progress',
        short_name: 'Progress',
        url: '/progress',
      },
    ],
  };
}
