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
      <body className="antialiased selection:bg-emerald-500 selection:text-white bg-slate-950 flex items-center justify-center min-h-[100dvh] overflow-hidden m-0 p-0">
        <main className="w-full h-[100dvh] sm:h-[90dvh] sm:max-h-[900px] sm:max-w-[420px] relative bg-slate-900/80 shadow-2xl shadow-emerald-500/10 sm:rounded-[2.5rem] overflow-hidden sm:border border-slate-700 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
