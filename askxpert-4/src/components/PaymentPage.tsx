import React, { useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Loader2, AlertCircle, ShieldCheck, Lock, CheckCircle2, Zap } from 'lucide-react';
import { Registration, FirestoreErrorInfo } from '../types';

interface PaymentPageProps {
  registrationData: Omit<Registration, 'ticketId' | 'createdAt' | 'transactionId' | 'paymentStatus'>;
  onBack: () => void;
  onSuccess: (email: string) => void;
}

export const PaymentPage: React.FC<PaymentPageProps> = ({ registrationData, onBack, onSuccess }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showLookupLink, setShowLookupLink] = useState<boolean>(false);

  const isIeee = registrationData.ieeeStatus === 'member';
  const isProfessional = registrationData.roleType === 'professional';
  
  // Calculate pricing based on role and IEEE membership combination
  const amount = isProfessional 
    ? (isIeee ? 3 : 4) 
    : (isIeee ? 1 : 2);

  // Safe error logging
  const handleFirestoreError = (err: unknown, operationType: 'write', path: string) => {
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

  // Helper to generate elegant ticket ID (e.g., AX-73F9)
  const generateTicketId = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `AX-${code}`;
  };

  // Helper to load Razorpay SDK dynamically if not already available
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Process successful payment, write to Firestore, sync to GSheet, and transition to pass
  const handlePaymentSuccess = async (paymentId: string) => {
    try {
      const emailClean = registrationData.email.trim().toLowerCase();
      const docRef = doc(db, 'registrations', emailClean);
      const ticketId = generateTicketId();

      const finalPayload: Registration = {
        ...registrationData,
        ticketId,
        createdAt: serverTimestamp(),
        transactionId: paymentId,
        paymentStatus: 'verified', // Automatically verified upon Razorpay success
      };

      // Clean undefined properties for Firestore
      const cleanPayload: Record<string, any> = {};
      Object.entries(finalPayload).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanPayload[key] = value;
        }
      });

      // 1. Write verified registration to Firestore
      await setDoc(docRef, cleanPayload);

      // 2. Trigger Google Sheets Webhook
      // @ts-ignore
      const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwCdyXXjeNA6u60xlpP-adM05kz9wSkLaGVGLv9mQ5yhAaXpu9cZP9Ao3aTgoc-lNTi9Q/exec';
      if (scriptUrl) {
        try {
          const sheetsPayload = {
            ticketId,
            name: registrationData.name,
            email: emailClean,
            phone: registrationData.phone,
            language: registrationData.language || 'English',
            ieeeStatus: registrationData.ieeeStatus,
            ieeeId: registrationData.ieeeId || 'N/A',
            college: registrationData.college,
            department: registrationData.department,
            yearOfStudy: registrationData.yearOfStudy,
            roleType: registrationData.roleType || 'student',
            paymentStatus: 'verified',
            amount: amount,
            transactionId: paymentId,
            timestamp: new Date().toISOString()
          };

          fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(sheetsPayload),
          })
            .then(() => console.log('Successfully dispatched verified payload to Google Sheets'))
            .catch(err => console.error('Silent Google Sheets fetch error:', err));
        } catch (sheetsErr) {
          console.error('Error triggering Google Sheets integration:', sheetsErr);
        }
      }

      // 3. Automatically redirect to the final verified delegate pass page!
      onSuccess(emailClean);
    } catch (err) {
      handleFirestoreError(err, 'write', `registrations/${registrationData.email}`);
      setError('Payment was received, but failed saving registration to database. Please contact event support with Payment ID: ' + paymentId);
      setLoading(false);
    }
  };

  const handleProceedToPay = async () => {
    setLoading(true);
    setError(null);

    const emailClean = registrationData.email.trim().toLowerCase();

    // 1. Check duplicate registration first
    try {
      const docRef = doc(db, 'registrations', emailClean);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setError('This email address is already registered. Click the link below to view your active Entry Pass.');
        setShowLookupLink(true);
        setLoading(false);
        return;
      }
    } catch (checkErr) {
      console.warn('Duplicate check warning, proceeding to checkout:', checkErr);
    }

    // 2. Ensure Razorpay SDK is loaded
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      setError('Could not connect to Razorpay payment gateway. Please check your internet connection and try again.');
      setLoading(false);
      return;
    }

    // @ts-ignore
    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TTWhBVZABEJn8e';

    // 3. Initialize Razorpay Checkout Options
    const options = {
      key: razorpayKey,
      amount: amount * 100, // Amount in paise
      currency: 'INR',
      name: 'AskXpert',
      description: `AskXpert Delegate Registration (${registrationData.name})`,
      image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=128&auto=format&fit=crop&q=80',
      prefill: {
        name: registrationData.name,
        email: emailClean,
        contact: registrationData.phone,
      },
      notes: {
        delegate_name: registrationData.name,
        role: isProfessional ? 'Professional' : 'Student',
        ieee_status: registrationData.ieeeStatus,
        college: registrationData.college,
        language: registrationData.language || 'English',
      },
      theme: {
        color: '#064e3b', // Deep emerald brand tone
      },
      modal: {
        ondismiss: () => {
          setLoading(false);
        },
        escape: true,
        backdropclose: false,
      },
      handler: async (response: { razorpay_payment_id: string; razorpay_order_id?: string; razorpay_signature?: string }) => {
        if (response && response.razorpay_payment_id) {
          await handlePaymentSuccess(response.razorpay_payment_id);
        } else {
          setError('Payment completion could not be verified. Please try again.');
          setLoading(false);
        }
      },
    };

    try {
      const razorpayInstance = new (window as any).Razorpay(options);
      
      razorpayInstance.on('payment.failed', (response: any) => {
        console.error('Razorpay payment failed:', response.error);
        setError(response.error?.description || 'Payment was unsuccessful. Please try again.');
        setLoading(false);
      });

      razorpayInstance.open();
    } catch (rzpErr) {
      console.error('Razorpay open error:', rzpErr);
      setError('Unable to open Razorpay payment modal. Please refresh or check your browser settings.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-[#FAF9F5]/95 border border-emerald-950/10 p-6 md:p-8 rounded-2xl shadow-xl shadow-emerald-950/5 backdrop-blur-md relative"
      >
        {/* Visual corner accents */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-900/30 rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-900/30 rounded-br-2xl" />

        {/* Back button */}
        <button
          onClick={onBack}
          disabled={loading}
          className="flex items-center space-x-1 text-xs text-emerald-800 hover:text-emerald-950 font-semibold mb-4 transition-colors cursor-pointer disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Delegate Details</span>
        </button>

        {/* Header */}
        <div className="flex items-center space-x-2.5 mb-5 border-b border-emerald-950/5 pb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-900/10 flex items-center justify-center text-emerald-900">
            <Zap className="w-4 h-4 text-emerald-800 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-emerald-950 tracking-tight leading-none">
              Registration Fee Payment
            </h3>
            <p className="text-[11px] text-emerald-900/60 font-sans mt-0.5">
              Secure online checkout powered by Razorpay
            </p>
          </div>
        </div>

        {/* Summary Banner with Delegate & Fee Details */}
        <div className="bg-emerald-950/5 border border-emerald-900/10 p-4 rounded-xl space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-emerald-900/70 font-sans">Delegate Name:</span>
            <span className="font-serif italic font-bold text-emerald-950 text-sm truncate max-w-[200px]">{registrationData.name}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-emerald-900/70 font-sans">Category / Member Status:</span>
            <span className="font-mono font-bold text-[11px] text-emerald-900 uppercase">
              {isProfessional ? 'PROFESSIONAL' : 'STUDENT'}{' '}
              {isIeee ? `• IEEE MEMBER` : '• NON-MEMBER'}
            </span>
          </div>

          {registrationData.language && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-emerald-900/70 font-sans">Preferred Language:</span>
              <span className="font-sans font-semibold text-xs text-emerald-900">
                {registrationData.language}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2.5 border-t border-emerald-950/10">
            <span className="text-emerald-950 font-display font-bold text-xs uppercase tracking-wider">Payable Amount:</span>
            <div className="text-right">
              <span className="text-2xl font-mono font-black text-emerald-900">₹{amount}.00</span>
              <span className="text-[10px] text-emerald-800/60 block font-mono">One-time entry fee</span>
            </div>
          </div>
        </div>

        {/* Payment Gateways & Badges */}
        <div className="mt-5 space-y-4">
          <div className="bg-white border border-emerald-950/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-800" />
                <span className="text-xs font-display font-bold text-emerald-950 uppercase tracking-wider">
                  Payment Channels Supported
                </span>
              </div>
              <span className="bg-emerald-100 text-emerald-900 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full">
                Instant Verification
              </span>
            </div>

            {/* Methods list */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-900 font-sans">
              <div className="flex items-center space-x-1.5 bg-emerald-950/[0.02] p-2 rounded-lg border border-emerald-950/5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                <span>UPI (GPay / PhonePe / Paytm)</span>
              </div>
              <div className="flex items-center space-x-1.5 bg-emerald-950/[0.02] p-2 rounded-lg border border-emerald-950/5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                <span>Credit / Debit Cards</span>
              </div>
              <div className="flex items-center space-x-1.5 bg-emerald-950/[0.02] p-2 rounded-lg border border-emerald-950/5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                <span>Net Banking (All Indian Banks)</span>
              </div>
              <div className="flex items-center space-x-1.5 bg-emerald-950/[0.02] p-2 rounded-lg border border-emerald-950/5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                <span>Wallets & Cred UPI</span>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 text-[10px] text-emerald-800/70 pt-1">
              <Lock className="w-3 h-3 text-emerald-700" />
              <span>256-Bit SSL Encrypted Transaction & Direct Confirmation</span>
            </div>
          </div>

          {/* Alert messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-start space-x-2 bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-rose-800 text-xs w-full"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-grow">
                  <p className="leading-relaxed">{error}</p>
                  {showLookupLink && (
                    <button
                      type="button"
                      onClick={() => onSuccess(registrationData.email.trim().toLowerCase())}
                      className="mt-2 text-emerald-900 font-bold underline text-xs block hover:text-emerald-950 transition-colors cursor-pointer"
                    >
                      Click here to view your active Entry Pass
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Proceed to Pay CTA */}
          <button
            type="button"
            onClick={handleProceedToPay}
            disabled={loading}
            className="w-full bg-emerald-900 hover:bg-emerald-950 text-[#FAF9F5] font-display font-bold text-sm tracking-wider py-3.5 px-4 rounded-xl cursor-pointer transition-all duration-300 shadow-lg shadow-emerald-900/15 hover:shadow-emerald-900/25 active:scale-[0.99] flex items-center justify-center space-x-2 disabled:bg-emerald-950/40 disabled:cursor-not-allowed uppercase"
          >
            {loading ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                <span>Connecting to Razorpay...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4.5 h-4.5" />
                <span>Proceed to Pay ₹{amount}.00</span>
              </>
            )}
          </button>

          <p className="text-[10px] font-mono text-emerald-800/60 text-center select-none">
            Upon successful payment, your verified delegate pass will be generated automatically.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
