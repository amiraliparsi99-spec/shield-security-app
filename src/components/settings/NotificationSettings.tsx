"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useNotifications } from "@/contexts/NotificationContext";

export function NotificationSettings() {
  const { isSupported, permission, isEnabled, requestPermission } = useNotifications();
  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    await requestPermission();
    setLoading(false);
  };

  if (!isSupported) {
    return (
      <div className="glass rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-zinc-500/20 flex items-center justify-center shrink-0">
            <BellOffIcon className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Push Notifications</h3>
            <p className="text-sm text-zinc-400 mt-1">
              Push notifications are not supported on this browser. Try using Chrome, Firefox, or Edge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            isEnabled ? 'bg-emerald-500/20' : 'bg-zinc-500/20'
          }`}>
            {isEnabled ? (
              <BellIcon className="w-5 h-5 text-emerald-400" />
            ) : (
              <BellOffIcon className="w-5 h-5 text-zinc-400" />
            )}
          </div>
          <div>
            <h3 className="text-white font-medium">Push Notifications</h3>
            <p className="text-sm text-zinc-400 mt-1">
              {isEnabled
                ? "You'll receive notifications for calls, bookings, and messages."
                : permission === 'denied'
                ? "Notifications are blocked. Please enable them in your browser settings."
                : "Enable notifications to stay updated on calls, bookings, and messages."}
            </p>
          </div>
        </div>

        {!isEnabled && permission !== 'denied' && (
          <motion.button
            onClick={handleEnable}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-shield-500 hover:bg-shield-600 text-white text-sm font-medium transition disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner className="w-4 h-4" />
                Enabling...
              </span>
            ) : (
              'Enable'
            )}
          </motion.button>
        )}

        {isEnabled && (
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium">
            Enabled
          </span>
        )}
      </div>

      {/* Notification preferences */}
      {isEnabled && (
        <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
          <h4 className="text-sm font-medium text-zinc-300">Notification Preferences</h4>
          
          <NotificationToggle
            label="Incoming Calls"
            description="Get notified when someone calls you"
            defaultChecked={true}
          />
          
          <NotificationToggle
            label="New Bookings"
            description="Get notified about new booking requests"
            defaultChecked={true}
          />
          
          <NotificationToggle
            label="Shift Offers"
            description="Get notified when new shifts are available"
            defaultChecked={true}
          />
          
          <NotificationToggle
            label="Messages"
            description="Get notified about new messages"
            defaultChecked={true}
          />
          
          <NotificationToggle
            label="Shift Reminders"
            description="Get reminded before your shifts start"
            defaultChecked={true}
          />
        </div>
      )}
    </div>
  );
}

function NotificationToggle({
  label,
  description,
  defaultChecked = true,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white text-sm">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-shield-500' : 'bg-zinc-700'
        }`}
      >
        <motion.div
          className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function BellOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11M6 6l12 12M13 17v1a3 3 0 01-6 0v-1m2-10.659A6.002 6.002 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h9" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <motion.svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
      />
    </motion.svg>
  );
}
