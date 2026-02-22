import Image from 'next/image';
import { getSettings } from '@/lib/json-db';
import HomeClient from '@/components/HomeClient';
import LandingVisitTracker from '@/components/analytics/LandingVisitTracker';
import { getActiveRaffleId } from '@/lib/raffle';

export const dynamic = 'force-dynamic';

async function getProgress() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'https://yvossoeee.com';
    const res = await fetch(`${baseUrl}/api/public/progress`, {
      next: { revalidate: 30 },
    });

    if (!res.ok) return { total: 0, vendido: 0, porcentaje: 0 };
    return res.json();
  } catch (error) {
    console.error("[HOME] Error fetching progress:", error);
    return { total: 0, vendido: 0, porcentaje: 0 };
  }
}

export default async function Home() {
  const settings = await getSettings();
  const raffleId = await getActiveRaffleId();
  const progressData = await getProgress();

  return (
    <main className="min-h-screen dark">
      <LandingVisitTracker raffleId={raffleId} />
      {/* Logo Header - NO ADMIN LINK */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/10">
        <div className="container-custom py-3 flex items-center justify-center">
          <Image src="/logo.png" alt="Logo" width={50} height={50} />
        </div>
      </div>

      <HomeClient settings={settings} progress={progressData} />
    </main>
  );
}
