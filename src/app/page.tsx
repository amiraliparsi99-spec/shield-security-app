"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FadeIn,
  StaggerContainer,
  StaggerItem,
  GlowCard,
  AnimatedText,
  FloatingOrb,
  PulseButton,
  motion,
} from "@/components/ui/motion";
import { trackEvent, trackPageView } from "@/lib/analytics";

// Phone Mockup Component
function PhoneMockup({ 
  children, 
  className = ""
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div 
      className={`relative ${className}`}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      {/* Phone frame */}
      <div className="relative mx-auto w-[280px] h-[580px] rounded-[40px] border-[8px] border-zinc-800 bg-black shadow-2xl shadow-black/60 overflow-hidden">
        {/* Screen content - fills entire frame */}
        <div className="w-full h-full overflow-hidden rounded-[32px]">
          {children}
        </div>
      </div>
      {/* Glow effect */}
      <div className="absolute inset-0 -z-10 blur-3xl opacity-30 bg-gradient-to-b from-shield-500 to-transparent" />
    </motion.div>
  );
}

// Interactive Phone with Tab Navigation
type PhoneTab = 'home' | 'explore' | 'messages' | 'payments' | 'account';

function InteractivePhone({ className = "" }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<PhoneTab>('home');

  const tabs: { id: PhoneTab; icon: string; label: string }[] = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'explore', icon: '📍', label: 'Explore' },
    { id: 'messages', icon: '💬', label: 'Messages' },
    { id: 'payments', icon: '💷', label: 'Payments' },
    { id: 'account', icon: '👤', label: 'Account' },
  ];

  return (
    <motion.div 
      className={`relative ${className}`}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      {/* Phone frame */}
      <div className="relative mx-auto w-[280px] h-[580px] rounded-[40px] border-[8px] border-zinc-800 bg-black shadow-2xl shadow-black/60 overflow-hidden cursor-pointer">
        <div className="w-full h-full overflow-hidden rounded-[32px] flex flex-col bg-[#0a0a0f]">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <span className="text-[10px] text-zinc-400">9:41</span>
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                <div className="w-1 h-2 bg-zinc-400 rounded-sm" />
                <div className="w-1 h-2.5 bg-zinc-400 rounded-sm" />
                <div className="w-1 h-3 bg-zinc-400 rounded-sm" />
                <div className="w-1 h-3.5 bg-white rounded-sm" />
              </div>
              <div className="w-6 h-3 border border-zinc-400 rounded-sm ml-1 relative">
                <div className="absolute inset-0.5 bg-teal-500 rounded-sm" style={{ width: '80%' }} />
              </div>
            </div>
          </div>

          {/* Screen Content */}
          <div className="flex-1 overflow-hidden">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'home' && <HomeTabContent />}
              {activeTab === 'explore' && <ExploreTabContent />}
              {activeTab === 'messages' && <MessagesTabContent />}
              {activeTab === 'payments' && <PaymentsTabContent />}
              {activeTab === 'account' && <AccountTabContent />}
            </motion.div>
          </div>

          {/* Bottom Tab Bar */}
          <div className="bg-zinc-900/95 border-t border-zinc-800 px-2 py-2">
            <div className="flex justify-around items-center">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center transition-all ${
                    activeTab === tab.id ? 'scale-110' : 'opacity-50 hover:opacity-75'
                  }`}
                >
                  <span className="text-[14px]">{tab.icon}</span>
                  <span className={`text-[8px] mt-0.5 ${
                    activeTab === tab.id ? 'text-teal-400' : 'text-zinc-500'
                  }`}>
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Home Indicator */}
          <div className="flex justify-center py-2 bg-zinc-900/95">
            <div className="w-28 h-1 bg-white/30 rounded-full" />
          </div>
        </div>
      </div>
      {/* Glow effect */}
      <div className="absolute inset-0 -z-10 blur-3xl opacity-30 bg-gradient-to-b from-shield-500 to-transparent" />
      
      {/* Instruction hint */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-zinc-500 whitespace-nowrap">
        👆 Click the tabs to explore
      </div>
    </motion.div>
  );
}

// Tab Content Components
function HomeTabContent() {
  return (
    <div className="h-full px-4 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold">My Dashboard</div>
          <div className="text-[11px] text-zinc-500">Good evening, Marcus</div>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-sm font-bold shadow-lg shadow-teal-500/40">
          M
        </div>
      </div>

      {/* Earnings Card */}
      <div className="bg-gradient-to-br from-teal-500/25 to-teal-600/10 border border-teal-500/30 rounded-2xl p-4 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] text-teal-300 uppercase tracking-wider font-medium">Total Earned</div>
            <div className="text-2xl font-bold text-white">£1,840</div>
            <div className="text-[10px] text-teal-400 mt-0.5">+£320 this week</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-teal-400">12</div>
            <div className="text-[9px] text-zinc-400">Shifts</div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-zinc-800/70 rounded-xl p-2 text-center">
          <div className="text-lg font-bold text-amber-400">4.9</div>
          <div className="text-[8px] text-zinc-500">Rating</div>
        </div>
        <div className="bg-zinc-800/70 rounded-xl p-2 text-center">
          <div className="text-lg font-bold text-emerald-400">98%</div>
          <div className="text-[8px] text-zinc-500">Attendance</div>
        </div>
        <div className="bg-zinc-800/70 rounded-xl p-2 text-center">
          <div className="text-lg font-bold text-purple-400">3</div>
          <div className="text-[8px] text-zinc-500">Upcoming</div>
        </div>
      </div>

      {/* Next Shift */}
      <div className="text-[9px] text-zinc-500 mb-1.5 font-semibold uppercase tracking-wider">Next Shift</div>
      <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm font-semibold">The Night Owl</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Tonight · 21:00 - 03:00</div>
            <div className="text-[10px] text-teal-400 mt-1 font-medium">£15/hr · 6hrs · £90</div>
          </div>
          <div className="bg-teal-500 text-[9px] px-2 py-1 rounded-full font-semibold">
            Confirmed
          </div>
        </div>
      </div>
    </div>
  );
}

function ExploreTabContent() {
  return (
    <div className="h-full px-4 text-white flex flex-col">
      <div className="mb-2">
        <div className="text-[9px] text-teal-400 uppercase tracking-wider font-medium">Explore</div>
        <div className="text-lg font-bold">Birmingham</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-800/70 rounded-lg p-0.5 mb-2">
        <div className="flex-1 py-1.5 text-center text-[9px] bg-teal-500/20 text-teal-400 rounded font-semibold">Venues</div>
        <div className="flex-1 py-1.5 text-center text-[9px] text-zinc-500">Personnel</div>
      </div>

      {/* Search */}
      <div className="bg-zinc-800/70 rounded-lg px-2.5 py-2 mb-2 text-[9px] text-zinc-500 flex items-center gap-1.5">
        <span className="text-[10px]">🔍</span>
        Search venues...
      </div>

      {/* Cool Map */}
      <div className="relative h-32 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-xl mb-2 overflow-hidden border border-zinc-700/50">
        {/* Map grid/roads */}
        <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100">
          {/* Main roads */}
          <path d="M 0 50 L 100 50" stroke="#3f3f46" strokeWidth="3" />
          <path d="M 50 0 L 50 100" stroke="#3f3f46" strokeWidth="3" />
          <path d="M 20 0 L 20 100" stroke="#3f3f46" strokeWidth="1" />
          <path d="M 80 0 L 80 100" stroke="#3f3f46" strokeWidth="1" />
          <path d="M 0 25 L 100 25" stroke="#3f3f46" strokeWidth="1" />
          <path d="M 0 75 L 100 75" stroke="#3f3f46" strokeWidth="1" />
          {/* Diagonal road */}
          <path d="M 0 100 L 100 0" stroke="#3f3f46" strokeWidth="2" />
        </svg>
        
        {/* Area labels */}
        <div className="absolute top-2 left-3 text-[7px] text-zinc-500 font-medium">JEWELLERY QTR</div>
        <div className="absolute top-2 right-3 text-[7px] text-zinc-500 font-medium">ASTON</div>
        <div className="absolute bottom-2 left-3 text-[7px] text-zinc-500 font-medium">DIGBETH</div>
        <div className="absolute bottom-2 right-3 text-[7px] text-zinc-500 font-medium">EASTSIDE</div>
        
        {/* Center label */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] text-zinc-400 font-semibold bg-zinc-900/80 px-2 py-0.5 rounded">
          CITY CENTRE
        </div>
        
        {/* Venue markers with labels */}
        <div className="absolute top-6 left-8">
          <div className="relative">
            <div className="w-4 h-4 bg-teal-500 rounded-full shadow-lg shadow-teal-500/50 flex items-center justify-center text-[8px] font-bold">1</div>
            <div className="absolute -inset-1 bg-teal-400 rounded-full animate-ping opacity-30" />
          </div>
        </div>
        
        <div className="absolute top-10 right-8">
          <div className="relative">
            <div className="w-4 h-4 bg-teal-500 rounded-full shadow-lg shadow-teal-500/50 flex items-center justify-center text-[8px] font-bold">2</div>
            <div className="absolute -inset-1 bg-teal-400 rounded-full animate-ping opacity-30" style={{ animationDelay: '0.5s' }} />
          </div>
        </div>
        
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <div className="relative">
            <div className="w-4 h-4 bg-teal-500 rounded-full shadow-lg shadow-teal-500/50 flex items-center justify-center text-[8px] font-bold">3</div>
            <div className="absolute -inset-1 bg-teal-400 rounded-full animate-ping opacity-30" style={{ animationDelay: '1s' }} />
          </div>
        </div>
        
        {/* Current location */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-4">
          <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
          <div className="absolute -inset-2 bg-blue-400/30 rounded-full animate-pulse" />
        </div>
        
        {/* Map hint */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[7px] text-zinc-400 bg-zinc-900/80 px-2 py-0.5 rounded-full">
          Tap venue to view
        </div>
      </div>

      {/* Venues */}
      <div className="text-[8px] text-zinc-500 mb-1 font-semibold uppercase tracking-wider">Nearby Hiring</div>
      <div className="space-y-1.5 flex-1 overflow-hidden">
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-2 flex items-center gap-2">
          <div className="w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center text-[9px] font-bold">1</div>
          <div className="flex-1">
            <div className="text-[10px] font-semibold">The Night Owl</div>
            <div className="text-[8px] text-teal-400">3 requests · 8 guards</div>
          </div>
          <div className="text-zinc-500 text-[10px]">→</div>
        </div>
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-2 flex items-center gap-2">
          <div className="w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center text-[9px] font-bold">2</div>
          <div className="flex-1">
            <div className="text-[10px] font-semibold">PRYZM Birmingham</div>
            <div className="text-[8px] text-teal-400">2 requests · 6 guards</div>
          </div>
          <div className="text-zinc-500 text-[10px]">→</div>
        </div>
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-2 flex items-center gap-2">
          <div className="w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center text-[9px] font-bold">3</div>
          <div className="flex-1">
            <div className="text-[10px] font-semibold">Lab11</div>
            <div className="text-[8px] text-teal-400">1 request · 4 guards</div>
          </div>
          <div className="text-zinc-500 text-[10px]">→</div>
        </div>
      </div>
    </div>
  );
}

function MessagesTabContent() {
  return (
    <div className="h-full px-4 text-white">
      <div className="text-lg font-bold mb-4">Messages</div>
      
      <div className="space-y-3">
        {/* Message thread */}
        <div className="flex items-center gap-3 bg-zinc-800/60 rounded-xl p-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-sm font-bold">
            N
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <div className="text-sm font-semibold">The Night Owl</div>
              <div className="text-[8px] text-zinc-500">2h ago</div>
            </div>
            <div className="text-[10px] text-zinc-400 truncate">Thanks for confirming! See you tonight...</div>
          </div>
          <div className="w-2 h-2 rounded-full bg-teal-500" />
        </div>

        <div className="flex items-center gap-3 bg-zinc-800/40 rounded-xl p-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-sm font-bold">
            P
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <div className="text-sm font-semibold">PRYZM</div>
              <div className="text-[8px] text-zinc-500">1d ago</div>
            </div>
            <div className="text-[10px] text-zinc-400 truncate">Great work last weekend!</div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-zinc-800/40 rounded-xl p-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm font-bold">
            E
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <div className="text-sm font-semibold">Elite Security</div>
              <div className="text-[8px] text-zinc-500">3d ago</div>
            </div>
            <div className="text-[10px] text-zinc-400 truncate">Shift schedule for next week attached</div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <div className="text-[10px] text-zinc-500">3 unread messages</div>
      </div>
    </div>
  );
}

function PaymentsTabContent() {
  return (
    <div className="h-full px-4 text-white">
      <div className="text-lg font-bold mb-1">Payments</div>
      <div className="text-[10px] text-zinc-500 mb-4">Your earnings & payouts</div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-2xl p-4 mb-4">
        <div className="text-[9px] text-emerald-300 uppercase tracking-wider font-medium">Available Balance</div>
        <div className="text-3xl font-bold text-white mt-1">£485.00</div>
        <button className="mt-3 bg-emerald-500 text-white text-[10px] px-4 py-2 rounded-full font-semibold">
          Withdraw to Bank
        </button>
      </div>

      {/* Recent Transactions */}
      <div className="text-[9px] text-zinc-500 mb-2 font-semibold uppercase tracking-wider">Recent</div>
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-zinc-800/60 rounded-xl p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
              <span className="text-sm">💷</span>
            </div>
            <div>
              <div className="text-[11px] font-medium">The Night Owl</div>
              <div className="text-[9px] text-zinc-500">Jan 28</div>
            </div>
          </div>
          <div className="text-sm font-semibold text-emerald-400">+£90</div>
        </div>

        <div className="flex items-center justify-between bg-zinc-800/60 rounded-xl p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
              <span className="text-sm">💷</span>
            </div>
            <div>
              <div className="text-[11px] font-medium">PRYZM</div>
              <div className="text-[9px] text-zinc-500">Jan 26</div>
            </div>
          </div>
          <div className="text-sm font-semibold text-emerald-400">+£120</div>
        </div>

        <div className="flex items-center justify-between bg-zinc-800/60 rounded-xl p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-sm">🏦</span>
            </div>
            <div>
              <div className="text-[11px] font-medium">Bank Withdrawal</div>
              <div className="text-[9px] text-zinc-500">Jan 24</div>
            </div>
          </div>
          <div className="text-sm font-semibold text-zinc-400">-£500</div>
        </div>
      </div>
    </div>
  );
}

function AccountTabContent() {
  return (
    <div className="h-full px-4 text-white">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-teal-500/40">
          M
        </div>
        <div>
          <div className="text-lg font-bold">Marcus Johnson</div>
          <div className="text-[10px] text-zinc-400">Door Supervisor</div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-amber-400 text-[10px]">★</span>
            <span className="text-[10px] text-zinc-300">4.9</span>
            <span className="text-[10px] text-zinc-500">(47 reviews)</span>
          </div>
        </div>
      </div>

      {/* SIA License */}
      <div className="bg-gradient-to-r from-zinc-800/80 to-zinc-800/40 border border-zinc-700/50 rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🪪</span>
            <div>
              <div className="text-[11px] font-medium">SIA License</div>
              <div className="text-[9px] text-zinc-500">Door Supervisor</div>
            </div>
          </div>
          <div className="bg-emerald-500/20 text-emerald-400 text-[9px] px-2 py-1 rounded-full font-medium">
            Verified ✓
          </div>
        </div>
        <div className="text-[9px] text-zinc-400 mt-2">Expires: Dec 2026</div>
      </div>

      {/* Menu Items */}
      <div className="space-y-1">
        {[
          { icon: '📝', label: 'Edit Profile' },
          { icon: '📅', label: 'My Availability' },
          { icon: '📄', label: 'Documents' },
          { icon: '⚙️', label: 'Settings' },
          { icon: '📊', label: 'Analytics' },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between bg-zinc-800/40 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <span className="text-base">{item.icon}</span>
              <span className="text-[11px] font-medium">{item.label}</span>
            </div>
            {item.badge ? (
              <span className="bg-purple-500 text-[8px] px-2 py-0.5 rounded-full">{item.badge}</span>
            ) : (
              <span className="text-zinc-500 text-[12px]">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Interactive Venue Phone with Tab Navigation
type VenuePhoneTab = 'dashboard' | 'bookings' | 'staff' | 'spend' | 'settings';

function VenueInteractivePhone({ className = "" }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<VenuePhoneTab>('dashboard');

  const tabs: { id: VenuePhoneTab; icon: string; label: string }[] = [
    { id: 'dashboard', icon: '📊', label: 'Home' },
    { id: 'bookings', icon: '📅', label: 'Bookings' },
    { id: 'staff', icon: '👥', label: 'Staff' },
    { id: 'spend', icon: '💰', label: 'Spend' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <motion.div
      className={`relative ${className}`}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <div className="relative mx-auto w-[280px] h-[580px] rounded-[40px] border-[8px] border-zinc-800 bg-black shadow-2xl shadow-black/60 overflow-hidden cursor-pointer">
        <div className="w-full h-full overflow-hidden rounded-[32px] flex flex-col bg-[#0a0a0f]">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <span className="text-[10px] text-zinc-400">9:41</span>
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                <div className="w-1 h-2 bg-zinc-400 rounded-sm" />
                <div className="w-1 h-2.5 bg-zinc-400 rounded-sm" />
                <div className="w-1 h-3 bg-zinc-400 rounded-sm" />
                <div className="w-1 h-3.5 bg-white rounded-sm" />
              </div>
              <div className="w-6 h-3 border border-zinc-400 rounded-sm ml-1 relative">
                <div className="absolute inset-0.5 bg-purple-500 rounded-sm" style={{ width: '80%' }} />
              </div>
            </div>
          </div>

          {/* Screen Content */}
          <div className="flex-1 overflow-hidden">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'dashboard' && <VenueDashboardTab />}
              {activeTab === 'bookings' && <VenueBookingsTab />}
              {activeTab === 'staff' && <VenueStaffTab />}
              {activeTab === 'spend' && <VenueSpendTab />}
              {activeTab === 'settings' && <VenueSettingsTab />}
            </motion.div>
          </div>

          {/* Bottom Tab Bar */}
          <div className="bg-zinc-900/95 border-t border-zinc-800 px-2 py-2">
            <div className="flex justify-around items-center">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center transition-all ${
                    activeTab === tab.id ? 'scale-110' : 'opacity-50 hover:opacity-75'
                  }`}
                >
                  <span className="text-[14px]">{tab.icon}</span>
                  <span className={`text-[8px] mt-0.5 ${
                    activeTab === tab.id ? 'text-purple-400' : 'text-zinc-500'
                  }`}>
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center py-2 bg-zinc-900/95">
            <div className="w-28 h-1 bg-white/30 rounded-full" />
          </div>
        </div>
      </div>
      <div className="absolute inset-0 -z-10 blur-3xl opacity-30 bg-gradient-to-b from-purple-500 to-transparent" />
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-zinc-500 whitespace-nowrap">
        👆 Click the tabs to explore
      </div>
    </motion.div>
  );
}

function VenueDashboardTab() {
  return (
    <div className="h-full px-4 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold">Venue Dashboard</div>
          <div className="text-[11px] text-zinc-500">Good evening, The Night Owl</div>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-sm font-bold shadow-lg shadow-purple-500/40">
          N
        </div>
      </div>

      <div className="bg-gradient-to-br from-purple-500/25 to-purple-600/10 border border-purple-500/30 rounded-2xl p-4 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] text-purple-300 uppercase tracking-wider font-medium">Security Spend</div>
            <div className="text-2xl font-bold text-white">£4,280</div>
            <div className="text-[10px] text-purple-400 mt-0.5">This month · 6 events</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-purple-400">8</div>
            <div className="text-[9px] text-zinc-400">Guards</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-zinc-800/70 rounded-xl p-2 text-center">
          <div className="text-lg font-bold text-emerald-400">3</div>
          <div className="text-[8px] text-zinc-500">Upcoming</div>
        </div>
        <div className="bg-zinc-800/70 rounded-xl p-2 text-center">
          <div className="text-lg font-bold text-amber-400">1</div>
          <div className="text-[8px] text-zinc-500">Pending</div>
        </div>
        <div className="bg-zinc-800/70 rounded-xl p-2 text-center">
          <div className="text-lg font-bold text-blue-400">12</div>
          <div className="text-[8px] text-zinc-500">Completed</div>
        </div>
      </div>

      <div className="text-[9px] text-zinc-500 mb-1.5 font-semibold uppercase tracking-wider">Tonight&apos;s Shift</div>
      <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3 mb-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm font-semibold">Friday Night Security</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">21:00 – 03:00 · 4 guards</div>
            <div className="text-[10px] text-purple-400 mt-1 font-medium">£18/hr · £432 total</div>
          </div>
          <div className="bg-emerald-500 text-[9px] px-2 py-1 rounded-full font-semibold">
            Confirmed
          </div>
        </div>
      </div>

      <div className="text-[9px] text-zinc-500 mb-1.5 font-semibold uppercase tracking-wider">Quick Actions</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-purple-500/15 border border-purple-500/30 rounded-xl p-2.5 text-center">
          <span className="text-base">🛡️</span>
          <div className="text-[9px] font-medium text-purple-300 mt-1">Book Security</div>
        </div>
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-2.5 text-center">
          <span className="text-base">📋</span>
          <div className="text-[9px] font-medium text-zinc-400 mt-1">Post Request</div>
        </div>
      </div>
    </div>
  );
}

function VenueBookingsTab() {
  return (
    <div className="h-full px-4 text-white">
      <div className="text-lg font-bold mb-1">Bookings</div>
      <div className="text-[10px] text-zinc-500 mb-4">Manage your security events</div>

      <div className="flex gap-1 bg-zinc-800/70 rounded-lg p-0.5 mb-3">
        <div className="flex-1 py-1.5 text-center text-[9px] bg-purple-500/20 text-purple-400 rounded font-semibold">Upcoming</div>
        <div className="flex-1 py-1.5 text-center text-[9px] text-zinc-500">Past</div>
        <div className="flex-1 py-1.5 text-center text-[9px] text-zinc-500">Drafts</div>
      </div>

      <div className="space-y-2">
        {[
          { name: "Saturday Main Event", date: "Sat 5 Apr", time: "20:00–04:00", guards: 6, status: "Confirmed", statusColor: "bg-emerald-500" },
          { name: "Friday Night", date: "Fri 11 Apr", time: "21:00–03:00", guards: 4, status: "Pending", statusColor: "bg-amber-500" },
          { name: "Private Function", date: "Sat 12 Apr", time: "19:00–01:00", guards: 3, status: "Confirmed", statusColor: "bg-emerald-500" },
          { name: "Bank Holiday Special", date: "Mon 21 Apr", time: "20:00–04:00", guards: 8, status: "Draft", statusColor: "bg-zinc-500" },
        ].map((b) => (
          <div key={b.name} className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11px] font-semibold">{b.name}</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">{b.date} · {b.time}</div>
                <div className="text-[9px] text-purple-400 mt-1">{b.guards} guards</div>
              </div>
              <div className={`${b.statusColor} text-[8px] px-2 py-0.5 rounded-full font-semibold text-white`}>
                {b.status}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <button className="w-full bg-purple-500 text-white text-[10px] py-2.5 rounded-xl font-semibold">
          + Book Security
        </button>
      </div>
    </div>
  );
}

function VenueStaffTab() {
  return (
    <div className="h-full px-4 text-white">
      <div className="text-lg font-bold mb-1">Staff</div>
      <div className="text-[10px] text-zinc-500 mb-4">Your security team</div>

      <div className="bg-zinc-800/70 rounded-lg px-2.5 py-2 mb-3 text-[9px] text-zinc-500 flex items-center gap-1.5">
        <span className="text-[10px]">🔍</span>
        Search staff...
      </div>

      <div className="text-[8px] text-zinc-500 mb-1.5 font-semibold uppercase tracking-wider">On Duty Tonight</div>
      <div className="space-y-2 mb-3">
        {[
          { name: "Marcus Johnson", role: "Door Supervisor", rating: "4.9", checked: true },
          { name: "Sarah Williams", role: "Door Supervisor", rating: "4.8", checked: true },
          { name: "James Carter", role: "Close Protection", rating: "5.0", checked: false },
        ].map((s) => (
          <div key={s.name} className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-2.5 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-[11px] font-bold shadow-lg shadow-teal-500/30">
              {s.name[0]}
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-semibold">{s.name}</div>
              <div className="text-[8px] text-zinc-500">{s.role}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-amber-400">★ {s.rating}</div>
              <div className={`text-[7px] mt-0.5 ${s.checked ? "text-emerald-400" : "text-zinc-500"}`}>
                {s.checked ? "Checked in" : "Expected"}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-[8px] text-zinc-500 mb-1.5 font-semibold uppercase tracking-wider">Preferred Staff</div>
      <div className="space-y-2">
        {[
          { name: "David Brown", role: "Door Supervisor", shifts: 24 },
          { name: "Emma Davis", role: "Event Security", shifts: 18 },
        ].map((s) => (
          <div key={s.name} className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-2.5 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-[11px] font-bold">
              {s.name[0]}
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-semibold">{s.name}</div>
              <div className="text-[8px] text-zinc-500">{s.role} · {s.shifts} shifts</div>
            </div>
            <div className="text-zinc-500 text-[10px]">→</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VenueSpendTab() {
  return (
    <div className="h-full px-4 text-white">
      <div className="text-lg font-bold mb-1">Spend</div>
      <div className="text-[10px] text-zinc-500 mb-4">Track your security costs</div>

      <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-2xl p-4 mb-3">
        <div className="text-[9px] text-purple-300 uppercase tracking-wider font-medium">This Month</div>
        <div className="text-3xl font-bold text-white mt-1">£4,280</div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: '54%' }} />
          </div>
          <span className="text-[9px] text-purple-400">54% of budget</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-zinc-800/70 rounded-xl p-3 text-center">
          <div className="text-sm font-bold text-emerald-400">£3,020</div>
          <div className="text-[8px] text-zinc-500">Paid</div>
        </div>
        <div className="bg-zinc-800/70 rounded-xl p-3 text-center">
          <div className="text-sm font-bold text-amber-400">£1,260</div>
          <div className="text-[8px] text-zinc-500">Pending</div>
        </div>
      </div>

      <div className="text-[8px] text-zinc-500 mb-1.5 font-semibold uppercase tracking-wider">Export</div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 text-center">
          <span className="text-base">📄</span>
          <div className="text-[8px] font-medium text-red-400 mt-1">PDF Report</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center">
          <span className="text-base">📊</span>
          <div className="text-[8px] font-medium text-emerald-400 mt-1">CSV Export</div>
        </div>
      </div>

      <div className="text-[8px] text-zinc-500 mb-1.5 font-semibold uppercase tracking-wider">Recent Invoices</div>
      <div className="space-y-1.5">
        {[
          { name: "Saturday Event", amount: "£1,440", date: "29 Mar" },
          { name: "Friday Night", amount: "£810", date: "28 Mar" },
          { name: "Private Function", amount: "£360", date: "25 Mar" },
        ].map((inv) => (
          <div key={inv.name} className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-2.5">
            <div>
              <div className="text-[10px] font-medium">{inv.name}</div>
              <div className="text-[8px] text-zinc-500">{inv.date}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold">{inv.amount}</span>
              <span className="text-[10px] text-purple-400">↓</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VenueSettingsTab() {
  return (
    <div className="h-full px-4 text-white">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-purple-500/40">
          N
        </div>
        <div>
          <div className="text-lg font-bold">The Night Owl</div>
          <div className="text-[10px] text-zinc-400">Nightclub · Birmingham</div>
          <div className="flex items-center gap-1 mt-1">
            <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full font-medium">Verified ✓</span>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-zinc-800/80 to-zinc-800/40 border border-zinc-700/50 rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <div>
              <div className="text-[11px] font-medium">Location</div>
              <div className="text-[9px] text-zinc-500">Broad St, Birmingham B1</div>
            </div>
          </div>
          <span className="text-zinc-500 text-[12px]">→</span>
        </div>
      </div>

      <div className="space-y-1">
        {[
          { icon: '📝', label: 'Venue Details' },
          { icon: '💳', label: 'Payment Methods' },
          { icon: '🔔', label: 'Notifications' },
          { icon: '👥', label: 'Team Members' },
          { icon: '📄', label: 'Invoices & Reports' },
          { icon: '⚙️', label: 'Account Settings' },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between bg-zinc-800/40 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <span className="text-base">{item.icon}</span>
              <span className="text-[11px] font-medium">{item.label}</span>
            </div>
            <span className="text-zinc-500 text-[12px]">→</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Laptop Mockup Component
function LaptopMockup({ 
  children,
  className = ""
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div 
      className={`relative ${className}`}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      {/* Laptop screen */}
      <div className="relative mx-auto max-w-[700px]">
        <div className="relative rounded-t-xl border-[8px] border-zinc-800 bg-zinc-900 overflow-hidden">
          {/* Camera dot */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-zinc-700" />
          {/* Screen */}
          <div className="aspect-[16/10] overflow-hidden pt-4">
            {children}
          </div>
        </div>
        {/* Laptop base */}
        <div className="relative h-4 bg-gradient-to-b from-zinc-700 to-zinc-800 rounded-b-lg">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-1 bg-zinc-600 rounded-b" />
        </div>
      </div>
      {/* Glow effect */}
      <div className="absolute inset-0 -z-10 blur-3xl opacity-20 bg-gradient-to-b from-shield-500 to-transparent" />
    </motion.div>
  );
}

// App Screen Components (simulated UI)
function VenueDashboardScreen() {
  return (
    <div className="w-full h-full bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xl font-semibold text-gradient-teal">Shield HQ</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-400">The Night Owl</span>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-sm font-semibold">N</div>
          </div>
        </div>
      </div>
      
      {/* Dashboard Content */}
      <div className="p-6">
        <div className="text-lg font-semibold mb-1">Venue Dashboard</div>
        <div className="text-xs text-zinc-500 mb-6">Welcome back! Here&apos;s your security overview.</div>
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <div className="text-3xl font-bold text-teal-400">3</div>
            <div className="text-xs text-zinc-500 mt-1">Open Requests</div>
          </div>
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <div className="text-3xl font-bold text-white">12</div>
            <div className="text-xs text-zinc-500 mt-1">Shifts This Week</div>
          </div>
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <div className="text-3xl font-bold text-emerald-400">£2,400</div>
            <div className="text-xs text-zinc-500 mt-1">Spent (MTD)</div>
          </div>
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <div className="text-3xl font-bold text-amber-400">4.9</div>
            <div className="text-xs text-zinc-500 mt-1">Avg Staff Rating</div>
          </div>
        </div>
        
        {/* Calendar Preview */}
        <div className="bg-zinc-800/30 rounded-xl p-4">
          <div className="text-sm font-medium mb-3">Upcoming Shifts</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 text-xs font-semibold">FRI</div>
                <div>
                  <div className="text-sm font-medium">Friday Night Security</div>
                  <div className="text-xs text-zinc-500">21:00 - 03:00 · 4 guards</div>
                </div>
              </div>
              <div className="text-xs text-teal-400 bg-teal-500/10 px-2 py-1 rounded">Confirmed</div>
            </div>
            <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-semibold">SAT</div>
                <div>
                  <div className="text-sm font-medium">Saturday Event</div>
                  <div className="text-xs text-zinc-500">20:00 - 04:00 · 6 guards</div>
                </div>
              </div>
              <div className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">2 pending</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeRole, setActiveRole] = useState<'venue' | 'personnel'>('venue');
  
  useEffect(() => {
    trackPageView("home");
  }, []);

  const handleSignupClick = (role: string) => {
    trackEvent("signup_cta_click", { role, location: "hero" });
  };

  return (
    <div className="min-h-screen overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0" />
        <FloatingOrb size={400} color="teal" className="absolute -left-32 top-20" delay={0} />
        <FloatingOrb size={300} color="cyan" className="absolute right-10 top-40" delay={2} />
        <FloatingOrb size={250} color="teal" className="absolute bottom-20 left-1/3" delay={4} />
        <div className="grid-pattern absolute inset-0 opacity-50" />
        <div className="noise absolute inset-0" />
      </div>

      {/* Hero Section with Phone Mockup */}
      <section className="relative border-b border-white/[0.06] pt-24 pb-16 sm:pt-32 sm:pb-24 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div className="text-center lg:text-left">
              <FadeIn direction="down" delay={0.1}>
                <span className="mb-6 inline-block rounded-full glass px-4 py-1.5 text-xs font-medium text-shield-400">
                  🛡️ The Security Workforce Platform
                </span>
              </FadeIn>

              <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                <AnimatedText text="Security Staffing" delay={0.2} />
                <br />
                <span className="text-gradient-teal">
                  <AnimatedText text="Made Simple" delay={0.4} />
                </span>
              </h1>

              <FadeIn direction="up" delay={0.6}>
                <p className="mt-6 text-lg leading-relaxed text-zinc-400">
                  Whether you&apos;re a <span className="text-white font-medium">venue</span> needing last-minute cover or
                  <span className="text-white font-medium"> security personnel</span> looking for work — 
                  Shield HQ connects you instantly.
                </p>
              </FadeIn>

              <FadeIn direction="up" delay={0.8}>
                <div className="mt-8 flex flex-col items-center lg:items-start gap-3 sm:flex-row sm:gap-4">
                  <Link href="/signup/venue" onClick={() => handleSignupClick("venue")}>
                    <PulseButton variant="primary" className="w-full sm:w-auto">
                      I need security staff →
                    </PulseButton>
                  </Link>
                  <Link href="/signup/personnel" onClick={() => handleSignupClick("personnel")}>
                    <PulseButton variant="secondary" className="w-full sm:w-auto">
                      I&apos;m SIA licensed →
                    </PulseButton>
                  </Link>
                </div>
                <p className="mt-4 text-sm text-zinc-500">
                  Free for venues • No contracts • Guards pay just 10%
                </p>
              </FadeIn>
            </div>

            {/* Right: Interactive Phone with decorative second phone */}
            <div className="relative hidden lg:block">
              <InteractivePhone className="transform rotate-2 hover:rotate-0 transition-transform duration-500" />
              
              {/* Second decorative phone (offset) */}
              <motion.div 
                className="absolute -left-24 top-24 -z-10"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
              >
                <div className="relative w-[200px] h-[420px] rounded-[32px] border-[6px] border-zinc-800 bg-black shadow-xl overflow-hidden transform -rotate-12 opacity-70">
                  {/* Static Explore Screen with Cool Map */}
                  <div className="w-full h-full bg-[#0a0a0f] text-white p-3 overflow-hidden flex flex-col">
                    <div className="text-[7px] text-teal-400 uppercase tracking-wider">Explore</div>
                    <div className="text-xs font-bold mb-1.5">Birmingham</div>
                    
                    {/* Mini tabs */}
                    <div className="flex gap-0.5 bg-zinc-800/70 rounded p-0.5 mb-1.5">
                      <div className="flex-1 py-0.5 text-center text-[6px] bg-teal-500/20 text-teal-400 rounded">Venues</div>
                      <div className="flex-1 py-0.5 text-center text-[6px] text-zinc-500">Personnel</div>
                    </div>
                    
                    {/* Cool Mini Map */}
                    <div className="relative h-28 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-lg mb-1.5 overflow-hidden border border-zinc-700/50">
                      {/* Map grid/roads */}
                      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100">
                        <path d="M 0 50 L 100 50" stroke="#3f3f46" strokeWidth="3" />
                        <path d="M 50 0 L 50 100" stroke="#3f3f46" strokeWidth="3" />
                        <path d="M 25 0 L 25 100" stroke="#3f3f46" strokeWidth="1" />
                        <path d="M 75 0 L 75 100" stroke="#3f3f46" strokeWidth="1" />
                        <path d="M 0 25 L 100 25" stroke="#3f3f46" strokeWidth="1" />
                        <path d="M 0 75 L 100 75" stroke="#3f3f46" strokeWidth="1" />
                        <path d="M 0 100 L 100 0" stroke="#3f3f46" strokeWidth="2" />
                      </svg>
                      
                      {/* Area labels */}
                      <div className="absolute top-1 left-2 text-[5px] text-zinc-500">JEWELLERY QTR</div>
                      <div className="absolute bottom-1 right-2 text-[5px] text-zinc-500">DIGBETH</div>
                      
                      {/* Center label */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[6px] text-zinc-400 font-semibold bg-zinc-900/80 px-1.5 py-0.5 rounded">
                        CITY CENTRE
                      </div>
                      
                      {/* Venue markers */}
                      <div className="absolute top-4 left-5">
                        <div className="w-3 h-3 bg-teal-500 rounded-full shadow-lg shadow-teal-500/50 flex items-center justify-center text-[6px] font-bold">1</div>
                        <div className="absolute -inset-0.5 bg-teal-400 rounded-full animate-ping opacity-30" />
                      </div>
                      <div className="absolute top-6 right-5">
                        <div className="w-3 h-3 bg-teal-500 rounded-full shadow-lg shadow-teal-500/50 flex items-center justify-center text-[6px] font-bold">2</div>
                        <div className="absolute -inset-0.5 bg-teal-400 rounded-full animate-ping opacity-30" style={{ animationDelay: '0.5s' }} />
                      </div>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                        <div className="w-3 h-3 bg-teal-500 rounded-full shadow-lg shadow-teal-500/50 flex items-center justify-center text-[6px] font-bold">3</div>
                        <div className="absolute -inset-0.5 bg-teal-400 rounded-full animate-ping opacity-30" style={{ animationDelay: '1s' }} />
                      </div>
                      
                      {/* Current location */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full border border-white shadow-lg" />
                        <div className="absolute -inset-1 bg-blue-400/30 rounded-full animate-pulse" />
                      </div>
                    </div>
                    
                    {/* Mini venue cards */}
                    <div className="space-y-1 flex-1">
                      <div className="bg-zinc-800/60 rounded p-1.5 flex items-center gap-1.5">
                        <div className="w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center text-[7px] font-bold">1</div>
                        <div className="flex-1">
                          <div className="text-[8px] font-semibold">The Night Owl</div>
                          <div className="text-[6px] text-teal-400">3 requests</div>
                        </div>
                      </div>
                      <div className="bg-zinc-800/60 rounded p-1.5 flex items-center gap-1.5">
                        <div className="w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center text-[7px] font-bold">2</div>
                        <div className="flex-1">
                          <div className="text-[8px] font-semibold">PRYZM</div>
                          <div className="text-[6px] text-teal-400">2 requests</div>
                        </div>
                      </div>
                      <div className="bg-zinc-800/60 rounded p-1.5 flex items-center gap-1.5">
                        <div className="w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center text-[7px] font-bold">3</div>
                        <div className="flex-1">
                          <div className="text-[8px] font-semibold">Lab11</div>
                          <div className="text-[6px] text-teal-400">1 request</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Glow effect */}
                <div className="absolute inset-0 -z-10 blur-2xl opacity-20 bg-gradient-to-b from-shield-500 to-transparent" />
              </motion.div>
            </div>
          </div>

          {/* Stats - More visual */}
          <FadeIn direction="up" delay={1}>
            <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { value: "100%", label: "SIA Verified", icon: "✓" },
                { value: "< 5min", label: "To Post a Shift", icon: "⚡" },
                { value: "10%", label: "Guard Fee Only", icon: "💰" },
                { value: "24/7", label: "Live Support", icon: "🛡️" },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="glass glass-hover rounded-2xl p-5 text-center"
                >
                  <div className="text-2xl mb-2">{stat.icon}</div>
                  <div className="text-2xl font-bold text-shield-400">{stat.value}</div>
                  <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Interactive Role Showcase */}
      <section className="relative border-b border-white/[0.06] py-20 sm:py-28 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <FadeIn>
            <h2 className="font-display text-center text-3xl font-semibold sm:text-4xl">
              Built for <span className="text-gradient-teal">everyone</span> in security
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-400">
              One platform, two powerful experiences. See how Shield HQ works for each role.
            </p>
          </FadeIn>

          {/* Role Selector Tabs */}
          <div className="mt-12 flex justify-center">
            <div className="inline-flex gap-2 p-1.5 glass rounded-full">
              {[
                { id: 'venue', label: 'Venues', icon: '🏢' },
                { id: 'personnel', label: 'Security', icon: '🛡️' },
              ].map((role) => (
                <button
                  key={role.id}
                  onClick={() => setActiveRole(role.id as any)}
                  className={`px-6 py-3 rounded-full text-sm font-medium transition-all ${
                    activeRole === role.id
                      ? 'bg-gradient-to-r from-shield-500 to-shield-600 text-white shadow-lg shadow-shield-500/30'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="mr-2">{role.icon}</span>
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Grid */}
          <div className="mt-12 grid lg:grid-cols-2 gap-8 items-center">
            {/* Description Card */}
            <motion.div
              key={activeRole}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <GlowCard className="p-8 sm:p-10">
                {activeRole === 'venue' && (
                  <>
                    <span className="inline-block rounded-full bg-shield-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-shield-400">
                      For Venues
                    </span>
                    <h3 className="mt-4 font-display text-2xl font-semibold text-white">
                      Find security staff in minutes
                    </h3>
                    <p className="mt-4 text-zinc-400 leading-relaxed">
                      Post your requirements, see available SIA-licensed professionals, and book instantly. 
                      No more phone calls or waiting — fill shifts same-day.
                    </p>
                    <ul className="mt-6 space-y-3 text-sm text-zinc-400">
                      {[
                        "Post shifts with date, time, and requirements",
                        "See real-time availability of verified staff",
                        "Book instantly or review applications",
                        "Manage all security from one dashboard",
                        "Export spend reports & download invoices",
                        "Track live check-ins and shift progress",
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-shield-500/20 text-shield-400 text-xs">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Link href="/signup/venue" className="mt-8 inline-flex items-center gap-2 text-shield-400 hover:text-shield-300 font-medium">
                      Get started as a venue
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </>
                )}
                {activeRole === 'personnel' && (
                  <>
                    <span className="inline-block rounded-full bg-shield-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-shield-400">
                      For Security Personnel
                    </span>
                    <h3 className="mt-4 font-display text-2xl font-semibold text-white">
                      Get more shifts, earn more
                    </h3>
                    <p className="mt-4 text-zinc-400 leading-relaxed">
                      Set your availability, see open shifts near you, and accept work instantly.
                      Build your reputation and get booked by top venues.
                    </p>
                    <ul className="mt-6 space-y-3 text-sm text-zinc-400">
                      {[
                        "Browse open shifts on a map or calendar",
                        "Accept jobs with one tap — Uber-style",
                        "Track earnings and manage your schedule",
                        "Get notified of urgent, premium shifts",
                        "Build your reputation with reviews and ratings",
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-shield-500/20 text-shield-400 text-xs">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Link href="/signup/personnel" className="mt-8 inline-flex items-center gap-2 text-shield-400 hover:text-shield-300 font-medium">
                      Join as security
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </>
                )}
              </GlowCard>
            </motion.div>

            {/* Interactive Phone — different for each role */}
            <motion.div
              key={`device-${activeRole}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex justify-center"
            >
              {activeRole === 'venue' ? <VenueInteractivePhone /> : <InteractivePhone />}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Web Dashboard Showcase */}
      <section className="relative border-b border-white/[0.06] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <FadeIn>
            <h2 className="font-display text-center text-3xl font-semibold sm:text-4xl">
              Powerful <span className="text-gradient-teal">web dashboard</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-400">
              Full control from your desktop. Manage everything from shifts to payments.
            </p>
          </FadeIn>

          <div className="mt-12">
            <LaptopMockup>
              <VenueDashboardScreen />
            </LaptopMockup>
          </div>

          {/* Feature Pills */}
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {[
              "Real-time Updates",
              "Instant Booking",
              "Smart Scheduling",
              "Analytics Dashboard",
              "Live Check-In",
              "Secure Payments",
              "Export Reports",
              "Download Invoices",
            ].map((feature, i) => (
              <span
                key={i}
                className="glass glass-hover px-4 py-2 rounded-full text-sm text-zinc-300"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Reporting & Exports Section */}
      <section className="relative border-b border-white/[0.06] py-20 sm:py-28 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Description */}
            <FadeIn direction="left">
              <span className="inline-block rounded-full bg-purple-500/15 px-4 py-1.5 text-xs font-medium text-purple-400 mb-4">
                📊 Reporting & Invoices
              </span>
              <h2 className="font-display text-3xl font-semibold sm:text-4xl">
                Full financial <span className="text-gradient-teal">visibility</span>
              </h2>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Track every pound spent on security. Export detailed spend reports, download invoices 
                for any event or time period, and keep your accounts in perfect order — all from your dashboard.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  {
                    icon: "📄",
                    title: "PDF Spend Reports",
                    desc: "Export branded reports by week, month, quarter, or year with full cost breakdowns",
                  },
                  {
                    icon: "🧾",
                    title: "Event Invoices",
                    desc: "Download individual invoices per event, or bulk download all invoices for a period",
                  },
                  {
                    icon: "📊",
                    title: "CSV Exports",
                    desc: "Export raw data to Excel or Google Sheets for your own analysis and accounting",
                  },
                  {
                    icon: "💰",
                    title: "Budget Tracking",
                    desc: "Set monthly budgets and get alerts when you're approaching your limit",
                  },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-lg">
                      {item.icon}
                    </span>
                    <div>
                      <h4 className="font-medium text-white">{item.title}</h4>
                      <p className="text-sm text-zinc-400 mt-0.5">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <Link href="/signup/venue" className="mt-8 inline-flex items-center gap-2 text-shield-400 hover:text-shield-300 font-medium transition">
                Start tracking spend
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </FadeIn>

            {/* Right: Visual mockup of export feature */}
            <FadeIn direction="right">
              <div className="relative">
                {/* Dashboard card mockup */}
                <div className="glass rounded-2xl overflow-hidden border border-white/10">
                  {/* Header */}
                  <div className="bg-zinc-900/80 px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">Spend Dashboard</div>
                      <div className="text-xs text-zinc-500">This Month</div>
                    </div>
                    <div className="flex gap-1.5">
                      {["Week", "Month", "Quarter", "Year"].map((t, i) => (
                        <span key={t} className={`text-[10px] px-2.5 py-1 rounded-md ${i === 1 ? "bg-purple-500 text-white" : "bg-white/5 text-zinc-500"}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-px bg-white/5">
                    {[
                      { label: "Total Spend", value: "£8,420", color: "text-white" },
                      { label: "Avg / Event", value: "£702", color: "text-blue-400" },
                      { label: "Pending", value: "£1,260", color: "text-amber-400" },
                      { label: "Paid", value: "£7,160", color: "text-emerald-400" },
                    ].map((s) => (
                      <div key={s.label} className="bg-zinc-900/60 p-4 text-center">
                        <div className="text-[10px] text-zinc-500">{s.label}</div>
                        <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Events list */}
                  <div className="px-5 py-3 border-t border-white/5">
                    <div className="text-xs font-medium text-zinc-400 mb-3">Recent Events</div>
                    {[
                      { name: "Saturday Main Event", date: "29 Mar", guards: 4, cost: "£1,440", status: "Paid" },
                      { name: "Friday Night Security", date: "28 Mar", guards: 3, cost: "£810", status: "Paid" },
                      { name: "Private Function", date: "25 Mar", guards: 2, cost: "£360", status: "Pending" },
                    ].map((ev) => (
                      <div key={ev.name} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-[10px] font-bold text-purple-400">
                            {ev.date.split(" ")[0]}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-white">{ev.name}</div>
                            <div className="text-[10px] text-zinc-500">{ev.date} · {ev.guards} guards</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full ${ev.status === "Paid" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                            {ev.status}
                          </span>
                          <span className="text-xs font-semibold text-white">{ev.cost}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Export bar */}
                  <div className="bg-zinc-900/80 px-5 py-3 border-t border-white/10 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-purple-500/15 text-purple-400 px-3 py-1.5 rounded-lg text-[10px] font-medium">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export Report
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 text-zinc-400 px-3 py-1.5 rounded-lg text-[10px] font-medium">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download Invoices
                    </div>
                  </div>
                </div>

                {/* Decorative floating invoice card */}
                <motion.div
                  className="absolute -right-4 -bottom-4 w-48 glass rounded-xl p-3 border border-white/10 shadow-xl"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded bg-red-500/15 flex items-center justify-center">
                      <svg className="h-3 w-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-[10px] font-semibold text-white">Invoice_March.pdf</span>
                  </div>
                  <div className="h-1 bg-emerald-500 rounded-full" />
                  <div className="text-[9px] text-emerald-400 mt-1">Downloaded</div>
                </motion.div>

                {/* Decorative floating CSV card */}
                <motion.div
                  className="absolute -left-4 top-8 w-40 glass rounded-xl p-3 border border-white/10 shadow-xl"
                  initial={{ opacity: 0, y: -20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded bg-emerald-500/15 flex items-center justify-center">
                      <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="text-[10px] font-semibold text-white">Spend_Q1.csv</span>
                  </div>
                  <div className="h-1 bg-emerald-500 rounded-full w-3/4" />
                  <div className="text-[9px] text-zinc-500 mt-1">Ready for Excel</div>
                </motion.div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="relative border-b border-white/[0.06] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <h2 className="font-display text-center text-3xl font-semibold text-white sm:text-4xl">
              Get started in <span className="text-gradient-teal">3 steps</span>
            </h2>
          </FadeIn>

          <StaggerContainer className="mt-16 grid gap-8 sm:grid-cols-3" staggerDelay={0.2}>
            {[
              { step: 1, title: "Sign up & verify", desc: "Create your account. Security personnel verify SIA license. Venues add your location." },
              { step: 2, title: "Post or browse", desc: "Venues post shifts. Personnel set availability and browse opportunities." },
              { step: 3, title: "Match & book", desc: "Connect instantly. Accept shifts or hire staff with one click." },
            ].map((item) => (
              <StaggerItem key={item.step}>
                <div className="glass glass-hover rounded-2xl p-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-shield-500 to-shield-600 text-2xl font-bold text-white shadow-lg shadow-shield-500/30">
                    {item.step}
                  </div>
                  <h3 className="mt-6 font-display text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm text-zinc-400">{item.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Why Shield HQ Beats the Old Way */}
      <section className="relative border-b border-white/[0.06] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <h2 className="font-display text-center text-3xl font-semibold sm:text-4xl">
              The old way is <span className="text-red-400 line-through opacity-60">broken</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-400">
              Stop calling around for last-minute cover. Stop waiting weeks to get paid. Shield HQ fixes everything.
            </p>
          </FadeIn>

          <div className="mt-14 grid md:grid-cols-2 gap-6">
            <FadeIn direction="left">
              <div className="glass rounded-2xl p-8 border border-red-500/10">
                <h3 className="text-lg font-semibold text-red-400 mb-6 flex items-center gap-2">
                  <span className="text-xl">😤</span> Without Shield HQ
                </h3>
                <ul className="space-y-4">
                  {[
                    "Calling 10 people to fill one shift",
                    "No idea if staff are actually SIA licensed",
                    "Paying agency markups of 30-40%",
                    "Waiting weeks for invoices and payments",
                    "Scrambling when someone calls in sick",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                      <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>

            <FadeIn direction="right">
              <div className="glass rounded-2xl p-8 border border-shield-500/20">
                <h3 className="text-lg font-semibold text-shield-400 mb-6 flex items-center gap-2">
                  <span className="text-xl">🛡️</span> With Shield HQ
                </h3>
                <ul className="space-y-4">
                  {[
                    "Post a shift and get matched in minutes",
                    "Every professional is SIA verified on signup",
                    "Venues pay nothing — guards pay a small 10% fee",
                    "Export reports & invoices — full financial visibility",
                    "Instant notifications to available staff nearby",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                      <span className="text-shield-400 mt-0.5 flex-shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Trusted & Verified */}
      <section className="relative border-b border-white/[0.06] py-20 sm:py-28 overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <h2 className="font-display text-center text-3xl font-semibold sm:text-4xl">
              Trusted, verified, <span className="text-gradient-teal">professional</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-400">
              Every security professional on Shield HQ goes through our verification process. Venues get peace of mind, and guards build real credibility.
            </p>
          </FadeIn>

          <StaggerContainer className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.1}>
            {[
              { icon: "🪪", title: "SIA License Check", desc: "Every guard uploads and verifies their SIA licence before they can accept shifts" },
              { icon: "⭐", title: "Ratings & Reviews", desc: "Venues rate guards after every shift, building transparent reputations" },
              { icon: "📍", title: "Live Check-In", desc: "GPS-verified clock-in and clock-out so venues always know who's on site" },
              { icon: "💳", title: "Payments & Invoices", desc: "Secure Stripe payments with exportable invoices, spend reports, and full transaction history" },
            ].map((feature, i) => (
              <StaggerItem key={i}>
                <div className="glass glass-hover rounded-2xl p-6 h-full">
                  <div className="text-3xl mb-4">{feature.icon}</div>
                  <h3 className="font-display text-base font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-zinc-400">{feature.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Built for Birmingham */}
      <section className="relative border-b border-white/[0.06] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeIn direction="left">
              <span className="inline-block rounded-full bg-shield-500/15 px-4 py-1.5 text-xs font-medium text-shield-400 mb-4">
                🇬🇧 Launching in Birmingham
              </span>
              <h2 className="font-display text-3xl font-semibold sm:text-4xl">
                Built for the UK&apos;s <span className="text-gradient-teal">nightlife capital</span>
              </h2>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Birmingham has one of the UK&apos;s busiest nightlife scenes — and some of the biggest 
                challenges finding reliable, verified door staff. Shield HQ was built here, for here, and 
                is expanding fast.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-zinc-400">
                {[
                  "Nightclubs, bars, pubs, and event venues",
                  "Festivals, concerts, and private events",
                  "Corporate events and conferences",
                  "Retail and commercial properties",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-shield-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-8 inline-flex items-center gap-2 text-shield-400 hover:text-shield-300 font-medium transition">
                Join the platform
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </FadeIn>

            <FadeIn direction="right">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { number: "500+", label: "SIA Licensed Guards", color: "text-shield-400" },
                  { number: "50+", label: "Venue Partners", color: "text-purple-400" },
                  { number: "2,000+", label: "Shifts Filled", color: "text-amber-400" },
                  { number: "4.8★", label: "Average Rating", color: "text-emerald-400" },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="glass glass-hover rounded-2xl p-6 text-center"
                  >
                    <div className={`text-3xl font-bold ${stat.color}`}>{stat.number}</div>
                    <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 sm:py-28">
        <FloatingOrb size={350} color="teal" className="absolute right-0 top-0 -translate-y-1/2 opacity-50" delay={1} />

        <FadeIn>
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <div className="glass-strong rounded-3xl p-10 sm:p-14">
              <h2 className="font-display text-3xl font-semibold sm:text-4xl">
                Ready to <span className="text-gradient-teal">get started</span>?
              </h2>
              <p className="mt-4 text-zinc-400">
                Join thousands of venues and security professionals on Shield HQ.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <PulseButton variant="primary" className="text-base w-full sm:w-auto">
                    Create free account
                  </PulseButton>
                </Link>
                <Link href="/how-it-works">
                  <button className="w-full sm:w-auto px-6 py-3 rounded-xl glass text-sm font-medium text-zinc-300 hover:text-white transition">
                    Learn more
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/[0.06] py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-8">
            <div className="col-span-2 sm:col-span-1">
              <motion.span className="font-display text-2xl font-semibold text-gradient-teal">
                Shield HQ
              </motion.span>
              <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
                The modern security workforce platform. Connecting venues with verified security professionals across the UK.
              </p>

              <div className="mt-4 flex gap-3">
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-white text-sm mb-3">Platform</h4>
              <div className="space-y-2 text-sm text-zinc-500">
                <Link href="/signup/venue" className="block hover:text-zinc-300 transition">For Venues</Link>
                <Link href="/signup/personnel" className="block hover:text-zinc-300 transition">For Security</Link>
                <Link href="/how-it-works" className="block hover:text-zinc-300 transition">How it Works</Link>
                <Link href="/why-shield" className="block hover:text-zinc-300 transition">Why Shield HQ</Link>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-white text-sm mb-3">Resources</h4>
              <div className="space-y-2 text-sm text-zinc-500">
                <Link href="/pitch/venue" className="block hover:text-zinc-300 transition">Venue Guide</Link>
                <Link href="/pitch/security" className="block hover:text-zinc-300 transition">Security Guide</Link>
                <Link href="/sia-licensing" className="block hover:text-zinc-300 transition">SIA Licensing Info</Link>
                <Link href="/faqs" className="block hover:text-zinc-300 transition">FAQs</Link>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-white text-sm mb-3">Account</h4>
              <div className="space-y-2 text-sm text-zinc-500">
                <Link href="/login" className="block hover:text-zinc-300 transition">Log in</Link>
                <Link href="/signup" className="block hover:text-zinc-300 transition">Sign up</Link>
                <Link href="/signup/venue" className="block hover:text-zinc-300 transition">Register as Venue</Link>
                <Link href="/signup/personnel" className="block hover:text-zinc-300 transition">Register as Guard</Link>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-white text-sm mb-3">Company</h4>
              <div className="space-y-2 text-sm text-zinc-500">
                <Link href="/why-shield" className="block hover:text-zinc-300 transition">About Us</Link>
                <a href="mailto:hello@shieldsecurity.app" className="block hover:text-zinc-300 transition">Contact</a>
                <Link href="/careers" className="block hover:text-zinc-300 transition">Careers</Link>
                <span className="block text-zinc-600">Birmingham, UK</span>
              </div>
            </div>
          </div>
          {/* App Store Badges */}
          <div className="mt-10 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">Get the Shield HQ app</p>
            <div className="flex gap-2">
              <a href="#" className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-lg px-3 py-1.5 transition group">
                <svg className="w-4 h-4 text-zinc-400 group-hover:text-white transition" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <div>
                  <div className="text-[7px] text-zinc-500 leading-none">Download on the</div>
                  <div className="text-[10px] font-semibold text-zinc-300 group-hover:text-white leading-tight transition">App Store</div>
                </div>
              </a>
              <a href="#" className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-lg px-3 py-1.5 transition group">
                <svg className="w-4 h-4 text-zinc-400 group-hover:text-white transition" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 010 1.38l-2.302 2.302L15.093 12l2.605-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
                <div>
                  <div className="text-[7px] text-zinc-500 leading-none">Get it on</div>
                  <div className="text-[10px] font-semibold text-zinc-300 group-hover:text-white leading-tight transition">Google Play</div>
                </div>
              </a>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
            <span>© {new Date().getFullYear()} Shield HQ. Security staffing for the modern era.</span>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-zinc-400 transition">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-zinc-400 transition">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
