import React from 'react';
import { Sparkles } from 'lucide-react';

export const AboutAskXpert: React.FC = () => {
  return (
    <div className="w-full max-w-3xl mx-auto border-t border-emerald-950/10 pt-10 mt-12 relative z-10 select-none">
      <div className="flex items-center space-x-2.5 mb-6 justify-center">
        <Sparkles className="w-4 h-4 text-emerald-800 animate-pulse" />
        <span className="font-display font-bold text-sm tracking-widest text-emerald-950 uppercase">
          Discover AskXpert
        </span>
      </div>

      {/* Text descriptions */}
      <div className="space-y-4 text-emerald-950/80 font-sans text-xs md:text-sm leading-relaxed text-center">
        <p>
          <strong className="text-emerald-950 font-semibold font-display">AskXpert</strong> is an elite flagship talk-and-podcast series conceived and conducted by <strong className="text-emerald-900 font-semibold">IEEE CE Kidangoor Student Branch</strong>.
        </p>
        
        <div className="py-2">
          <span className="font-serif italic text-emerald-800 px-4 border-l-2 border-r-2 border-emerald-900/20 py-1 inline-block">
            "A Conversation Today, A Career Insight Tomorrow."
          </span>
        </div>

        <p className="max-w-2xl mx-auto">
          The program brings student minds into direct, unscripted discourse with seasoned technology experts, corporate pioneers, and globally distinguished alumni to resolve career ambiguities and acquire futuristic professional insights.
        </p>
      </div>
    </div>
  );
};

