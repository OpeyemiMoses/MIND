import type { Metadata } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans, Sora } from 'next/font/google';
import { LaunchFilm } from '@/components/film/LaunchFilm';

const sora = Sora({ subsets: ['latin'], weight: ['500', '600', '700', '800'] });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['500', '600', '700'] });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Mind — Launch Film',
  description: 'Mind: your financial life, remembered. A 2:30 motion graphics launch film.',
};

export default function FilmPage() {
  return (
    <main className={`${sora.className} ${jakarta.className} ${mono.className}`}>
      <LaunchFilm fonts={{ display: sora.style.fontFamily, sans: jakarta.style.fontFamily, mono: mono.style.fontFamily }} />
    </main>
  );
}

