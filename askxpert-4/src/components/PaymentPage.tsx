import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  Zap, 
  QrCode, 
  Copy, 
  Check, 
  UploadCloud, 
  X, 
  ChevronRight
} from 'lucide-react';
import QRCode from 'qrcode';
import { Registration, FirestoreErrorInfo } from '../types';

type PaymentMode = 'select' | 'razorpay' | 'qr';

interface PaymentPageProps {
  registrationData: Omit<Registration, 'ticketId' | 'createdAt' | 'transactionId' | 'paymentStatus' | 'paymentMethod'>;
  onBack: () => void;
  onSuccess: (email: string) => void;
}

export const PaymentPage: React.FC<PaymentPageProps> = ({ registrationData, onBack, onSuccess }) => {
  const [mode, setMode] = useState<PaymentMode>('select');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showLookupLink, setShowLookupLink] = useState<boolean>(false);

  // QR Code Specific State
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isIeee = registrationData.ieeeStatus === 'member';
  const isProfessional = registrationData.roleType === 'professional';
  
  // Calculate pricing based on role and IEEE membership combination criteria:
  const amount = isProfessional 
    ? (isIeee ? 10 : 20) 
    : (isIeee ? 10 : 20);

  // UPI configuration from environment with graceful fallbacks
  // @ts-ignore
  const upiId = import.meta.env.VITE_UPI_ID || 'paytm.s1wsfli@pty';
  // @ts-ignore
  const payeeName = import.meta.env.VITE_UPI_PAYEE_NAME || 'AskXpert IEEE CEK';

  // Construct standard UPI deep-link URI
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`AskXpert Registration ${registrationData.name}`)}`;

  // Generate dynamic QR code according to the criteria and calculated fee
  useEffect(() => {
    QRCode.toDataURL(upiDeepLink, {
      width: 320,
      margin: 2,
      color: {
        dark: '#064e3b', // Deep emerald
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        setQrCodeUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate UPI QR code:', err);
      });
  }, [upiDeepLink]);

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

  // Copy UPI ID to clipboard
  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId).then(() => {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    });
  };

  // Client-side image compression for photo upload
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPG, or WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          setScreenshot(compressedDataUrl);
          setScreenshotName(file.name);
          setError(null);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  // Common completion handler that dispatches to Firestore and Google Sheets Webhook
  const saveRegistrationAndFinish = async (
    paymentMethod: 'razorpay' | 'upi_qr',
    transactionId: string | undefined,
    status: 'verified' | 'pending',
    screenshotDataUrl?: string
  ) => {
    const emailClean = registrationData.email.trim().toLowerCase();
    const docRef = doc(db, 'registrations', emailClean);
    const ticketId = generateTicketId();

    const finalPayload: Registration = {
      ...registrationData,
      ticketId,
      createdAt: serverTimestamp(),
      ...(transactionId ? { transactionId: transactionId.trim() } : {}),
      paymentStatus: status,
      paymentMethod,
      amount,
      ...(screenshotDataUrl ? { screenshot: screenshotDataUrl } : {}),
    };

    // Clean undefined properties for Firestore
    const cleanPayload: Record<string, any> = {};
    Object.entries(finalPayload).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanPayload[key] = value;
      }
    });

    // 1. Write registration to Firestore
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
          paymentStatus: status,
          paymentMethod: paymentMethod === 'razorpay' ? 'Razorpay' : 'UPI QR',
          amount: amount,
          transactionId: transactionId ? transactionId.trim() : 'N/A (Screenshot Uploaded)',
          hasScreenshot: Boolean(screenshotDataUrl),
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
          .then(() => console.log('Successfully dispatched payload to Google Sheets'))
          .catch(err => console.error('Silent Google Sheets fetch error:', err));
      } catch (sheetsErr) {
        console.error('Error triggering Google Sheets integration:', sheetsErr);
      }
    }

    // 3. Automatically redirect to the ticket page with WhatsApp group card!
    onSuccess(emailClean);
  };

  // --- RAZORPAY FLOW ---
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

  const handleProceedToRazorpay = async () => {
    setLoading(true);
    setError(null);

    const emailClean = registrationData.email.trim().toLowerCase();

    // Check duplicate registration first
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

    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      setError('Could not connect to Razorpay gateway. Please check your network connection or choose UPI QR.');
      setLoading(false);
      return;
    }

    // @ts-ignore
    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TTWhBVZABEJn8e';

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
        color: '#064e3b',
      },
      modal: {
        ondismiss: () => {
          setLoading(false);
        },
        escape: true,
        backdropclose: false,
      },
      handler: async (response: { razorpay_payment_id: string }) => {
        if (response && response.razorpay_payment_id) {
          try {
            await saveRegistrationAndFinish('razorpay', response.razorpay_payment_id, 'verified');
          } catch (err) {
            handleFirestoreError(err, 'write', `registrations/${registrationData.email}`);
            setError('Payment was received, but saving to database failed. Please contact support with ID: ' + response.razorpay_payment_id);
            setLoading(false);
          }
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
      setError('Unable to open Razorpay payment modal. Please try UPI QR option or refresh.');
      setLoading(false);
    }
  };

  // --- MANUAL UPI QR FLOW ---
  const handleProceedToQrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const emailClean = registrationData.email.trim().toLowerCase();

    if (!screenshot) {
      setError('Please upload a screenshot photo of your completed UPI payment.');
      setLoading(false);
      return;
    }

    try {
      // Check duplicate registration
      const docRef = doc(db, 'registrations', emailClean);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setError('This email address is already registered. Click the link below to view your active Entry Pass.');
        setShowLookupLink(true);
        setLoading(false);
        return;
      }

      await saveRegistrationAndFinish('upi_qr', undefined, 'pending', screenshot);
    } catch (err) {
      handleFirestoreError(err, 'write', `registrations/${registrationData.email}`);
      setError('Failed to submit registration. Please verify your internet connection and try again.');
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

        {/* Back navigation */}
        {mode === 'select' ? (
          <button
            onClick={onBack}
            disabled={loading}
            className="flex items-center space-x-1 text-xs text-emerald-800 hover:text-emerald-950 font-semibold mb-4 transition-colors cursor-pointer disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Delegate Details</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setMode('select');
              setError(null);
            }}
            disabled={loading}
            className="flex items-center space-x-1 text-xs text-emerald-800 hover:text-emerald-950 font-semibold mb-4 transition-colors cursor-pointer disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Change Payment Method</span>
          </button>
        )}

        {/* Shared Delegate & Pricing Summary */}
        <div className="bg-emerald-950/5 border border-emerald-900/10 p-4 rounded-xl space-y-2.5 mb-5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-emerald-900/70 font-sans">Delegate Name:</span>
            <span className="font-serif italic font-bold text-emerald-950 text-sm truncate max-w-[200px]">
              {registrationData.name}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-emerald-900/70 font-sans">Category / Member Criteria:</span>
            <span className="font-mono font-bold text-[11px] text-emerald-900 uppercase">
              {isProfessional ? 'PROFESSIONAL' : 'STUDENT'}{' '}
              {isIeee ? '• IEEE MEMBER' : '• NON-MEMBER'}
            </span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-emerald-950/10">
            <span className="text-emerald-950 font-display font-bold text-xs uppercase tracking-wider">
              Payable Registration Fee:
            </span>
            <div className="text-right">
              <span className="text-2xl font-mono font-black text-emerald-900">₹{amount}.00</span>
              <span className="text-[10px] text-emerald-800/60 block font-mono">One-time entry fee</span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODE 1: CHOOSE PAYMENT METHOD SCREEN                        */}
        {/* ============================================================ */}
        {mode === 'select' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="text-center pb-2">
              <h3 className="font-display font-bold text-lg text-emerald-950 tracking-tight">
                Select Payment Method
              </h3>
              <p className="text-xs text-emerald-900/70 mt-0.5">
                Choose how you would like to complete your registration payment
              </p>
            </div>

            {/* Option A: Razorpay */}
            <button
              type="button"
              onClick={() => setMode('razorpay')}
              className="w-full text-left p-4 rounded-xl border-2 border-emerald-900/20 hover:border-emerald-800 bg-white hover:bg-emerald-50/50 transition-all duration-300 group shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-900/10 text-emerald-900 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Zap className="w-5 h-5 text-emerald-800" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-display font-bold text-sm text-emerald-950">
                        Razorpay Online Gateway
                      </h4>
                      <span className="bg-emerald-100 text-emerald-900 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full">
                        Instant
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-950/70 mt-1 leading-relaxed">
                      UPI apps (GPay, PhonePe, Paytm), Debit/Credit Cards, Net Banking & Wallets.
                    </p>
                    <div className="flex items-center space-x-2 mt-2 text-[10px] text-emerald-800 font-mono font-semibold">
                      <span>✓ Immediate automatic pass release</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-800 group-hover:translate-x-0.5 transition-transform flex-shrink-0 mt-2" />
              </div>
            </button>

            {/* Option B: QR Code / UPI ID */}
            <button
              type="button"
              onClick={() => setMode('qr')}
              className="w-full text-left p-4 rounded-xl border-2 border-emerald-900/20 hover:border-emerald-800 bg-white hover:bg-emerald-50/50 transition-all duration-300 group shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-900/10 text-emerald-900 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <QrCode className="w-5 h-5 text-emerald-800" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-display font-bold text-sm text-emerald-950">
                        UPI QR Code & Manual Transfer
                      </h4>
                      <span className="bg-amber-100 text-amber-900 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full">
                        QR / UPI ID
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-950/70 mt-1 leading-relaxed">
                      Auto-generated dynamic QR code matching your criteria fee (₹{amount}.00). Upload payment screenshot photo.
                    </p>
                    <div className="flex items-center space-x-2 mt-2 text-[10px] text-emerald-800 font-mono font-semibold">
                      <span>✓ Direct UPI transfer • Photo proof upload</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-800 group-hover:translate-x-0.5 transition-transform flex-shrink-0 mt-2" />
              </div>
            </button>

            <div className="flex items-center justify-center space-x-2 text-[11px] text-emerald-900/60 pt-3">
              <ShieldCheck className="w-4 h-4 text-emerald-800" />
              <span>Both methods grant verified entry passes & WhatsApp group access</span>
            </div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* MODE 2: RAZORPAY GATEWAY CHECKOUT SCREEN                     */}
        {/* ============================================================ */}
        {mode === 'razorpay' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center space-x-2.5 mb-2 border-b border-emerald-950/5 pb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-900/10 flex items-center justify-center text-emerald-900">
                <Zap className="w-4 h-4 text-emerald-800" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-emerald-950 tracking-tight leading-none">
                  Razorpay Online Checkout
                </h3>
                <p className="text-[11px] text-emerald-900/60 font-sans mt-0.5">
                  Instant automated entry pass generation
                </p>
              </div>
            </div>

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

            {/* Error alerts */}
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

            <button
              type="button"
              onClick={handleProceedToRazorpay}
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
              Upon successful payment, you will be redirected to your ticket and the WhatsApp group.
            </p>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* MODE 3: AUTO QR GENERATION & MANUAL UPI TRANSFER SCREEN     */}
        {/* ============================================================ */}
        {mode === 'qr' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-5"
          >
            <div className="flex items-center space-x-2.5 border-b border-emerald-950/5 pb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-900/10 flex items-center justify-center text-emerald-900">
                <QrCode className="w-4 h-4 text-emerald-800" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-emerald-950 tracking-tight leading-none">
                  UPI QR Code Payment
                </h3>
                <p className="text-[11px] text-emerald-900/60 font-sans mt-0.5">
                  Scan the auto-generated QR code or transfer to the UPI ID
                </p>
              </div>
            </div>

            {/* Dynamic QR Code Card */}
            <div className="bg-white border border-emerald-950/10 rounded-2xl p-5 flex flex-col items-center text-center space-y-3 shadow-sm">
              <div className="relative p-2 bg-emerald-950/5 border border-emerald-900/10 rounded-xl">
                {qrCodeUrl ? (
                  <img 
                    src={qrCodeUrl} 
                    alt={`UPI QR Code for ₹${amount}.00`} 
                    className="w-48 h-48 md:w-52 md:h-52 rounded-lg object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-800" />
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-emerald-900 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded-md shadow-sm">
                  ₹{amount}.00
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-sans font-semibold text-emerald-950">
                  Scan using any UPI App
                </span>
                <p className="text-[10px] text-emerald-900/60 font-sans">
                  Google Pay • PhonePe • Paytm • BHIM • Cred UPI
                </p>
              </div>
            </div>

            {/* Official UPI ID Copy Section */}
            <div className="bg-emerald-950/5 border border-emerald-900/10 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[11px] font-mono font-bold uppercase text-emerald-950/70">
                  Official Event UPI ID
                </span>
                <span className="text-[10px] font-mono text-emerald-800">
                  Payee: {payeeName}
                </span>
              </div>

              <div className="flex items-center justify-between bg-white border border-emerald-950/10 rounded-lg p-2.5">
                <span className="font-mono font-bold text-sm text-emerald-950 select-all tracking-wide">
                  {upiId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="flex items-center space-x-1 bg-emerald-900 hover:bg-emerald-950 text-white text-[10px] font-mono font-bold px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                >
                  {copiedUpi ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-300" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy UPI ID</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Verification Form: Photo Upload */}
            <form onSubmit={handleProceedToQrSubmit} className="space-y-4 pt-1">
              {/* Photo Upload Option */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 flex items-center justify-between">
                  <span>Upload Payment Screenshot Photo *</span>
                  <span className="text-[10px] text-emerald-800/60 font-mono font-normal">JPG / PNG / WEBP</span>
                </label>

                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                {!screenshot ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                      isDragging 
                        ? 'border-emerald-800 bg-emerald-50' 
                        : 'border-emerald-950/20 hover:border-emerald-800/60 bg-white hover:bg-emerald-50/30'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-900/10 flex items-center justify-center text-emerald-900 mb-2">
                      <UploadCloud className="w-5 h-5 text-emerald-800" />
                    </div>
                    <span className="text-xs font-bold text-emerald-950 font-sans">
                      Click to choose photo or drag & drop here
                    </span>
                    <span className="text-[10px] text-emerald-900/60 mt-0.5">
                      Upload clear receipt showing ₹{amount}.00 & date
                    </span>
                  </div>
                ) : (
                  <div className="bg-white border border-emerald-950/15 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <img 
                        src={screenshot} 
                        alt="Uploaded Screenshot Preview" 
                        className="w-12 h-12 object-cover rounded-lg border border-emerald-950/10 flex-shrink-0"
                      />
                      <div className="truncate">
                        <span className="text-xs font-bold text-emerald-950 block truncate font-sans">
                          {screenshotName || 'payment-screenshot.jpg'}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-mono flex items-center space-x-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Photo ready for verification</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] text-emerald-800 hover:text-emerald-950 underline font-semibold px-2 py-1 cursor-pointer"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScreenshot(null);
                          setScreenshotName('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="p-1 text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        aria-label="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Error box */}
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

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-900 hover:bg-emerald-950 text-[#FAF9F5] font-display font-bold text-sm tracking-wider py-3.5 px-4 rounded-xl cursor-pointer transition-all duration-300 shadow-lg shadow-emerald-900/15 hover:shadow-emerald-900/25 active:scale-[0.99] flex items-center justify-center space-x-2 disabled:bg-emerald-950/40 disabled:cursor-not-allowed uppercase mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>Submitting Registration...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4.5 h-4.5" />
                    <span>Submit & Generate Delegate Pass</span>
                  </>
                )}
              </button>

              <p className="text-[10px] font-mono text-emerald-800/60 text-center select-none">
                After submission, your entry pass and official WhatsApp group access will be opened immediately.
              </p>
            </form>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
