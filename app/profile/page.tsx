import type { Metadata } from 'next';
import { ProfileClient } from '@/components/profile/profile-client';
import { getProStatus, currentUserId } from '@/lib/subscription';

export const metadata: Metadata = {
  title: 'My Profile',
};

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const isPro = await getProStatus(await currentUserId());

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="relative mb-8">
        <span className="katakana absolute -top-2 left-0 text-[10px]">プロフィール</span>
        <h1 className="text-4xl text-white text-glow sm:text-5xl">My Profile</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Your watchlist, history, and subscription — all in one place.
        </p>
      </div>
      <ProfileClient isPro={isPro} />
    </div>
  );
}
