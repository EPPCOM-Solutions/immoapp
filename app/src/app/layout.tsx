import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Premium Immo Finder",
  description: "Next-gen real estate swiping application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased selection:bg-emerald-500 selection:text-white bg-slate-950">
        <main className="w-full h-[100dvh] pb-safe sm:pb-0 sm:h-auto sm:max-w-md mx-auto sm:aspect-[9/19.5] relative bg-slate-900/50 shadow-2xl shadow-emerald-500/10 sm:my-8 sm:rounded-[3rem] overflow-hidden sm:border border-slate-700/50">
          {children}
        </main>
      </body>
    </html>
  );
}
