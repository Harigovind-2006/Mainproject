import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgriTrack | Autonomous Fleet Progress & ETA Correction Dashboard",
  description:
    "Real-time closed-loop telemetry tracker, digital twin ETA estimation, adaptive speed & trajectory correction for autonomous agricultural fleets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-[#070b14] text-slate-100 antialiased selection:bg-cyan-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}