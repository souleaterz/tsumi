import Link from 'next/link';
import { AuthPanel } from '@/components/layout/auth-panel';

export const metadata = { title: 'Sign Up' };

export default function SignUpPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
      <span className="font-jp text-5xl text-primary">罪</span>
      <h1 className="mt-3 font-heading text-4xl tracking-widest text-white text-glow">
        Join Tsumi
      </h1>
      <p className="katakana mt-1 text-[10px]">サインアップ</p>
      <div className="mt-8">
        <AuthPanel mode="sign-up" />
      </div>
      <p className="mt-6 text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
