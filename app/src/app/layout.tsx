import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LivingMatch",
  description: "Dein Zuhause, perfekt gematcht.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased selection:bg-orange-500 selection:text-white bg-stone-950 flex items-center justify-center min-h-[100dvh] overflow-hidden m-0 p-0">
        <main className="w-full h-[100dvh] sm:h-[90dvh] sm:max-h-[900px] sm:max-w-[420px] relative bg-stone-900/80 shadow-2xl shadow-orange-500/10 sm:rounded-[2.5rem] overflow-hidden sm:border border-stone-700 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
