'use client';

import Link from 'next/link';

/**
 * @file apps/frontend/app/recovery/page.tsx
 * @description Password recovery placeholder page.
 */
export default function RecoveryPage(): React.ReactElement {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-md">
        <h1 className="mb-2 text-center text-2xl font-bold text-foreground">Password Recovery</h1>
        <p className="text-center text-sm text-muted-foreground">
          Please contact support to reset your password.
        </p>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Back to{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
