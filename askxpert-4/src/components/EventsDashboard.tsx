import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Plus, 
  Trash2, 
  Sparkles, 
  X, 
  Layers, 
  AlertCircle, 
  CheckCircle,
  Database,
  ArrowRight,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

interface EventItem {
  id: string;
  title: string;
  description: string;
  type: 'active' | 'upcoming' | 'past';
  date: string;
  time: string;
  venue: string;
  speaker?: string;
  speakerTitle?: string;
  category?: string;
  poster?: string;
}

interface EventsDashboardProps {
  onRegisterClick: () => void;
}

// Compact helper to scale down loaded images to keep database storage size lightweight
const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75)); // 75% quality JPEG compress
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

export const EventsDashboard: React.FC<EventsDashboardProps> = ({ onRegisterClick }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [seeding, setSeeding] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'active' | 'past'>('active');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [speakerTitle, setSpeakerTitle] = useState('');
  const [category, setCategory] = useState('Interactive Talk');
  const [poster, setPoster] = useState('');
  const [posterInputType, setPosterInputType] = useState<'upload' | 'url'>('upload');
  const [dragActive, setDragActive] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const categories = [
    'Interactive Talk',
    'Workshop',
    'Podcast Session',
    'Panel Discussion',
    'Career Boot Camp',
    'Tech Webinar'
  ];

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents: EventItem[] = [];
      snapshot.forEach((docSnap) => {
        fetchedEvents.push({
          id: docSnap.id,
          ...docSnap.data()
        } as EventItem);
      });
      setEvents(fetchedEvents);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching events:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        try {
          const compressed = await compressImage(result);
          setPoster(compressed);
        } catch (err) {
          console.error("Error compressing image:", err);
          setPoster(result); // Fallback to raw base64 if compression fails
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim() || !description.trim() || !date.trim() || !venue.trim()) {
      setError('Please fill in all required fields (Title, Description, Date, Venue).');
      return;
    }

    try {
      const newEvent = {
        title: title.trim(),
        description: description.trim(),
        type,
        date: date.trim(),
        time: time.trim(),
        venue: venue.trim(),
        speaker: speaker.trim() || null,
        speakerTitle: speakerTitle.trim() || null,
        category: category,
        poster: poster.trim() || null,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'events'), newEvent);
      setSuccess('Event added successfully!');
      
      // Reset form
      setTitle('');
      setDescription('');
      setType('active');
      setDate('');
      setTime('');
      setVenue('');
      setSpeaker('');
      setSpeakerTitle('');
      setCategory('Interactive Talk');
      setPoster('');
      
      // Close form with small delay
      setTimeout(() => {
        setShowAddForm(false);
        setSuccess(null);
      }, 1000);
    } catch (err: any) {
      console.error("Error adding event:", err);
      setError(err.message || 'Failed to add event to database.');
    }
  };

  const handleDeleteEvent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'events', id));
    } catch (err) {
      console.error("Error deleting event:", err);
      alert('Failed to delete event.');
    }
  };

  const seedSampleEvents = async () => {
    setSeeding(true);
    setError(null);
    try {
      const samples = [
        {
          title: "AskXpert #5: Entering High-Scale Tech & Product Management",
          description: "An interactive, unscripted session with a Senior Product Manager at Google. Discover how to transition from university engineering to top-tier tech roles, master product architecture, and build exceptional portfolios.",
          type: "active",
          date: "July 18, 2026",
          time: "6:00 PM IST",
          venue: "Google Meet (Live Interactive Stream)",
          speaker: "Siddharth Mehta",
          speakerTitle: "Senior Product Manager at Google, CEK Alumnus",
          category: "Interactive Talk",
          poster: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&auto=format&fit=crop&q=80",
          createdAt: serverTimestamp()
        },
        {
          title: "IEEE CEK Resume Roast & Portfolio Auditing Clinic",
          description: "Submit your GitHub profiles and resume drafts for a live, constructive review with industry recruiting experts. Learn the exact keywords that pass ATS screening.",
          type: "active",
          date: "August 02, 2026",
          time: "4:00 PM IST",
          venue: "Main Seminar Hall, CE Kidangoor",
          speaker: "Amal Sebastian",
          speakerTitle: "Lead Talent Acquisition at TechCorp",
          category: "Workshop",
          poster: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1000&auto=format&fit=crop&q=80",
          createdAt: serverTimestamp()
        },
        {
          title: "AskXpert #4: Building for the Decentralized Web & Web3",
          description: "Delved into the fundamentals of blockchain, smart contract security, and decentralized file systems. The session concluded with a live Q&A about future global careers in decentralized tech.",
          type: "past",
          date: "June 25, 2026",
          time: "5:30 PM IST",
          venue: "Virtual Session",
          speaker: "Dr. Elena Rostova",
          speakerTitle: "Principal Web3 Architect & Cryptographer",
          category: "Podcast Session",
          poster: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1000&auto=format&fit=crop&q=80",
          createdAt: serverTimestamp()
        }
      ];

      for (const sample of samples) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await addDoc(collection(db, 'events'), sample);
      }
      setSuccess('Successfully pre-seeded 3 realistic sample events!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error seeding events:", err);
      setError('Seeding failed: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  const activeEvents = events.filter(e => e.type === 'active' || e.type === 'upcoming');
  const pastEvents = events.filter(e => e.type === 'past');

  return (
    <div id="events-dashboard-container" className="w-full space-y-12">
      {/* Admin: Create Event Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-5 md:p-8 rounded-xl border-2 border-dashed border-emerald-950/20 bg-emerald-950/[0.02] shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-950/5">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-emerald-900" />
                  <span className="text-xs md:text-sm font-mono font-bold text-emerald-950 uppercase tracking-wider">
                    Create Event Form
                  </span>
                </div>
                <button 
                  onClick={() => setShowAddForm(false)} 
                  className="text-emerald-950/60 hover:text-emerald-950 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <div className="flex items-start space-x-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-start space-x-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleAddEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm text-emerald-950">
                {/* Title */}
                <div className="md:col-span-2 flex flex-col space-y-1">
                  <span className="font-mono text-xs text-emerald-950/60">Event Title *</span>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. AskXpert #5: Demystifying Artificial Intelligence"
                    className="px-3 py-2 border border-emerald-950/10 rounded-lg bg-[#FAF9F5] focus:outline-none focus:border-emerald-950 font-sans"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2 flex flex-col space-y-1">
                  <span className="font-mono text-xs text-emerald-950/60">Description *</span>
                  <textarea
                    required
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A descriptive paragraph outlining topics, expected takeaways, etc."
                    className="px-3 py-2 border border-emerald-950/10 rounded-lg bg-[#FAF9F5] focus:outline-none focus:border-emerald-950 font-sans resize-none"
                  />
                </div>

                {/* Type Classification */}
                <div className="flex flex-col space-y-1">
                  <span className="font-mono text-xs text-emerald-950/60">Event Status / Category *</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(['active', 'past'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`py-2 rounded-lg border text-xs font-mono capitalize transition-all cursor-pointer ${
                          type === t 
                            ? 'bg-emerald-950 border-emerald-950 text-[#FAF9F5] font-bold' 
                            : 'border-emerald-950/10 bg-[#FAF9F5] text-emerald-950/80 hover:bg-emerald-950/5'
                        }`}
                      >
                        {t === 'active' ? 'Active' : 'Past'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category Visual Label */}
                <div className="flex flex-col space-y-1">
                  <span className="font-mono text-xs text-emerald-950/60">Event Genre / Theme *</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="px-3 py-2 border border-emerald-950/10 rounded-lg bg-[#FAF9F5] focus:outline-none focus:border-emerald-950 font-sans h-9 md:h-10"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div className="flex flex-col space-y-1">
                  <span className="font-mono text-xs text-emerald-950/60">Event Date *</span>
                  <input
                    type="text"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    placeholder="e.g. July 24, 2026 or Saturday, Aug 1"
                    className="px-3 py-2 border border-emerald-950/10 rounded-lg bg-[#FAF9F5] focus:outline-none focus:border-emerald-950 font-sans"
                  />
                </div>

                {/* Time */}
                <div className="flex flex-col space-y-1">
                  <span className="font-mono text-xs text-emerald-950/60">Time</span>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="e.g. 5:30 PM IST"
                    className="px-3 py-2 border border-emerald-950/10 rounded-lg bg-[#FAF9F5] focus:outline-none focus:border-emerald-950 font-sans"
                  />
                </div>

                {/* Venue */}
                <div className="flex flex-col space-y-1">
                  <span className="font-mono text-xs text-emerald-950/60">Venue / Location *</span>
                  <input
                    type="text"
                    required
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. CEK Seminar Hall, Google Meet, etc."
                    className="px-3 py-2 border border-emerald-950/10 rounded-lg bg-[#FAF9F5] focus:outline-none focus:border-emerald-950 font-sans"
                  />
                </div>

                {/* Speaker */}
                <div className="flex flex-col space-y-1">
                  <span className="font-mono text-xs text-emerald-950/60">Speaker Name</span>
                  <input
                    type="text"
                    value={speaker}
                    onChange={(e) => setSpeaker(e.target.value)}
                    placeholder="e.g. Dr. Jane Doe"
                    className="px-3 py-2 border border-emerald-950/10 rounded-lg bg-[#FAF9F5] focus:outline-none focus:border-emerald-950 font-sans"
                  />
                </div>

                {/* Speaker Designation */}
                <div className="md:col-span-2 flex flex-col space-y-1">
                  <span className="font-mono text-xs text-emerald-950/60">Speaker Credentials / Designation</span>
                  <input
                    type="text"
                    value={speakerTitle}
                    onChange={(e) => setSpeakerTitle(e.target.value)}
                    placeholder="e.g. Lead Machine Learning Engineer at Meta, CEK Alumna"
                    className="px-3 py-2 border border-emerald-950/10 rounded-lg bg-[#FAF9F5] focus:outline-none focus:border-emerald-950 font-sans"
                  />
                </div>

                {/* Poster Image Section */}
                <div className="md:col-span-2 flex flex-col space-y-2 border-t border-emerald-950/5 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-emerald-950/80">Event Poster / Cover Image</span>
                    <div className="flex space-x-1 bg-emerald-950/5 p-0.5 rounded-lg border border-emerald-950/5 text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={() => setPosterInputType('upload')}
                        className={`px-2 py-1 rounded transition-all cursor-pointer ${posterInputType === 'upload' ? 'bg-emerald-950 text-[#FAF9F5] font-bold' : 'text-emerald-950/60 hover:text-emerald-950'}`}
                      >
                        File Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => setPosterInputType('url')}
                        className={`px-2 py-1 rounded transition-all cursor-pointer ${posterInputType === 'url' ? 'bg-emerald-950 text-[#FAF9F5] font-bold' : 'text-emerald-950/60 hover:text-emerald-950'}`}
                      >
                        Image URL
                      </button>
                    </div>
                  </div>

                  {posterInputType === 'upload' ? (
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 text-center cursor-pointer select-none transition-all ${
                          dragActive
                            ? 'border-emerald-950 bg-emerald-950/10'
                            : 'border-emerald-950/15 bg-emerald-950/[0.01] hover:bg-emerald-950/[0.03]'
                        }`}
                        onClick={() => document.getElementById('poster-file-input')?.click()}
                      >
                        <input
                          id="poster-file-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        <Upload className="w-6 h-6 text-emerald-900/60 mb-1" />
                        <span className="font-mono text-xs font-semibold text-emerald-950">
                          Drag & drop event poster
                        </span>
                        <span className="text-[10px] text-emerald-950/60 mt-0.5">
                          or click to browse from system
                        </span>
                      </div>

                      {poster && (
                        <div className="shrink-0 flex flex-col items-center space-y-1.5 relative">
                          <span className="font-mono text-[9px] text-emerald-950/60">Live Preview</span>
                          <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-emerald-950/20 group">
                            <img
                              src={poster}
                              alt="Poster preview"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              type="button"
                              onClick={() => setPoster('')}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                              title="Remove Poster"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-3 items-center">
                      <div className="flex-grow flex flex-col space-y-1">
                        <input
                          type="text"
                          value={poster}
                          onChange={(e) => setPoster(e.target.value)}
                          placeholder="e.g. https://images.unsplash.com/... or any static image link"
                          className="px-3 py-2 border border-emerald-950/10 rounded-lg bg-[#FAF9F5] focus:outline-none focus:border-emerald-950 font-sans"
                        />
                      </div>
                      {poster && (
                        <div className="shrink-0 relative w-10 h-10 rounded-lg overflow-hidden border border-emerald-950/10">
                          <img
                            src={poster}
                            alt="Poster preview"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit button */}
                <div className="md:col-span-2 flex justify-end pt-3">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-950 text-[#FAF9F5] font-mono text-xs font-semibold rounded-lg hover:bg-emerald-900 active:scale-98 transition-all cursor-pointer"
                  >
                    Submit Event Announcement
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-950/10 border-t-emerald-950 rounded-full animate-spin"></div>
          <span className="font-mono text-xs text-emerald-950/60">Synchronizing live events...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && events.length === 0 && (
        <div className="text-center py-16 border border-dashed border-emerald-950/10 rounded-xl bg-emerald-950/[0.01]">
          <Calendar className="w-10 h-10 text-emerald-950/30 mx-auto mb-4" />
          <h3 className="font-serif italic font-bold text-lg text-emerald-950/80">
            No Events Published
          </h3>
          <p className="text-xs text-emerald-950/60 max-w-sm mx-auto mt-1 mb-5">
            There are currently no active, upcoming, or past events listed in the database.
          </p>
          {/* Seeder button hidden */}
        </div>
      )}

      {/* Main Content Layout */}
      {!loading && events.length > 0 && (
        <div className="space-y-12">
          
          {/* SECTION 1: ACTIVE / CURRENT / SPOTLIGHT EVENTS */}
          {activeEvents.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 border-b border-emerald-950/5 pb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-950/30" />
                <h3 className="font-mono text-xs font-extrabold uppercase tracking-widest text-emerald-950/60">
                  Events (Registration Closed)
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {activeEvents.map((event) => (
                  <div
                    key={event.id}
                    className="relative rounded-2xl border-2 border-emerald-950 bg-emerald-950 text-[#FAF9F5] p-6 md:p-8 overflow-hidden group select-none shadow-md"
                  >
                    {/* Background faint sparkle decorative overlay */}
                    <div className="absolute top-4 right-4 text-[#FAF9F5]/5 pointer-events-none group-hover:scale-110 transition-transform">
                      <Sparkles className="w-32 h-32" />
                    </div>

                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center">
                      {event.poster && (
                        <div className="md:col-span-4 lg:col-span-3 shrink-0 flex flex-col space-y-4">
                          <div className="aspect-[3/4] w-full rounded-xl overflow-hidden border border-[#FAF9F5]/10 shadow-lg relative bg-[#FAF9F5]/5">
                            <img
                              src={event.poster}
                              alt={event.title}
                              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          {/* Changed to Registration Closed */}
                          <button
                            disabled
                            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-[#FAF9F5]/10 text-[#FAF9F5]/50 border border-[#FAF9F5]/10 font-mono text-xs font-bold cursor-not-allowed select-none"
                          >
                            <span>Registration Closed</span>
                          </button>
                        </div>
                      )}

                      <div className={`${event.poster ? 'md:col-span-8 lg:col-span-9' : 'md:col-span-12'} flex flex-col lg:flex-row lg:items-center justify-between gap-6`}>
                        <div className="space-y-4 max-w-3xl flex-grow">
                          <div className="flex items-center space-x-2">
                            {/* Event Category Tag */}
                            <div className="inline-block px-2.5 py-1 rounded-md bg-[#FAF9F5]/10 border border-[#FAF9F5]/10 font-mono text-[9px] font-bold uppercase tracking-widest">
                              {event.category || 'Spotlight Session'}
                            </div>
                            <div className="inline-block px-2.5 py-1 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono text-[9px] font-bold uppercase tracking-widest">
                              Registration Closed
                            </div>
                          </div>

                          {/* Title */}
                          <h4 className="text-xl md:text-3xl font-serif italic font-bold tracking-tight text-[#FAF9F5] leading-tight">
                            {event.title}
                          </h4>

                          {/* Description */}
                          <p className="text-xs md:text-sm text-[#FAF9F5]/80 font-sans leading-relaxed">
                            {event.description}
                          </p>

                          {/* Meta Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-mono text-[11px] text-[#FAF9F5]/70">
                            {event.speaker && (
                              <div className="flex items-center space-x-2">
                                <User className="w-3.5 h-3.5 text-[#FAF9F5]/60 shrink-0" />
                                <span>
                                  <strong className="text-[#FAF9F5]">{event.speaker}</strong>
                                  {event.speakerTitle && ` (${event.speakerTitle})`}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center space-x-2">
                              <Calendar className="w-3.5 h-3.5 text-[#FAF9F5]/60 shrink-0" />
                              <span>{event.date} {event.time && `| ${event.time}`}</span>
                            </div>
                            <div className="flex items-center space-x-2 sm:col-span-2">
                              <MapPin className="w-3.5 h-3.5 text-[#FAF9F5]/60 shrink-0" />
                              <span>{event.venue}</span>
                            </div>
                          </div>
                        </div>

                        {/* Fallback button if poster doesn't exist */}
                        {!event.poster && (
                          <div className="flex flex-row lg:flex-col items-center gap-3 shrink-0 self-start lg:self-center">
                            <button
                              disabled
                              className="flex items-center justify-center space-x-2.5 px-6 py-3.5 rounded-xl bg-[#FAF9F5]/10 text-[#FAF9F5]/50 border border-[#FAF9F5]/10 font-mono text-xs font-bold cursor-not-allowed select-none"
                            >
                              <span>Registration Closed</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* SECTION 3: ENDED / PAST EVENTS */}
          {pastEvents.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 border-b border-emerald-950/5 pb-2">
                <h3 className="font-mono text-xs font-extrabold uppercase tracking-widest text-emerald-950/60">
                  Ended Events / Archives
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {pastEvents.map((event) => (
                  <div
                    key={event.id}
                    className="group rounded-xl border border-emerald-950/5 bg-[#FAF9F5]/40 opacity-85 hover:opacity-100 overflow-hidden transition-all hover:bg-[#FAF9F5] flex flex-col justify-between"
                  >
                    {event.poster && (
                      <div className="w-full p-3 bg-emerald-950/5 border-b border-emerald-950/5 relative">
                        <div className="w-full h-36 overflow-hidden rounded-lg relative">
                          <img 
                            src={event.poster} 
                            alt={event.title} 
                            className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-500"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    )}

                    <div className="p-5 flex-grow flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[8px] text-emerald-900/60 font-semibold uppercase tracking-widest">
                            Completed • {event.category || 'Archive'}
                          </span>
                        </div>

                        <h4 className="text-sm font-serif italic font-bold text-emerald-950 leading-snug">
                          {event.title}
                        </h4>

                        <p className="text-xs text-emerald-950/60 font-sans leading-relaxed">
                          {event.description}
                        </p>
                      </div>

                      <div className="border-t border-emerald-950/5 pt-3 mt-3 font-mono text-[9px] text-emerald-800/70 space-y-1">
                        {event.speaker && (
                          <div className="flex items-center space-x-1.5">
                            <User className="w-3.5 h-3.5 text-emerald-950/30 shrink-0" />
                            <span className="truncate">{event.speaker}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-950/30 shrink-0" />
                          <span>{event.date}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
