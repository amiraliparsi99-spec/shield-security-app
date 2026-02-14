"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";

type Theme = 'dark' | 'light' | 'system';

const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { 
    value: 'light', 
    label: 'Light',
    icon: <SunIcon className="w-4 h-4" />
  },
  { 
    value: 'dark', 
    label: 'Dark',
    icon: <MoonIcon className="w-4 h-4" />
  },
  { 
    value: 'system', 
    label: 'System',
    icon: <ComputerIcon className="w-4 h-4" />
  },
];

export function ThemeToggle({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const { theme, setTheme } = useTheme();

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-lg p-1">
        {THEMES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={`p-2 rounded-md transition ${
              theme === t.value 
                ? 'bg-shield-500 text-white' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-shield-500/20 flex items-center justify-center shrink-0">
          {theme === 'dark' ? (
            <MoonIcon className="w-5 h-5 text-shield-400" />
          ) : theme === 'light' ? (
            <SunIcon className="w-5 h-5 text-shield-400" />
          ) : (
            <ComputerIcon className="w-5 h-5 text-shield-400" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-white font-medium">Appearance</h3>
          <p className="text-sm text-zinc-400 mt-1">
            Choose how Shield looks to you
          </p>
          
          <div className="grid grid-cols-3 gap-3 mt-4">
            {THEMES.map((t) => (
              <motion.button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                  theme === t.value 
                    ? 'border-shield-500 bg-shield-500/10' 
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  theme === t.value ? 'bg-shield-500 text-white' : 'bg-white/10 text-zinc-400'
                }`}>
                  {t.icon}
                </div>
                <span className={`text-sm font-medium ${
                  theme === t.value ? 'text-shield-400' : 'text-zinc-400'
                }`}>
                  {t.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Quick toggle button for nav/header
export function ThemeQuickToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <motion.button
      onClick={toggleTheme}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
        resolvedTheme === 'dark' 
          ? 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white' 
          : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700'
      }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {resolvedTheme === 'dark' ? (
        <SunIcon className="w-5 h-5" />
      ) : (
        <MoonIcon className="w-5 h-5" />
      )}
    </motion.button>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function ComputerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
