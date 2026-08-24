import React, { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, AlertCircle, Loader2, ArrowRight, ArrowLeft, User, Mail, Phone, School, Briefcase, Globe, Info } from 'lucide-react';
import { FirestoreErrorInfo } from '../types';

interface RegisterFormProps {
  onRegisterProceed: (data: {
    name: string;
    email: string;
    phone: string;
    language?: 'English' | 'Malayalam';
    ieeeStatus: 'member' | 'non-member';
    ieeeId?: string;
    college: string;
    department: string;
    yearOfStudy: string;
    roleType?: 'student' | 'professional';
    institutionName?: string;
    courseName?: string;
    otherCourseName?: string;
    branchName?: string;
    otherBranchName?: string;
    organizationName?: string;
    currentRole?: string;
    designation?: string;
  }) => void;
  onSwitchToLookup?: () => void;
  onBackToEvents?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ 
  onRegisterProceed, 
  onSwitchToLookup,
  onBackToEvents
}) => {

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    language: 'Malayalam' as 'Malayalam' | 'English',
    roleType: 'student' as 'student' | 'professional',
    // Student fields:
    institutionName: '',
    courseName: 'BTech' as 'BTech' | 'MTech' | 'BCA' | 'MCA' | 'Others',
    otherCourseName: '',
    branchName: 'Computer Science & Engineering',
    otherBranchName: '',
    yearOfStudy: '1', // 1, 2, 3, or 4
    // Professional fields:
    organizationName: '',
    currentRole: '',
    designation: '',
    // IEEE status fields:
    ieeeStatus: 'non-member' as 'member' | 'non-member',
    ieeeId: '',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const emailClean = formData.email.trim().toLowerCase();
    const nameClean = formData.name.trim();
    const phoneClean = formData.phone.trim();

    // Client-side validations
    if (!nameClean) {
      setError('Please provide your full name.');
      setLoading(false);
      return;
    }
    if (!emailClean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      setError('Please provide a valid email address.');
      setLoading(false);
      return;
    }
    if (!phoneClean || phoneClean.length < 5 || phoneClean.length > 20) {
      setError('Please enter a valid WhatsApp number (5 to 20 digits).');
      setLoading(false);
      return;
    }

    if (formData.roleType === 'student') {
      if (!formData.institutionName.trim()) {
        setError('Please provide your Institution Name.');
        setLoading(false);
        return;
      }
      if (formData.courseName === 'Others' && !formData.otherCourseName.trim()) {
        setError('Please specify your course.');
        setLoading(false);
        return;
      }
      if ((formData.courseName === 'BTech' || formData.courseName === 'MTech') && formData.branchName === 'Others' && !formData.otherBranchName.trim()) {
        setError('Please specify your branch.');
        setLoading(false);
        return;
      }
    } else {
      if (!formData.organizationName.trim()) {
        setError('Please provide your Organization Name.');
        setLoading(false);
        return;
      }
      if (!formData.designation.trim()) {
        setError('Please provide your Designation.');
        setLoading(false);
        return;
      }
    }

    if (formData.ieeeStatus === 'member' && !formData.ieeeId.trim()) {
      setError('Please provide your IEEE Membership ID.');
      setLoading(false);
      return;
    }

    try {
      // Check duplicate registration (Email-uniqueness check)
      const docRef = doc(db, 'registrations', emailClean);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setError('This email address is already registered for AskXpert. Click "Get Ticket" tab above to fetch your Entry Pass.');
        setLoading(false);
        return;
      }

      const collegeName = formData.roleType === 'student' 
        ? formData.institutionName.trim() 
        : formData.organizationName.trim();

      let deptDetails = '';
      if (formData.roleType === 'student') {
        if (formData.courseName === 'Others') {
          deptDetails = formData.otherCourseName.trim();
        } else if (formData.courseName === 'BTech' || formData.courseName === 'MTech') {
          const selectedBranch = formData.branchName === 'Others' ? formData.otherBranchName.trim() : formData.branchName;
          deptDetails = `${formData.courseName} - ${selectedBranch}`;
        } else {
          // BCA or MCA
          deptDetails = formData.courseName;
        }
      } else {
        deptDetails = formData.designation.trim();
      }

      const yearMap: Record<string, string> = {
        '1': '1st Year',
        '2': '2nd Year',
        '3': '3rd Year',
        '4': '4th Year',
        '5': '5th Year',
      };
      const studyLevel = formData.roleType === 'student'
        ? (yearMap[formData.yearOfStudy] || 'Student')
        : 'Professional';

      // Proceed to payment details with validated registration state
      onRegisterProceed({
        name: nameClean,
        email: emailClean,
        phone: phoneClean,
        language: formData.language,
        ieeeStatus: formData.ieeeStatus,
        college: collegeName,
        department: deptDetails,
        yearOfStudy: studyLevel,
        roleType: formData.roleType,
        institutionName: formData.roleType === 'student' ? formData.institutionName.trim() : undefined,
        courseName: formData.roleType === 'student' ? formData.courseName : undefined,
        otherCourseName: (formData.roleType === 'student' && formData.courseName === 'Others') ? formData.otherCourseName.trim() : undefined,
        branchName: (formData.roleType === 'student' && (formData.courseName === 'BTech' || formData.courseName === 'MTech')) ? formData.branchName : undefined,
        otherBranchName: (formData.roleType === 'student' && (formData.courseName === 'BTech' || formData.courseName === 'MTech') && formData.branchName === 'Others') ? formData.otherBranchName.trim() : undefined,
        organizationName: formData.roleType === 'professional' ? formData.organizationName.trim() : undefined,
        designation: formData.roleType === 'professional' ? formData.designation.trim() : undefined,
        ...(formData.ieeeStatus === 'member' && formData.ieeeId.trim() ? { ieeeId: formData.ieeeId.trim() } : {}),
      });

    } catch (err) {
      handleFirestoreError(err, 'get', `registrations/${emailClean}`);
      setError('Could not connect to database. Please check your internet connection and try again.');
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

        <div className="flex items-center space-x-2.5 mb-4 border-b border-emerald-950/5 pb-4">
          <Sparkles className="w-5 h-5 text-emerald-800 animate-pulse" />
          <div>
            <h3 className="font-display font-bold text-lg text-emerald-950 tracking-tight leading-none">
              Delegate Registration
            </h3>
            <span className="text-[10px] text-emerald-800 font-mono tracking-wider uppercase mt-1 inline-block">
              Secure your professional entry pass
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Row 1: Name */}
          <div className="flex flex-col space-y-1">
            <label htmlFor="name" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase flex items-center space-x-1.5">
              <User className="w-3 h-3 text-emerald-800" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleInputChange}
              placeholder="YOUR NAME"
              className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-4 py-2.5 text-sm text-emerald-950 font-sans placeholder-emerald-950/30 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10"
            />
          </div>

          {/* Row 2: Email & Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1">
              <label htmlFor="email" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase flex items-center space-x-1.5">
                <Mail className="w-3 h-3 text-emerald-800" />
                <span>Email Address</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                placeholder="YOUR EMAIL"
                className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-4 py-2.5 text-sm text-emerald-950 font-sans placeholder-emerald-950/30 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label htmlFor="phone" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase flex items-center space-x-1.5">
                <Phone className="w-3 h-3 text-emerald-800" />
                <span>WhatsApp Number</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                required
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="YOUR NUMBER"
                className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-4 py-2.5 text-sm text-emerald-950 font-sans placeholder-emerald-950/30 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10"
              />
            </div>
          </div>

          {/* Preferred Language Dropdown */}
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="language" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase flex items-center space-x-1.5">
                <Globe className="w-3 h-3 text-emerald-800" />
                <span>Preferred Language</span>
              </label>
              
              <div className="relative group flex items-center">
                <button
                  type="button"
                  aria-label="Language selection information"
                  className="text-emerald-700/70 hover:text-emerald-900 transition-colors p-0.5 rounded-full hover:bg-emerald-900/5 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {/* Tooltip */}
                <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block group-focus-within:block w-52 p-2 bg-emerald-950 text-[#FAF9F5] text-[11px] rounded-lg shadow-lg border border-emerald-800/30 z-30 pointer-events-none transition-all leading-snug">
                  Select your preferred language for event communication, notifications, and materials.
                  <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-emerald-950" />
                </div>
              </div>
            </div>

            <select
              id="language"
              name="language"
              value={formData.language}
              onChange={handleInputChange}
              className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-3 py-2.5 text-xs text-emerald-950 font-sans outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10 cursor-pointer font-medium"
            >
              <option value="Malayalam">Malayalam</option>
              <option value="English">English</option>
            </select>
          </div>



          {/* Row 3: Role Selection (Student vs Professional) */}
          <div className="flex flex-col space-y-1.5 border-t border-emerald-950/5 pt-3">
            <span className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
              I am registering as a:
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, roleType: 'student' }))}
                className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border text-xs font-bold transition-all duration-300 cursor-pointer ${
                  formData.roleType === 'student'
                    ? 'bg-emerald-900/10 border-emerald-900 text-emerald-950 shadow-sm'
                    : 'bg-white border-emerald-950/10 text-emerald-950/60 hover:text-emerald-950 hover:border-emerald-950/25'
                }`}
              >
                <School className="w-4 h-4" />
                <span>Student</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, roleType: 'professional' }))}
                className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border text-xs font-bold transition-all duration-300 cursor-pointer ${
                  formData.roleType === 'professional'
                    ? 'bg-emerald-900/10 border-emerald-900 text-emerald-950 shadow-sm'
                    : 'bg-white border-emerald-950/10 text-emerald-950/60 hover:text-emerald-950 hover:border-emerald-950/25'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Professional</span>
              </button>
            </div>
          </div>

          {/* Conditional Role-Based Fields */}
          <AnimatePresence mode="wait">
            {formData.roleType === 'student' ? (
              <motion.div
                key="student-fields"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Student field 1: Institution Name */}
                <div className="flex flex-col space-y-1">
                  <label htmlFor="institutionName" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
                    Institution / College Name
                  </label>
                  <input
                    type="text"
                    id="institutionName"
                    name="institutionName"
                    required
                    value={formData.institutionName}
                    onChange={handleInputChange}
                    placeholder="e.g. College of Engineering Kidangoor"
                    className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-4 py-2.5 text-sm text-emerald-950 font-sans placeholder-emerald-950/30 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10"
                  />
                </div>

                {/* Student field 2 & 3: Course Name & Year of Study */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-1">
                    <label htmlFor="courseName" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
                      Course Name
                    </label>
                    <select
                      id="courseName"
                      name="courseName"
                      value={formData.courseName}
                      onChange={handleInputChange}
                      className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-3 py-2.5 text-xs text-emerald-950 font-sans outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10 cursor-pointer"
                    >
                      <option value="BTech">BTech</option>
                      <option value="MTech">MTech</option>
                      <option value="BCA">BCA</option>
                      <option value="MCA">MCA</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label htmlFor="yearOfStudy" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
                      Year of Study
                    </label>
                    <select
                      id="yearOfStudy"
                      name="yearOfStudy"
                      value={formData.yearOfStudy}
                      onChange={handleInputChange}
                      className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-3 py-2.5 text-xs text-emerald-950 font-sans outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10 cursor-pointer"
                    >
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                      <option value="5">5th Year</option>
                    </select>
                  </div>
                </div>

                {/* Conditional course name specifier */}
                {formData.courseName === 'Others' && (
                  <div className="flex flex-col space-y-1">
                    <label htmlFor="otherCourseName" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
                      Specify Course Name
                    </label>
                    <input
                      type="text"
                      id="otherCourseName"
                      name="otherCourseName"
                      required
                      value={formData.otherCourseName}
                      onChange={handleInputChange}
                      placeholder="e.g. Diploma / PhD / others"
                      className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-4 py-2.5 text-sm text-emerald-950 font-sans placeholder-emerald-950/30 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10"
                    />
                  </div>
                )}

                {/* Conditional branches option for BTech & MTech */}
                {(formData.courseName === 'BTech' || formData.courseName === 'MTech') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-emerald-950/5 pt-3">
                    <div className="flex flex-col space-y-1">
                      <label htmlFor="branchName" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
                        Select Branch
                      </label>
                      <select
                        id="branchName"
                        name="branchName"
                        value={formData.branchName}
                        onChange={handleInputChange}
                        className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-3 py-2.5 text-xs text-emerald-950 font-sans outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10 cursor-pointer"
                      >
                        <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                        <option value="Electronics & Communication Engineering">Electronics & Communication Engineering</option>
                        <option value="Electrical & Electronics Engineering">Electrical & Electronics Engineering</option>
                        <option value="Information Technology">Information Technology</option>
                        <option value="Civil Engineering">Civil Engineering</option>
                        <option value="Mechanical Engineering">Mechanical Engineering</option>
                        <option value="Artificial Intelligence & Data Science">Artificial Intelligence & Data Science</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>

                    {formData.branchName === 'Others' && (
                      <div className="flex flex-col space-y-1">
                        <label htmlFor="otherBranchName" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
                          Specify Branch Name
                        </label>
                        <input
                          type="text"
                          id="otherBranchName"
                          name="otherBranchName"
                          required
                          value={formData.otherBranchName}
                          onChange={handleInputChange}
                          placeholder="e.g. Biomedical / Chemical"
                          className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-4 py-2.5 text-sm text-emerald-950 font-sans placeholder-emerald-950/30 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Student field 4: IEEE Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-emerald-950/5 pt-3">
                  <div className={`flex flex-col space-y-1 ${formData.ieeeStatus === 'member' ? 'md:col-span-1' : 'md:col-span-3'}`}>
                    <label htmlFor="ieeeStatus" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
                      IEEE Member?
                    </label>
                    <select
                      id="ieeeStatus"
                      name="ieeeStatus"
                      value={formData.ieeeStatus}
                      onChange={handleInputChange}
                      className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-3 py-2.5 text-xs text-emerald-950 font-sans outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10 cursor-pointer"
                    >
                      <option value="non-member">No</option>
                      <option value="member">Yes</option>
                    </select>
                  </div>

                  {formData.ieeeStatus === 'member' && (
                    <div className="md:col-span-2 flex flex-col space-y-1">
                      <label htmlFor="ieeeId" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
                        IEEE ID
                      </label>
                      <input
                        type="text"
                        id="ieeeId"
                        name="ieeeId"
                        required
                        value={formData.ieeeId}
                        onChange={handleInputChange}
                        placeholder="e.g. 98124021"
                        className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-4 py-2.5 text-sm text-emerald-950 font-sans placeholder-emerald-950/30 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10"
                      />
                    </div>
                  )}
                </div>

              </motion.div>
            ) : (
              <motion.div
                key="professional-fields"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Professional field 1: Organization Name */}
                <div className="flex flex-col space-y-1">
                  <label htmlFor="organizationName" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    id="organizationName"
                    name="organizationName"
                    required
                    value={formData.organizationName}
                    onChange={handleInputChange}
                    placeholder="e.g. Tata Consultancy Services / Google"
                    className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-4 py-2.5 text-sm text-emerald-950 font-sans placeholder-emerald-950/30 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10"
                  />
                </div>

                {/* Professional field 2: Designation */}
                <div className="flex flex-col space-y-1">
                  <label htmlFor="designation" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
                    Designation
                  </label>
                  <input
                    type="text"
                    id="designation"
                    name="designation"
                    required
                    value={formData.designation}
                    onChange={handleInputChange}
                    placeholder="e.g. Senior Software Engineer / Lead Researcher / Manager"
                    className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-4 py-2.5 text-sm text-emerald-950 font-sans placeholder-emerald-950/30 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10"
                  />
                </div>

                {/* Professional field 3: IEEE Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-emerald-950/5 pt-3">
                  <div className={`flex flex-col space-y-1 ${formData.ieeeStatus === 'member' ? 'md:col-span-1' : 'md:col-span-3'}`}>
                    <label htmlFor="ieeeStatus" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
                      IEEE Member?
                    </label>
                    <select
                      id="ieeeStatus"
                      name="ieeeStatus"
                      value={formData.ieeeStatus}
                      onChange={handleInputChange}
                      className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-3 py-2.5 text-xs text-emerald-950 font-sans outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10 cursor-pointer"
                    >
                      <option value="non-member">No</option>
                      <option value="member">Yes</option>
                    </select>
                  </div>

                  {formData.ieeeStatus === 'member' && (
                    <div className="md:col-span-2 flex flex-col space-y-1">
                      <label htmlFor="ieeeId" className="text-[10px] font-sans font-bold tracking-wider text-emerald-900 uppercase">
                        IEEE ID
                      </label>
                      <input
                        type="text"
                        id="ieeeId"
                        name="ieeeId"
                        required
                        value={formData.ieeeId}
                        onChange={handleInputChange}
                        placeholder="e.g. 98124021"
                        className="w-full bg-white border border-emerald-950/10 focus:border-emerald-800/50 rounded-xl px-4 py-2.5 text-sm text-emerald-950 font-sans placeholder-emerald-950/30 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-800/10"
                      />
                    </div>
                  )}
                </div>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Alert messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-start space-x-2 bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-rose-800 text-xs mt-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-900 hover:bg-emerald-950 text-[#FAF9F5] font-display font-bold text-sm tracking-widest py-3 px-4 rounded-xl cursor-pointer transition-all duration-300 shadow-md shadow-emerald-900/10 flex items-center justify-center space-x-2 disabled:bg-emerald-950/40 disabled:cursor-not-allowed uppercase mt-4"
          >
            {loading ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                <span>Checking records...</span>
              </>
            ) : (
              <>
                <span>Proceed to Payment</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {onSwitchToLookup && (
            <div className="pt-4 border-t border-emerald-950/5 text-center mt-4">
              <button
                type="button"
                onClick={onSwitchToLookup}
                className="text-xs text-emerald-800 hover:text-emerald-950 font-bold underline transition-all cursor-pointer inline-flex items-center space-x-1"
              >
                <span>Already registered? Retrieve your entry pass</span>
              </button>
            </div>
          )}

        </form>
      </motion.div>
    </div>
  );
};
