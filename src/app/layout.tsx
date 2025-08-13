import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stock market AI-Powered Development",
  description: "Stock market pattern hunter with Next.js, TypeScript, and Tailwind CSS",
  keywords: ["Stock market pattern hunter", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "AI development", "React"],
  authors: [{ name: "Adesai" }],
  openGraph: {
    title: "Stock Market Pattern Hunter",
    description: "AI-powered development with modern React stack",
    url: "my_github_repo",
    siteName: "my_github_repo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stock Market Pattern Hunter",
    description: "AI-powered development with modern React stack",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
