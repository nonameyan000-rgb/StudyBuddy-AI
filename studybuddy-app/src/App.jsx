import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InlineMath, BlockMath } from 'react-katex';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { AuthProvider, useAuth } from './context/AuthContext';
import AuthModal from './components/AuthModal';
import { uploadDocument, saveGeneratedDeckAndCards, fetchUserDocuments, fetchCardsForDocument, downloadDocumentBlob, isImageFilename, deleteDocument, renameDocument } from './lib/db';
import { generateFlashcardsForFile, isImageFile } from './services/aiService';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { BookOpen, BrainCircuit, Check, CheckCircle2, ChevronLeft, ChevronRight, Download, Edit2, FileText, Image as ImageIcon, Layers, Loader2, Maximize, Menu, Play, Plus, ScrollText, Search, Trash2, X, XCircle, Zap, ZoomIn, ZoomOut } from 'lucide-react';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppContent() {
  const { session } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('login');

  const openModal = (mode) => {
    setModalMode(mode);
    setIsModalOpen(true);
  };

  return (
    <>
      <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} initialMode={modalMode} />
      <Routes>
        <Route path="/" element={<LandingPage openModal={openModal} />} />
        <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/" />} />
      </Routes>
    </>
  );
}

function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Library state
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // Document Management States
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingDocId, setRenamingDocId] = useState(null);
  const [renameInput, setRenameInput] = useState('');
  
  // Study Mode
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [currentStudyIndex, setCurrentStudyIndex] = useState(0);

  // Active document & cards
  const [activeDocument, setActiveDocument] = useState(null);
  const [generatedCards, setGeneratedCards] = useState([]);
  const [isFetchingCards, setIsFetchingCards] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);

  // Cleanup blob URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Upload & generation state
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDocumentOnMobile, setShowDocumentOnMobile] = useState(true);

  const fileInputRef = useRef(null);
  const visibleCardsContainerRef = useRef(null);
  const pdfExportContainerRef = useRef(null);

  // ─── On Mount: Load all documents from Supabase ───────────────────────────
  useEffect(() => {
    async function loadDocuments() {
      setIsLoadingDocs(true);
      try {
        const docs = await fetchUserDocuments();
        setDocuments(docs);
      } catch (err) {
        console.error('Failed to load documents:', err);
      } finally {
        setIsLoadingDocs(false);
      }
    }
    if (user) loadDocuments();
  }, [user]);

  // ─── Select a document: sets active & fetches its cards ──────────────────
  const handleSelectDocument = async (doc) => {
    // If same doc selected, do nothing
    if (activeDocument?.id === doc.id) return;
    setActiveDocument(doc);
    setGeneratedCards([]);
    setIsFetchingCards(true);
    setBlobUrl(null);
    if (doc.storage_path) {
      downloadDocumentBlob(doc.storage_path).then(blob => {
        if (blob) {
          setBlobUrl(URL.createObjectURL(blob));
          // Attach blob as rawFile so handleGenerate has data to process!
          setActiveDocument(prev => ({ ...prev, rawFile: blob }));
        }
      });
    }
    try {
      const cards = await fetchCardsForDocument(doc.id);
      setGeneratedCards(cards);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setIsFetchingCards(false);
    }
  };

    // ─── CRUD Handlers ────────────────────────────────────────────────────────
  const handleDeleteDocument = async (e, doc) => {
    e.stopPropagation(); // Prevent selection
    if (!window.confirm(`Are you sure you want to delete "${doc.filename}"? This cannot be undone.`)) return;

    try {
      await deleteDocument(doc);
      // Remove from UI
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      // Cleanup if currently open
      if (activeDocument && activeDocument.id === doc.id) {
        setActiveDocument(null);
        setGeneratedCards([]);
        setBlobUrl(null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const startRenaming = (e, doc) => {
    e.stopPropagation();
    setRenamingDocId(doc.id);
    setRenameInput(doc.filename);
  };

  const confirmRename = async (e, doc) => {
    e.stopPropagation();
    if (!renameInput.trim() || renameInput === doc.filename) {
      setRenamingDocId(null);
      return;
    }
    
    try {
      await renameDocument(doc.id, renameInput);
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, filename: renameInput } : d));
      if (activeDocument?.id === doc.id) {
        setActiveDocument(prev => ({ ...prev, filename: renameInput }));
      }
      setRenamingDocId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setIsUploading(true);
    try {
      const doc = await uploadDocument(user.id, file);
      // Prepend to library so it appears at top (matches descending DB order)
      setDocuments(prev => [doc, ...prev]);
      // Auto-select the new doc (rawFile is attached so preview works)
      setActiveDocument(doc);
      setGeneratedCards([]);
      setBlobUrl(URL.createObjectURL(file));
    } catch (err) {
      console.error('FULL SUPABASE ERROR (upload):', err);
      alert(`Upload Error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!activeDocument || !activeDocument.rawFile) return;
    setIsGenerating(true);

    try {
      // Unified multimodal pipeline — auto-detects PDF vs image
      const rawCards = await generateFlashcardsForFile(
        activeDocument.rawFile,
        (step) => setGenerationStep(step)
      );

      setGenerationStep('Saving cards to Supabase...');
      const { cards } = await saveGeneratedDeckAndCards(
        user.id,
        activeDocument.id,
        activeDocument.filename,
        rawCards
      );

      setGeneratedCards(cards);
    } catch (error) {
      console.error('FULL SUPABASE ERROR (generate):', error);
      alert(`Generation Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };
  
  const handleSignOut = async () => {
    // Clear all local state before navigating for privacy
    setDocuments([]);
    setActiveDocument(null);
    setGeneratedCards([]);
    await signOut();
    navigate('/');
  };

  const exportAnki = () => {
    if (generatedCards.length === 0) return;
    
    let csvContent = "Front,Back\n";
    generatedCards.forEach(card => {
      // Escape double quotes and wrap the whole field in double quotes 
      // to handle newlines, commas, and LaTeX special characters safely
      const front = `"${(card.front || '').replace(/"/g, '""')}"`;
      const back = `"${(card.back || '').replace(/"/g, '""')}"`;
      csvContent += `${front},${back}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDocument?.filename ? activeDocument.filename.replace(/\.[^/.]+$/, "") : 'flashcards'}_ankideck.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportMenuOpen(false);
  };

  const exportMarkdown = () => {
    if (generatedCards.length === 0) return;
    let mdContent = `# ${activeDocument?.filename ? activeDocument.filename.replace(/\.[^/.]+$/, "") : 'Flashcards'}\n\n`;
    generatedCards.forEach((card, index) => {
      mdContent += `### Card ${index + 1}\n**Q:** ${card.front}\n\n**A:** ${card.back}\n\n---\n\n`;
    });
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDocument?.filename ? activeDocument.filename.replace(/\.[^/.]+$/, "") : 'flashcards'}_notion.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportMenuOpen(false);
  };

  const exportCaptureSettings = {
    scale: 2, 
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc) => {
      const style = clonedDoc.createElement('style');
      style.innerHTML = '* { color-interpolation: sRGB !important; }';
      clonedDoc.head.appendChild(style);

      const elements = clonedDoc.getElementsByTagName('*');
      for (let el of elements) {
        const comp = clonedDoc.defaultView ? clonedDoc.defaultView.getComputedStyle(el) : window.getComputedStyle(el);
        const classes = typeof el.className === 'string' ? el.className : '';
        
        ['color', 'backgroundColor', 'borderBottomColor', 'borderTopColor', 'borderLeftColor', 'borderRightColor'].forEach(prop => {
          const val = comp[prop];
          if (val && val.includes('oklch')) {
             let fallback = '#000000';
             if (prop.includes('background')) fallback = classes.includes('bg-gray') ? '#f9fafb' : '#ffffff';
             else if (prop.includes('color')) fallback = classes.includes('text-red') ? '#ef4444' : (classes.includes('text-gray-400') ? '#9ca3af' : '#111827');
             else if (prop.includes('border')) fallback = '#e5e7eb';
             
             el.style[prop] = fallback;
          }
        });
      }
    }
  };

  const exportImage = async (format) => {
    if (!pdfExportContainerRef.current || generatedCards.length === 0) return;
    setIsExportingPDF(true);
    setIsExportMenuOpen(false);
    
    try {
      // Wait for KaTeX to finish rendering in the hidden clone
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const canvas = await html2canvas(pdfExportContainerRef.current, exportCaptureSettings);
      
      const imgData = canvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.9 : undefined);
      const link = document.createElement('a');
      link.download = `${activeDocument?.filename ? activeDocument.filename.replace(/\.[^/.]+$/, "") : 'flashcards'}.${format}`;
      link.href = imgData;
      // Real browser download using anchor
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Capture failed:", err);
      alert(`Failed to export ${format.toUpperCase()}. Please check console.`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const exportPDF = async () => {
    if (!pdfExportContainerRef.current || generatedCards.length === 0) return;
    setIsExportingPDF(true);
    setIsExportMenuOpen(false);
    
    try {
      // Wait for KaTeX to finish rendering in the hidden clone
      await new Promise(resolve => setTimeout(resolve, 1000));

      const canvas = await html2canvas(pdfExportContainerRef.current, exportCaptureSettings);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const margin = 15;
      const widthToPrint = pdfWidth - (margin * 2);
      const heightToPrint = (imgProps.height * widthToPrint) / imgProps.width;
      
      let heightLeft = heightToPrint;
      let position = 15; // Top margin

      pdf.addImage(imgData, 'PNG', margin, position, widthToPrint, heightToPrint);
      heightLeft -= (pdfHeight - position - 15);

      while (heightLeft > 0) {
        position = heightLeft - heightToPrint;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, widthToPrint, heightToPrint);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`${activeDocument?.filename ? activeDocument.filename.replace(/\.[^/.]+$/, "") : 'flashcards'}.pdf`);
    } catch (err) {
      console.error("Capture failed:", err);
      alert('Failed to export PDF. Please check console.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleSelectFromSidebar = async (doc) => {
    setIsSidebarOpen(false); // Close mobile sidebar automatically
    // If it has a rawFile attached (just uploaded), keep that
    if (doc.rawFile) {
      setActiveDocument(doc);
      setGeneratedCards([]);
      setIsFetchingCards(true);
      setBlobUrl(URL.createObjectURL(doc.rawFile));
      try {
        const cards = await fetchCardsForDocument(doc.id);
        setGeneratedCards(cards);
      } catch (err) { console.error(err); }
      finally { setIsFetchingCards(false); }
    } else {
      await handleSelectDocument(doc);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#fafafa] text-gray-900 font-sans selection:bg-red-100 selection:text-red-900">
      
      {/* 1. LEFT SIDEBAR (Navigation & Library) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={`fixed inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 md:relative md:translate-x-0 w-64 bg-white border-r border-gray-200 flex flex-col shrink-0`}>
        <div className="h-16 px-6 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div onClick={() => navigate('/')} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <Zap className="w-5 h-5 text-red-600" />
            <span className="font-bold text-lg tracking-tight">StudyBuddy</span>
          </div>
          <button className="md:hidden text-gray-400 hover:text-gray-600" onClick={() => setIsSidebarOpen(false)}>
             <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-100">
           <button 
             onClick={() => fileInputRef.current?.click()}
             disabled={isUploading}
             className="w-full bg-red-600 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-red-700 transition-colors shadow-sm"
           >
             {isUploading ? <span className="animate-pulse text-sm">Uploading...</span> : <><Plus className="w-4 h-4"/> <span className="text-sm">New Upload</span></>}
           </button>
           <input type="file" accept="application/pdf,image/*" className="hidden" ref={fileInputRef} onChange={handleUpload} />
        </div>
        
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
           <div className="flex items-center justify-between mb-3 px-1">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Your Library</p>
           </div>
           
           <div className="relative mb-3">
             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
             <input 
               type="text" 
               placeholder="Search files..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-shadow"
             />
           </div>

           <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar -mx-2 px-2">
             {isLoadingDocs ? (
               <div className="space-y-2">
                 {[1,2,3].map(i => (
                   <div key={i} className="h-8 bg-gray-100 rounded-md animate-pulse" />
                 ))}
               </div>
             ) : documents.length === 0 ? (
                 <p className="text-xs text-gray-400 italic">No documents yet. Upload your first file!</p>
             ) : (
                 documents.filter(doc => doc.filename.toLowerCase().includes(searchQuery.toLowerCase())).map(doc => {
                   const isImg = doc.rawFile && isImageFile(doc.rawFile);
                   const isActive = activeDocument?.id === doc.id;
                   const Icon = isImg ? ImageIcon : FileText;
                   return (
                     <div key={doc.id}
                          onClick={() => handleSelectFromSidebar(doc)}
                          className={`group p-2.5 rounded-md cursor-pointer flex items-center justify-between text-sm transition-colors ${isActive ? 'bg-red-50 text-red-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-red-500' : 'text-gray-400'}`} />
                          {renamingDocId === doc.id ? (
                             <input 
                               type="text"
                               autoFocus
                               value={renameInput}
                               onChange={(e) => setRenameInput(e.target.value)}
                               onClick={(e) => e.stopPropagation()}
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter') confirmRename(e, doc);
                                 if (e.key === 'Escape') setRenamingDocId(null);
                               }}
                               className="w-full bg-white border border-gray-300 rounded px-1.5 py-0.5 text-gray-900 outline-none ring-1 ring-red-500 text-xs"
                             />
                          ) : (
                             <span className="truncate">{doc.filename}</span>
                          )}
                        </div>
                        
                        <div className={`flex items-center gap-1.5 pl-2 opacity-0 group-hover:opacity-100 transition-opacity ${renamingDocId === doc.id ? 'opacity-100' : ''}`}>
                          {renamingDocId === doc.id ? (
                            <>
                              <CheckCircle2 onClick={(e) => confirmRename(e, doc)} className="w-3.5 h-3.5 text-green-600 hover:text-green-700" />
                              <XCircle onClick={(e) => { e.stopPropagation(); setRenamingDocId(null); }} className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                            </>
                          ) : (
                            <>
                              <Edit2 onClick={(e) => startRenaming(e, doc)} className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                              <Trash2 onClick={(e) => handleDeleteDocument(e, doc)} className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" />
                            </>
                          )}
                        </div>
                     </div>
                   );
                 })
             )}
           </div>
        </div>

        <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-400 font-medium mb-2 px-2 truncate">
              {user?.email}
            </div>
            <button onClick={handleSignOut} className="w-full text-left text-sm text-gray-900 font-medium hover:text-red-600 py-1.5 px-2 rounded-md hover:bg-red-50 transition-colors">
              Log out
            </button>
        </div>
      </aside>

      {/* 2. CENTER WORKSPACE (Document View) */}
      <main className={`flex-1 flex col relative isolate overflow-hidden min-w-0 ${showDocumentOnMobile ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
         {/* Subtle Dot Grid */}
         <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-20 mix-blend-multiply pointer-events-none -z-10"></div>
            
         {activeDocument ? (
             <>
               <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-10 transition-all">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                     <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-1.5 -ml-1 text-gray-500 hover:bg-gray-100 rounded-md shrink-0">
                        <Menu className="w-5 h-5" />
                     </button>
                     <h2 className="font-semibold text-gray-900 flex items-center gap-2.5 truncate">
                        <ScrollText className="w-5 h-5 text-gray-400 shrink-0 hidden sm:block" />
                        <span className="truncate">{activeDocument.filename}</span>
                     </h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                       onClick={() => setShowDocumentOnMobile(false)}
                       className="md:hidden text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all"
                    >
                       Cards &rarr;
                    </button>
                    <button 
                       onClick={handleGenerate}
                       disabled={isGenerating}
                       className="bg-white border border-gray-200 text-gray-800 font-medium px-3 md:px-4 py-1.5 md:py-2 rounded-lg hover:border-red-200 hover:text-red-600 shadow-sm hover:shadow transition-all text-xs md:text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin"/> <span className="hidden sm:inline">Generating...</span></> : <><BrainCircuit className="w-4 h-4"/> <span className="hidden sm:inline">Generate Cards</span></>}
                    </button>
                  </div>
               </header>
               
               <div className="flex-1 p-3 md:p-6 relative overflow-hidden">
                 {isGenerating && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center flex-col">
                       <BrainCircuit className="w-16 h-16 text-red-600 mb-6 animate-pulse" />
                       <h3 className="text-xl font-bold text-gray-900">AI is Analyzing your Document</h3>
                       <p className="text-sm text-gray-600 mt-3 font-medium bg-white px-4 py-1.5 rounded-full border border-gray-200 shadow-sm animate-pulse">{generationStep}</p>
                    </div>
                 )}
                 {activeDocument.rawFile ? (
                   // Fresh upload - use in-memory File object
                   isImageFile(activeDocument.rawFile) ? (
                     <ImageViewer file={activeDocument.rawFile} />
                   ) : (
                     <object
                        data={blobUrl}
                        type="application/pdf"
                        className="w-full h-full rounded-2xl shadow-sm border border-gray-200 bg-white"
                     >
                        <p className="p-8 text-gray-500">Your browser does not support inline PDFs.</p>
                     </object>
                   )
                 ) : (() => {
                   // Historical doc - render using downloaded Blob URL
                   if (!blobUrl) return (
                     <div className="w-full h-full rounded-2xl border border-gray-200 shadow-sm bg-white flex flex-col items-center justify-center gap-4">
                       <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
                       <p className="text-gray-500 text-sm font-medium">Downloading document securely...</p>
                     </div>
                   );

                   return isImageFilename(activeDocument.filename) ? (
                     <div className="w-full h-full overflow-auto rounded-2xl border border-gray-200 bg-[#f0f0f0] flex items-center justify-center p-4">
                       <img
                         src={blobUrl}
                         loading="lazy"
                         alt={activeDocument.filename}
                         className="max-w-full max-h-full rounded-xl shadow-sm object-contain"
                         onError={(e) => console.error('❌ Blob Image failed to load.')}
                       />
                     </div>
                   ) : (
                     <iframe
                       src={blobUrl}
                       title={activeDocument.filename}
                       className="w-full h-full rounded-2xl shadow-sm border border-gray-200 bg-white"
                       onError={(e) => console.error('❌ Blob iframe failed to load.')}
                     />
                   );
                 })()}
               </div>
             </>
         ) : (
             <div className="flex-1 flex items-center justify-center">
                <div className="text-center bg-white p-6 md:p-12 rounded-3xl border border-gray-100 shadow-[0_0_40px_rgba(0,0,0,0.02)] max-w-sm mx-4">
                   <div className="flex justify-center mb-4 md:hidden">
                      <button onClick={() => setIsSidebarOpen(true)} className="flex items-center gap-2 text-sm bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                         <Menu className="w-4 h-4" /> Open Menu
                      </button>
                   </div>
                   <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-gray-400 shadow-sm">
                      <Layers className="w-8 h-8 md:w-10 md:h-10 text-gray-300" />
                   </div>
                   <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-3">No Document Open</h3>
                   <p className="text-xs md:text-sm text-gray-500 leading-relaxed">Select a document from your library or upload a new one to begin generating flashcards.</p>
                </div>
             </div>
         )}
      </main>

      {/* 3. RIGHT SIDEBAR (Flashcard Panel) */}
      <aside className={`w-full md:w-80 lg:w-96 bg-white border-l border-gray-200 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-20 shrink-0 ${!showDocumentOnMobile ? 'flex' : 'hidden md:flex'}`}>
          <header className="h-16 border-b border-gray-200 flex items-center px-2 md:px-4 shrink-0 bg-white relative z-10">
             <div className="w-full flex items-center justify-between bg-white/50 border border-gray-200 rounded-xl px-2 md:px-3 py-1.5 shadow-sm">
                 <h3 className="font-semibold text-gray-900 flex items-center gap-1.5 md:gap-2 text-sm">
                    <button onClick={() => setShowDocumentOnMobile(true)} className="md:hidden p-1 -ml-1 text-gray-500 hover:bg-gray-100 rounded-md shrink-0">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <BookOpen className="w-4 h-4 text-red-600 hidden sm:block" />
                    Flashcards
                 </h3>
                 <div className="flex items-center gap-2">
                   <button onClick={() => { setIsStudyMode(true); setCurrentStudyIndex(0); }} disabled={generatedCards.length===0} className="text-gray-500 hover:text-red-600 bg-white hover:bg-red-50 border border-gray-200 p-1.5 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" title="Study Mode">
                      <Maximize className="w-3.5 h-3.5" />
                   </button>
                   <div className="relative">
                     <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} disabled={generatedCards.length===0 || isExportingPDF} className="text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isExportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} 
                        {isExportingPDF ? 'Exporting...' : 'Export'}
                     </button>
                     
                     <AnimatePresence>
                       {isExportMenuOpen && generatedCards.length > 0 && (
                         <>
                           <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)} />
                           <motion.div 
                             initial={{ opacity: 0, y: 10, scale: 0.95 }}
                             animate={{ opacity: 1, y: 0, scale: 1 }}
                             exit={{ opacity: 0, y: 10, scale: 0.95 }}
                             transition={{ duration: 0.15 }}
                             className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
                           >
                             <div className="flex flex-col py-1">
                                <button onClick={exportPDF} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors">
                                  Download PDF
                                </button>
                                <button onClick={() => exportImage('png')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors">
                                  Save as PNG
                                </button>
                                <button onClick={() => exportImage('jpeg')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors">
                                  Save as JPEG
                                </button>
                                <button onClick={exportAnki} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors">
                                  Anki (CSV)
                                </button>
                                <button onClick={exportMarkdown} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors">
                                  Notion (Markdown)
                                </button>
                             </div>
                           </motion.div>
                         </>
                       )}
                     </AnimatePresence>
                   </div>
                 </div>
             </div>
          </header>

          <div ref={visibleCardsContainerRef} className="flex-1 overflow-y-auto p-5 bg-[#fafafa]">
             {isFetchingCards ? (
                 <div className="h-full flex flex-col items-center justify-center gap-3 p-6">
                   <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
                   <p className="text-xs text-gray-500">Loading saved cards...</p>
                 </div>
             ) : generatedCards.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-center p-6">
                     <BrainCircuit className="w-12 h-12 text-gray-200 mb-4" />
                     <p className="text-sm font-semibold text-gray-900">No cards yet</p>
                     <p className="text-xs text-gray-500 mt-2 leading-relaxed">Select a document and click "Generate Cards" to create flashcards.</p>
                 </div>
             ) : (
                <div className="space-y-4">
                  {generatedCards.map((card, i) => (
                    <motion.div
                      key={card.id || i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
                    >
                      <Flashcard card={card} />
                    </motion.div>
                  ))}
                </div>
             )}
          </div>
      </aside>
      
      {/* 4. FULLSCREEN STUDY MODE OVERLAY */}
      <AnimatePresence>
        {isStudyMode && generatedCards.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col"
          >
            <div className="h-20 px-8 flex items-center justify-between shadow-sm shrink-0">
               <div className="text-white/50 font-medium tracking-wide">
                 Card {currentStudyIndex + 1} of {generatedCards.length}
               </div>
               <button onClick={() => setIsStudyMode(false)} className="text-white hover:text-red-400 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
                 <X className="w-6 h-6" />
               </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-8">
               <div className="w-full max-w-4xl h-[60vh]">
                  <Flashcard card={generatedCards[currentStudyIndex]} large />
               </div>
            </div>

            <div className="h-32 flex items-center justify-center gap-6 shrink-0">
               <button 
                  onClick={() => setCurrentStudyIndex(i => Math.max(0, i - 1))}
                  disabled={currentStudyIndex === 0}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all"
               >
                  <ChevronLeft className="w-5 h-5" /> Previous
               </button>
               <button 
                  onClick={() => setCurrentStudyIndex(i => Math.min(generatedCards.length - 1, i + 1))}
                  disabled={currentStudyIndex === generatedCards.length - 1}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all"
               >
                  Next <ChevronRight className="w-5 h-5" />
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* 5. HIDDEN CLONE FOR EXPORTS */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
        <div ref={pdfExportContainerRef} className="w-[800px] flex flex-col gap-12 bg-white p-8">
          {generatedCards.map((card, i) => (
            <div key={`export-${card.id || i}`} className="pdf-export-card border border-gray-300 rounded-2xl bg-white flex flex-col overflow-hidden shadow-sm break-inside-avoid">
               <div className="bg-gray-50 border-b border-gray-200 px-8 py-4">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-gray-400 block mb-2">Front (Question)</span>
                  <MathText text={card.front} className="text-xl font-bold text-gray-900 block" />
               </div>
               <div className="bg-white px-8 py-6">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-red-500 block mb-2">Back (Answer)</span>
                  <MathText text={card.back} className="text-lg text-gray-700 block leading-relaxed" />
               </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function ImageViewer({ file }) {
  const [zoom, setZoom] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const zoomIn  = () => setZoom(z => Math.min(z + 0.25, 4));
  const zoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const reset   = () => setZoom(1);

  if (!objectUrl) return null;

  return (
    <>
      {/* Zoom Controls */}
      <div className="absolute top-8 right-8 z-20 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm p-1">
        <button onClick={zoomOut} className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Zoom out">
          <ZoomOut className="w-4 h-4 text-gray-600" />
        </button>
        <button onClick={reset} className="px-2 text-xs font-mono font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors py-1">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={zoomIn} className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Zoom in">
          <ZoomIn className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Scrollable image container */}
      <div
        className="w-full h-full overflow-auto rounded-2xl border border-gray-200 bg-[#f0f0f0] flex items-start justify-center cursor-zoom-in"
        onClick={() => setLightboxOpen(true)}
      >
        <img
          src={objectUrl}
          loading="lazy"
          alt="Uploaded study material"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}
          className="max-w-none rounded-xl shadow-sm my-4"
          onClick={e => { e.stopPropagation(); }}
        />
      </div>

      {/* Fullscreen Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
              className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute -top-4 -right-4 bg-white text-gray-800 hover:text-gray-900 rounded-full p-1.5 shadow-lg z-10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={objectUrl}
                loading="lazy"
                alt="Study material fullscreen"
                className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Splits a string by LaTeX delimiters and renders each segment accordingly.
 * Handles $$...$$ (block) and $...$ (inline) mixed with plain text.
 */
function MathText({ text, className = '' }) {
  if (!text) return null;

  // Split on block math $$...$$ first, then inline $...$
  const segments = [];
  // Regex: match $$...$$ or $...$
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Push plain text before this match
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('$$')) {
      segments.push({ type: 'block', content: raw.slice(2, -2).trim() });
    } else {
      segments.push({ type: 'inline', content: raw.slice(1, -1).trim() });
    }
    lastIndex = regex.lastIndex;
  }

  // Push any remaining plain text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // If no LaTeX found at all, render plain
  if (segments.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'block') {
          return (
            <span key={i} className="block my-2">
              <BlockMath math={seg.content} />
            </span>
          );
        }
        if (seg.type === 'inline') {
          return <InlineMath key={i} math={seg.content} />;
        }
        return <span key={i}>{seg.content}</span>;
      })}
    </span>
  );
}

function Flashcard({ card, large = false }) {
  const [isFlipped, setIsFlipped] = useState(false);

  // Reset flip state if a new card is passed in (like during Study Mode navigation)
  useEffect(() => { setIsFlipped(false); }, [card]);

  return (
    <div 
      className={`relative w-full cursor-pointer [perspective:1200px] ${large ? 'h-full' : 'min-h-[160px]'}`}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="w-full h-full grid"
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* FRONT FACE */}
        <div 
          className={`col-start-1 row-start-1 relative backface-hidden bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow will-change-transform ${large ? 'p-12' : 'p-6 pt-12 pb-12'}`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className="absolute top-5 left-6 text-[10px] font-bold tracking-wider uppercase text-gray-400">Front</span>
          <MathText text={card.front} className={`${large ? 'text-2xl lg:text-4xl' : 'text-base'} font-bold text-gray-900 text-center leading-relaxed`} />
          <div className="absolute bottom-5 right-6 text-[10px] text-gray-400 font-medium">Click to flip</div>
        </div>

        {/* BACK FACE */}
        <div 
          className={`col-start-1 row-start-1 relative backface-hidden bg-white border-2 border-red-100 rounded-2xl flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow will-change-transform ${large ? 'p-12' : 'p-6 pt-12 pb-12'}`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <span className="absolute top-5 left-6 text-[10px] font-bold tracking-wider uppercase text-red-500">Back</span>
          <div className="flex-1 w-full h-full flex items-center justify-center overflow-y-auto custom-scrollbar">
             <MathText text={card.back} className={`${large ? 'text-xl lg:text-3xl' : 'text-sm'} text-gray-700 font-medium leading-relaxed text-center`} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function LandingPage({ openModal }) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 font-sans selection:bg-red-100 selection:text-red-900 relative">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 cursor-pointer">
              <Zap className="w-6 h-6 text-red-600" />
              <span className="font-bold text-xl tracking-tight">StudyBuddy AI</span>
            </div>
            <nav className="hidden md:flex gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium transition-colors duration-300">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium transition-colors duration-300">Pricing</a>
            </nav>
            <div className="flex items-center gap-4">
              {session ? (
                 <>
                   <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-red-600 font-medium px-4 py-2 rounded-md transition-colors duration-300 hidden sm:block">
                     Go to Dashboard
                   </button>
                   <button onClick={signOut} className="bg-white border border-gray-200 text-gray-700 font-medium px-5 py-2 rounded-md hover:border-red-200 hover:text-red-600 transition-all duration-300 shadow-sm">
                     Log Out
                   </button>
                 </>
              ) : (
                 <>
                   <button onClick={() => openModal('login')} className="text-gray-600 hover:text-red-600 font-medium px-4 py-2 rounded-md transition-colors duration-300 hidden sm:block">
                     Login
                   </button>
                   <button onClick={() => openModal('signup')} className="bg-red-600 text-white font-medium px-5 py-2 rounded-md hover:bg-red-700 transition-all duration-300 hover:shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                     Get Started
                   </button>
                 </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <motion.section 
          className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center relative"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {/* Subtle Dot Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40 mix-blend-multiply pointer-events-none -z-10"></div>
          
          <div className="max-w-4xl mx-auto">
            <motion.h1
              variants={fadeIn}
              className="text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight"
            >
              Transform Long Reads into <br className="hidden sm:block" />
              <span className="text-red-600">Anki Cards</span> in Seconds.
            </motion.h1>
            <motion.p
              variants={fadeIn}
              className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              The ultimate AI study tool for SAT & IELTS. Upload your textbooks or PDFs, and get instant summaries and interactive flashcards.
            </motion.p>
            <motion.div
              variants={fadeIn}
              className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-20"
            >
              {session ? (
                 <button onClick={() => navigate('/dashboard')} className="w-full sm:w-auto bg-red-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-red-700 transition-all duration-300 hover:shadow-[0_0_15px_rgba(220,38,38,0.4)] text-lg">
                   Open Dashboard
                 </button>
              ) : (
                 <button onClick={() => openModal('signup')} className="w-full sm:w-auto bg-red-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-red-700 transition-all duration-300 hover:shadow-[0_0_15px_rgba(220,38,38,0.4)] text-lg">
                   Start for Free
                 </button>
              )}
              <button className="w-full sm:w-auto group flex items-center justify-center gap-2 text-gray-600 font-semibold px-8 py-4 rounded-xl hover:text-red-600 transition-all duration-300 text-lg bg-white border border-gray-200 hover:border-red-200 hover:shadow-sm">
                <Play className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
                Watch Demo
              </button>
            </motion.div>

            {/* Dashboard Preview */}
            <motion.div
              variants={fadeIn}
              className="relative mx-auto rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300 p-4 sm:p-6 overflow-hidden max-w-5xl"
            >
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 bg-white border border-gray-100 rounded-xl p-6 text-left relative overflow-hidden">
                  <div className="h-4 w-1/3 bg-gray-200 rounded mb-6"></div>
                  <div className="space-y-3">
                    <div className="h-3 w-full bg-gray-100 rounded"></div>
                    <div className="h-3 w-full bg-gray-100 rounded"></div>
                    <div className="h-3 w-5/6 bg-gray-100 rounded"></div>
                    <div className="h-3 w-full bg-gray-100 rounded"></div>
                    <div className="h-3 w-4/5 bg-gray-100 rounded"></div>
                  </div>
                  <div className="mt-8 space-y-3">
                    <div className="h-3 w-full bg-gray-100 rounded"></div>
                    <div className="h-3 w-5/6 bg-gray-100 rounded"></div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex-1 bg-white border border-gray-100 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group transition-all duration-300 hover:border-red-100">
                    <span className="text-xs text-gray-400 font-bold tracking-wider uppercase mb-2">Front</span>
                    <h3 className="text-lg font-bold text-gray-900 text-center mb-6">What is Mitochondria?</h3>
                    <div className="w-full border-t border-dashed border-gray-200 mb-6"></div>
                    <span className="text-xs text-gray-400 font-bold tracking-wider uppercase mb-2">Back</span>
                    <p className="text-gray-600 text-center text-sm font-medium">
                      The powerhouse of the cell, responsible for cellular respiration and energy production.
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center">
                     <div className="h-10 w-24 bg-gray-50 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors flex items-center justify-center text-xs font-semibold text-gray-500 cursor-pointer">Again</div>
                     <div className="h-10 w-24 bg-gray-50 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-colors flex items-center justify-center text-xs font-semibold text-gray-500 cursor-pointer">Good</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Features Section */}
        <motion.section 
          id="features" 
          className="py-24 bg-white border-y border-gray-200"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div variants={fadeIn} className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Stop writing. Start learning.</h2>
              <p className="text-lg text-gray-600">Three simple steps to maximize your study efficiency.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <motion.div variants={fadeIn} className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                <div className="w-12 h-12 bg-gray-50 text-gray-900 rounded-xl flex items-center justify-center mb-6 border border-gray-200">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">1. Upload Material</h3>
                <p className="text-gray-600 leading-relaxed">
                  Drop your PDF textbooks, lecture notes, or long-reads directly into our system.
                </p>
              </motion.div>

              {/* Feature 2 */}
              <motion.div variants={fadeIn} className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                <div className="w-12 h-12 bg-gray-50 text-red-600 rounded-xl flex items-center justify-center mb-6 border border-gray-200">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">2. AI Analysis</h3>
                <p className="text-gray-600 leading-relaxed">
                  Our engine extracts key terms, formulas, and concepts automatically with high precision.
                </p>
              </motion.div>

              {/* Feature 3 */}
              <motion.div variants={fadeIn} className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                <div className="w-12 h-12 bg-gray-50 text-gray-900 rounded-xl flex items-center justify-center mb-6 border border-gray-200">
                  <Download className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">3. Export to Anki</h3>
                <p className="text-gray-600 leading-relaxed">
                  Download a ready-to-use CSV deck or instantly study directly within our built-in app.
                </p>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Pricing Section */}
        <motion.section 
          id="pricing" 
          className="py-24 bg-[#fafafa]"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div variants={fadeIn} className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Simple, transparent pricing.</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-center">
              {/* Free Plan */}
              <motion.div variants={fadeIn} className="border border-gray-200 rounded-2xl p-8 flex flex-col bg-white shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Basic</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">Free</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-gray-600"><Check className="w-5 h-5 text-gray-400" />10 pages/month</li>
                  <li className="flex items-center gap-3 text-gray-600"><Check className="w-5 h-5 text-gray-400" />Basic AI summaries</li>
                  <li className="flex items-center gap-3 text-gray-600"><Check className="w-5 h-5 text-gray-400" />Standard export</li>
                </ul>
                <button onClick={() => openModal('signup')} className="w-full border border-gray-200 text-gray-900 font-semibold py-3 rounded-xl hover:border-gray-900 hover:bg-gray-50 transition-all duration-300">
                  Start Free
                </button>
              </motion.div>

              {/* Pro Plan */}
              <motion.div variants={fadeIn} className="border-2 border-red-600 rounded-2xl p-8 flex flex-col bg-white relative shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 md:scale-105 z-10">
                <div className="absolute top-0 right-8 -translate-y-1/2 bg-red-600 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                  Most Popular
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Pro</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">$9.99</span>
                  <span className="text-gray-500 font-medium">/mo</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-gray-900"><Check className="w-5 h-5 text-red-600" />100 pages/month</li>
                  <li className="flex items-center gap-3 text-gray-900"><Check className="w-5 h-5 text-red-600" />Advanced SAT/IELTS vocabulary</li>
                  <li className="flex items-center gap-3 text-gray-900"><Check className="w-5 h-5 text-red-600" />Priority support</li>
                </ul>
                <button onClick={() => openModal('signup')} className="w-full bg-red-600 text-white font-semibold py-3 rounded-xl hover:bg-red-700 transition-all duration-300 hover:shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                  Upgrade to Pro
                </button>
              </motion.div>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-600" />
              <span className="font-bold text-lg tracking-tight">StudyBuddy AI</span>
            </div>
            <p className="text-gray-500 text-sm">
              &copy; 2026 StudyBuddy AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
