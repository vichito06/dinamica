import Image from 'next/image';
import { getSettings } from '@/lib/json-db';
import HomeClient from '@/components/HomeClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const settings = await getSettings();

  return (
    <main className="min-h-screen dark">
      {/* Logo Header - NO ADMIN LINK */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/10">
        <div className="container-custom py-3 flex items-center justify-center">
          <Image src="/logo.png" alt="Logo" width={50} height={50} />
        </div>
      </div>

      <HomeClient settings={settings} />
    </main>
  );
}
