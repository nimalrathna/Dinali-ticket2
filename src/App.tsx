import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, Ticket, Download, CheckCircle, ChevronRight, Mail, Sparkles, Lock, ShieldCheck, Users, DollarSign, Send, Image as ImageIcon, Loader2, Shield, Search, RefreshCw } from 'lucide-react';

// Ensure the attached photo is saved in your project's "public" folder as "dinali-portrait.jpg"
const DINALI_TICKET_IMAGE_URL = "/dinali-portrait.jpg";
// LIVE GOOGLE APPS SCRIPT URL
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbyMTbd4b6Yu_RlknTBLQvp4HOHutMjJyasaXQHeE1_zx3QFzrf6y79L6wSosYk8HLeV/exec";

export default function App() {
  const TICKET_PRICE = 40;
  
  useEffect(() => {
    document.title = "Swaranga 2026";
  }, []);

  // --- Core States ---
  const [maxTickets, setMaxTickets] = useState<number>(372);
  const [ticketsSold, setTicketsSold] = useState<number>(145);
  const [nextOrderId, setNextOrderId] = useState<number>(1);
  const [nextSequenceNumber, setNextSequenceNumber] = useState<number>(146);
  const [isServerSynced, setIsServerSynced] = useState<boolean>(false);

  // --- Organizer / Admin States ---
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [showAdminAuth, setShowAdminAuth] = useState<boolean>(false);
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [authError, setAuthError] = useState<boolean>(false);
  const [adminTicketType, setAdminTicketType] = useState<string>('General');
  const [confirmReset, setConfirmReset] = useState<boolean>(false); 
  
  const [ticketDatabase, setTicketDatabase] = useState<any[]>(() => {
    const saved = localStorage.getItem('dinali_ticket_database');
    return saved !== null ? JSON.parse(saved) : [];
  });

  // Booking Form States
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [mobile, setMobile] = useState<string>(''); 
  const [quantity, setQuantity] = useState<number>(1);
  const [customOrderId, setCustomOrderId] = useState<string>(''); 
  const [customStartNumber, setCustomStartNumber] = useState<string>(''); 
  
  // UI Status States
  const [requestStatus, setRequestStatus] = useState<string>('idle');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  
  // Lookup States
  const [lookupId, setLookupId] = useState<string>('');
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);

  const [userTicket, setUserTicket] = useState<any>(null);
  const ticketRef = useRef<any>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glareX: 50, glareY: 50, opacity: 0 });

  // 1. Fetch True Settings from Server on Load
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const res = await fetch(GOOGLE_API_URL, {
          method: "POST",
          body: JSON.stringify({ action: "init" })
        });
        const data = await res.json();
        if (data.success) {
          setMaxTickets(data.maxTickets);
          setTicketsSold(data.ticketsSold);
          setNextOrderId(data.nextOrderId);
          setNextSequenceNumber(data.nextSeqNo);
          setIsServerSynced(true);
        }
      } catch (err) {
        console.error("Failed to fetch initial server state", err);
      }
    };
    fetchInitialData();

    // Inject html2canvas for downloads
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Save Local Demo Database
  useEffect(() => {
    localStorage.setItem('dinali_ticket_database', JSON.stringify(ticketDatabase));
  }, [ticketDatabase]);

  const handleGenerateTicket = (e: any) => {
    e.preventDefault();
    if (ticketsSold + quantity > maxTickets) return;
    if (!name && !isAdmin) return; 
    
    const guestName = name || "VIP Guest";
    const type = isAdmin ? adminTicketType : "General";

    setRequestStatus('submitting');
    processTicketAndSendToBackend(guestName, email, mobile, quantity, type);
  };

  const processTicketAndSendToBackend = async (guestName: string, guestEmail: string, guestMobile: string, qty: number, type: string) => {
    // Determine IDs locally first as a fallback/admin specifier
    const baseOrderId = isAdmin && customOrderId ? parseInt(customOrderId, 10) : nextOrderId;
    const baseTicketNo = isAdmin && customStartNumber ? parseInt(customStartNumber, 10) : nextSequenceNumber;
    const purchaseId = baseOrderId.toString();
    const endNum = baseTicketNo + qty - 1;
    const ticketNumString = `${baseTicketNo}${qty > 1 ? ` - ${endNum}` : ''}`;
    const uniqueId = `DINALI-26-${baseTicketNo.toString().padStart(3, '0')}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const payload = {
      action: "generate",
      purchaseId: purchaseId, 
      ticketId: uniqueId,     
      ticketNumber: ticketNumString,
      source: isAdmin ? "Admin" : "Public",
      name: guestName,
      email: guestEmail,
      mobile: guestMobile, 
      quantity: qty,
      totalPrice: qty * TICKET_PRICE,
      ticketType: type,
      incrementSeq: !customStartNumber,
      incrementOrder: !customOrderId
    };

    if (isAdmin) {
      // Admin bypasses validation to allow manual overrides unconditionally
      fetch(GOOGLE_API_URL, { method: "POST", body: JSON.stringify(payload) });
      generateFinalTicket(guestName, guestEmail, guestMobile, qty, uniqueId, purchaseId, baseOrderId, type, ticketNumString, endNum);
      return;
    }

    // Public Check - Wait for Server's True Number Lock & Validation
    try {
      const response = await fetch(GOOGLE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      
      if (result.success) {
        generateFinalTicket(
          guestName, guestEmail, guestMobile, qty, 
          result.uniqueId || uniqueId, 
          result.orderId || purchaseId, 
          parseInt(result.orderId || purchaseId, 10), 
          type, 
          result.ticketNumber || ticketNumString, 
          0 // End num 0 because local sequence isn't trusted for public tracking
        );
      } else {
        if (result.error === "SOLD_OUT") {
          alert("We're sorry, but the event just sold out while processing your request!");
          // Sync server to get updated max capacity to lock UI
          setTicketsSold(maxTickets); 
        } else {
          throw new Error("Backend failed");
        }
        setRequestStatus('idle');
      }
    } catch (error) {
      console.error("Backend Error:", error);
      alert("We are experiencing high traffic and couldn't connect to the ticketing server. Please try again.");
      setRequestStatus('idle');
    }
  };

  const generateFinalTicket = (guestName: string, guestEmail: string, guestMobile: string, qty: number, predefinedId: any = null, purchaseId: string = "N/A", currentOrderId: number = nextOrderId, type: string = "General", ticketNumString: string = "", endNum: number = nextSequenceNumber) => {
    const finalTicket = {
      purchaseId: purchaseId,
      name: guestName,
      email: guestEmail || 'No Email Provided',
      mobile: guestMobile || 'No Mobile Provided',
      quantity: qty,
      totalPrice: qty * TICKET_PRICE,
      number: ticketNumString || `${ticketsSold + 1}${qty > 1 ? ` - ${ticketsSold + qty}` : ''}`,
      id: predefinedId || `DINALI-26-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      date: "Saturday 27th June 2026",
      time: "6.00pm",
      venue: "Pioneer Theatre, Castle Hill",
      type: type,
      timestamp: new Date().toLocaleString()
    };

    setUserTicket(finalTicket);
    setTicketsSold(prev => prev + qty);
    
    // Increment local state trackers ONLY for admin (Public relies on server init sync)
    if (isAdmin) {
      if (endNum > 0) setNextSequenceNumber(endNum + 1);
      if (currentOrderId > 0) setNextOrderId(currentOrderId + 1);
    }

    setCustomOrderId(''); 
    setCustomStartNumber(''); 
    setTicketDatabase([finalTicket, ...ticketDatabase]);
    setRequestStatus('approved');
  };

  const handleLookupOrder = async (e: any) => {
    e.preventDefault();
    if (!lookupId) return;
    setIsLookingUp(true);
    
    try {
      const response = await fetch(GOOGLE_API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "lookup", orderId: lookupId })
      });
      const result = await response.json();
      
      if (result.success && result.ticket) {
        viewExistingTicket(result.ticket);
        setLookupId('');
      } else {
        alert("Order ID not found in the live Database.");
      }
    } catch (err) {
      alert("Failed to connect to the database.");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handlePushSettingsToServer = async () => {
    setSyncStatus('syncing');
    try {
      await fetch(GOOGLE_API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "update_settings",
          maxTickets: maxTickets,
          nextOrderId: customOrderId ? parseInt(customOrderId, 10) : nextOrderId,
          nextSeqNo: customStartNumber ? parseInt(customStartNumber, 10) : nextSequenceNumber,
          ticketsSold: ticketsSold
        })
      });
      
      if (customOrderId) setNextOrderId(parseInt(customOrderId, 10));
      if (customStartNumber) setNextSequenceNumber(parseInt(customStartNumber, 10));
      setCustomOrderId('');
      setCustomStartNumber('');
      
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err) {
      setSyncStatus('error');
      alert("Failed to push settings to server.");
    }
  };

  const handleResendTicket = async (ticket: any) => {
    if (!ticket.purchaseId || ticket.purchaseId === "N/A") {
      alert("This ticket doesn't have an Order ID associated with it.");
      return;
    }
    const overrideEmail = window.prompt(`Resend to original (${ticket.email}) or enter new:`);
    if (overrideEmail === null) return; 

    setResendingId(ticket.purchaseId);
    try {
      await fetch(GOOGLE_API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "reprint", purchaseId: ticket.purchaseId, email: overrideEmail.trim() })
      });
      alert(`Success! Check inbox.`);
    } catch (error) {
      alert("Error resending.");
    } finally {
      setResendingId(null);
    }
  };

  // --- Download logic (MacBook / iPhone separated) ---
  const downloadTicketAsImage = async () => {
    if (!ticketRef.current || !(window as any).html2canvas) return;
    setIsDownloading(true);
    const element = ticketRef.current as any;
    const originalTransform = element.style.transform;
    element.style.transform = 'none';

    const glareOverlay = element.querySelector('.mix-blend-screen');
    if (glareOverlay) glareOverlay.style.display = 'none';

    const goldTextElements = element.querySelectorAll('.text-3d-gold');
    goldTextElements.forEach((el: any) => {
      el.dataset.originalClass = el.className;
      el.className = el.className.replace('text-3d-gold', '');
      el.style.backgroundImage = 'none';
      el.style.webkitBackgroundClip = 'initial';
      el.style.webkitTextFillColor = 'initial';
      el.style.color = '#D4AF37';
      el.style.textShadow = '0px 2px 4px rgba(0,0,0,0.8)';
    });

    try {
      const canvas = await (window as any).html2canvas(element, { useCORS: true, scale: 2, backgroundColor: '#1a0205', logging: false });
      const fileName = `Ticket_${userTicket.name.replace(/\s+/g, '_')}.png`;
      const dataUrl = canvas.toDataURL("image/png");
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const nav = navigator as any;

      if (isMobile && blob && nav.canShare && nav.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] })) {
        try {
          const file = new File([blob], fileName, { type: 'image/png' });
          await nav.share({ files: [file] });
        } catch (shareErr: any) {
          if (shareErr.name !== 'AbortError') {
            const link = document.createElement('a'); link.download = fileName; link.href = dataUrl; link.click();
          }
        }
      } else {
        const link = document.createElement('a'); link.download = fileName; link.href = dataUrl; document.body.appendChild(link); link.click(); document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Download Error:", err);
    } finally {
      element.style.transform = originalTransform;
      if (glareOverlay) glareOverlay.style.display = '';
      goldTextElements.forEach((el: any) => {
        el.className = el.dataset.originalClass;
        el.style.backgroundImage = ''; el.style.webkitBackgroundClip = ''; el.style.webkitTextFillColor = ''; el.style.color = ''; el.style.textShadow = '';
      });
      setIsDownloading(false);
    }
  };

  const handleReset = () => { setUserTicket(null); setName(''); setEmail(''); setMobile(''); setQuantity(1); setRequestStatus('idle'); };
  const viewExistingTicket = (ticket: any) => { setUserTicket(ticket); setRequestStatus('approved'); };

  const handleAdminAuth = (e: any) => {
    e.preventDefault();
    if (adminPassword === 'Dinali1984') { setIsAdmin(true); setShowAdminAuth(false); setAdminPassword(''); } else { setAuthError(true); }
  };

  const handleFactoryReset = () => {
    setTicketsSold(0);
    setNextOrderId(1);
    setNextSequenceNumber(146);
    setTicketDatabase([]);
    setConfirmReset(false);
    localStorage.removeItem('dinali_ticket_database');
    localStorage.removeItem('dinali_tickets_sold');
    localStorage.removeItem('dinali_max_tickets');
    localStorage.removeItem('dinali_next_order_id');
    localStorage.removeItem('dinali_sequence_num');
  };

  const handleMouseMove = (e: any) => {
    if (!ticketRef.current) return;
    const rect = ticketRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    const centerX = rect.width / 2; const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10; const rotateY = ((x - centerX) / centerX) * 10;
    const glareX = (x / rect.width) * 100; const glareY = (y / rect.height) * 100;
    setTilt({ x: rotateX, y: rotateY, glareX, glareY, opacity: 1 });
  };
  const handleMouseLeave = () => { setTilt({ x: 0, y: 0, glareX: 50, glareY: 50, opacity: 0 }); };

  const ticketsRemaining = maxTickets - ticketsSold;
  const progressPercentage = maxTickets > 0 ? (ticketsSold / maxTickets) * 100 : 100;

  return (
    <div className="min-h-screen bg-[#150103] text-white relative overflow-x-hidden font-sans selection:bg-yellow-500/30">
      
      {/* --- ADMIN AUTH MODAL --- */}
      {showAdminAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md print-hide p-4 animate-fade-in">
          <div className="bg-[#0a0102] border border-red-900/50 p-8 rounded-2xl max-w-sm w-full shadow-[0_0_50px_rgba(212,175,55,0.1)] relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37] rounded-t-2xl"></div>
            <div className="flex items-center space-x-3 mb-6"><Lock className="text-[#D4AF37]" size={24} /><h3 className="text-xl text-white font-light tracking-widest uppercase">Admin Access</h3></div>
            <form onSubmit={handleAdminAuth}>
              <div className="mb-6">
                <input type="password" value={adminPassword} onChange={(e) => { setAdminPassword(e.target.value); setAuthError(false); }} className={`w-full bg-[#150103] border ${authError ? 'border-red-500' : 'border-red-900/50'} text-white p-4 rounded-lg focus:outline-none focus:border-[#D4AF37] transition-colors`} placeholder="Enter Passcode" autoFocus />
                {authError && <p className="text-red-500 text-[10px] mt-2 uppercase tracking-widest absolute">Incorrect Passcode</p>}
              </div>
              <div className="flex space-x-3">
                <button type="button" onClick={() => { setShowAdminAuth(false); setAdminPassword(''); setAuthError(false); }} className="w-1/3 py-3 text-gray-400 border border-gray-800 rounded-lg uppercase text-xs font-bold tracking-widest hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="w-2/3 py-3 bg-gradient-to-r from-[#D4AF37] to-[#8B6508] text-black font-bold rounded-lg uppercase text-xs tracking-widest hover:brightness-110 transition-all flex items-center justify-center space-x-2"><span>Unlock</span><ChevronRight size={14} /></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CINEMATIC LIGHTING ENGINE --- */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 print-hide">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] bg-[radial-gradient(circle_at_center,_rgba(80,10,20,0.6)_0%,_rgba(20,2,4,1)_80%)]"></div>
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[150vh] bg-[conic-gradient(from_120deg_at_50%_0%,rgba(212,175,55,0.15)_0deg,transparent_60deg)] origin-top transform rotate-12 blur-[40px] animate-spotlight-sweep"></div>
        <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[150vh] bg-[conic-gradient(from_240deg_at_50%_0%,transparent_0deg,rgba(212,175,55,0.1)_60deg)] origin-top transform -rotate-12 blur-[50px] animate-spotlight-sweep-reverse"></div>
        {[...Array(30)].map((_, i) => (
          <Sparkles key={`star-${i}`} className="absolute text-yellow-300/70 animate-twinkle-star" style={{ width: Math.random() * 12 + 8 + 'px', height: Math.random() * 12 + 8 + 'px', left: Math.random() * 100 + '%', top: Math.random() * 100 + '%', animationDuration: Math.random() * 3 + 2 + 's', animationDelay: Math.random() * 5 + 's' }} />
        ))}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 flex flex-col items-center min-h-screen">
        
        {/* HEADER */}
        <div className="text-center w-full flex flex-col items-center relative z-20 print-hide">
          <div className="inline-flex items-center space-x-3 px-6 py-1.5 border border-white/10 rounded-full text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase text-yellow-500/80 mb-6 backdrop-blur-md bg-black/20 shadow-[0_0_30px_rgba(212,175,55,0.1)]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            <span>Live Experience {isServerSynced ? "• Online" : ""}</span>
          </div>
          
          <div className="relative w-full flex flex-col items-center justify-center z-30 mb-8 md:mb-16">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-[#D4AF37] rounded-full blur-[100px] md:blur-[150px] opacity-20 mix-blend-screen z-0 animate-pulse-slow pointer-events-none"></div>
            <h2 className="text-xs md:text-lg uppercase tracking-[0.6em] md:tracking-[0.8em] text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-white to-gray-400 mb-2 font-light ml-[0.8em] drop-shadow-md relative z-10" style={{ fontFamily: "'Montserrat', sans-serif" }}>A Musical Journey</h2>
            <h1 className="text-6xl md:text-[8rem] lg:text-[10rem] font-extrabold tracking-widest mb-1 text-3d-gold animate-shine leading-none drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] relative z-10" style={{ fontFamily: "'Abhaya Libre', serif", paddingBottom: '0.15em' }}>ස්වරාංග</h1>
            <h3 className="text-lg md:text-4xl tracking-[0.3em] md:tracking-[0.4em] text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37] mt-[-15px] md:mt-[-30px] font-bold drop-shadow-[0_10px_20px_rgba(0,0,0,1)] relative z-10" style={{ fontFamily: "'Cinzel Decorative', serif" }}>DINALI IN CONCERT</h3>

            <div className="relative z-20 mt-12 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 text-xs md:text-sm tracking-[0.2em] text-gray-200 font-medium uppercase backdrop-blur-md bg-[#2a040a]/60 py-4 px-8 border border-yellow-500/20 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
              <div className="flex items-center space-x-3"><Calendar size={16} className="text-[#D4AF37]" /><span>Sat 27 Jun 2026</span></div>
              <span className="hidden md:block text-[#D4AF37]/50">|</span>
              <div className="flex items-center space-x-3"><Clock size={16} className="text-[#D4AF37]" /><span>6:00 PM</span></div>
              <span className="hidden md:block text-[#D4AF37]/50">|</span>
              <div className="flex items-center space-x-3"><MapPin size={16} className="text-[#D4AF37]" /><span>Pioneer Theatre, Castle Hill</span></div>
            </div>
          </div>
        </div>

        <div className="w-full flex justify-center mt-8 md:mt-12 relative z-30">
          
          {isAdmin && !userTicket ? (
            /* --- ORGANIZER DASHBOARD --- */
            <div className="w-full max-w-5xl relative group animate-fade-in print-hide">
              <div className="absolute -inset-1 bg-gradient-to-r from-green-600/20 to-emerald-900/40 rounded-3xl blur-xl opacity-50"></div>
              <div className="relative w-full bg-[#0a120a]/90 border border-green-900/40 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-green-900/50 pb-6">
                  <div>
                    <h2 className="text-3xl font-light tracking-wide mb-1 text-white flex items-center gap-3"><ShieldCheck className="text-green-500" />Organizer Dashboard</h2>
                    <p className="text-green-500 text-xs uppercase tracking-[0.2em]">soulsoundsbydinali@gmail.com</p>
                  </div>
                  <button onClick={() => setIsAdmin(false)} className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white border border-gray-600 px-4 py-2.5 rounded-full transition-all">Exit Admin</button>
                </div>

                {/* STATS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  <div className="bg-black/40 border border-green-900/30 p-6 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Ticket className="text-green-500" size={32} />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Tickets Sold</p>
                        <div className="flex items-baseline space-x-2 text-2xl font-light text-white mt-1">
                          <span>{ticketsSold}</span>
                          <span className="text-sm text-gray-600">/</span>
                          <input type="number" value={maxTickets} onChange={(e) => setMaxTickets(parseInt(e.target.value, 10) || 0)} className="w-16 bg-transparent text-gray-400 text-sm focus:outline-none border-b border-dashed border-gray-600 hover:border-green-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-black/40 border border-green-900/30 p-6 rounded-2xl flex items-center space-x-4"><Users className="text-green-500" size={32} /><div><p className="text-xs text-gray-500 uppercase tracking-widest">Guest List Groups</p><p className="text-2xl font-light text-white" title="Number of unique orders/bookings">{ticketDatabase.length}</p></div></div>
                  <div className="bg-black/40 border border-green-900/30 p-6 rounded-2xl flex items-center space-x-4"><DollarSign className="text-green-500" size={32} /><div><p className="text-xs text-gray-500 uppercase tracking-widest">Est. Revenue</p><p className="text-2xl font-light text-white">${ticketsSold * TICKET_PRICE}</p></div></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  
                  {/* DIRECT GENERATOR */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-black/40 border border-green-900/20 p-6 rounded-2xl">
                      <h3 className="text-sm font-medium uppercase tracking-widest text-green-400 mb-6">Direct Generator</h3>
                      <form onSubmit={handleGenerateTicket} className="space-y-4">
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent border-b border-green-900/50 px-2 py-2 text-white placeholder-gray-600 focus:outline-none text-sm" placeholder="Guest Name" />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent border-b border-green-900/50 px-2 py-2 text-white placeholder-gray-600 focus:outline-none text-sm" placeholder="Email (Optional)" />
                        <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full bg-transparent border-b border-green-900/50 px-2 py-2 text-white placeholder-gray-600 focus:outline-none text-sm" placeholder="Mobile (Optional)" />
                        
                        <div className="flex items-center justify-between border-b border-green-900/50 pb-2 pt-2">
                          <span className="text-gray-400 text-sm px-2">Ticket Type</span>
                          <select value={adminTicketType} onChange={(e: any) => setAdminTicketType(e.target.value)} className="bg-transparent text-white focus:outline-none text-right">
                            <option value="General" className="bg-black">General</option>
                            <option value="VIP" className="bg-black">VIP</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between border-b border-green-900/50 pb-2 pt-2"><span className="text-gray-400 text-sm px-2">Total Passes</span><select value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10))} className="bg-transparent text-white focus:outline-none text-right">{[...Array(20)].map((_, i) => (<option key={i + 1} value={i + 1} className="bg-black">{i + 1}</option>))}</select></div>
                        <button type="submit" disabled={requestStatus === 'submitting'} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-black font-bold uppercase tracking-widest text-xs py-3 rounded mt-4 transition-colors">Generate Ticket</button>
                      </form>
                    </div>

                    {/* NEW: LOOKUP FEATURE */}
                    <div className="bg-black/40 border border-green-900/20 p-6 rounded-2xl">
                      <h3 className="text-sm font-medium uppercase tracking-widest text-green-400 mb-6 flex items-center gap-2"><Search size={16} /> Lookup Order</h3>
                      <form onSubmit={handleLookupOrder} className="space-y-4">
                        <input type="text" required value={lookupId} onChange={(e) => setLookupId(e.target.value)} className="w-full bg-transparent border-b border-green-900/50 px-2 py-2 text-white placeholder-gray-600 focus:outline-none text-sm" placeholder="Enter Order ID (e.g. 145)" />
                        <button type="submit" disabled={isLookingUp} className="w-full bg-transparent border border-green-600 hover:bg-green-900/30 text-green-400 font-bold uppercase tracking-widest text-xs py-3 rounded mt-2 transition-colors">{isLookingUp ? 'Searching Server...' : 'Fetch Ticket View'}</button>
                      </form>
                    </div>
                  </div>

                  {/* DATABASE TABLE */}
                  <div className="lg:col-span-2">
                    <h3 className="text-sm font-medium uppercase tracking-widest text-green-400 mb-4">Local Cache Database</h3>
                    <div className="bg-black/40 border border-green-900/20 rounded-2xl overflow-hidden max-h-[550px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-green-900/20 text-green-500 uppercase tracking-widest sticky top-0 backdrop-blur-md"><tr><th className="p-4 font-medium">Order</th><th className="p-4 font-medium">Guest</th><th className="p-4 font-medium">Passes</th><th className="p-4 font-medium text-right">Action</th></tr></thead>
                        <tbody className="divide-y divide-green-900/20">
                          {ticketDatabase.map((ticket: any, idx: any) => (
                            <tr key={idx} className="hover:bg-green-900/10 transition-colors">
                              <td className="p-4 text-yellow-500 font-mono">{ticket.purchaseId}</td>
                              <td className="p-4 text-white">{ticket.name}<div className="text-[9px] text-gray-500">{ticket.email}</div></td>
                              <td className="p-4 text-gray-400">{ticket.quantity} <span className="text-[9px] text-gray-600 ml-1">({ticket.type})</span></td>
                              <td className="p-4 text-right flex justify-end gap-2">
                                <button onClick={() => handleResendTicket(ticket)} disabled={resendingId === ticket.purchaseId} className="text-blue-400 border border-blue-900/50 px-3 py-1 rounded-full text-[10px]">Resend</button>
                                <button onClick={() => viewExistingTicket(ticket)} className="text-green-400 border border-green-900/50 px-3 py-1 rounded-full text-[10px]">View</button>
                              </td>
                            </tr>
                          ))}
                          {ticketDatabase.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-600">No cached tickets. Use the Lookup tool to fetch from server.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ADVANCED SYSTEM CONTROLS */}
                  <div className="lg:col-span-3 bg-black/40 border border-green-900/20 p-6 rounded-2xl mt-4">
                    <h3 className="text-sm font-medium uppercase tracking-widest text-green-400 mb-6 flex items-center justify-between">
                      <div className="flex items-center gap-2"><Lock size={16} /> Advanced Controls</div>
                      {syncStatus === 'success' && <span className="text-xs text-green-500 flex items-center gap-1 animate-pulse"><CheckCircle size={12}/> Synced to Server</span>}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                      <div><label className="text-xs text-gray-500 block mb-2">Next Seq No.</label><input type="number" value={customStartNumber} onChange={(e: any) => setCustomStartNumber(e.target.value)} placeholder={`Now: ${nextSequenceNumber}`} className="bg-black/50 border border-green-900/50 px-4 py-3 rounded-lg text-white w-full" /></div>
                      <div><label className="text-xs text-gray-500 block mb-2">Next Order ID</label><input type="number" value={customOrderId} onChange={(e: any) => setCustomOrderId(e.target.value)} placeholder={`Now: ${nextOrderId}`} className="bg-black/50 border border-green-900/50 px-4 py-3 rounded-lg text-white w-full" /></div>
                      <div><label className="text-xs text-gray-500 block mb-2">Tickets Sold Override</label><input type="number" value={ticketsSold} onChange={(e: any) => setTicketsSold(parseInt(e.target.value, 10))} className="bg-black/50 border border-green-900/50 px-4 py-3 rounded-lg text-white w-full" /></div>
                      <div><label className="text-xs text-gray-500 block mb-2">Total Venue Capacity</label><input type="number" value={maxTickets} onChange={(e: any) => setMaxTickets(parseInt(e.target.value, 10))} className="bg-black/50 border border-green-900/50 px-4 py-3 rounded-lg text-white w-full" /></div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-green-900/30 flex justify-between items-center">
                      <button onClick={handlePushSettingsToServer} disabled={syncStatus === 'syncing'} className="bg-gradient-to-r from-green-700 to-emerald-800 hover:brightness-110 text-white font-bold uppercase tracking-widest text-xs px-6 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50">
                        <RefreshCw size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                        {syncStatus === 'syncing' ? 'Syncing...' : 'Push Settings to Live Server'}
                      </button>
                      <button onClick={() => setConfirmReset(!confirmReset)} onDoubleClick={handleFactoryReset} className={`text-xs border px-6 py-3 rounded-lg transition-all ${confirmReset ? 'bg-red-900 text-white' : 'text-red-500 border-red-900/30'}`}>{confirmReset ? "Double Click to Reset Local" : "Clear Local Cache"}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : requestStatus === 'idle' || requestStatus === 'submitting' ? (
            /* --- REGULAR BOOKING WIDGET --- */
            <div className="w-full max-w-lg relative group print-hide">
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600/30 to-red-900/50 rounded-3xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
              <div className="relative w-full bg-[#1a0205]/80 border border-red-900/40 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-2xl">
                <div className="flex justify-between items-end mb-8 border-b border-red-900/50 pb-6">
                  <div><h2 className="text-3xl font-light tracking-wide mb-1 text-white">Reserve</h2><p className="text-[#D4AF37] text-xs uppercase tracking-[0.2em]">Official Ticketing</p></div>
                  <div className="text-right"><span className="block text-2xl font-light text-white">${TICKET_PRICE}</span><span className="text-gray-500 text-xs uppercase tracking-widest">Per Pass</span></div>
                </div>

                <div className="mb-10">
                  <div className="flex justify-between text-[10px] tracking-widest uppercase mb-3 text-gray-400"><span>Capacity</span><span className="text-[#D4AF37]">{Math.round(progressPercentage)}%</span></div>
                  <div className="w-full bg-red-950/50 h-[2px] rounded-full overflow-hidden"><div className="bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37] h-full" style={{ width: `${progressPercentage}%` }}></div></div>
                </div>

                {ticketsRemaining > 0 ? (
                  <form onSubmit={handleGenerateTicket} className="space-y-6">
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent border-b border-red-900/50 px-2 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] text-lg font-light" placeholder="Guest Name" />
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent border-b border-red-900/50 px-2 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] text-lg font-light" placeholder="Email Address" />
                    <input type="tel" required value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full bg-transparent border-b border-red-900/50 px-2 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] text-lg font-light" placeholder="Mobile Number" />
                    
                    <div className="pt-4 flex items-center justify-between border-b border-red-900/50 pb-2"><span className="text-gray-300 px-2">Passes</span><select value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10))} className="bg-transparent text-white text-xl appearance-none cursor-pointer pr-4 text-right">{[...Array(Math.min(10, ticketsRemaining))].map((_, i) => (<option key={i + 1} value={i + 1} className="bg-[#1a0205]">{i + 1}</option>))}</select></div>

                    <div className="pt-8">
                      <button type="submit" disabled={requestStatus === 'submitting'} className="w-full bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37] text-black font-bold text-sm tracking-[0.2em] uppercase py-5 rounded-sm transition-all flex items-center justify-center space-x-3 disabled:opacity-70">
                        {requestStatus === 'submitting' ? (
                          <div className="flex items-center space-x-2"><Shield size={18} className="animate-pulse" /><span>Security Verification...</span></div>
                        ) : (
                          <><span>Secure Passes • ${quantity * TICKET_PRICE}</span><ChevronRight size={18} /></>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="text-center p-6 border border-red-900/50 bg-red-900/10 rounded-sm font-bold uppercase tracking-widest text-red-500">Event Sold Out</div>
                )}
              </div>
            </div>
          ) : (
            /* --- THE 3D TICKET VIEW --- */
            <div className="w-full flex flex-col items-center animate-fade-in-up mt-[-40px]">
              <p className="text-xs text-green-400 tracking-[0.3em] uppercase mb-12 animate-pulse drop-shadow-md print-hide">Credentials Verified</p>

              <div className="perspective-1000 mb-12" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
                <div ref={ticketRef} id="digital-ticket" className="w-full max-w-4xl relative rounded-xl overflow-hidden flex flex-col md:flex-row bg-[#1a0205] border border-red-900/50 shadow-[0_30px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(212,175,55,0.2)] transition-transform duration-200 ease-out preserve-3d" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
                  <div className="absolute inset-0 pointer-events-none mix-blend-screen z-50 transition-opacity duration-300" style={{ opacity: tilt.opacity, background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 50%)` }}></div>

                  <div className="relative flex-1 p-8 md:p-12 bg-gradient-to-br from-[#3a0612] via-[#1a0205] to-[#0a0102] overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] pointer-events-none"></div>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37]"></div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37]"></div>
                    
                    <div className="relative z-10 flex flex-col h-full justify-between min-h-[350px]">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2 text-yellow-500 mb-6 border border-yellow-500/30 px-3 py-1 inline-flex rounded-sm"><Sparkles size={12} /><span className="text-[10px] font-bold tracking-[0.4em] uppercase">Theatre Access</span></div>
                          <h2 className="text-xs md:text-sm uppercase tracking-[0.5em] text-gray-400 mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>A Musical Journey</h2>
                          <h1 className="text-4xl md:text-6xl font-extrabold text-3d-gold mb-1" style={{ fontFamily: "'Abhaya Libre', serif" }}>ස්වරාංග</h1>
                          <h3 className="text-lg md:text-xl tracking-[0.3em] text-white/90 uppercase" style={{ fontFamily: "'Cinzel Decorative', serif" }}>Dinali In Concert</h3>
                        </div>
                        <div className="flex flex-col items-end space-y-4">
                          <div className="w-16 h-16 rounded-full border border-white/20 bg-gradient-to-br from-yellow-300/20 via-yellow-600/20 flex items-center justify-center backdrop-blur-md"><span className="text-[8px] tracking-widest text-white/50 text-center uppercase leading-tight">Official<br/>Seal</span></div>
                          <div className="w-20 h-28 md:w-28 md:h-36 rounded-md overflow-hidden border border-[#D4AF37]/40 shadow-xl relative"><img src={DINALI_TICKET_IMAGE_URL} alt="Dinali" crossOrigin="anonymous" className="w-full h-full object-cover object-[center_top]" onError={(e: any) => e.target.src = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80"} /></div>
                        </div>
                      </div>

                      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-left border-t border-red-900/40 pt-6">
                        <div><p className="text-[9px] text-gray-400 uppercase tracking-widest mb-1">Date</p><p className="font-light text-sm tracking-wider">Sat 27 Jun</p></div>
                        <div><p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Time</p><p className="font-light text-sm tracking-wider">6:00 PM</p></div>
                        <div><p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Venue</p><p className="font-light text-sm tracking-wider">{userTicket.venue}</p></div>
                        <div><p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Admit</p><p className="font-light text-sm tracking-wider">{userTicket.quantity} Person(s)</p></div>
                      </div>
                    </div>
                  </div>

                  <div className="relative w-full md:w-80 bg-[#170104] border-t border-red-900/40 md:border-t-0 md:border-l p-8 flex flex-col items-center justify-between">
                    <div className="w-full">
                      <p className="text-[9px] text-gray-400 uppercase tracking-[0.3em] mb-1">Guest Name</p>
                      <p className="text-lg font-light tracking-wider uppercase border-b border-red-900/40 pb-4 mb-4 text-white">{userTicket.name}</p>
                      <div className="flex justify-between items-end mb-8">
                        <div><p className="text-[9px] text-gray-500 uppercase tracking-[0.3em] mb-1">Section</p><p className="text-xl font-light text-[#D4AF37] tracking-wider">{userTicket.type || 'General'}</p></div>
                        <div className="text-right"><p className="text-[9px] text-gray-500 uppercase tracking-[0.3em] mb-1">Pass No.</p><p className="text-sm font-mono text-gray-300 tracking-widest">{userTicket.number}</p></div>
                      </div>
                    </div>
                    <div className="w-full flex justify-center bg-white p-2 rounded-sm mb-4"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(userTicket.id)}&color=000000&bgcolor=ffffff`} alt="QR" crossOrigin="anonymous" className="w-28 h-28 md:w-32 md:h-32" /></div>
                    <div className="w-full h-8 bg-repeat-x opacity-40 flex">
                      {[...Array(30)].map((_, i) => (<div key={i} className="h-full bg-white" style={{ width: Math.random() * 4 + 1 + 'px', marginRight: Math.random() * 3 + 1 + 'px' }}></div>))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-6 print-hide w-full max-w-4xl mt-8">
                <button onClick={downloadTicketAsImage} disabled={isDownloading} className="bg-white text-black font-bold uppercase tracking-[0.2em] px-8 py-4 rounded-md hover:bg-yellow-500 transition-colors flex items-center space-x-3 shadow-xl disabled:opacity-70 group relative overflow-hidden">
                  <div className="absolute inset-0 w-[200%] translate-x-[-100%] bg-gradient-to-r from-transparent via-white/50 to-transparent group-hover:translate-x-[50%] transition-transform duration-1000"></div>
                  {isDownloading ? (<><Loader2 size={18} className="animate-spin" /><span>Saving...</span></>) : (<><ImageIcon size={18} /><span>Save to Photos</span></>)}
                </button>
                <button onClick={handleReset} className="text-xs uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-colors border-b border-transparent hover:border-white">{isAdmin ? "Back to Dashboard" : "Issue Another"}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-50 print-hide"><button onClick={() => { if (isAdmin) setIsAdmin(false); else setShowAdminAuth(true); }} className={`p-3 rounded-full backdrop-blur-md transition-all ${isAdmin ? 'bg-green-600 text-white shadow-xl' : 'bg-black/40 text-gray-600 border border-white/10 hover:text-white'}`}><Lock size={16} /></button></div>

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Abhaya+Libre:wght@800&family=Montserrat:wght@200;300;400;500&family=Cinzel+Decorative:wght@400;700;900&display=swap');
        .text-3d-gold { background-image: linear-gradient(to right, #D4AF37, #FFF8DC, #D4AF37, #FFF8DC, #D4AF37); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0px 1px 0px #5c3a02) drop-shadow(0px 2px 0px #422901) drop-shadow(0px 3px 0px #2e1c00) drop-shadow(0px 4px 15px rgba(212,175,55,0.4)); }
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes shine { to { background-position: 200% center; } }
        @keyframes spotlight-sweep { 0%, 100% { transform: rotate(12deg) scale(1); opacity: 0.5; } 50% { transform: rotate(15deg) scale(1.1); opacity: 0.8; } }
        @keyframes spotlight-sweep-reverse { 0%, 100% { transform: rotate(-12deg) scale(1); opacity: 0.5; } 50% { transform: rotate(-15deg) scale(1.1); opacity: 0.8; } }
        @keyframes pulse-slow { 0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.05); } }
        @keyframes twinkle-star { 0%, 100% { opacity: 0.2; transform: scale(0.6) rotate(0deg); } 50% { opacity: 1; transform: scale(1.2) rotate(45deg); } }
        .animate-fade-in-up { animation: fade-in-up 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
        .animate-shine { animation: shine 6s linear infinite; }
        .animate-spotlight-sweep { animation: spotlight-sweep 10s ease-in-out infinite; }
        .animate-spotlight-sweep-reverse { animation: spotlight-sweep-reverse 12s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 5s ease-in-out infinite; }
        .animate-twinkle-star { animation: twinkle-star 3s ease-in-out infinite; }
        @media print { .print-hide { display: none !important; } #digital-ticket { transform: none !important; box-shadow: none !important; margin: 0 auto !important; } .mix-blend-screen { display: none !important; } }
      `}} />
    </div>
  );
}
