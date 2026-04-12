'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearSessionAndRedirectToLogin } from '../../lib/auth';

export default function LogoutPage(): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    clearSessionAndRedirectToLogin(router.replace);
  }, [router]);

  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      Signing you out…
    </div>
  );
}
