import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Project Submissions',
  description: 'Manage student project title submissions, verification, and repo tracking.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
