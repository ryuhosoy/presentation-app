import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PresentationFlow - Automated PowerPoint Presentations',
  description: 'Transform your presentations into engaging automated videos with synchronized audio and smooth slide transitions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}