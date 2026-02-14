"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TourStep {
  target: string; // CSS selector or 'center' for modal
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface OnboardingTourProps {
  steps: TourStep[];
  tourId: string; // Unique ID to track completion
  onComplete?: () => void;
}

const STORAGE_KEY_PREFIX = 'shield-tour-completed-';

export function OnboardingTour({ steps, tourId, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Check if tour was already completed
  useEffect(() => {
    const completed = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tourId}`);
    if (!completed) {
      // Delay showing tour for better UX
      setTimeout(() => setIsVisible(true), 1000);
    }
  }, [tourId]);

  // Find target element position
  useEffect(() => {
    if (!isVisible || steps[currentStep].position === 'center') {
      setTargetRect(null);
      return;
    }

    const target = document.querySelector(steps[currentStep].target);
    if (target) {
      setTargetRect(target.getBoundingClientRect());
    }
  }, [currentStep, isVisible, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handleSkip = () => {
    completeTour();
  };

  const completeTour = () => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${tourId}`, 'true');
    setIsVisible(false);
    onComplete?.();
  };

  if (!isVisible) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isCentered = step.position === 'center' || !targetRect;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[1000]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/70"
          onClick={handleSkip}
        />

        {/* Highlight area */}
        {targetRect && !isCentered && (
          <div
            className="absolute rounded-xl ring-4 ring-shield-500 ring-offset-4 ring-offset-black/50"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          className={`absolute ${isCentered ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''}`}
          style={!isCentered && targetRect ? getTooltipPosition(targetRect, step.position) : undefined}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          key={currentStep}
        >
          <div className="w-80 bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl">
            {/* Progress */}
            <div className="flex items-center gap-1 mb-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition ${
                    i <= currentStep ? 'bg-shield-500' : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>

            {/* Content */}
            <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
            <p className="text-sm text-zinc-400 mb-6">{step.description}</p>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleSkip}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition"
              >
                Skip tour
              </button>
              <div className="flex items-center gap-3">
                {currentStep > 0 && (
                  <button
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="px-4 py-2 rounded-lg text-sm text-zinc-300 hover:text-white transition"
                  >
                    Back
                  </button>
                )}
                <motion.button
                  onClick={handleNext}
                  className="px-4 py-2 rounded-lg bg-shield-500 hover:bg-shield-600 text-white text-sm font-medium transition"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLastStep ? 'Get Started' : 'Next'}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function getTooltipPosition(
  rect: DOMRect,
  position: TourStep['position']
): React.CSSProperties {
  const padding = 16;
  
  switch (position) {
    case 'top':
      return {
        bottom: window.innerHeight - rect.top + padding,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
      };
    case 'bottom':
      return {
        top: rect.bottom + padding,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
      };
    case 'left':
      return {
        top: rect.top + rect.height / 2,
        right: window.innerWidth - rect.left + padding,
        transform: 'translateY(-50%)',
      };
    case 'right':
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + padding,
        transform: 'translateY(-50%)',
      };
    default:
      return {
        top: rect.bottom + padding,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
      };
  }
}

// Pre-built tours for different user types
export const PERSONNEL_TOUR: TourStep[] = [
  {
    target: 'center',
    position: 'center',
    title: 'Welcome to Shield! 👋',
    description: 'The marketplace connecting security professionals with venues. Let\'s show you around.',
  },
  {
    target: '[data-tour="jobs"]',
    position: 'bottom',
    title: 'Find Jobs',
    description: 'Browse available shifts from venues in your area. Filter by date, pay rate, and location.',
  },
  {
    target: '[data-tour="availability"]',
    position: 'bottom',
    title: 'Set Your Availability',
    description: 'Let venues know when you\'re free to work. Set weekly schedules and block off dates.',
  },
  {
    target: '[data-tour="earnings"]',
    position: 'bottom',
    title: 'Track Earnings',
    description: 'See your completed shifts, total earnings, and payment history all in one place.',
  },
  {
    target: '[data-tour="documents"]',
    position: 'bottom',
    title: 'Upload Documents',
    description: 'Add your SIA license and other certifications to get verified and access more jobs.',
  },
];

export const VENUE_TOUR: TourStep[] = [
  {
    target: 'center',
    position: 'center',
    title: 'Welcome to Shield! 🏢',
    description: 'Find and book verified security professionals for your events. Let\'s get you set up.',
  },
  {
    target: '[data-tour="book-security"]',
    position: 'bottom',
    title: 'Book Security',
    description: 'Create a booking request with your event details, staff requirements, and budget.',
  },
  {
    target: '[data-tour="bookings"]',
    position: 'bottom',
    title: 'Manage Bookings',
    description: 'Track all your upcoming and past bookings. Confirm staff and monitor check-ins.',
  },
  {
    target: '[data-tour="templates"]',
    position: 'bottom',
    title: 'Event Templates',
    description: 'Save time by creating templates for recurring events with pre-set requirements.',
  },
];

export const AGENCY_TOUR: TourStep[] = [
  {
    target: 'center',
    position: 'center',
    title: 'Welcome to Shield! 🛡️',
    description: 'Manage your security team and grow your client base. Let\'s explore your dashboard.',
  },
  {
    target: '[data-tour="staff"]',
    position: 'bottom',
    title: 'Staff Management',
    description: 'Add and manage your security personnel. Track their availability and performance.',
  },
  {
    target: '[data-tour="bookings"]',
    position: 'bottom',
    title: 'Client Bookings',
    description: 'View and respond to booking requests from venues. Assign your best staff.',
  },
  {
    target: '[data-tour="analytics"]',
    position: 'bottom',
    title: 'Analytics',
    description: 'Monitor your agency\'s performance, revenue trends, and staff metrics.',
  },
];

// Hook to reset tour (for testing)
export function useResetTour(tourId: string) {
  return () => {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tourId}`);
    window.location.reload();
  };
}
