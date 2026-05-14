'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invalid email or password');
        setIsLoading(false);
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError('Sign-in failed. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
      <div
        className="w-full max-w-md panel rounded-2xl p-7 sm:p-8"
        style={{ animation: 'panelRise 0.45s ease-out both' }}
      >
        <div className="mb-7 flex flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
            Google Maps Scraper
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-[26px]">
            Sign in to continue
          </h1>
          <p className="text-sm text-slate-500">
            Enter your credentials to access the dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-shell"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-shell"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              className="rounded-lg border px-4 py-3 text-sm"
              style={{
                background: 'var(--danger-bg)',
                borderColor: 'rgba(185, 28, 28, 0.14)',
                color: 'var(--danger-text)',
              }}
            >
              {error}
            </div>
          )}

          <button type="submit" disabled={isLoading} className="btn-primary mt-1 w-full">
            {isLoading && <LoadingSpinner />}
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
