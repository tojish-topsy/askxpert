import React, { useState, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Copy, ArrowLeft, Loader2, AlertCircle, ShieldCheck, CreditCard, QrCode, Lock, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Registration, FirestoreErrorInfo } from '../types';

interface PaymentPageProps {
  registrationData: Omit<Registration, 'ticketId' | 'createdAt' | 'transactionId' | 'paymentStatus'>;
  onBack: () => void;
  onSuccess: (email: string) => void;
}

export const PaymentPage: React.FC<PaymentPageProps> = ({ registrationData, onBack, onSuccess }) => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<'upi' | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showLookupLink, setShowLookupLink] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isIeee = registrationData.ieeeStatus === 'member';
  const isProfessional = registrationData.roleType === 'professional';
  
  // Calculate specific pricing based on the role and IEEE membership combination
  const amount = isProfessional 
    ? (isIeee ? 10 : 30) 
    : (isIeee ? 10 : 30);
  
  const upiId = 'paytm.s1wsfli@pty';

  const handleCopy = (text: string, type: 'upi') => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

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

  // Helper to generate elegant high-contrast ticket ID (e.g., AX-73F9)
  const generateTicketId = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars like 0, 1, O, I
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `AX-${code}`;
  };

  // File processing helper with automatic canvas resizing and compression
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, or JPEG).');
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Resize if exceeds 1024px in any dimension
            const MAX_DIM = 1024;
            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('Could not get 2D context');
            }

            // Draw image on canvas
            ctx.drawImage(img, 0, 0, width, height);

            // Export as compressed JPEG (0.7 quality)
            // This compresses the image significantly (typically 40KB - 120KB),
            // which safely and easily fits within Firestore's 1MB document size limit
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            
            // Safety check for Firestore document size (1MB limit)
            const estimatedSize = compressedBase64.length * 0.75;
            if (estimatedSize > 800 * 1024) { // 800KB safety threshold
              setError('The uploaded image is too large even after compression. Please try a simpler or smaller screenshot.');
              setScreenshot(null);
            } else {
              setScreenshot(compressedBase64);
              setError(null);
            }
          } catch (err) {
            console.error('Image compression error:', err);
            // Fallback to original if compression fails and it's small enough
            const originalBase64 = e.target?.result as string;
            if (originalBase64.length * 0.75 < 800 * 1024) {
              setScreenshot(originalBase64);
              setError(null);
            } else {
              setError('The payment screenshot is too large. Please upload a smaller image or crop it.');
            }
          } finally {
            setLoading(false);
          }
        };
        img.onerror = () => {
          setError('Failed to process the uploaded image.');
          setLoading(false);
        };
        img.src = e.target.result as string;
      } else {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Error reading file.');
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeScreenshot = () => {
    setScreenshot(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!screenshot) {
      setError('Please upload your payment screenshot to complete registration.');
      setLoading(false);
      return;
    }

    try {
      const emailClean = registrationData.email.trim().toLowerCase();
      
      // Check duplicate registration (Email-uniqueness check)
      const docRef = doc(db, 'registrations', emailClean);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setError('This email address is already registered. Click the link below to view your active Entry Pass.');
        setShowLookupLink(true);
        setLoading(false);
        return;
      }

      const ticketId = generateTicketId();

      const finalPayload: Registration = {
        ...registrationData,
        ticketId,
        createdAt: serverTimestamp(),
        screenshot: screenshot,
        paymentStatus: 'pending', // Verification pending by organizers
      };

      // Clean undefined properties to prevent Firestore from throwing an error
      const cleanPayload: Record<string, any> = {};
      Object.entries(finalPayload).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanPayload[key] = value;
        }
      });

      // Write to database
      await setDoc(docRef, cleanPayload);

      // Trigger Google Sheets Webhook if Apps Script URL is configured in environment
      // @ts-ignore
      const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
      if (scriptUrl) {
        try {
          const sheetsPayload = {
            ticketId,
            name: registrationData.name,
            email: emailClean,
            phone: registrationData.phone,
            ieeeStatus: registrationData.ieeeStatus,
            ieeeId: registrationData.ieeeId || 'N/A',
            college: registrationData.college,
            department: registrationData.department,
            yearOfStudy: registrationData.yearOfStudy,
            roleType: registrationData.roleType || 'student',
            paymentStatus: 'pending',
            amount: amount,
            timestamp: new Date().toISOString()
          };

          fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(sheetsPayload),
          }).catch(err => console.error('Silent Google Sheets fetch error:', err));
        } catch (sheetsErr) {
          console.error('Error triggering Google Sheets integration:', sheetsErr);
        }
      }

      // Trigger callback to show the ticket!
      onSuccess(emailClean);
    } catch (err) {
      handleFirestoreError(err, 'write', `registrations/${registrationData.email}`);
      setError('Could not register details. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-[#FAF9F5]/90 border border-emerald-950/10 p-6 md:p-8 rounded-2xl shadow-xl shadow-emerald-950/5 backdrop-blur-md relative"
      >
        {/* Visual corner highlights */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-900/30 rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-900/30 rounded-br-2xl" />

        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center space-x-1 text-xs text-emerald-800 hover:text-emerald-950 font-semibold mb-4 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
          <span>Back to Delegate Details</span>
        </button>

        <div className="flex items-center space-x-2.5 mb-5 border-b border-emerald-950/5 pb-4">
          <CreditCard className="w-5 h-5 text-amber-700 animate-pulse" />
          <div>
            <h3 className="font-display font-bold text-lg text-emerald-950 tracking-tight leading-none">
              Registration Fee Payment
            </h3>
          </div>
        </div>

        {/* Summary Banner */}
        <div className="bg-emerald-950/5 border border-emerald-900/10 p-4 rounded-xl mb-6 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-emerald-900/70 font-sans">Delegate:</span>
            <span className="font-serif italic font-bold text-emerald-950 text-sm">{registrationData.name}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-emerald-900/70 font-sans">Category / Member Status:</span>
            <span className="font-mono font-bold text-xs text-emerald-900 uppercase animate-fade-in">
              {isProfessional ? 'PROFESSIONAL' : 'STUDENT'}{' '}
              {isIeee ? `• IEEE MEMBER (ID: ${registrationData.ieeeId})` : '• NON-MEMBER'}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-emerald-950/10">
            <span className="text-emerald-950 font-display font-bold text-xs uppercase">Payable Amount:</span>
            <span className="text-lg font-mono font-black text-emerald-900">₹{amount}.00</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-6">
          
          {/* UPI Payment */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-mono tracking-widest text-emerald-900 uppercase flex items-center space-x-1.5 border-b border-emerald-950/5 pb-1">
              <QrCode className="w-3.5 h-3.5 text-emerald-800" />
              <span>Scan QR or Enter UPI ID to Pay</span>
            </h4>
            
            <div className="flex flex-col md:flex-row items-center gap-5 bg-white border border-emerald-950/5 p-4 rounded-xl">
              {/* QR Code */}
              <div className="w-28 h-28 bg-emerald-950/5 rounded-lg flex items-center justify-center p-1.5 border border-emerald-950/10 shadow-inner relative overflow-hidden select-none">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=IEEE%20SB%20CEK&am=${amount}&cu=INR`)}`}
                  alt="UPI QR Code"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* UPI ID Details */}
              <div className="space-y-2 text-center md:text-left flex-grow">
                <span className="text-[10px] text-emerald-800/60 font-mono uppercase block font-bold">UPI ID</span>
                <p className="font-mono font-bold text-sm text-emerald-950 bg-emerald-950/[0.03] border border-emerald-950/5 px-3 py-1.5 rounded-lg inline-flex items-center justify-between w-full">
                  <span>{upiId}</span>
                  <button
                    onClick={() => handleCopy(upiId, 'upi')}
                    className="p-1 hover:bg-emerald-900/10 rounded transition-colors text-emerald-900 cursor-pointer"
                    title="Copy UPI ID"
                  >
                    {copiedText === 'upi' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </p>
                <p className="text-[10px] text-emerald-800/70 leading-normal">
                  Open any UPI app (GPay, PhonePe, Paytm, BHIM), scan the QR code, or enter the UPI ID to transfer ₹{amount}.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Submission Form */}
        <form onSubmit={handleSubmit} className="mt-6 pt-5 border-t border-emerald-950/5 space-y-4">
          
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase flex items-center space-x-1.5">
              <Lock className="w-3 h-3 text-emerald-800" />
              <span>Upload Payment Screenshot</span>
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
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className={`w-full border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center space-y-2 ${
                  dragActive
                    ? 'border-emerald-800 bg-emerald-950/[0.03] scale-[0.98]'
                    : 'border-emerald-950/15 hover:border-emerald-800/50 hover:bg-emerald-950/[0.01]'
                }`}
              >
                <Upload className="w-8 h-8 text-emerald-800/50" />
                <div className="space-y-0.5">
                  <p className="text-xs font-sans font-semibold text-emerald-950">
                    Drag and drop your screenshot here
                  </p>
                  <p className="text-[10px] text-emerald-800/60 font-sans">
                    or click to browse from your device
                  </p>
                </div>
                <span className="text-[9px] text-emerald-800/40">
                  Supports JPEG, PNG, JPG (Max 2.5MB)
                </span>
              </div>
            ) : (
              <div className="relative border border-emerald-950/10 rounded-xl overflow-hidden bg-white p-3 flex items-center space-x-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-emerald-950/10 flex-shrink-0 bg-emerald-950/5 flex items-center justify-center">
                  <img
                    src={screenshot}
                    alt="Payment Screenshot Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-xs font-semibold text-emerald-950 truncate flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-800 flex-shrink-0" />
                    Payment Screenshot
                  </p>
                  <p className="text-[10px] text-emerald-800/60">
                    Ready to submit
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeScreenshot}
                  className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors cursor-pointer"
                  title="Remove Screenshot"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            )}
            
            <span className="text-[9px] text-emerald-800/70 leading-normal">
              * Please capture and upload the transaction success screen containing the UPI reference details.
            </span>
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

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-900 hover:bg-emerald-950 text-[#FAF9F5] font-display font-bold text-sm tracking-widest py-3 px-4 rounded-xl cursor-pointer transition-all duration-300 shadow-md shadow-emerald-900/10 flex items-center justify-center space-x-2 disabled:bg-emerald-950/40 disabled:cursor-not-allowed uppercase"
          >
            {loading ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                <span>Submitting Registration...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4.5 h-4.5" />
                <span>Upload & Complete Registration</span>
              </>
            )}
          </button>

          <p className="text-[9px] font-mono text-emerald-800/60 text-center select-none pt-1">
            Your pass will be generated immediately once you upload and submit your payment screenshot.
          </p>

        </form>
      </motion.div>
    </div>
  );
};
