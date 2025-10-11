import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Cctv, Notebook, LineChart, ScanEye } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OmniCampus",
  description: "Built with BaseBrain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex h-screen bg-slate-950 overflow-hidden">
          {/* Sidebar (global) */}
          <div className="w-20 bg-slate-900/50 backdrop-blur-xl border-r border-slate-800/50 flex flex-col items-center py-6 gap-8">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-2">
                <Cctv className="w-6 h-6 text-white" />
              </div>
              <div className="text-xs font-bold text-white">Omni</div>
              <div className="text-[10px] text-slate-400">Campus</div>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              {/* Static menu buttons (global) */}
              <button className="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/50">
                <Cctv className="w-6 h-6 text-white" />
              </button>
              <button className="w-14 h-14 rounded-xl flex items-center justify-center bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white">
                <Notebook className="w-6 h-6" />
              </button>
              <button className="w-14 h-14 rounded-xl flex items-center justify-center bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white">
                <LineChart className="w-6 h-6" />
              </button>
              <button className="w-14 h-14 rounded-xl flex items-center justify-center bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white">
                <ScanEye className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Main area for pages */}
          <main className="flex-1 relative">{children}</main>
        </div>
      </body>
    </html>
  );
}
