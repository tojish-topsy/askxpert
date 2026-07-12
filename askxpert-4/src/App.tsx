import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FloatingSparkles } from './components/FloatingSparkles';
import { RegisterForm } from './components/RegisterForm';
import { PaymentPage } from './components/PaymentPage';
import { TicketLookup } from './components/TicketLookup';
import { AboutAskXpert } from './components/AboutAskXpert';
import { EventsDashboard } from './components/EventsDashboard';
import { Globe, Calendar, BookOpen, Search } from 'lucide-react';

type TabType = 'dashboard' | 'register' | 'ticket';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [registeredEmail, setRegisteredEmail] = useState<string>('');
  const [pendingRegistration, setPendingRegistration] = useState<any>(null);

  const handleRegistrationSuccess = (email: string) => {
    setRegisteredEmail(email);
    setPendingRegistration(null);
    setActiveTab('ticket');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-emerald-950 font-sans halftone-dots flex flex-col justify-between overflow-x-hidden relative">
      {/* Decorative background visual layers */}
      <FloatingSparkles />

      {/* Main Container */}
      <main className="w-full max-w-7xl mx-auto px-6 py-8 md:py-12 flex-grow relative z-10 print:p-0">
        
        {/* Unified Elegant Top Brand Header & Navigation Tab Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-emerald-950/10 pb-6 mb-8 select-none print:hidden">
          <div className="flex flex-col space-y-1">
            <h2 className="text-[10px] md:text-xs font-display font-extrabold tracking-[0.18em] text-emerald-950/70 uppercase">
              IEEE CE Kidangoor Student Branch
            </h2>
            <div className="flex items-center space-x-2">
              <h1 className="font-serif italic font-bold text-3xl md:text-4xl lg:text-5xl tracking-tight text-emerald-900 leading-none">
                Ask<span className="not-italic font-sans font-bold text-emerald-950 hover:text-emerald-800 transition-colors cursor-default">X</span>pert
              </h1>
              <div className="animate-pulse">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="#0D5232" />
                </svg>
              </div>
            </div>
          </div>

          {/* Tab Selector is hidden as per request */}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            /* FULL WIDTH EVENTS DASHBOARD */
            <motion.div
              key="events-dashboard-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <EventsDashboard 
                onRegisterClick={() => {
                  setPendingRegistration(null);
                  setActiveTab('register');
                }} 
              />
            </motion.div>
          ) : (
            /* REGULAR SPLIT GRID LAYOUT FOR REGISTER & TICKET */
            <motion.div
              key="visitor-grid"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
            >
              {/* Left Column: Slogans, Titles, Visuals, Timer (7 grid cols) (Print Hidden) */}
              <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6 md:space-y-8 select-none print:hidden">
                
                {/* Subtitle / Slogan */}
                <div className="flex flex-col space-y-1.5">
                  <h2 className="text-sm md:text-base font-display font-extrabold tracking-[0.18em] text-emerald-950/80 leading-snug">
                    A CONVERSATION TODAY, A CAREER INSIGHT TOMORROW.
                  </h2>
                </div>

                {/* Program Logo Display Heading */}
                <div className="relative py-2">
                  <h1 className="font-serif italic font-bold text-7xl md:text-8xl lg:text-9xl tracking-tight text-emerald-900 leading-none relative z-10">
                    Ask<span className="not-italic font-sans font-bold text-emerald-950 hover:text-emerald-800 transition-colors cursor-default">X</span>pert
                  </h1>
                  
                  {/* Visual tiny sparkle decoration directly on logo */}
                  <div className="absolute top-1 right-[-15px] md:right-[-25px] animate-pulse">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="#0D5232" />
                    </svg>
                  </div>
                </div>

              </div>

              {/* Right Column: Microphone representation & Form Switcher (5 grid cols) */}
              <div className="lg:col-span-5 flex flex-col items-center space-y-8 lg:space-y-6 print:col-span-12 print:w-full">
                
                {/* Switchable Interactive Panels */}
                <div className="w-full flex justify-center">
                  {activeTab === 'register' ? (
                    pendingRegistration ? (
                      <PaymentPage
                        registrationData={pendingRegistration}
                        onBack={() => setPendingRegistration(null)}
                        onSuccess={handleRegistrationSuccess}
                      />
                    ) : (
                      <RegisterForm
                        onRegisterProceed={(data) => setPendingRegistration(data)}
                        onSwitchToLookup={() => setActiveTab('ticket')}
                        onBackToEvents={() => setActiveTab('dashboard')}
                      />
                    )
                  ) : (
                    <TicketLookup
                      initialEmail={registeredEmail}
                      onBackToRegister={() => {
                        setRegisteredEmail('');
                        setPendingRegistration(null);
                        setActiveTab('register');
                      }}
                      onBackToEvents={() => setActiveTab('dashboard')}
                    />
                  )}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compulsory Static Info Section */}
        <div className="print:hidden">
          <AboutAskXpert />
        </div>
      </main>

      {/* Footer Details & Social handles (Print Hidden) */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 border-t border-emerald-950/5 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-[11px] font-sans text-emerald-800/80 tracking-wide z-10 relative print:hidden">
        
        {/* Left side: Student Branch Website Link */}
        <div className="flex items-center space-x-2 select-none group">
          <Globe className="w-3.5 h-3.5 text-emerald-900/60 group-hover:text-emerald-800 transition-colors" />
          <a
            href="https://ieee.ce-kgr.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono hover:text-emerald-950 underline decoration-emerald-900/20 hover:decoration-emerald-950 transition-all font-medium"
          >
            ieee.ce-kgr.org
          </a>
        </div>

        {/* Center: Copyright credits */}
        <div className="font-sans select-none">
          © 2026 IEEE CE Kidangoor Student Branch. All rights reserved.
        </div>

        {/* Right side: Empty spacing to keep footer design balanced */}
        <div className="w-4 h-4 md:w-auto" />

      </footer>
    </div>
  );
}
