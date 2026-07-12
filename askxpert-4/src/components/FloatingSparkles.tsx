import React from 'react';
import { motion } from 'motion/react';

interface SparkleProps {
  delay?: number;
  size?: number;
  className?: string;
}

export const Sparkle: React.FC<SparkleProps> = ({ delay = 0, size = 20, className = "" }) => {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className}`}
      initial={{ scale: 0.8, opacity: 0.3 }}
      animate={{
        scale: [0.8, 1.2, 0.8],
        opacity: [0.3, 1, 0.3],
        rotate: [0, 45, 90, 45, 0]
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        delay: delay,
        ease: "easeInOut"
      }}
    >
      <path
        d="M12 0L14.8 9.2L24 12L14.8 14.8L12 24L9.2 14.8L0 12L9.2 9.2L12 0Z"
        fill="#0D5232"
        className="fill-emerald-800"
      />
    </motion.svg>
  );
};

export const FloatingSparkles: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Sparkle top-left near header */}
      <div className="absolute top-[15%] left-[8%] md:left-[12%]">
        <Sparkle size={24} delay={0} />
      </div>

      {/* Sparkle middle-left */}
      <div className="absolute top-[45%] left-[4%] md:left-[6%]">
        <Sparkle size={18} delay={1.5} />
      </div>

      {/* Sparkle bottom-left */}
      <div className="absolute bottom-[20%] left-[10%] md:left-[15%]">
        <Sparkle size={22} delay={3.0} />
      </div>

      {/* Sparkle top-right */}
      <div className="absolute top-[18%] right-[12%] md:right-[20%]">
        <Sparkle size={20} delay={0.8} />
      </div>

      {/* Sparkle middle-right */}
      <div className="absolute top-[52%] right-[6%] md:right-[15%]">
        <Sparkle size={28} delay={2.2} />
      </div>

      {/* Sparkle bottom-right */}
      <div className="absolute bottom-[15%] right-[8%] md:right-[10%]">
        <Sparkle size={16} delay={1.2} />
      </div>

      {/* Subtle curving orbit lines matching the poster */}
      <svg className="absolute inset-0 w-full h-full stroke-emerald-950/10 fill-none" xmlns="http://www.w3.org/2000/svg">
        <path d="M-100,200 Q200,450 600,250 T1300,500" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M-100,350 Q400,150 900,400 T1600,300" strokeWidth="1.5" strokeDasharray="4 4" />
      </svg>
    </div>
  );
};
