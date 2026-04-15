/**
 * @file apps/frontend/app/layout.tsx
 * @description Root layout for the GST Reconciliation Next.js app.
 * Phase 12: Navy design system — DM Sans + JetBrains Mono.
 *           LayoutShell handles conditional sidebar/topbar vs auth-only view.
 */

import type { Metadata } from 'next';
import './globals.css';
import { LayoutShell } from '../components/layout/LayoutShell';

export const metadata: Metadata = {
  title: 'GST Reconciliation System',
  description:
    'AI-powered GST Reconciliation and Input Tax Credit (ITC) Automation System for Indian businesses.',
  keywords: ['GST', 'reconciliation', 'ITC', 'GSTR-2A', 'GSTR-2B', 'India', 'tax'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Fonts: DM Sans (body) and JetBrains Mono (mono / data) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/*
          Anti-FOUC script: reads stored theme and applies both .dark class
          (Tailwind dark: utilities) and data-theme="dark" attribute (CSS variables)
          before first paint.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.removeAttribute('data-theme');}else{document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-theme','dark');}}catch(e){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
