
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppStep, Stage, User, QCReport, CheckpointResult, CheckpointDefinition } from './types';
import { getStoredUsers, saveUsers, saveReport, getStoredReports, getAllCheckpoints, setCustomCheckpoints } from './storage';
import { 
  CameraIcon, 
  UserIcon, 
  ChevronRightIcon, 
  CheckIcon, 
  XIcon, 
  ArrowLeftIcon,
  EditIcon,
  TrashIcon,
  PlusIcon,
  SaveIcon,
  CQALogo
} from './components/Icons';
import { suggestFailureReason } from './services/geminiService';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import * as XLSX from 'xlsx';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const LiveCamera: React.FC<{ onCapture: (base64: string) => void; onClose: () => void }> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, 
          audio: false 
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera access error:", err);
        alert("Camera access denied. Please enable camera permissions in settings.");
        onClose();
      }
    }
    startCamera();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [onClose]);

  const capture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      onCapture(canvas.toDataURL('image/jpeg', 0.8));
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black flex flex-col animate-in fade-in duration-200">
      <div className="absolute top-0 left-0 right-0 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex flex-col min-w-0">
          <h3 className="text-white text-[10px] font-black uppercase tracking-[0.2em] leading-none truncate">CQA Evidence Capture</h3>
          <p className="text-blue-400 text-[8px] font-black uppercase tracking-widest mt-1">Live Feed Only</p>
        </div>
        <button onClick={onClose} className="text-white p-2 hover:bg-white/10 rounded-full transition-colors active:scale-90 shrink-0">
          <XIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-40 h-40 sm:w-64 sm:h-64 border border-white/20 rounded-2xl relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 bg-white/40"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-4 bg-white/40"></div>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-px w-4 bg-white/40"></div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 h-px w-4 bg-white/40"></div>
            </div>
        </div>
      </div>
      <div className="p-6 sm:p-10 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md border-t border-white/5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button 
          onClick={capture}
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform shadow-[0_0_40px_rgba(255,255,255,0.15)] bg-white/5"
        >
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white shadow-inner"></div>
        </button>
        <p className="text-white/40 text-[8px] font-black uppercase tracking-[0.3em] mt-4 sm:mt-6">Capture Inspection Proof</p>
      </div>
    </div>
  );
};

const Scanner: React.FC<{ onScan: (result: string) => void; onClose: () => void }> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "reader";

  useEffect(() => {
    scannerRef.current = new Html5Qrcode(regionId);
    
    const config = { 
      fps: 25, 
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
        const qrboxSize = Math.floor(minEdgeSize * 0.75);
        return { width: qrboxSize, height: qrboxSize };
      },
      aspectRatio: 1.0,
      formatsToSupport: [ 
        Html5QrcodeSupportedFormats.QR_CODE, 
        Html5QrcodeSupportedFormats.CODE_128, 
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.DATA_MATRIX
      ]
    };
    
    scannerRef.current.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        onScan(decodedText);
        if (scannerRef.current?.isScanning) {
           scannerRef.current.stop().catch(e => console.warn("Scanner shutdown warning:", e));
        }
      },
      undefined
    ).catch(err => {
      console.error("Scanner Initialization Error:", err);
    });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(e => console.warn(e));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-150">
      <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex justify-between items-center bg-black/60 backdrop-blur-md absolute top-0 left-0 right-0 z-10 border-b border-white/10">
        <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] truncate mr-2">CQA Scanner Active</h3>
        <button onClick={onClose} className="text-white p-2 hover:bg-white/10 rounded-full transition-colors active:scale-90 shrink-0">
          <XIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden relative">
        <div id={regionId} className="w-full h-full"></div>
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-64 sm:w-80 sm:h-80 border-2 border-blue-500 rounded-2xl shadow-[0_0_0_100vmax_rgba(0,0,0,0.65)] relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white -translate-x-1 -translate-y-1 rounded-tl-sm"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white translate-x-1 -translate-y-1 rounded-tr-sm"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white -translate-x-1 translate-y-1 rounded-bl-sm"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white translate-x-1 translate-y-1 rounded-br-sm"></div>
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.9)] animate-pulse opacity-80"></div>
          </div>
        </div>
      </div>
      <div className="p-6 sm:p-10 text-center bg-black/60 backdrop-blur-md absolute bottom-0 left-0 right-0 border-t border-white/10 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.15em] animate-pulse">Scanning Traceability Barcode</p>
      </div>
    </div>
  );
};

const ZoomableImage: React.FC<{ src: string; onRemove?: () => void }> = ({ src, onRemove }) => {
  const [scale, setScale] = useState(1);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setScale(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setScale(prev => Math.max(prev - 0.5, 0.5));
  };

  return (
    <div className="relative w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden rounded-xl group">
      <img
        src={src}
        alt="Preview"
        style={{ transform: `scale(${scale})` }}
        className="max-w-full max-h-full object-contain transition-transform duration-200 ease-out"
      />
      <div className="absolute bottom-3 left-3 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={handleZoomOut} className="bg-black/80 backdrop-blur-md text-white px-3 py-1.5 rounded-lg border border-white/20 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">- Zoom</button>
        <button onClick={handleZoomIn} className="bg-black/80 backdrop-blur-md text-white px-3 py-1.5 rounded-lg border border-white/20 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">+ Zoom</button>
      </div>
      {onRemove && (
        <button onClick={(e) => { e.preventDefault(); onRemove(); }} className="absolute top-3 right-3 bg-red-600/90 text-white p-2.5 rounded-full hover:bg-red-600 transition-colors z-10 shadow-lg active:scale-90"><XIcon className="w-4 h-4" /></button>
      )}
    </div>
  );
};

const TrendChart: React.FC<{ data: { date: string, pass: number, fail: number }[] }> = ({ data }) => {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d.pass + d.fail), 1);
  
  return (
    <div className="bg-white p-4 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Yield Trends (Last 7 Days)</h4>
        <div className="flex gap-4">
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Certified</span></div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rejected</span></div>
        </div>
      </div>
      <div className="flex items-end justify-between h-48 sm:h-56 gap-1 sm:gap-4 px-1">
        {data.map((day, idx) => {
          const passHeight = (day.pass / maxVal) * 100;
          const failHeight = (day.fail / maxVal) * 100;
          
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-3 group relative h-full">
              <div className="w-full flex flex-col-reverse items-center justify-start h-full gap-0.5 sm:gap-1">
                <div 
                  className="w-full bg-green-500 rounded-t-sm transition-all duration-700 ease-out delay-[idx*50ms] group-hover:bg-green-600" 
                  style={{ height: `${passHeight}%` }}
                />
                <div 
                  className="w-full bg-red-500 rounded-t-sm transition-all duration-700 ease-out delay-[idx*50ms] group-hover:bg-red-600" 
                  style={{ height: `${failHeight}%` }}
                />
              </div>
              <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tighter truncate w-full text-center">
                {day.date.split('-').slice(1).join('/')}
              </p>
              
              <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 py-2 rounded-xl text-[9px] font-black opacity-0 group-hover:opacity-100 transition-all z-10 whitespace-nowrap shadow-2xl border border-white/10 scale-90 group-hover:scale-100">
                <p className="text-green-400 mb-0.5">OK: {day.pass}</p>
                <p className="text-red-400">NG: {day.fail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.STAGE_SELECTION);
  const [selectedStage, setSelectedStage] = useState<Stage>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [deviceImage, setDeviceImage] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<CheckpointResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [activePhotoCheckpoint, setActivePhotoCheckpoint] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  
  const checkpointRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const resetApp = () => { setDeviceId(''); setDeviceImage(null); setCheckpoints([]); setCurrentStep(AppStep.DEVICE_ID_ENTRY); };

  // Auto-reset logic for continuous production flow
  useEffect(() => {
    if (currentStep === AppStep.SUCCESS) {
      const timer = setTimeout(() => {
        resetApp();
      }, 1300); // Redirect back to scan after brief success
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const handleStageSelect = (stage: Stage) => {
    setSelectedStage(stage);
    if (currentUser && !currentUser.isAdmin) {
      if (currentUser.assignedStage !== 'Both' && currentUser.assignedStage !== stage) {
         setError(`Access denied. You are assigned to ${currentUser.assignedStage === 'FQC' ? 'Final Quality Control (FQC)' : 'Packaging'}.`);
         return;
      }
      setCurrentStep(AppStep.DEVICE_ID_ENTRY);
    } else {
      setCurrentStep(AppStep.LOGIN);
    }
    setError('');
  };

  const handleAdminAccess = () => {
    setSelectedStage(null); 
    if (currentUser?.isAdmin) {
      setCurrentStep(AppStep.ADMIN);
    } else {
      setCurrentStep(AppStep.LOGIN);
    }
    setError('');
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const userId = formData.get('userId') as string;
    const password = formData.get('password') as string;
    const users = getStoredUsers();
    const user = users.find(u => u.userId === userId && u.password === password);
    if (user) {
      if (!user.isActive) { setError('Account disabled. Contact CQA Admin.'); return; }
      setCurrentUser(user);
      setError('');
      if (user.isAdmin) { setCurrentStep(AppStep.ADMIN); }
      else {
        if (!selectedStage) { setError('Select a stage.'); return; }
        if (user.assignedStage !== 'Both' && user.assignedStage !== selectedStage) { setError(`Access denied. You are assigned to ${user.assignedStage === 'FQC' ? 'Final Quality Control (FQC)' : 'Packaging'}.`); return; }
        setCurrentStep(AppStep.DEVICE_ID_ENTRY);
      }
    } else { setError('Invalid Credentials.'); }
  };

  const validateAndProceed = (id: string) => {
    if (!id || !id.trim()) { setError('Traceability ID is required'); return; }
    setError('');
    const baseCheckpoints = getAllCheckpoints(selectedStage);
    setCheckpoints(baseCheckpoints.map(cp => ({ ...cp, status: null, image: null, reason: '' })));
    setAttemptedSubmit(false);
    setCurrentStep(AppStep.CHECKLIST);
  };

  const handleCheckpointUpdate = (id: string, updates: Partial<CheckpointResult>) => {
    setCheckpoints(prev => prev.map(cp => cp.id === id ? { ...cp, ...updates } : cp));
  };

  const handleAIReason = async (id: string, label: string) => {
    const reason = await suggestFailureReason(label, selectedStage || 'General');
    handleCheckpointUpdate(id, { reason });
  };

  const validateCheckpoints = () => {
    const errors: { [key: string]: string[] } = {};
    let firstErrorId: string | null = null;

    checkpoints.forEach(cp => {
      const cpErrors: string[] = [];
      if (!cp.status) cpErrors.push('Audit Status Required.');
      if (!cp.image) cpErrors.push('Photo Evidence Required.');
      if (cp.status === 'Fail' && !cp.reason.trim()) cpErrors.push('Root Cause Description Required.');
      
      if (cpErrors.length > 0) {
        errors[cp.id] = cpErrors;
        if (!firstErrorId) firstErrorId = cp.id;
      }
    });

    return { errors, firstErrorId };
  };

  const handleFinalSubmitRequest = () => {
    setAttemptedSubmit(true);
    const { errors, firstErrorId } = validateCheckpoints();
    
    if (Object.keys(errors).length > 0) {
      if (firstErrorId && checkpointRefs.current[firstErrorId]) {
        checkpointRefs.current[firstErrorId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    
    // Direct submission bypassing confirmation modal
    handleConfirmedFinalSubmit();
  };

  const handleConfirmedFinalSubmit = () => {
    setIsSubmitting(true);
    const report: QCReport = { id: `CQA-${Date.now()}`, timestamp: new Date().toISOString(), stage: selectedStage === 'Both' ? null : selectedStage, userId: currentUser?.userId || 'Unknown', deviceId, checkpoints };
    // Simulated processing delay
    setTimeout(() => { 
      saveReport(report); 
      setIsSubmitting(false); 
      setCurrentStep(AppStep.SUCCESS); 
    }, 800);
  };

  const logout = () => { setCurrentUser(null); setSelectedStage(null); setDeviceId(''); setDeviceImage(null); setCheckpoints([]); setError(''); setCurrentStep(AppStep.STAGE_SELECTION); };

  const renderHeader = () => (
    <header className="factory-gradient text-white p-3 sm:p-5 shadow-2xl flex justify-between items-center sticky top-0 z-[60] border-b border-white/5 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className="flex items-center gap-2 sm:gap-4 cursor-pointer overflow-hidden max-w-[65%]" onClick={() => !currentUser && setCurrentStep(AppStep.STAGE_SELECTION)}>
        <CQALogo className="w-8 h-8 sm:w-11 sm:h-11 shrink-0 drop-shadow-lg" />
        <div className="flex flex-col min-w-0">
          <h1 className="text-lg sm:text-2xl font-black tracking-tighter uppercase leading-none">CQA</h1>
          <p className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-green-400 mt-0.5 opacity-90 truncate">Critical Quality Assurance</p>
        </div>
      </div>
      {currentUser && (
        <div className="flex items-center gap-2 sm:gap-5 shrink-0 ml-2">
          <div className="text-right border-r border-white/10 pr-2 sm:pr-5 hidden sm:block">
            <p className="text-[9px] sm:text-[11px] text-blue-300 uppercase font-black tracking-[0.2em] leading-none mb-1">{selectedStage === 'Both' ? 'FQC + Packaging' : (selectedStage === 'FQC' ? 'Final Quality Control (FQC)' : (selectedStage === 'Packaging' ? 'Packaging' : (currentUser.isAdmin ? 'ADMIN' : 'SYSTEM')))}</p>
            <p className="text-xs sm:text-base font-bold truncate max-w-[120px]">{currentUser.userId}</p>
          </div>
          <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl transition-all font-black text-[9px] sm:text-[11px] uppercase shadow-xl active:scale-90 ring-2 ring-red-500/20">Logout</button>
        </div>
      )}
    </header>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden selection:bg-blue-100">
      {renderHeader()}
      <main className="flex-1 flex flex-col w-full max-w-2xl mx-auto px-4 py-6 sm:py-10 md:px-0">
        {currentStep === AppStep.STAGE_SELECTION && (
          <div className="flex-1 flex flex-col justify-center gap-8 text-center animate-in fade-in zoom-in duration-500">
            <div className="mb-2 flex flex-col items-center">
              <CQALogo className="w-24 h-24 sm:w-40 sm:h-40 mb-6 sm:mb-10 drop-shadow-[0_20px_50px_rgba(34,197,94,0.3)] animate-pulse" />
              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 uppercase tracking-tight leading-tight">CQA Entry Protocol</h2>
              <p className="text-slate-500 font-bold mt-2 text-sm sm:text-lg uppercase tracking-widest opacity-80">Factory Floor Quality Control</p>
            </div>
            <div className="grid gap-4 w-full max-w-md mx-auto px-2">
              <button onClick={() => handleStageSelect('FQC')} className="min-h-[5.5rem] sm:min-h-[8rem] bg-white border-2 border-slate-200 hover:border-green-600 rounded-3xl shadow-sm text-xl sm:text-3xl font-black uppercase text-slate-800 transition-all active:scale-[0.97] hover:shadow-xl hover:-translate-y-1 flex items-center justify-center group text-center px-4"><span className="group-hover:scale-105 transition-transform">Final Quality Control (FQC)</span></button>
              <button onClick={() => handleStageSelect('Packaging')} className="min-h-[5.5rem] sm:min-h-[8rem] bg-white border-2 border-slate-200 hover:border-green-600 rounded-3xl shadow-sm text-xl sm:text-3xl font-black uppercase text-slate-800 transition-all active:scale-[0.97] hover:shadow-xl hover:-translate-y-1 flex items-center justify-center group px-4"><span className="group-hover:scale-105 transition-transform">Packaging</span></button>
              <button onClick={handleAdminAccess} className="text-slate-400 font-black uppercase text-[10px] sm:text-xs hover:text-slate-800 mt-6 flex items-center justify-center gap-2 transition-all hover:tracking-[0.1em] py-4"><UserIcon className="w-4 h-4" /> Management Console Access</button>
            </div>
          </div>
        )}
        {currentStep === AppStep.LOGIN && (
          <div className="flex-1 flex flex-col justify-center animate-in slide-in-from-left duration-300 py-6 max-w-md mx-auto w-full">
            <button onClick={() => setCurrentStep(AppStep.STAGE_SELECTION)} className="mb-8 flex items-center text-blue-600 font-black text-xs sm:text-sm gap-2 hover:text-blue-800 transition-all active:translate-x-[-4px] uppercase tracking-widest"><ArrowLeftIcon className="w-4 h-4" /> Protocol Selection</button>
            <div className="flex items-center gap-4 mb-10">
              <CQALogo className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 shadow-2xl rounded-2xl" />
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none text-slate-900">Security<br/><span className="text-slate-400 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] mt-1 block">Authentication</span></h2>
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="group"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 group-focus-within:text-blue-600 transition-colors">Certifier ID</label><input name="userId" required placeholder="F-ID-XXXX" className="w-full px-5 py-4 sm:py-5 bg-white border-2 border-slate-100 rounded-2xl font-black text-base sm:text-xl text-slate-900 focus:border-blue-600 transition-all shadow-sm" /></div>
              <div className="group"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 group-focus-within:text-blue-600 transition-colors">Access Key</label><input name="password" type="password" required placeholder="••••••••" className="w-full px-5 py-4 sm:py-5 bg-white border-2 border-slate-100 rounded-2xl font-black text-base sm:text-xl text-slate-900 focus:border-blue-600 transition-all shadow-sm" /></div>
              {error && <div className="text-red-600 font-black text-xs sm:text-sm p-4 bg-red-50 rounded-2xl border-2 border-red-100 animate-shake">{error}</div>}
              <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 sm:py-5 rounded-2xl shadow-2xl uppercase tracking-widest active:scale-[0.98] transition-all hover:bg-black text-sm sm:text-base mt-2 ring-4 ring-slate-900/10">Login</button>
            </form>
          </div>
        )}
        {currentStep === AppStep.DEVICE_ID_ENTRY && (
          <div className="flex-1 flex flex-col justify-center space-y-8 animate-in slide-in-from-right duration-300 py-6 max-w-md mx-auto w-full">
            <div className="text-center space-y-3">
              <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-slate-900 leading-none">CQA ID Input</h2>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Device Traceability Lock</p>
            </div>
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 opacity-70">Enter Serial Number</label>
                  <input value={deviceId} onChange={(e) => setDeviceId(e.target.value.toUpperCase())} className="w-full px-6 py-5 sm:py-6 bg-white border-4 border-slate-100 rounded-3xl text-center text-xl sm:text-3xl font-mono font-black tracking-[0.2em] text-slate-900 focus:border-green-500 transition-all shadow-inner uppercase" />
                </div>
                <button onClick={() => setIsScanning(true)} className="p-4 sm:p-6 bg-slate-900 text-white font-black uppercase rounded-2xl border-4 border-slate-800 hover:bg-black transition-all flex items-center justify-center shadow-[0_10px_20px_-5px_rgba(15,23,42,0.3)] active:scale-95 mt-0 sm:mt-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1-1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                </button>
              </div>
              {isScanning && <Scanner onScan={(result) => { setDeviceId(result.toUpperCase()); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
            </div>
            {error && <p className="text-red-600 text-center font-black text-xs uppercase tracking-tight p-4 bg-red-50 rounded-2xl border-2 border-red-100">{error}</p>}
            <div className="flex justify-center pt-4">
              <button 
                onClick={() => validateAndProceed(deviceId)} 
                className="w-full sm:w-4/5 bg-slate-900 hover:bg-black text-white font-black py-4 sm:py-5 rounded-3xl shadow-2xl uppercase text-xs sm:text-sm tracking-[0.3em] active:scale-[0.98] transition-all flex items-center justify-center gap-3 ring-8 ring-slate-900/5 group"
              >
                Continue <ChevronRightIcon className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          </div>
        )}
        {currentStep === AppStep.CHECKLIST && (
          <div className="space-y-6 pb-40 sm:pb-48 animate-in slide-in-from-bottom duration-500">
            {activePhotoCheckpoint && (
              <LiveCamera 
                onCapture={(base64) => {
                  handleCheckpointUpdate(activePhotoCheckpoint, { image: base64 });
                  setActivePhotoCheckpoint(null);
                }}
                onClose={() => setActivePhotoCheckpoint(null)}
              />
            )}

            <div className="bg-white p-4 sm:p-6 rounded-[2rem] shadow-xl border border-slate-100 flex items-center justify-between gap-6 sticky top-[4.5rem] sm:top-[6rem] z-20 backdrop-blur-md bg-white/90">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] sm:text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] truncate mb-1">CQA Protocol ID</p>
                <p className="text-xl sm:text-2xl font-mono font-black text-blue-600 truncate leading-none">{deviceId}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] sm:text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-1">Inspection Node</p>
                <p className="text-xs sm:text-sm font-black text-slate-800 uppercase px-3 py-1 bg-slate-100 rounded-lg">{selectedStage === 'FQC' ? 'FQC' : 'PKG'}</p>
              </div>
            </div>
            <div className="space-y-6">
              {checkpoints.map((cp, idx) => (
                <div 
                  key={cp.id} 
                  ref={el => { checkpointRefs.current[cp.id] = el; }}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-md transition-all hover:shadow-lg"
                >
                  <div className="p-4 sm:p-5 bg-slate-50/50 border-b border-slate-100 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-lg font-black text-slate-900 leading-tight sm:leading-snug">{cp.label}</h3>
                      {cp.description && <p className="text-[9px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-tight mt-1.5 leading-relaxed">{cp.description}</p>}
                    </div>
                  </div>
                  <div className="p-5 sm:p-7 space-y-6 sm:space-y-8">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleCheckpointUpdate(cp.id, { status: 'Pass' })} className={`py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[9px] transition-all shadow-sm ${cp.status === 'Pass' ? 'bg-green-600 text-white shadow-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><CheckIcon className="w-4 h-4" /> PASS</button>
                        <button onClick={() => handleCheckpointUpdate(cp.id, { status: 'Fail' })} className={`py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[9px] transition-all shadow-sm ${cp.status === 'Fail' ? 'bg-red-600 text-white shadow-red-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><XIcon className="w-4 h-4" /> FAIL</button>
                      </div>
                      {attemptedSubmit && cp.isMandatory && !cp.status && (
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] animate-pulse px-2 text-center">Mandatory selection missing.</p>
                      )}
                    </div>

                    <div className="flex justify-center space-y-3">
                      {!cp.image ? (
                        <button 
                          onClick={() => setActivePhotoCheckpoint(cp.id)}
                          className={`py-3 px-4 bg-blue-50/50 text-blue-700 rounded-2xl border-2 border-dashed flex items-center justify-center font-black text-xs uppercase transition-all group ${attemptedSubmit && cp.isMandatory && !cp.image ? 'border-red-300 bg-red-50 text-red-600 animate-shake' : 'border-blue-200 hover:bg-blue-100/50 hover:border-blue-400'}`}
                        >
                          <CameraIcon className="w-6 h-6 shrink-0" />
                        </button>
                      ) : ( <div className="h-40 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm flex justify-center items-center"><ZoomableImage src={cp.image} onRemove={() => handleCheckpointUpdate(cp.id, { image: null })} /></div> )}
                      {attemptedSubmit && cp.isMandatory && !cp.image && (
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] animate-pulse px-2 text-center">Photo evidence required by CQA Protocol.</p>
                      )}
                    </div>

                    {cp.status === 'Fail' && (
                      <div className="animate-in slide-in-from-top duration-300 space-y-3">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">Root Cause Documentation</label>
                          <button onClick={() => handleAIReason(cp.id, cp.label)} className="text-[9px] text-purple-600 font-black px-3 py-1.5 rounded-xl border-2 border-purple-100 uppercase hover:bg-purple-50 transition-all active:scale-95 shadow-sm">✨ AI Failure Prediction</button>
                        </div>
                        <textarea 
                          value={cp.reason} 
                          onChange={(e) => handleCheckpointUpdate(cp.id, { reason: e.target.value })} 
                          placeholder="Provide detailed technical non-conformance notes..." 
                          className={`w-full p-5 border-2 rounded-2xl text-xs sm:text-base outline-none font-bold h-32 text-slate-900 transition-all resize-none shadow-inner ${attemptedSubmit && cp.status === 'Fail' && !cp.reason.trim() ? 'bg-red-50 border-red-500 ring-4 ring-red-500/10' : 'bg-slate-50 border-slate-100 focus:bg-white focus:border-red-500'}`} 
                        />
                        {attemptedSubmit && cp.status === 'Fail' && !cp.reason.trim() && (
                          <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] animate-pulse px-2 text-center">Technical remark required for rejected units.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/90 backdrop-blur-sm border-t border-slate-200 z-[70] w-full shadow-sm pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
               <div className="max-w-md mx-auto px-2">
                 <button disabled={isSubmitting} onClick={handleFinalSubmitRequest} className={`py-2 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-[0.98] shadow-md ${isSubmitting ? 'bg-slate-400' : 'bg-slate-800 hover:bg-slate-900'} text-white w-full max-w-[200px] mx-auto`}>{isSubmitting ? 'Sending...' : 'Submit'}</button>
               </div>
            </div>
          </div>
        )}
        {currentStep === AppStep.SUCCESS && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in slide-in-from-bottom duration-500 py-10 sm:py-20 px-4">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-green-50 text-green-600 rounded-full flex items-center justify-center shadow-lg ring-4 ring-green-100/50">
              <CheckIcon className="w-12 h-12 sm:w-16 sm:h-16" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900">Inspection submitted successfully</h2>
              <p className="text-slate-400 font-black uppercase text-[8px] tracking-[0.3em] animate-pulse mt-4">Preparing for next device...</p>
            </div>
          </div>
        )}
        {currentStep === AppStep.ADMIN && <AdminPanel onLogout={logout} />}
      </main>
    </div>
  );
};

const AdminPanel: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inspections' | 'evidence' | 'users' | 'add_checkpoint'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<QCReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<QCReport | null>(null);

  const [filterDeviceID, setFilterDeviceID] = useState('');
  const [filterStage, setFilterStage] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isNCRExportDropdownOpen, setIsNCRExportDropdownOpen] = useState(false);

  useEffect(() => {
    setUsers(getStoredUsers());
    setReports(getStoredReports());
  }, []);

  const stats = useMemo(() => {
    const total = reports.length;
    const fqc = reports.filter(r => r.stage === 'FQC').length;
    const packaging = reports.filter(r => r.stage === 'Packaging').length;
    const passedReports = reports.filter(r => r.checkpoints.every(cp => cp.status === 'Pass'));
    const passed = passedReports.length;
    const totalFailed = total - passed;

    const failureCounts: { [key: string]: number } = {};
    reports.forEach(r => {
      r.checkpoints.forEach(cp => {
        if (cp.status === 'Fail') {
          failureCounts[cp.label] = (failureCounts[cp.label] || 0) + 1;
        }
      });
    });

    const commonFailures = Object.entries(failureCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    const trend: { date: string, pass: number, fail: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayReports = reports.filter(r => r.timestamp.startsWith(dateStr));
      const dayPassed = dayReports.filter(r => r.checkpoints.every(cp => cp.status === 'Pass')).length;
      const dayFailed = dayReports.length - dayPassed;
      
      trend.push({ date: dateStr, pass: dayPassed, fail: dayFailed });
    }

    return { total, fqc, packaging, passed, failed: totalFailed, commonFailures, trend };
  }, [reports]);

  const ncrReports = useMemo(() => {
    return reports.filter(r => {
      const isPass = r.checkpoints.every(cp => cp.status === 'Pass');
      if (isPass) return false; // NCR Tab only shows Units that have at least one FAIL

      const reportDate = r.timestamp.split('T')[0];
      const matchDate = reportDate >= fromDate && reportDate <= toDate;
      const matchStage = filterStage === 'All' || r.stage === filterStage;
      return matchDate && matchStage;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [reports, fromDate, toDate, filterStage]);

  const evidenceRows = useMemo(() => {
    return reports.flatMap(report => 
      report.checkpoints.map(cp => ({
        deviceId: report.deviceId,
        stage: report.stage,
        checkpointName: cp.label,
        result: cp.status,
        reason: cp.reason,
        inspector: report.userId,
        timestamp: report.timestamp,
        image: cp.image ? 'YES' : 'NO'
      }))
    ).filter(row => {
      const reportDate = row.timestamp.split('T')[0];
      const matchDate = reportDate >= fromDate && reportDate <= toDate;
      const matchStage = filterStage === 'All' || row.stage === filterStage;
      const matchStatus = filterStatus === 'All' || row.result === filterStatus;
      return matchDate && matchStage && matchStatus;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [reports, fromDate, toDate, filterStage, filterStatus]);

  const handleExport = (format: 'csv' | 'excel', source: 'reports' | 'ncr') => {
    const fileNameDate = fromDate === toDate ? fromDate : `${fromDate}_to_${toDate}`;
    const prefix = source === 'reports' ? 'CQA_Report' : 'CQA_NCR';
    const extension = format === 'csv' ? 'csv' : 'xlsx';
    const fileName = `${prefix}_${fileNameDate}.${extension}`;
    
    let rowsToExport: any[] = [];
    let headers: string[] = [];

    if (source === 'reports') {
      headers = ['Node ID', 'Station', 'Inspection Rule', 'Status', 'Certifier', 'Timestamp', 'Technical Remark'];
      rowsToExport = evidenceRows.map(row => [
        row.deviceId,
        row.stage,
        `"${row.checkpointName.replace(/"/g, '""')}"`,
        row.result || 'NULL',
        row.inspector,
        row.timestamp,
        `"${(row.reason || '').replace(/"/g, '""')}"`
      ]);
    } else {
      // NCR Logic: Only export FAIL checkpoints from the filtered failed reports
      headers = ['Node ID', 'Station', 'Failed Checkpoint', 'Status', 'Certifier', 'Timestamp', 'Root Cause / Reason'];
      // Flattening all failed checkpoints from reports that had at least one failure
      rowsToExport = ncrReports.flatMap(r => 
        r.checkpoints
          .filter(cp => cp.status === 'Fail')
          .map(cp => [
            r.deviceId,
            r.stage,
            `"${cp.label.replace(/"/g, '""')}"`,
            'FAIL',
            r.userId,
            r.timestamp,
            `"${(cp.reason || '').replace(/"/g, '""')}"`
          ])
      );
    }
    
    const content = [headers.join(','), ...rowsToExport.map(r => r.join(','))].join('\n');
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; 
    link.download = fileName; 
    link.click();
    setIsExportDropdownOpen(false);
    setIsNCRExportDropdownOpen(false);
  };

  const downloadEvidenceImage = (imageSrc: string, deviceId: string, stage: string, checkpoint: string) => {
    const link = document.createElement('a');
    link.href = imageSrc;
    const cleanCP = checkpoint.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    link.download = `CQA_EVIDENCE_${deviceId}_${stage}_${cleanCP}.png`;
    link.click();
  };

  return (
    <div className="space-y-6 sm:space-y-10 animate-in fade-in pb-20 w-full px-1">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 sm:p-7 rounded-[2rem] shadow-xl border-2 border-slate-50 gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <CQALogo className="w-10 h-10 sm:w-14 sm:h-14 shrink-0 shadow-xl rounded-2xl" />
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-black uppercase text-slate-900 leading-tight tracking-tight truncate">CQA Analytics Hub</h2>
            <p className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] truncate">Critical Performance Metrics</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-full sm:w-auto text-red-600 font-black text-xs sm:text-sm uppercase border-2 border-red-50 px-6 py-3 rounded-2xl hover:bg-red-50 transition-all active:scale-95 shadow-sm">Logout Console</button>
      </div>

      <nav className="flex gap-2 bg-white p-1.5 rounded-[1.75rem] border-2 border-slate-50 shadow-xl overflow-x-auto no-scrollbar scroll-smooth snap-x">
        {[
          { id: 'dashboard', label: 'Overview' },
          { id: 'inspections', label: 'NCR' },
          { id: 'evidence', label: 'Reports' },
          { id: 'users', label: 'User' },
          { id: 'add_checkpoint', label: 'CQA Rules' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex-1 whitespace-nowrap px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all snap-start ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-2xl scale-100 ring-4 ring-slate-900/10' : 'text-slate-400 hover:bg-slate-50 scale-95 hover:scale-100'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'inspections' && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500 max-w-4xl mx-auto w-full">
          <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border-2 border-slate-50 flex flex-col gap-8">
            <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight">Non-Conformance Registry (NCR)</h3>
            
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From Date</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-blue-600 transition-all focus:bg-white cursor-pointer" />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To Date</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-blue-600 transition-all focus:bg-white cursor-pointer" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Factory Station</label>
              <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest outline-none focus:border-blue-600 focus:bg-white transition-all appearance-none cursor-pointer">
                <option value="All">All Factory Stations</option><option value="FQC">Final Quality Control (FQC)</option><option value="Packaging">Packaging</option>
              </select>
            </div>

            <div className="relative">
              <button 
                onClick={() => setIsNCRExportDropdownOpen(!isNCRExportDropdownOpen)} 
                className="w-full bg-red-600 text-white px-8 py-5 rounded-3xl font-black text-xs uppercase shadow-2xl flex items-center justify-center gap-3 hover:bg-red-700 active:scale-95 transition-all ring-8 ring-red-600/10"
              >
                <SaveIcon className="w-6 h-6" /> Export Report
              </button>
              
              {isNCRExportDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-3xl border-4 border-red-600 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden z-[80] animate-in slide-in-from-top-4 duration-200">
                  <button onClick={() => handleExport('csv', 'ncr')} className="w-full text-left px-8 py-5 hover:bg-slate-50 font-black text-black text-[12px] sm:text-sm uppercase tracking-widest border-b-2 border-slate-100 flex items-center justify-between group">
                    <span>Export as CSV</span>
                    <ChevronRightIcon className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                  </button>
                  <button onClick={() => handleExport('excel', 'ncr')} className="w-full text-left px-8 py-5 hover:bg-slate-50 font-black text-black text-[12px] sm:text-sm uppercase tracking-widest flex items-center justify-between group">
                    <span>Export as Excel</span>
                    <ChevronRightIcon className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="pt-6 border-t border-slate-100 text-center">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] leading-relaxed">
                NCR Records Identified: <span className="text-slate-900">{ncrReports.length} Failed Inspections</span><br/>
                Range: <span className="text-blue-600 font-mono">{fromDate} — {toDate}</span>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {ncrReports.map(report => (
              <div key={report.id} onClick={() => setSelectedReport(report)} className="bg-white p-5 sm:p-7 rounded-[2rem] border-2 border-red-100 shadow-lg flex justify-between items-center cursor-pointer hover:border-red-500 transition-all active:scale-[0.99] gap-5 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="shrink-0 w-3.5 h-3.5 rounded-full ring-4 bg-red-500 ring-red-50 shadow-sm"></span>
                    <p className="text-base sm:text-xl font-black text-slate-900 font-mono tracking-[0.1em] truncate uppercase">{report.deviceId}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="bg-red-50 text-red-600 px-3 py-1 rounded-xl shrink-0 border border-red-100">{report.stage === 'FQC' ? 'FQC' : 'PKG'}</span>
                    <span className="flex items-center gap-1.5"><UserIcon className="w-3 h-3" /> {report.userId}</span>
                    <span className="shrink-0 opacity-60">{new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="bg-red-50 p-3 rounded-2xl group-hover:bg-red-600 group-hover:text-white transition-all shadow-inner text-red-600">
                  <ChevronRightIcon className="w-6 h-6 shrink-0" />
                </div>
              </div>
            ))}
            {ncrReports.length === 0 && <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-slate-50 opacity-40 uppercase font-black text-sm tracking-[0.4em] shadow-inner">No NCR Records Found for Selection</div>}
          </div>
        </div>
      )}

      {activeTab === 'evidence' && (
        <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border-2 border-slate-50 flex flex-col gap-8 animate-in slide-in-from-top duration-500 max-w-4xl mx-auto w-full">
          <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight">Audit Reports</h3>
          
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From Date</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-blue-600 transition-all focus:bg-white cursor-pointer" />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To Date</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-blue-600 transition-all focus:bg-white cursor-pointer" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Factory Station</label>
              <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest outline-none focus:border-blue-600 focus:bg-white transition-all appearance-none cursor-pointer">
                <option value="All">All Factory Stations</option><option value="FQC">Final Quality Control (FQC)</option><option value="Packaging">Packaging</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Outcome Filter</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest outline-none focus:border-blue-600 focus:bg-white transition-all appearance-none cursor-pointer">
                <option value="All">All CQA Outcomes</option><option value="Pass">Pass - OK Units</option><option value="Fail">Reject - NG Units</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)} 
              className="w-full bg-slate-900 text-white px-8 py-5 rounded-3xl font-black text-xs uppercase shadow-2xl flex items-center justify-center gap-3 hover:bg-black active:scale-95 transition-all ring-8 ring-slate-900/10"
            >
              <SaveIcon className="w-6 h-6" /> Export Report
            </button>
            
            {isExportDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-3xl border-4 border-slate-900 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden z-[80] animate-in slide-in-from-top-4 duration-200">
                <button onClick={() => handleExport('csv', 'reports')} className="w-full text-left px-8 py-5 hover:bg-slate-50 font-black text-black text-[12px] sm:text-sm uppercase tracking-widest border-b-2 border-slate-100 flex items-center justify-between group">
                  <span>Export as CSV</span>
                  <ChevronRightIcon className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                </button>
                <button onClick={() => handleExport('excel', 'reports')} className="w-full text-left px-8 py-5 hover:bg-slate-50 font-black text-black text-[12px] sm:text-sm uppercase tracking-widest flex items-center justify-between group">
                  <span>Export as Excel</span>
                  <ChevronRightIcon className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                </button>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-slate-100 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
              Target Selection: <span className="text-slate-900">{evidenceRows.length} Certified Records</span><br/>
              Range: <span className="text-blue-600 font-mono">{fromDate} — {toDate}</span>
            </p>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { label: 'System Audits', value: stats.total, color: 'text-slate-900', bg: 'bg-slate-50/50' },
              { label: 'Certified (OK)', value: stats.passed, color: 'text-green-600', bg: 'bg-green-50/30' },
              { label: 'Rejected (NG)', value: stats.failed, color: 'text-red-600', bg: 'bg-red-50/30' },
              { label: 'Line Load', value: `${stats.fqc}/${stats.packaging}`, color: 'text-blue-600', bg: 'bg-blue-50/30' }
            ].map(stat => (
              <div key={stat.label} className={`bg-white p-6 sm:p-8 rounded-[2rem] border-2 border-slate-100 shadow-lg text-center flex flex-col justify-center transition-all hover:-translate-y-2 hover:shadow-2xl ${stat.bg}`}>
                <p className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3 leading-tight truncate">{stat.label}</p>
                <p className={`text-2xl sm:text-4xl font-black ${stat.color} truncate leading-none`}>{stat.value}</p>
              </div>
            ))}
          </div>
          
          <TrendChart data={stats.trend} />

          <div className="bg-white p-6 sm:p-10 rounded-[3rem] border-2 border-slate-100 shadow-xl space-y-8 transition-all hover:shadow-2xl">
            <h4 className="text-[10px] sm:text-xs font-black uppercase text-slate-400 tracking-[0.3em] text-center sm:text-left">CQA Failure Density Map</h4>
            {stats.commonFailures.length > 0 ? (
              <div className="space-y-4">
                {stats.commonFailures.map(([label, count]) => (
                  <div key={label} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/80 p-5 sm:p-6 rounded-3xl border-2 border-slate-100 gap-4 group transition-all hover:bg-white hover:shadow-lg hover:border-red-100">
                    <p className="text-xs sm:text-sm font-black text-slate-800 leading-snug flex-1 truncate">{label}</p>
                    <span className="shrink-0 text-sm sm:text-lg font-black text-red-600 bg-red-100 px-5 py-2 rounded-2xl border-2 border-red-200 group-hover:scale-110 transition-transform shadow-sm">{count} Critical Failures</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 opacity-30 gap-4">
                <CheckIcon className="w-16 h-16 text-green-500" />
                <p className="text-sm font-black text-slate-500 uppercase tracking-widest">System Yield 100% Correct</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900 p-8 sm:p-12 rounded-[3.5rem] text-white shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-8 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="text-center sm:text-left min-w-0 relative z-10">
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.4em] text-green-400 leading-none mb-4">CQA Core Node Active</p>
              <h3 className="text-2xl sm:text-4xl font-black truncate leading-tight tracking-tight uppercase">Assurance Layer Secure</h3>
            </div>
            <div className="bg-white/10 p-6 rounded-[2rem] relative z-10 shadow-2xl group-hover:scale-110 transition-transform ring-8 ring-white/5">
              <CheckIcon className="w-12 h-12 sm:w-16 sm:h-16 text-green-400" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && <UserManagementSection users={users} setUsers={setUsers} />}
      
      {activeTab === 'add_checkpoint' && <CheckpointManager />}

      {selectedReport && (
        <div className="fixed inset-0 z-[100] bg-slate-900/98 backdrop-blur-3xl flex flex-col animate-in fade-in duration-300 modal-blur">
          <div className="p-6 sm:p-10 flex justify-between items-center border-b border-white/5 shrink-0 pt-[calc(1.5rem+env(safe-area-inset-top))]">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-black text-blue-400 uppercase tracking-[0.4em] leading-none mb-3">Immutable CQA Audit Document</p>
              <h3 className="text-2xl sm:text-5xl font-black text-white font-mono truncate uppercase tracking-tighter">{selectedReport.deviceId}</h3>
            </div>
            <button onClick={() => setSelectedReport(null)} className="text-white bg-white/10 p-3 sm:p-5 rounded-3xl hover:bg-white/20 ml-6 shrink-0 transition-all active:scale-90 shadow-2xl ring-2 ring-white/5"><XIcon className="w-8 h-8" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-10 no-scrollbar">
            <div className="bg-white/5 border-2 border-white/5 rounded-[3rem] p-8 sm:p-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 shadow-inner">
              <div className="space-y-2"><p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-1">Asset Traceability</p><p className="text-sm sm:text-lg font-black text-white uppercase leading-tight">Critical Node Chain</p></div>
              <div className="space-y-2"><p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-1">Audit Certification</p><p className="text-sm sm:text-lg font-black text-white leading-tight">{new Date(selectedReport.timestamp).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</p></div>
              <div className="space-y-2"><p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-1">Primary Certifier</p><p className="text-sm sm:text-lg font-black text-blue-400 uppercase leading-tight truncate">{selectedReport.userId}</p></div>
              <div className="space-y-2">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-1">Final Status</p>
                <span className={`text-sm sm:text-lg font-black px-5 py-2 rounded-2xl border-2 shadow-2xl inline-block transition-transform hover:scale-105 ${selectedReport.checkpoints.every(c => c.status === 'Pass') ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10'}`}>
                  {selectedReport.checkpoints.every(c => c.status === 'Pass') ? 'CQA CERTIFIED (OK)' : 'NON-CONFORMANT (NG)'}
                </span>
              </div>
            </div>
            
            <div className="space-y-6 pb-20 max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-10">
                <div className="h-px bg-white/10 flex-1"></div>
                <h4 className="text-[10px] sm:text-xs font-black text-white/50 uppercase tracking-[0.5em] shrink-0">CQA Audit Lifecycle Log</h4>
                <div className="h-px bg-white/10 flex-1"></div>
              </div>
              {selectedReport.checkpoints.map((cp, idx) => (
                <div key={cp.id} className="bg-white/[0.03] border-2 border-white/5 rounded-[2.5rem] overflow-hidden p-6 sm:p-10 space-y-8 transition-all hover:bg-white/[0.06] hover:border-white/10 shadow-2xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-3">Line Validation Step {idx + 1}</p>
                      <p className="text-lg sm:text-2xl font-black text-white leading-tight tracking-tight uppercase">{cp.label}</p>
                    </div>
                    <span className={`shrink-0 px-6 py-3 rounded-2xl text-[11px] sm:text-sm font-black uppercase tracking-[0.2em] shadow-2xl border-2 ${cp.status === 'Pass' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{cp.status === 'Pass' ? 'PASSED' : 'REJECTED'}</span>
                  </div>
                  {cp.image && (
                    <div className="space-y-4">
                      <div className="h-64 sm:h-[450px] rounded-[2rem] overflow-hidden bg-black shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/10 group relative">
                        <ZoomableImage src={cp.image} />
                        <div className="absolute inset-0 pointer-events-none border-[12px] border-white/5 rounded-[2rem]"></div>
                      </div>
                      <button 
                        onClick={() => downloadEvidenceImage(cp.image!, selectedReport.deviceId, selectedReport.stage || 'UNK', cp.label)}
                        className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/80 text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] rounded-2xl transition-all border-2 border-white/5 flex items-center justify-center gap-3 active:scale-95 shadow-xl group"
                      >
                        <SaveIcon className="w-5 h-5 group-hover:translate-y-1 transition-transform" /> Download Certified Evidence
                      </button>
                    </div>
                  )}
                  {cp.status === 'Fail' && cp.reason && (
                    <div className="bg-red-500/10 border-2 border-red-500/20 rounded-[2rem] p-6 sm:p-8 shadow-inner">
                      <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.3em] mb-4">Certifier Technical remark</p>
                      <p className="text-sm sm:text-lg font-bold text-white leading-relaxed italic opacity-90">"{cp.reason}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CheckpointManager: React.FC = () => {
  const [stage, setStage] = useState<'FQC' | 'Packaging'>('FQC');
  const [uploadedCheckpoints, setUploadedCheckpoints] = useState<CheckpointDefinition[]>([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const currentRules = getAllCheckpoints(stage);
    const headers = ['Rule Number', 'Rule Description'];
    const rows = currentRules.map((cp, idx) => {
      // Strip leading sequence numbering for clean editing
      const cleanLabel = cp.label.replace(/^\d+\.\s*/, '');
      return [idx + 1, `"${cleanLabel.replace(/"/g, '""')}"`];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CQA_Rules_${stage}_Template.csv`;
    link.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    
    // Check if file is Excel based on extension or mime type
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    reader.onload = (event) => {
      try {
        let rows: any[][] = [];
        
        if (isExcel) {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        } else {
          // Standard CSV parsing via XLSX for better consistency
          const data = event.target?.result as string;
          const workbook = XLSX.read(data, { type: 'string' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        }

        // Clean rows and filter out headers or empty entries
        const cleanRows = rows.filter(r => r.length > 0 && r[0] !== undefined && r[0] !== null && String(r[0]).trim() !== '');
        
        // Detect if first row is a header
        const dataRows = (cleanRows.length > 0 && String(cleanRows[0][0]).toLowerCase().includes('description')) ? cleanRows.slice(1) : cleanRows;

        const newCheckpoints: CheckpointDefinition[] = dataRows.map((row, idx) => {
          // Extract description from either 1st or 2nd column
          let desc = (row.length > 1 ? String(row[1]) : String(row[0])).trim();
          // Clean existing sequence numbering if present in the text to avoid duplicates
          desc = desc.replace(/^\d+\.\s*/, '');
          
          return {
            id: `bulk_${stage}_${Date.now()}_${idx}`,
            label: `${idx + 1}. ${desc}`,
            isMandatory: true
          };
        });

        if (newCheckpoints.length === 0) throw new Error('Invalid file format. Please upload a valid CSV or Excel file.');
        
        setUploadedCheckpoints(newCheckpoints);
        setError('');
        setSuccess(`${newCheckpoints.length} rules detected and verified.`);
      } catch (err) {
        setError('Invalid file format. Please upload a valid CSV or Excel file.');
        setSuccess('');
        setUploadedCheckpoints([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadedCheckpoints.length === 0) {
      setError('Please select a rules file first.');
      return;
    }

    // setCustomCheckpoints strictly REPLACES the array for the selected stage node
    setCustomCheckpoints(stage, uploadedCheckpoints);
    setSuccess('CQA Rules strictly updated. Previous rules archived.');
    setUploadedCheckpoints([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => setSuccess(''), 4000);
  };

  return (
    <div className="bg-slate-900 p-8 sm:p-14 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] space-y-10 border-4 border-slate-800 animate-in slide-in-from-bottom duration-500 max-w-4xl mx-auto w-full group overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-transparent pointer-events-none"></div>
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-white/10 pb-8">
        <div className="space-y-1">
          <h3 className="text-white font-black uppercase text-[11px] sm:text-sm tracking-[0.5em] leading-none mb-2">CQA RULES</h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Bulk Rule Management</p>
        </div>
        <PlusIcon className="w-10 h-10 text-white/10 shrink-0 group-hover:rotate-90 transition-transform duration-500" />
      </div>

      <form onSubmit={handleSave} className="space-y-10 relative z-10">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Deployment Station Node</label>
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            {[
              { id: 'FQC', label: 'Final Quality Control (FQC)' },
              { id: 'Packaging', label: 'Packaging' }
            ].map(s => (
              <button key={s.id} type="button" onClick={() => {setStage(s.id as any); setUploadedCheckpoints([]); setError(''); setSuccess(''); if (fileInputRef.current) fileInputRef.current.value='';}} className={`py-4 sm:py-5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all border-4 shadow-2xl px-4 ${stage === s.id ? 'bg-blue-600 text-white border-blue-400 scale-100' : 'bg-slate-800 text-slate-500 border-transparent scale-95 opacity-50'}`}>{s.label}</button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/40 p-8 sm:p-10 rounded-[2.5rem] border-2 border-dashed border-slate-700 hover:border-blue-500/50 transition-colors flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-blue-400 shadow-xl">
            <SaveIcon className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h4 className="text-white font-black uppercase text-[10px] sm:text-xs tracking-widest">Upload Rules Package</h4>
            <p className="text-slate-500 text-[9px] uppercase tracking-wider">CSV or Excel (.xlsx) only</p>
          </div>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange} 
            accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
            className="hidden" 
            id="bulk-rule-upload"
          />
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <label htmlFor="bulk-rule-upload" className="flex-1 cursor-pointer bg-slate-800 hover:bg-slate-700 text-white font-black py-4 px-6 rounded-2xl text-[10px] uppercase tracking-widest transition-all border-2 border-slate-700 active:scale-95 shadow-lg">
              Select File
            </label>
            <button type="button" onClick={handleDownloadTemplate} className="flex-1 bg-transparent hover:bg-white/5 text-blue-400 font-black py-4 px-6 rounded-2xl text-[10px] uppercase tracking-widest transition-all border-2 border-blue-500/20 active:scale-95">
              Download Current
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {error && <p className="text-red-400 text-[10px] font-black uppercase text-center tracking-[0.2em] bg-red-500/10 py-4 rounded-2xl border-2 border-red-500/20">{error}</p>}
          {success && <p className="text-green-400 text-[10px] font-black uppercase text-center tracking-[0.2em] bg-green-500/10 py-4 rounded-2xl border-2 border-green-500/20">{success}</p>}
          
          <button type="submit" className={`w-full py-5 sm:py-7 uppercase text-[11px] sm:text-sm tracking-[0.4em] rounded-3xl transition-all shadow-2xl ring-8 ${uploadedCheckpoints.length > 0 ? 'bg-blue-600 text-white hover:bg-blue-500 ring-blue-600/5 active:scale-[0.98]' : 'bg-slate-800 text-slate-500 ring-transparent cursor-not-allowed opacity-50'}`}>
            Submit
          </button>
        </div>
        
        <div className="text-center">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] leading-relaxed">
            CRITICAL: Submission completely replaces existing Rules.<br/>
            Inspectors will immediately see the updated sequence.
          </p>
        </div>
      </form>
    </div>
  );
};

const UserManagementSection: React.FC<{ users: User[], setUsers: (u: User[]) => void }> = ({ users, setUsers }) => {
  const [newUserId, setNewUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newStage, setNewStage] = useState<Stage>('FQC');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); if (!newUserId || !newPassword) return;
    let updated: User[];
    if (editingUserId) {
      updated = users.map(u => u.userId === editingUserId ? { ...u, password: newPassword, assignedStage: newStage } : u);
      setEditingUserId(null);
    } else {
      updated = [...users, { userId: newUserId, password: newPassword, isAdmin: false, isActive: true, assignedStage: newStage }];
    }
    setUsers(updated); saveUsers(updated);
    setNewUserId(''); setNewPassword('');
  };

  const toggleUserStatus = (userId: string) => {
    const updated = users.map(u => u.userId === userId ? { ...u, isActive: !u.isActive } : u);
    setUsers(updated);
    saveUsers(updated);
  };

  const confirmDelete = () => {
    if (!userToDelete) return;
    const updated = users.filter(x => x.userId !== userToDelete);
    setUsers(updated);
    saveUsers(updated);
    setUserToDelete(null);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-500 max-w-5xl mx-auto w-full">
      {userToDelete && (
        <div className="fixed inset-0 z-[150] bg-slate-900/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-300 modal-blur">
          <div className="bg-white rounded-[3rem] p-10 sm:p-14 max-w-lg w-full shadow-2xl border-4 border-slate-50 text-center space-y-8 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-xl ring-8 ring-red-50/50">
              <TrashIcon className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl sm:text-3xl font-black uppercase text-slate-900 tracking-tight leading-none">Security Purge</h3>
              <p className="text-xs sm:text-base font-bold text-slate-400 leading-relaxed">De-authorize certifier <span className="text-slate-900 font-black">{userToDelete}</span>? This asset lifecycle will be terminated.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={() => setUserToDelete(null)} 
                className="py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest text-slate-400 bg-slate-50 border-2 border-slate-100 hover:bg-slate-100 transition-all active:scale-95"
              >
                Abort Action
              </button>
              <button 
                onClick={confirmDelete} 
                className="py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest text-white bg-red-600 shadow-2xl hover:bg-red-700 transition-all active:scale-95 ring-4 ring-red-600/10"
              >
                Execute Purge
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 p-8 sm:p-14 rounded-[3.5rem] shadow-2xl space-y-8 border-4 border-slate-800 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-tr from-green-500/5 to-transparent opacity-30 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        <h3 className="text-white font-black uppercase text-[11px] sm:text-sm tracking-[0.4em] leading-none mb-4 relative z-10">{editingUserId ? `Updating user: ${editingUserId}` : 'Authorize New User'}</h3>
        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input value={newUserId} onChange={e => setNewUserId(e.target.value)} placeholder="Inspector UID" disabled={!!editingUserId} className="admin-input bg-slate-800/50 rounded-2xl px-6 py-5 outline-none focus:bg-slate-800 disabled:opacity-30 text-sm border-2 border-slate-800 focus:border-blue-600 transition-all uppercase tracking-widest" />
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Access key" type="password" className="admin-input bg-slate-800/50 rounded-2xl px-6 py-5 outline-none focus:bg-slate-800 border-2 border-slate-800 focus:border-blue-600 transition-all text-sm" />
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Access Scope (Required)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'FQC', label: 'FQC' },
                { id: 'Packaging', label: 'Packaging' },
                { id: 'Both', label: 'Both (FQC + Packaging)' }
              ].map(s => (
                <button key={s.id} type="button" onClick={() => setNewStage(s.id as Stage)} className={`py-3.5 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all border-2 shadow-sm ${newStage === s.id ? 'bg-blue-600 text-white border-blue-400 scale-100 shadow-blue-500/20' : 'bg-slate-800 text-slate-500 border-transparent scale-95 opacity-50'}`}>{s.label}</button>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full bg-green-600 text-white font-black py-5 sm:py-6 uppercase text-[11px] sm:text-sm tracking-[0.4em] rounded-3xl hover:bg-green-500 shadow-2xl active:scale-[0.99] transition-all ring-8 ring-green-600/5">{editingUserId ? 'Push security update' : 'Register'}</button>
          {editingUserId && <button type="button" onClick={() => { setEditingUserId(null); setNewUserId(''); setNewPassword(''); }} className="w-full text-white/40 font-black text-[9px] uppercase tracking-[0.5em] mt-4 hover:text-white transition-colors">Terminate Operation</button>}
        </form>
      </div>
      <div className="bg-white rounded-[3rem] border-2 border-slate-50 shadow-2xl overflow-hidden transition-all hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)]">
        <div className="px-10 py-8 bg-slate-50/50 border-b-2 border-slate-50 flex justify-between items-center">
          <p className="text-[10px] sm:text-xs font-black uppercase text-slate-400 tracking-[0.3em]">CQA Authorized Access Registry</p>
          <UserIcon className="w-6 h-6 text-slate-200" />
        </div>
        <div className="overflow-x-auto responsive-table-container no-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="bg-white text-slate-400 font-black uppercase tracking-[0.2em] border-b-2 border-slate-50">
              <tr>
                <th className="px-10 py-6 whitespace-nowrap">Asset Identity</th>
                <th className="px-10 py-6 whitespace-nowrap text-center">Node Link</th>
                <th className="px-10 py-6 whitespace-nowrap text-center">Access state</th>
                <th className="px-10 py-6 text-right whitespace-nowrap">Security Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50 font-bold">
              {users.map(u => (
                <tr key={u.userId} className={`hover:bg-blue-50/30 transition-colors group ${!u.isActive ? 'bg-slate-50/50 grayscale' : ''}`}>
                  <td className="px-10 py-8 text-slate-900 font-black text-sm whitespace-nowrap flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shrink-0 shadow-sm ${u.isActive ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                    {u.userId} {u.isAdmin && <span className="text-[9px] bg-slate-900 text-white px-3 py-1 rounded-xl font-black tracking-widest shrink-0 ml-3 shadow-lg">SYSTEM MANAGER</span>}
                  </td>
                  <td className="px-10 py-8 uppercase text-[10px] text-slate-500 font-black tracking-widest text-center whitespace-nowrap">
                    <span className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">{u.assignedStage === 'Both' ? 'FQC + PKG' : (u.assignedStage === 'FQC' ? 'FQC' : 'PKG')}</span>
                  </td>
                  <td className="px-10 py-8 text-center whitespace-nowrap">
                    <span className={`text-[10px] font-black uppercase px-4 py-2 rounded-2xl border-2 shadow-sm transition-all group-hover:scale-105 inline-block ${u.isActive ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                      {u.isActive ? 'Active Node' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right whitespace-nowrap">
                    {!u.isAdmin && (
                      <div className="flex justify-end items-center gap-5">
                        <div className="flex items-center gap-4 pr-6 border-r-2 border-slate-50">
                           <button 
                            onClick={() => toggleUserStatus(u.userId)}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none ring-4 ${u.isActive ? 'bg-green-500 ring-green-100 shadow-green-200' : 'bg-slate-300 ring-slate-100'} shadow-inner active:scale-90`}
                            title={u.isActive ? "Deauthorize Account" : "Authorize Account"}
                          >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-2xl transition-transform duration-300 ease-in-out ${u.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setEditingUserId(u.userId); setNewUserId(u.userId); setNewPassword(u.password); setNewStage(u.assignedStage); }} className="text-blue-600 p-3 hover:bg-blue-100 rounded-2xl transition-all shadow-sm active:scale-90 hover:shadow-lg" title="Modify Registry"><EditIcon className="w-5 h-5" /></button>
                          <button onClick={() => setUserToDelete(u.userId)} className="text-red-600 p-3 hover:bg-red-100 rounded-2xl transition-all shadow-sm active:scale-90 hover:shadow-lg" title="Erase Identity"><TrashIcon className="w-5 h-5" /></button>
                        </div>
                      </div>
                    )}
                    {u.isAdmin && <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest pr-4 italic">Immutable Root</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default App;
