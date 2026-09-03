import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Mail, AlertCircle, Loader2, ArrowLeft, Printer, ShieldCheck, Ticket, Calendar, MapPin, Radio, Eye, X } from 'lucide-react';
import { Registration, FirestoreErrorInfo } from '../types';

interface TicketLookupProps {
  initialEmail?: string;
  onBackToRegister?: () => void;
  onBackToEvents?: () => void;
}

export const TicketLookup: React.FC<TicketLookupProps> = ({ 
  initialEmail = '', 
  onBackToRegister,
  onBackToEvents
}) => {
  const [email, setEmail] = useState<string>(initialEmail);
  const [loading, setLoading] = useState<boolean>(false);
  const [ticket, setTicket] = useState<Registration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState<boolean>(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState<boolean>(false);

  useEffect(() => {
    if (initialEmail) {
      handleLookup(null, initialEmail);
    }
  }, [initialEmail]);

  // Safe error logging
  const handleFirestoreError = (err: unknown, operationType: 'get', path: string) => {
    const errInfo: FirestoreErrorInfo = {
      error: err instanceof Error ? err.message : String(err),
      operationType,
      path,
      authInfo: {
        userId: null,
        email: null,
        emailVerified: null,
        isAnonymous: null,
      },
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
  };

  const handleLookup = async (e: React.FormEvent | null, searchEmail?: string) => {
    if (e) e.preventDefault();
    
    const targetEmail = (searchEmail || email).trim().toLowerCase();
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    setTicket(null);

    try {
      const docRef = doc(db, 'registrations', targetEmail);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setTicket(docSnap.data() as Registration);
      } else {
        setError('No delegate pass found under this email. Please check the spelling or submit a new registration.');
      }
    } catch (err) {
      handleFirestoreError(err, 'get', `registrations/${targetEmail}`);
      setError('Error retrieving your ticket. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-xl mx-auto relative z-10 print:p-0">
      
      <AnimatePresence mode="wait">
        {!ticket ? (
          <motion.div
            key="lookup-search"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className="bg-[#FAF9F5]/90 border border-emerald-950/10 p-6 md:p-8 rounded-2xl shadow-xl shadow-emerald-950/5 backdrop-blur-md relative print:hidden"
          >
            {/* Visual corner highlights */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-900/30 rounded-tl-2xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-900/30 rounded-br-2xl" />

            {onBackToEvents && (
              <button
                type="button"
                onClick={onBackToEvents}
                className="flex items-center space-x-1.5 text-xs text-emerald-800 hover:text-emerald-950 font-mono font-bold mb-4 transition-all cursor-pointer select-none"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Events</span>
              </button>
            )}

            <div className="flex items-center space-x-2.5 mb-6 border-b border-emerald-950/5 pb-4">
              <Ticket className="w-5 h-5 text-emerald-800" />
              <div>
                <h3 className="font-display font-bold text-lg text-emerald-950 tracking-tight leading-none">
                  Retrieve Entry Pass
                </h3>
                <span className="text-[10px] text-emerald-800 font-mono tracking-wider uppercase mt-1 inline-block">
                  Verify registration & download ticket
                </span>
              </div>
            </div>

            <form onSubmit={(e) => handleLookup(e)} className="space-y-5">
              <div className="flex flex-col space-y-1.5">
                <label htmlFor="lookup-email" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase flex items-center space-x-1.5">
                  <Mail className="w-3 h-3 text-emerald-800" />
                  <span>Enter Registered Email</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="lookup-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="sandra@cekgr.ac.in"
                    className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl pl-4 pr-11 py-3 text-sm text-emerald-950 font-sans placeholder-emerald-950/30 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 bg-emerald-900 hover:bg-emerald-950 text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:bg-emerald-950/40"
                    aria-label="Search"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error box */}
              {error && searched && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start space-x-2 bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-rose-800 text-xs"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-grow space-y-2">
                    <p className="leading-relaxed">{error}</p>
                    {onBackToRegister && (
                      <button
                        type="button"
                        onClick={onBackToRegister}
                        className="text-rose-900 font-bold underline text-xs block hover:text-rose-950 transition-colors"
                      >
                        Click here to register a new ticket
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              <p className="text-[10px] font-mono text-emerald-800/60 leading-relaxed text-center">
                * Input the exact email used during registration. Contact coordinators if you encounter issues.
              </p>

              {onBackToRegister && (
                <div className="pt-4 border-t border-emerald-950/5 text-center">
                  <button
                    type="button"
                    onClick={onBackToRegister}
                    className="text-xs text-emerald-800 hover:text-emerald-950 font-bold underline transition-all cursor-pointer"
                  >
                    Need to register? Click here to sign up
                  </button>
                </div>
              )}
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="ticket-display"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="space-y-6"
          >
            {/* Top Toolbar */}
            <div className="flex justify-between items-center px-2 print:hidden">
              <button
                onClick={() => {
                  setTicket(null);
                  setSearched(false);
                  if (!initialEmail) setEmail('');
                }}
                className="flex items-center space-x-1.5 text-xs font-sans text-emerald-900 hover:text-emerald-950 transition-all font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Lookup another email</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-sans px-3.5 py-2 rounded-xl transition-all shadow-md cursor-pointer hover:shadow-emerald-900/20"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save Pass</span>
              </button>
            </div>

            {/* COMPULSORY WHATSAPP GROUP CARD */}
            <div className="w-full bg-[#E8F5E9] border border-emerald-300 rounded-2xl p-5 md:p-6 shadow-sm relative overflow-hidden print:hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="bg-rose-600 text-white text-[9px] font-mono font-black px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
                      Compulsory Action
                    </span>
                    <span className="text-emerald-800 font-mono text-[9px] tracking-wider uppercase font-bold">
                      Official Event Channel
                    </span>
                  </div>
                  <h4 className="font-display font-black text-base text-emerald-950 tracking-tight">
                    Join Official WhatsApp Group
                  </h4>
                  <p className="text-xs text-emerald-950/80 leading-relaxed font-sans max-w-md">
                    Please join the official WhatsApp community group now. This is <span className="font-semibold text-rose-700 underline">compulsory</span> for all registered delegates to receive live schedules, updates, and entry guidelines.
                  </p>
                </div>
                <div className="flex-shrink-0 self-start md:self-center">
                  <a
                    href="https://chat.whatsapp.com/FGzbCRebAZc7guARlJ2QAw?s=cl&p=a&mlu=4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-sans font-bold text-xs px-5 py-3 rounded-xl transition-all duration-300 shadow-md hover:shadow-[#25D366]/20 hover:scale-[1.02] active:scale-95"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.66.986 3.291 1.478 4.836 1.479 5.488 0 9.954-4.448 9.957-9.922.001-2.652-1.03-5.144-2.902-7.02C16.645 1.815 14.158.784 11.516.784c-5.49 0-9.958 4.45-9.96 9.926-.001 1.83.5 3.614 1.45 5.176l-1.004 3.666 3.755-.985zm12.31-7.143c-.26-.13-1.534-.757-1.771-.842-.237-.085-.41-.13-.583.13-.172.26-.667.842-.818 1.012-.15.17-.3.19-.56.06-.26-.13-1.1-.405-2.094-1.292-.775-.69-1.298-1.543-1.45-1.802-.15-.26-.016-.4.115-.53.117-.118.26-.3.39-.45.13-.15.173-.255.26-.425.085-.17.042-.315-.02-.445-.06-.13-.583-1.4-.8-1.92-.21-.505-.424-.436-.583-.443-.15-.007-.323-.008-.495-.008-.172 0-.452.065-.69.322-.237.258-.905.885-.905 2.158 0 1.273.925 2.502 1.055 2.672.13.17 1.82 2.78 4.41 3.896.616.265 1.1.422 1.476.541.618.196 1.18.169 1.625.102.496-.075 1.534-.627 1.75-1.233.214-.606.214-1.127.15-1.233-.06-.108-.23-.17-.49-.3z"/>
                    </svg>
                    <span>Join Group</span>
                  </a>
                </div>
              </div>
            </div>

            {/* THE TICKET - ELEGANT DUAL-STUB DESIGN */}
            <div className="w-full bg-emerald-950 text-[#FAF9F5] rounded-3xl overflow-hidden shadow-2xl relative border border-emerald-900/30 print:shadow-none print:border-emerald-950/40">
              
              {/* Boarding ticket side circles / punch hole effect */}
              <div className="absolute top-[68%] md:top-0 md:left-[72%] -translate-y-1/2 w-6 h-6 bg-[#FAF9F5] rounded-full z-20 -left-3 print:bg-white" />
              <div className="absolute top-[68%] md:top-0 md:right-[-12px] md:left-[72%] -translate-y-1/2 w-6 h-6 bg-[#FAF9F5] rounded-full z-20 -right-3 md:hidden print:bg-white" />
              <div className="absolute top-[68%] md:bottom-[-12px] md:left-[72%] -translate-y-1/2 w-6 h-6 bg-[#FAF9F5] rounded-full z-20 -right-3 md:-translate-y-0 md:top-auto print:bg-white" />

              <div className="grid grid-cols-1 md:grid-cols-12">
                
                {/* MAIN PASS BODY (8 cols) */}
                <div className="md:col-span-8 p-6 md:p-8 space-y-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-dashed border-[#FAF9F5]/20 relative">
                  
                  {/* Event branding header */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5">
                        {ticket.paymentStatus === 'failed' ? (
                          <div className="flex items-center space-x-1 text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded-md">
                            <span className="text-[9px] font-mono tracking-widest uppercase font-bold">Payment Failed</span>
                          </div>
                        ) : ticket.paymentStatus === 'pending' ? (
                          <div className="flex items-center space-x-1.5 text-amber-300 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-[9px] font-mono tracking-widest uppercase font-bold">UPI Verification Pending</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1 text-emerald-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-mono tracking-widest uppercase font-bold">Verified Delegate Pass</span>
                          </div>
                        )}
                      </div>
                      <h4 className="font-display font-black text-xl tracking-tight text-[#FAF9F5]">AskXpert</h4>
                    </div>

                    <div className="text-right select-none">
                      <span className="font-sans font-bold text-[9px] text-[#FAF9F5]/60 tracking-widest block uppercase">CONDUCTED BY</span>
                      <span className="font-sans font-extrabold text-[9px] tracking-tight text-emerald-400 uppercase">IEEE CEK SB</span>
                    </div>
                  </div>

                  {/* Program Slogan / theme */}
                  <div className="py-2 border-y border-[#FAF9F5]/10">
                    <span className="text-[8px] font-mono text-emerald-400/90 uppercase tracking-widest block">THEME</span>
                    <p className="text-[10px] md:text-xs font-display font-extrabold text-[#FAF9F5] tracking-wide leading-tight mt-0.5">
                      "A CONVERSATION TODAY, A CAREER INSIGHT TOMORROW."
                    </p>
                  </div>

                  {/* Attendee Metadata details */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-[9px] font-mono text-[#FAF9F5]/50 uppercase block">DELEGATE NAME</span>
                      <span className="font-serif italic font-bold text-xl md:text-2xl text-[#FAF9F5] tracking-tight block truncate">
                        {ticket.name}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-[8px] font-mono text-[#FAF9F5]/50 uppercase block">
                          {ticket.roleType === 'professional' ? 'ORGANIZATION' : 'INSTITUTION'}
                        </span>
                        <span className="font-sans font-semibold text-[#FAF9F5] truncate block mt-0.5">
                          {ticket.college.includes('Kidangoor') ? 'CE Kidangoor' : ticket.college}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-mono text-[#FAF9F5]/50 uppercase block">
                          {ticket.roleType === 'professional' ? 'DESIGNATION' : 'COURSE / LEVEL'}
                        </span>
                        <span className="font-sans font-semibold text-[#FAF9F5] truncate block mt-0.5">
                          {ticket.roleType === 'professional' 
                            ? (ticket.designation && ticket.department && ticket.designation !== ticket.department
                                ? `${ticket.department} • ${ticket.designation}`
                                : (ticket.designation || ticket.department))
                            : `${ticket.department} ${ticket.yearOfStudy ? `• ${ticket.yearOfStudy}` : ''}`}
                        </span>
                      </div>
                      {ticket.language && (
                        <div>
                          <span className="text-[8px] font-mono text-[#FAF9F5]/50 uppercase block">LANGUAGE</span>
                          <span className="font-sans font-semibold text-[#FAF9F5] truncate block mt-0.5">
                            {ticket.language}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      {ticket.transactionId && (
                        <div className="text-xs">
                          <span className="text-[8px] font-mono text-[#FAF9F5]/50 uppercase block">
                            {ticket.paymentMethod === 'razorpay' ? 'PAYMENT ID' : 'TRANSACTION / UTR ID'}
                          </span>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="font-mono text-[11px] font-bold text-emerald-300 tracking-wider">
                              {ticket.transactionId}
                            </span>
                          </div>
                        </div>
                      )}

                      {ticket.screenshot && (
                        <div className="text-xs">
                          <span className="text-[8px] font-mono text-[#FAF9F5]/50 uppercase block">PAYMENT PROOF</span>
                          <button
                            type="button"
                            onClick={() => setShowScreenshotModal(true)}
                            className="mt-0.5 flex items-center space-x-1.5 bg-emerald-900 hover:bg-emerald-800 text-white border border-emerald-700/50 rounded-xl px-3 py-1 text-[10px] font-mono tracking-wider transition-all duration-300 cursor-pointer shadow-sm hover:shadow-emerald-950/20 active:scale-95"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-300" />
                            <span>View Screenshot</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* TICKET STUB / BARCODE SIDE (4 cols) */}
                <div className="md:col-span-4 p-6 md:p-8 bg-emerald-900/35 flex flex-col justify-between items-center text-center space-y-6 md:space-y-0 relative">
                  
                  {/* Pass Ticket Code */}
                  <div className="space-y-1 w-full">
                    <span className="text-[9px] font-mono text-[#FAF9F5]/50 uppercase block">PASS CODE</span>
                    <span className="font-mono font-black text-2xl tracking-widest text-[#FAF9F5] bg-emerald-950/80 px-4 py-1.5 rounded-xl border border-emerald-800/20 inline-block w-full">
                      {ticket.ticketId}
                    </span>
                  </div>

                  {/* IEEE Badge */}
                  <div className="w-full">
                    {ticket.ieeeStatus === 'member' ? (
                      <span className="inline-block bg-emerald-800 border border-emerald-600/50 text-[#FAF9F5] text-[9px] font-mono font-bold tracking-wider uppercase px-3 py-1 rounded-full w-full">
                        ★ IEEE MEMBER
                      </span>
                    ) : (
                      <span className="inline-block bg-emerald-950/60 border border-emerald-900/40 text-emerald-300 text-[9px] font-mono font-semibold tracking-wider uppercase px-3 py-1 rounded-full w-full">
                        GUEST DELEGATE
                      </span>
                    )}
                    {ticket.ieeeId && (
                      <span className="text-[8px] font-mono text-[#FAF9F5]/40 mt-1 block">
                        ID: {ticket.ieeeId}
                      </span>
                    )}
                  </div>

                </div>

              </div>
            </div>

            {/* Print styling guide for the browser print action */}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Screenshot Modal Overlay */}
      <AnimatePresence>
        {showScreenshotModal && ticket?.screenshot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/80 backdrop-blur-sm print:hidden"
            onClick={() => setShowScreenshotModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-[#FAF9F5] border border-emerald-900/20 max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center px-4 py-3 border-b border-emerald-950/5 bg-emerald-950/5">
                <span className="font-display font-bold text-xs text-emerald-950 uppercase tracking-wider">
                  Uploaded Payment Screenshot
                </span>
                <button
                  type="button"
                  onClick={() => setShowScreenshotModal(false)}
                  className="p-1 hover:bg-emerald-950/10 rounded-lg transition-colors cursor-pointer text-emerald-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Image body */}
              <div className="p-4 flex items-center justify-center max-h-[70vh] overflow-y-auto bg-white">
                <img
                  src={ticket.screenshot}
                  alt="Delegate Payment Screenshot"
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm border border-emerald-950/10"
                />
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-emerald-950/5 bg-emerald-950/5 text-center text-[10px] font-mono text-emerald-800/60">
                Uploaded by {ticket.name}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
