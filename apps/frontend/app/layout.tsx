/**
 * @file apps/frontend/app/layout.tsx
 * @description Root layout for the GST Reconciliation Next.js app.
 * Applies global styles, metadata, and wraps all pages with the Header component.
 *
 * Phase 1: Basic layout with navigation.
 */

import type { Metadata } from 'next';
import './globals.css';
import { Header } from '../components/layout/Header';

export const metadata: Metadata = {
  title: 'GST Reconciliation System',
  description:
    'AI-powered GST Reconciliation and Input Tax Credit (ITC) Automation System for Indian businesses.',
  keywords: ['GST', 'reconciliation', 'ITC', 'GSTR-2A', 'GSTR-2B', 'India', 'tax'],
};

/**
 * Root layout wraps every page in the application.
 * Includes the global Header navigation.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
