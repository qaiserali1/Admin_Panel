import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FMCG Booker Admin Portal | Device Binding & Approvals',
  description: 'Manage FMCG order booking agents, device bindings, and access approvals',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
