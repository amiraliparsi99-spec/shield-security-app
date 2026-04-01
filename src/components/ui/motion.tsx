"use client";

import { motion, type Variants, type HTMLMotionProps } from "framer-motion";
import { ReactNode, forwardRef } from "react";

// Animation variants
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0 },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

// FadeIn component - fades in on scroll
interface FadeInProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  direction?: "up" | "down" | "left" | "right" | "none";
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

export function FadeIn({
  children,
  direction = "up",
  delay = 0,
  duration = 0.5,
  className = "",
  once = true,
  ...props
}: FadeInProps) {
  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: direction === "up" ? 20 : direction === "down" ? -20 : 0,
      x: direction === "left" ? 30 : direction === "right" ? -30 : 0,
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: {
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-50px" }}
      variants={variants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// StaggerContainer - Parent for staggered animations
interface StaggerContainerProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
  once?: boolean;
}

export function StaggerContainer({
  children,
  staggerDelay = 0.1,
  className = "",
  once = true,
  ...props
}: StaggerContainerProps) {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-50px" }}
      variants={containerVariants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// StaggerItem - Individual staggered child
interface StaggerItemProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className = "", ...props }: StaggerItemProps) {
  return (
    <motion.div variants={staggerItem} className={className} {...props}>
      {children}
    </motion.div>
  );
}

// GlowCard - Glass card with CSS-only hover (no framer-motion to avoid backdrop-filter flicker)
interface GlowCardProps {
  children: ReactNode;
  className?: string;
}

export const GlowCard = forwardRef<HTMLDivElement, GlowCardProps>(
  ({ children, className = "" }, ref) => {
    return (
      <div
        ref={ref}
        className={`glass glass-hover rounded-2xl p-8 ${className}`}
      >
        {children}
      </div>
    );
  }
);
GlowCard.displayName = "GlowCard";

// AnimatedText - Staggered text animation word by word
interface AnimatedTextProps {
  text: string;
  className?: string;
  delay?: number;
}

export function AnimatedText({ text, className = "", delay = 0 }: AnimatedTextProps) {
  const words = text.split(" ");

  const container: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: delay,
      },
    },
  };

  const child: Variants = {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  };

  return (
    <motion.span
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className={`inline-flex flex-wrap ${className}`}
    >
      {words.map((word, i) => (
        <motion.span key={i} variants={child} className="mr-[0.25em]">
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

// FloatingOrb - Animated floating background orb
interface FloatingOrbProps {
  size?: number;
  color?: "teal" | "cyan" | "custom";
  customColor?: string;
  className?: string;
  delay?: number;
}

export function FloatingOrb({
  size = 300,
  color = "teal",
  customColor,
  className = "",
  delay = 0,
}: FloatingOrbProps) {
  const colors = {
    teal: "rgba(20, 184, 166, 0.25)",
    cyan: "rgba(34, 211, 238, 0.2)",
    custom: customColor || "rgba(20, 184, 166, 0.25)",
  };

  return (
    <div
      className={`orb pointer-events-none orb-float ${className}`}
      style={{
        width: size,
        height: size,
        background: colors[color],
        filter: "blur(80px)",
        animationDelay: `${delay}s`,
      }}
    />
  );
}

// PulseButton - Button with pulse glow effect on hover
interface PulseButtonProps extends HTMLMotionProps<"button"> {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
}

export function PulseButton({
  children,
  className = "",
  variant = "primary",
  ...props
}: PulseButtonProps) {
  const baseStyles =
    variant === "primary"
      ? "bg-shield-500 text-white shadow-lg shadow-shield-500/20 hover:shadow-[0_0_30px_rgba(20,184,166,0.4)]"
      : "border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.1]";

  return (
    <motion.button
      className={`relative overflow-hidden rounded-xl px-8 py-4 font-semibold transition-all duration-300 ${baseStyles} ${className}`}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}

// Counter - Animated number counter
interface CounterProps {
  from?: number;
  to: number;
  duration?: number;
  className?: string;
}

export function Counter({ from = 0, to, duration = 2, className = "" }: CounterProps) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      <motion.span
        initial={{ opacity: 0 }}
        whileInView={{
          opacity: 1,
        }}
        viewport={{ once: true }}
      >
        {to}
      </motion.span>
    </motion.span>
  );
}

// ParallaxSection - Simple parallax effect
interface ParallaxSectionProps {
  children: ReactNode;
  offset?: number;
  className?: string;
}

export function ParallaxSection({
  children,
  offset = 50,
  className = "",
}: ParallaxSectionProps) {
  return (
    <motion.div
      className={className}
      initial={{ y: offset }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Export motion for direct use
export { motion };
