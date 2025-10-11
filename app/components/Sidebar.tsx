'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cctv, Notebook, LineChart, ScanEye } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const items = [
    { href: '/', label: 'Home', Icon: Cctv },
    { href: '/log', label: 'Logs', Icon: Notebook },
    { href: '/stats', label: 'Stats', Icon: LineChart },
    { href: '/train', label: 'Train', Icon: ScanEye },
  ];

  const baseClass =
    'w-14 h-14 rounded-xl flex items-center justify-center';
  const inactiveClass =
    'bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white';
  const activeClass =
    'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/50 text-white';

  return (
    <div className="hidden md:flex w-16 md:w-20 bg-slate-900/50 backdrop-blur-xl border-r border-slate-800/50 flex-col items-center py-4 md:py-6 gap-6 md:gap-8">
      <div className="text-center mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-2">
          <Cctv className="w-6 h-6 text-white" />
        </div>
        <div className="text-xs font-bold text-white">Omni</div>
        <div className="text-[10px] text-slate-400">Campus</div>
      </div>

      <div className="flex-1 flex flex-col gap-3">
        {items.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
            >
              <Icon className="w-6 h-6" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}