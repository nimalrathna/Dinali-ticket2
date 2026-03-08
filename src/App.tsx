import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, Ticket, Download, CheckCircle, ChevronRight, Mail, Sparkles, Lock, ShieldCheck, Users, DollarSign, Send, Image as ImageIcon, Loader2, Shield, Search, RefreshCw } from 'lucide-react';

// Ensure the attached photo is saved in your project's "public" folder as "dinali-portrait.jpg"
const DINALI_TICKET_IMAGE_URL = "/dinali-portrait.jpg";
// LIVE GOOGLE APPS SCRIPT URL
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbzVkAooYNGoSch8MLdCGC1HITma34IW8rV0eeO57nI3TWtGL17VYmo8R-0WZIHHqQWV/exec";

export default function App() {
  const ADULT_PRICE = 40;
  const CHILD_PRICE = 15;
  
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
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [adminTicketType, setAdminTicketType] = useState<string>('General');

  const [ticketDatabase, setTicketDatabase] = useState<any[]>(() => {
    const saved = localStorage.getItem('dinali_ticket_database');
    return saved !== null ? JSON.parse(saved) : [];
  });

  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [mobile, setMobile] = useState<string>(''); 
  
  // --- New Ticket Quantity States ---
  const [adultQuantity, setAdultQuantity] = useState<number>(1);
  const [childQuantity, setChildQuantity] = useState<number>(0);

  const [customOrderId, setCustomOrderId] = useState<string>('');
  const [customStartNumber, setCustomStartNumber] = useState<string>(''); 
  const [requestStatus, setRequestStatus] = useState<string>('idle');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  
  const [userTicket, setUserTicket] = useState<any>(null);

  // --- 3D Ticket Interactive States ---
  const ticketRef = useRef<any>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glareX: 50, glareY: 50, opacity: 0 });

  // --- Sync Initial Load with Server ---
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await fetch(GOOGLE_API_URL, {
          method: "POST",
          body: JSON.stringify({ action: "init" })
        });
        const result = await response.json();
        if (result.success) {
          setMaxTickets(result.maxTickets);
          setTicketsSold(result.ticketsSold);
          setNextOrderId(result.nextOrderId);
          setNextSequenceNumber(result.nextSeqNo);
          setIsServerSynced(true);
        }
      } catch (error) {
        console.error("Failed to sync with server on load:", error);
      }
    };
    if (!isServerSynced) fetchInitialData();
  }, [isServerSynced]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.async = true;
    document.body.appendChild(script);

    localStorage.setItem('dinali_ticket_database', JSON.stringify(ticketDatabase));
  }, [ticketDatabase]);

  const handleGenerateTicket = (e: any) => {
    e.preventDefault();
    const totalQty = adultQuantity + childQuantity;

    if (totalQty === 0) {
      alert("Please select at least 1 pass to continue.");
      return;
    }
    if (ticketsSold + totalQty > maxTickets) return;
    if (!name && !isAdmin) return; 

    const guestName = name || "VIP Guest";
    const type = isAdmin ? adminTicketType : "General";

    setRequestStatus(isAdmin ? 'approving' : 'submitting');
    processTicketAndSendToBackend(guestName, email, mobile, adultQuantity, childQuantity, type);
  };

  const processTicketAndSendToBackend = (guestName: string, guestEmail: string, guestMobile: string, adultQty: number, childQty: number, type: string) => {
    const totalQty = adultQty + childQty;
    const totalPrice = (adultQty * ADULT_PRICE) + (childQty * CHILD_PRICE);

    const startNum = customStartNumber ? parseInt(customStartNumber, 10) : nextSequenceNumber;
    const endNum = startNum + totalQty - 1;
    const ticketNumString = `${startNum}${totalQty > 1 ? ` - ${endNum}` : ''}`;
    
    const formattedNumber = endNum.toString().padStart(3, '0');
    const uniqueId = `DINALI-26-${formattedNumber}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    const currentOrderId = customOrderId ? parseInt(customOrderId, 10) : nextOrderId;
    const purchaseId = currentOrderId.toString();

    const payload = {
      action: "generate",
      purchaseId: purchaseId,
      source: isAdmin ? "Admin" : "Public",
      name: guestName,
      email: guestEmail,
      mobile: guestMobile, 
      quantity: totalQty, 
      adultQuantity: adultQty,
      childQuantity: childQty,
      ticketId: uniqueId,
      ticketNumber: ticketNumString,
      totalPrice: totalPrice,
      ticketType: type
    };

    fetch(GOOGLE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload)
    }).catch(error => console.error("Failed to connect to backend:", error));
    
    setTimeout(() => {
      generateFinalTicket(guestName, guestEmail, guestMobile, adultQty, childQty, uniqueId, purchaseId, currentOrderId, type, ticketNumString, endNum);
    }, 800);
  };

  const generateFinalTicket = (guestName: string, guestEmail: string, guestMobile: string, adultQty: number, childQty: number, predefinedId: any = null, purchaseId: string = "N/A", currentOrderId: number = nextOrderId, type: string = "General", ticketNumString: string = "", endNum: number = nextSequenceNumber) => {
    const totalQty = adultQty + childQty;
    const uniqueId = predefinedId || `DINALI-26-${endNum.toString().padStart(3, '0')}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const finalTicket = {
      purchaseId: purchaseId,
      name: guestName,
      email: guestEmail || 'No Email Provided',
      mobile: guestMobile || 'No Mobile Provided',
      quantity: totalQty,
      adultQuantity: adultQty,
      childQuantity: childQty,
      totalPrice: (adultQty * ADULT_PRICE) + (childQty * CHILD_PRICE),
      number: ticketNumString || `${ticketsSold + 1}${totalQty > 1 ? ` - ${ticketsSold + totalQty}` : ''}`,
      id: uniqueId,
      date: "Saturday 27th June 2026",
      time: "6.00pm",
      venue: "Pioneer Theatre, Castle Hill",
      type: type,
      timestamp: new Date().toLocaleString()
    };

    setUserTicket(finalTicket);
    setTicketsSold(prev => prev + totalQty);
    setNextSequenceNumber(endNum + 1);
    setNextOrderId(currentOrderId + 1); 
    setCustomOrderId(''); 
    setCustomStartNumber(''); 
    setTicketDatabase([finalTicket, ...ticketDatabase]);
    setRequestStatus('approved');
  };

  const handleResendTicket = async (ticket: any) => {
    if (!ticket.purchaseId || ticket.purchaseId === "N/A") {
      alert("This ticket doesn't have an Order ID associated with it. You cannot resend it automatically.");
      return;
    }

    const overrideEmail = window.prompt(
      `Resend ticket for ${ticket.name} (Order: ${ticket.purchaseId})\n\nEnter a new email address below, or leave it blank to send to the original email (${ticket.email}):`
    );

    if (overrideEmail === null) return; 

    setResendingId(ticket.purchaseId);

    const payload = {
      action: "reprint",
      purchaseId: ticket.purchaseId,
      email: overrideEmail.trim()
    };

    try {
      await fetch(GOOGLE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload)
      });
      
      alert(`Ticket resend request triggered for Order ID: ${ticket.purchaseId}. Check inbox shortly.`);
    } catch (error) {
      console.error("Failed to resend ticket:", error);
      alert("There was an error trying to resend the ticket.");
    } finally {
      setResendingId(null);
    }
  };

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
      const canvas = await (window as any).html2canvas(element, {
        useCORS: true, 
        scale: 2,      
        backgroundColor: '#1a0205', 
        logging: false
      });

      const image = canvas.toDataURL("image/png");
      const filename = `Swaranga_Ticket_${userTicket.name.replace(/\s+/g, '_')}.png`;

      try {
        const blob = await (await fetch(image)).blob();
        const file = new File([blob], filename, { type: 'image/png' });
        
        // FIX: Cast navigator to any to bypass strict TypeScript compilation errors
        const nav = navigator as any;

        if (nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({
            files: [file],
            title: 'Swaranga Ticket',
            text: 'Here is my ticket for the Swaranga concert!'
          });
        } else {
          throw new Error('Web Share API not supported on this device');
        }
      } catch (shareError) {
        // Fallback for desktop and unsupported browsers
        const link = document.createElement('a');
        link.download = filename;
        link.href = image;
        link.click();
      }

    } catch (err) {
      console.error("Failed to generate image:", err);
      alert("Something went wrong generating the image. Please try again.");
    } finally {
      element.style.transform = originalTransform;
      if (glareOverlay) glareOverlay.style.display = '';
      
      goldTextElements.forEach((el: any) => {
        el.className = el.dataset.originalClass;
        el.style.backgroundImage = '';
        el.style.webkitBackgroundClip = '';
        el.style.webkitTextFillColor = '';
        el.style.color = '';
        el.style.textShadow = '';
      });
      
      setIsDownloading(false);
    }
  };

  const handleReset = () => {
    setUserTicket(null);
    setName('');
    setEmail('');
    setMobile(''); 
    setAdultQuantity(1);
    setChildQuantity(0);
    setRequestStatus('idle');
  };

  const viewExistingTicket = (ticket: any) => {
    setUserTicket(ticket);
    setRequestStatus('approved');
  };

  const handleAdminAuth = (e: any) => {
    e.preventDefault();
    if (adminPassword === 'Dinali1984') {
      setIsAdmin(true);
      setShowAdminAuth(false);
      setAdminPassword('');
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleFactoryReset = () => {
    if (confirmReset) {
      setTicketsSold(0);
      setNextOrderId(1); 
      setNextSequenceNumber(146); 
      setTicketDatabase([]);
      setConfirmReset(false);
    } else {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!ticketRef.current) return;
    const rect = ticketRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;

    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setTilt({ x: rotateX, y: rotateY, glareX, glareY, opacity: 1 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, glareX: 50, glareY: 50, opacity: 0 });
  };

  const ticketsRemaining = maxTickets - ticketsSold;
  const progressPercentage = maxTickets > 0 ? (ticketsSold / maxTickets) * 100 : 100;
  const currentTotalAmount = (adultQuantity * ADULT_PRICE) + (childQuantity * CHILD_PRICE);

  return (
    <div className="min-h-screen bg-[#150103] text-white relative overflow-x-hidden font-sans selection:bg-yellow-500/30">
      
      {/* --- ADMIN AUTH MODAL --- */}
      {showAdminAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md print-hide p-4 animate-fade-in">
          <div className="bg-[#0a0102] border border-red-900/50 p-8 rounded-2xl max-w-sm w-full shadow-[0_0_50px_rgba(212,175,55,0.1)] relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37] rounded-t-2xl"></div>
            
            <div className="flex items-center space-x-3 mb-6">
              <Lock className="text-[#D4AF37]" size={24} />
              <h3 className="text-xl text-white font-light tracking-widest uppercase">Admin Access</h3>
            </div>
            
            <form onSubmit={handleAdminAuth}>
              <div className="mb-6">
                <input 
                  type="password" 
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setAuthError(false); }}
                  className={`w-full bg-[#150103] border ${authError ? 'border-red-500' : 'border-red-900/50'} text-white p-4 rounded-lg focus:outline-none focus:border-[#D4AF37] transition-colors`}
                  placeholder="Enter Passcode"
                  autoFocus
                />
                {authError && <p className="text-red-500 text-[10px] mt-2 uppercase tracking-widest absolute">Incorrect Passcode</p>}
              </div>
              
              <div className="flex space-x-3">
                <button 
                  type="button" 
                  onClick={() => { setShowAdminAuth(false); setAdminPassword(''); setAuthError(false); }} 
                  className="w-1/3 py-3 text-gray-400 border border-gray-800 rounded-lg uppercase text-xs font-bold tracking-widest hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="w-2/3 py-3 bg-gradient-to-r from-[#D4AF37] to-[#8B6508] text-black font-bold rounded-lg uppercase text-xs tracking-widest hover:brightness-110 transition-all flex items-center justify-center space-x-2"
                >
                  <span>Unlock</span>
                  <ChevronRight size={14} />
                </button>
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
          <Sparkles 
            key={`star-${i}`}
            className="absolute text-yellow-300/70 animate-twinkle-star"
            style={{
              width: Math.random() * 12 + 8 + 'px',
              height: Math.random() * 12 + 8 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animationDuration: Math.random() * 3 + 2 + 's',
              animationDelay: Math.random() * 5 + 's',
            }}
          />
        ))}

        {[...Array(25)].map((_, i) => (
          <div 
            key={i}
            className="absolute bg-yellow-400/40 rounded-sm animate-dust shadow-[0_0_10px_rgba(212,175,55,0.5)]"
            style={{
              width: Math.random() * 6 + 2 + 'px',
              height: Math.random() * 6 + 2 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              transform: `rotate(${Math.random() * 360}deg)`,
              animationDuration: Math.random() * 15 + 10 + 's',
              animationDelay: Math.random() * 5 + 's',
            }}
          ></div>
        ))}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 flex flex-col items-center min-h-screen">
        
        <div className="text-center w-full flex flex-col items-center relative z-20 print-hide">
          <div className="inline-flex items-center space-x-3 px-6 py-1.5 border border-white/10 rounded-full text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase text-yellow-500/80 mb-6 backdrop-blur-md bg-black/20 shadow-[0_0_30px_rgba(212,175,55,0.1)]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            <span>Live Experience</span>
          </div>
          
          <div className="relative w-full flex flex-col items-center justify-center z-30 mb-8 md:mb-16">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-[#D4AF37] rounded-full blur-[100px] md:blur-[150px] opacity-20 mix-blend-screen z-0 animate-pulse-slow pointer-events-none"></div>

            <h2 className="text-xs md:text-lg uppercase tracking-[0.6em] md:tracking-[0.8em] text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-white to-gray-400 mb-2 font-light ml-[0.8em] drop-shadow-md relative z-10" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              A Musical Journey
            </h2>

            <h1 className="text-6xl md:text-[8rem] lg:text-[10rem] font-extrabold tracking-widest mb-1 text-3d-gold animate-shine leading-none drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] relative z-10" style={{ fontFamily: "'Abhaya Libre', serif", paddingBottom: '0.15em' }}>
              ස්වරාංග
            </h1>
            
            <h3 className="text-lg md:text-4xl tracking-[0.3em] md:tracking-[0.4em] text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37] mt-[-15px] md:mt-[-30px] font-bold drop-shadow-[0_10px_20px_rgba(0,0,0,1)] relative z-10" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
              DINALI IN CONCERT
            </h3>

            <div className="relative z-20 mt-12 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 text-xs md:text-sm tracking-[0.2em] text-gray-200 font-medium uppercase backdrop-blur-md bg-[#2a040a]/60 py-4 px-8 border border-yellow-500/20 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
              <div className="flex items-center space-x-3">
                <Calendar size={16} className="text-[#D4AF37]" />
                <span>Sat 27 Jun 2026</span>
              </div>
              <span className="hidden md:block text-[#D4AF37]/50">|</span>
              <div className="flex items-center space-x-3">
                <Clock size={16} className="text-[#D4AF37]" />
                <span>6:00 PM</span>
              </div>
              <span className="hidden md:block text-[#D4AF37]/50">|</span>
              <div className="flex items-center space-x-3">
                <MapPin size={16} className="text-[#D4AF37]" />
                <span>Pioneer Theatre, Castle Hill</span>
              </div>
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
                    <h2 className="text-3xl font-light tracking-wide mb-1 text-white flex items-center gap-3">
                      <ShieldCheck className="text-green-500" />
                      Organizer Dashboard
                    </h2>
                    <p className="text-green-500 text-xs uppercase tracking-[0.2em]">
                      {isServerSynced ? <span className="flex items-center gap-1 text-green-400"><RefreshCw size={10} className="animate-spin" /> Live Synced</span> : 'soulsoundsbydinali@gmail.com'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button 
                      onClick={() => setIsAdmin(false)} 
                      className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white border border-gray-600 hover:border-white bg-black/40 px-4 py-2.5 rounded-full transition-all"
                    >
                      Exit Admin
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  <div className="bg-black/40 border border-green-900/30 p-6 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Ticket className="text-green-500" size={32} />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Tickets Sold</p>
                        <div className="flex items-baseline space-x-2 text-2xl font-light text-white mt-1">
                          <span>{ticketsSold}</span>
                          <span className="text-sm text-gray-600">/</span>
                          <input
                            type="number"
                            value={maxTickets}
                            onChange={(e) => setMaxTickets(parseInt(e.target.value, 10) || 0)}
                            className="w-16 bg-transparent text-gray-400 text-sm focus:outline-none focus:text-white border-b border-dashed border-gray-600 hover:border-green-500 text-left px-1 transition-colors"
                            title="Adjust Maximum Capacity"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/40 border border-green-900/30 p-6 rounded-2xl flex items-center space-x-4">
                    <Users className="text-green-500" size={32} />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest">Guest List Groups</p>
                      <p className="text-2xl font-light text-white">{ticketDatabase.length}</p>
                    </div>
                  </div>
                  <div className="bg-black/40 border border-green-900/30 p-6 rounded-2xl flex items-center space-x-4">
                    <DollarSign className="text-green-500" size={32} />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest">Est. Revenue</p>
                      <p className="text-2xl font-light text-white">${ticketsSold * ADULT_PRICE}</p> {/* Base est on adult price */}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-1 bg-black/40 border border-green-900/20 p-6 rounded-2xl">
                    <h3 className="text-sm font-medium uppercase tracking-widest text-green-400 mb-6">Direct Ticket Generator</h3>
                    <p className="text-xs text-gray-400 mb-6">Generate tickets instantly for your guest list. This will trigger the email and Google Sheet update automatically.</p>
                    
                    <form onSubmit={handleGenerateTicket} className="space-y-4">
                      <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-transparent border-b border-green-900/50 px-2 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm"
                        placeholder="Guest Name (e.g. Smith Family)"
                      />
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent border-b border-green-900/50 px-2 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm"
                        placeholder="Email (Optional)"
                      />
                      <input 
                        type="tel" 
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        className="w-full bg-transparent border-b border-green-900/50 px-2 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm"
                        placeholder="Mobile Number (Optional)"
                      />
                      
                      <div className="flex items-center justify-between border-b border-green-900/50 pb-2 pt-2">
                        <span className="text-gray-400 text-sm px-2">Ticket Type</span>
                        <select
                          value={adminTicketType}
                          onChange={(e: any) => setAdminTicketType(e.target.value)}
                          className="bg-transparent text-white focus:outline-none text-right"
                        >
                          <option value="General" className="bg-black">General</option>
                          <option value="VIP" className="bg-black">VIP</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between border-b border-green-900/50 pb-2 pt-2">
                        <span className="text-gray-400 text-sm px-2">Adult Passes ($40)</span>
                        <select
                          value={adultQuantity}
                          onChange={(e) => setAdultQuantity(parseInt(e.target.value, 10))}
                          className="bg-transparent text-white focus:outline-none text-right"
                        >
                          {[...Array(20)].map((_, i) => (
                            <option key={i} value={i} className="bg-black">{i}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-between border-b border-green-900/50 pb-2 pt-2">
                        <span className="text-gray-400 text-sm px-2">Child Passes ($15)</span>
                        <select
                          value={childQuantity}
                          onChange={(e) => setChildQuantity(parseInt(e.target.value, 10))}
                          className="bg-transparent text-white focus:outline-none text-right"
                        >
                          {[...Array(20)].map((_, i) => (
                            <option key={i} value={i} className="bg-black">{i}</option>
                          ))}
                        </select>
                      </div>

                      <button type="submit" disabled={requestStatus === 'approving'} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-black font-bold uppercase tracking-widest text-xs py-3 rounded mt-4 transition-colors">
                        {requestStatus === 'approving' ? 'Generating...' : 'Generate & Open Ticket'}
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-2">
                    <h3 className="text-sm font-medium uppercase tracking-widest text-green-400 mb-4">Ticket Database (Local Demo)</h3>
                    <div className="bg-black/40 border border-green-900/20 rounded-2xl overflow-hidden">
                      <div className="max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-green-900/20 text-green-500 uppercase tracking-widest sticky top-0 backdrop-blur-md">
                            <tr>
                              <th className="p-4 font-medium">Order ID</th>
                              <th className="p-4 font-medium">Guest</th>
                              <th className="p-4 font-medium">Passes</th>
                              <th className="p-4 font-medium">ID</th>
                              <th className="p-4 font-medium text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-green-900/20">
                            {ticketDatabase.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500">No tickets generated yet.</td>
                              </tr>
                            ) : (
                              ticketDatabase.map((ticket: any, idx: any) => (
                                <tr key={idx} className="hover:bg-green-900/10 transition-colors">
                                  <td className="p-4 text-yellow-500 font-mono text-[10px]">{ticket.purchaseId || "N/A"}</td>
                                  <td className="p-4 text-white">
                                    {ticket.name}
                                    <div className="text-[9px] text-gray-500 mt-1">{ticket.email || 'No Email'}</div>
                                  </td>
                                  <td className="p-4 text-gray-400">
                                    {ticket.quantity} 
                                    <span className="text-[9px] text-gray-600 block">
                                      ({ticket.adultQuantity !== undefined ? ticket.adultQuantity : ticket.quantity}A, {ticket.childQuantity || 0}C)
                                    </span>
                                  </td>
                                  <td className="p-4 text-gray-500 font-mono">{ticket.id.split('-')[2]}</td>
                                  <td className="p-4 text-right">
                                    <div className="flex justify-end space-x-2">
                                      <button 
                                        onClick={() => handleResendTicket(ticket)}
                                        disabled={resendingId === ticket.purchaseId}
                                        className={`text-blue-400 hover:text-white transition-colors border border-blue-900/50 px-3 py-1 rounded-full flex items-center space-x-1 disabled:opacity-50 disabled:cursor-wait`}
                                        title="Resend Ticket Email"
                                      >
                                        <Send size={10} />
                                        <span>{resendingId === ticket.purchaseId ? 'Sending...' : 'Resend'}</span>
                                      </button>
                                      <button 
                                        onClick={() => viewExistingTicket(ticket)}
                                        className="text-green-400 hover:text-white transition-colors border border-green-900/50 px-3 py-1 rounded-full"
                                      >
                                        View
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* --- Advanced System Controls --- */}
                  <div className="lg:col-span-3 bg-black/40 border border-green-900/20 p-6 rounded-2xl mt-4">
                    <h3 className="text-sm font-medium uppercase tracking-widest text-green-400 mb-6 flex items-center gap-2">
                      <Lock size={16} /> System Controls
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Override Next Ticket No.</label>
                        <div className="flex items-center">
                          <input
                            type="number"
                            value={customStartNumber}
                            onChange={(e: any) => setCustomStartNumber(e.target.value)}
                            placeholder={`Default next: ${nextSequenceNumber}`}
                            className="bg-black/50 border border-green-900/50 px-4 py-3 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm w-full transition-colors"
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                          Leave blank to auto-increment.
                        </p>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Override Next Order ID</label>
                        <div className="flex items-center">
                          <input
                            type="number"
                            value={customOrderId}
                            onChange={(e: any) => setCustomOrderId(e.target.value)}
                            placeholder={`Default next: ${nextOrderId}`}
                            className="bg-black/50 border border-green-900/50 px-4 py-3 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm w-full transition-colors"
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                          Sequential order number (1, 2, 3...).
                        </p>
                      </div>
                      
                      {/* Override Tickets Sold */}
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Override Tickets Sold</label>
                        <input
                          type="number"
                          value={ticketsSold}
                          onChange={(e: any) => setTicketsSold(parseInt(e.target.value, 10) || 0)}
                          className="bg-black/50 border border-green-900/50 px-4 py-3 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm w-full transition-colors"
                        />
                        <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                          Reset or adjust the sold counter manually.
                        </p>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Maximum Venue Capacity</label>
                        <input
                          type="number"
                          value={maxTickets}
                          onChange={(e: any) => setMaxTickets(parseInt(e.target.value, 10) || 0)}
                          className="bg-black/50 border border-green-900/50 px-4 py-3 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm w-full transition-colors"
                        />
                        <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                          Caps public sales at {maxTickets} total passes.
                        </p>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-green-900/30 flex justify-end">
                      <button 
                        onClick={handleFactoryReset} 
                        className={`text-xs uppercase font-bold tracking-widest border px-6 py-3 rounded-lg transition-all flex items-center gap-2 ${confirmReset ? 'bg-red-900/80 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse' : 'text-red-500/80 border-red-900/30 hover:text-red-400 hover:border-red-500/50 bg-black/40'}`}
                      >
                        {confirmReset ? "Are you sure? Click to Confirm" : "Factory Reset Local Data"}
                      </button>
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
                  <div>
                    <h2 className="text-3xl font-light tracking-wide mb-1 text-white">Reserve</h2>
                    <p className="text-[#D4AF37] text-xs uppercase tracking-[0.2em]">Official Ticketing</p>
                  </div>
                </div>

                <div className="mb-10">
                  <div className="flex justify-between text-[10px] tracking-widest uppercase mb-3 text-gray-400">
                    <span>Capacity</span>
                    <span className="text-[#D4AF37]">{Math.round(progressPercentage)}%</span>
                  </div>
                  <div className="w-full bg-red-950/50 h-[2px] rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-[#8B6508] via-[#D4AF37] to-[#FFF8DC] h-full relative"
                      style={{ width: `${progressPercentage}%` }}
                    >
                      <div className="absolute top-0 right-0 bottom-0 w-10 bg-white blur-[5px] opacity-50"></div>
                    </div>
                  </div>
                </div>

                {ticketsRemaining > 0 ? (
                  <form onSubmit={handleGenerateTicket} className="space-y-6">
                    <div className="space-y-1">
                      <input 
                        type="text" 
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-transparent border-b border-red-900/50 px-2 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors text-lg font-light tracking-wide"
                        placeholder="Guest Name"
                      />
                    </div>
                    <div className="space-y-1">
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent border-b border-red-900/50 px-2 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors text-lg font-light tracking-wide"
                        placeholder="Email Address"
                      />
                    </div>
                    <div className="space-y-1">
                      <input 
                        type="tel" 
                        required
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        className="w-full bg-transparent border-b border-red-900/50 px-2 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors text-lg font-light tracking-wide"
                        placeholder="Mobile Number"
                      />
                    </div>
                    
                    <div className="pt-4 flex items-center justify-between border-b border-red-900/50 pb-2">
                      <span className="text-gray-300 font-light tracking-wide px-2">Adult Passes ($40)</span>
                      <select
                        value={adultQuantity}
                        onChange={(e) => setAdultQuantity(parseInt(e.target.value, 10))}
                        className="bg-transparent text-white text-xl font-light focus:outline-none appearance-none cursor-pointer pr-4 text-right"
                        style={{ textAlignLast: 'right' }}
                      >
                        {[...Array(11)].map((_, i) => (
                          <option key={i} value={i} className="bg-[#1a0205]">{i}</option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-4 flex items-center justify-between border-b border-red-900/50 pb-2">
                      <span className="text-gray-300 font-light tracking-wide px-2">Child Passes ($15)</span>
                      <select
                        value={childQuantity}
                        onChange={(e) => setChildQuantity(parseInt(e.target.value, 10))}
                        className="bg-transparent text-white text-xl font-light focus:outline-none appearance-none cursor-pointer pr-4 text-right"
                        style={{ textAlignLast: 'right' }}
                      >
                        {[...Array(11)].map((_, i) => (
                          <option key={i} value={i} className="bg-[#1a0205]">{i}</option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-8">
                      <button 
                        type="submit" 
                        disabled={requestStatus === 'submitting'}
                        className="w-full group relative overflow-hidden bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37] text-black font-bold text-sm tracking-[0.2em] uppercase py-5 rounded-sm transition-all flex items-center justify-center space-x-3 disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-[0_0_40px_rgba(212,175,55,0.4)]"
                      >
                        <div className="absolute inset-0 w-[200%] translate-x-[-100%] bg-gradient-to-r from-transparent via-white/50 to-transparent group-hover:translate-x-[50%] transition-transform duration-1000 ease-in-out"></div>
                        
                        {requestStatus === 'submitting' ? (
                          <span className="animate-pulse">Authorizing...</span>
                        ) : (
                          <>
                            <span>Secure Passes • ${currentTotalAmount}</span>
                            <ChevronRight size={18} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="text-center p-6 border border-red-900/50 bg-red-900/10 rounded-sm">
                    <p className="text-red-500 tracking-widest uppercase text-sm">Event Sold Out</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* --- THE 3D TICKET VIEW --- */
            <div className="w-full flex flex-col items-center animate-fade-in-up mt-[-40px]">
              
              <p className="text-xs text-green-400 tracking-[0.3em] uppercase mb-12 animate-pulse drop-shadow-md print-hide">Credentials Verified</p>

              <div 
                className="perspective-1000 mb-12"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <div 
                  ref={ticketRef}
                  id="digital-ticket" 
                  className="w-full max-w-4xl relative rounded-xl overflow-hidden flex flex-col md:flex-row bg-[#1a0205] border border-red-900/50 shadow-[0_30px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(212,175,55,0.2)] transition-transform duration-200 ease-out preserve-3d"
                  style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
                >
                  
                  <div 
                    className="absolute inset-0 pointer-events-none mix-blend-screen z-50 transition-opacity duration-300"
                    style={{
                      opacity: tilt.opacity,
                      background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 50%)`,
                    }}
                  ></div>

                  <div className="relative flex-1 p-8 md:p-12 bg-gradient-to-br from-[#3a0612] via-[#1a0205] to-[#0a0102] overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] pointer-events-none"></div>
                    
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37]"></div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37]"></div>
                    
                    <div className="relative z-10 flex flex-col h-full justify-between min-h-[350px]">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2 text-yellow-500 mb-6 border border-yellow-500/30 px-3 py-1 inline-flex rounded-sm">
                            <Sparkles size={12} />
                            <span className="text-[10px] font-bold tracking-[0.4em] uppercase">Theatre Access</span>
                          </div>
                          
                          <h2 className="text-xs md:text-sm uppercase tracking-[0.5em] text-gray-400 mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                            A Musical Journey
                          </h2>
                          <h1 
                            className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37] mb-1"
                            style={{ fontFamily: "'Abhaya Libre', serif" }}
                          >
                            ස්වරාංග
                          </h1>
                          <h3 
                            className="text-lg md:text-xl tracking-[0.3em] text-white/90 uppercase"
                            style={{ fontFamily: "'Cinzel Decorative', serif" }}
                          >
                            Dinali In Concert
                          </h3>
                        </div>
                        
                        <div className="flex flex-col items-end space-y-4">
                          <div className="w-16 h-16 rounded-full border border-white/20 bg-gradient-to-br from-yellow-300/20 via-yellow-600/20 to-orange-300/20 flex items-center justify-center backdrop-blur-md">
                            <span className="text-[8px] tracking-widest text-white/50 text-center uppercase leading-tight">Official<br/>Seal</span>
                          </div>
                          
                          <div className="w-20 h-28 md:w-28 md:h-36 rounded-md overflow-hidden border border-[#D4AF37]/40 shadow-[0_10px_20px_rgba(0,0,0,0.6)] relative">
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1a0205] via-transparent to-transparent opacity-80 z-10 pointer-events-none"></div>
                            <img 
                              src={DINALI_TICKET_IMAGE_URL} 
                              alt="Dinali" 
                              crossOrigin="anonymous" 
                              className="w-full h-full object-cover object-[center_top]"
                              onError={(e: any) => {
                                e.target.onerror = null; 
                                e.target.src = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80";
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-left border-t border-red-900/40 pt-6">
                        <div>
                          <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-1">Date</p>
                          <p className="font-light text-sm tracking-wider">Sat 27 Jun</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Time</p>
                          <p className="font-light text-sm tracking-wider">6:00 PM</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Venue</p>
                          <p className="font-light text-sm tracking-wider">{userTicket.venue}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Admit</p>
                          <p className="font-light text-sm tracking-wider">
                            {userTicket.adultQuantity !== undefined ? userTicket.adultQuantity : userTicket.quantity} Adult(s)
                            {userTicket.childQuantity > 0 ? `, ${userTicket.childQuantity} Child` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative w-full md:w-80 bg-[#170104] border-t border-red-900/40 md:border-t-0 md:border-l p-8 flex flex-col items-center justify-between">
                    <div className="hidden md:block absolute top-[-10px] left-[-10px] w-5 h-5 bg-[#0a0102] rounded-full"></div>
                    <div className="hidden md:block absolute bottom-[-10px] left-[-10px] w-5 h-5 bg-[#0a0102] rounded-full"></div>
                    
                    <div className="w-full">
                      <p className="text-[9px] text-gray-400 uppercase tracking-[0.3em] mb-1">Guest Name</p>
                      <p className="text-lg font-light tracking-wider uppercase border-b border-red-900/40 pb-4 mb-4 text-white">{userTicket.name}</p>
                      
                      <div className="flex justify-between items-end mb-8">
                        <div>
                          <p className="text-[9px] text-gray-500 uppercase tracking-[0.3em] mb-1">Section</p>
                          <p className="text-xl font-light text-[#D4AF37] tracking-wider">{userTicket.type || 'General'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-gray-500 uppercase tracking-[0.3em] mb-1">Pass No.</p>
                          <p className="text-sm font-mono text-gray-300 tracking-widest">{userTicket.number}</p>
                        </div>
                      </div>
                    </div>

                    <div className="w-full flex justify-center bg-white p-2 rounded-sm mb-4">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(userTicket.id)}&color=000000&bgcolor=ffffff`} 
                        alt="Ticket QR Code" 
                        crossOrigin="anonymous"
                        className="w-28 h-28 md:w-32 md:h-32"
                      />
                    </div>

                    <div className="w-full h-8 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')] bg-repeat-x opacity-40 flex">
                      {[...Array(30)].map((_, i) => (
                        <div key={i} className="h-full bg-white" style={{ width: Math.random() * 4 + 1 + 'px', marginRight: Math.random() * 3 + 1 + 'px' }}></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Below Ticket */}
              <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-6 print-hide w-full max-w-4xl mt-8">
                <button 
                  onClick={downloadTicketAsImage} 
                  disabled={isDownloading}
                  className="bg-white text-black font-bold uppercase tracking-[0.2em] px-8 py-4 rounded-md hover:bg-yellow-500 transition-colors flex items-center space-x-3 shadow-[0_0_20px_rgba(255,255,255,0.2)] w-full md:w-auto justify-center disabled:opacity-70 disabled:cursor-wait group relative overflow-hidden"
                >
                  <div className="absolute inset-0 w-[200%] translate-x-[-100%] bg-gradient-to-r from-transparent via-white/50 to-transparent group-hover:translate-x-[50%] transition-transform duration-1000 ease-in-out"></div>
                  
                  {isDownloading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Saving Ticket...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={18} />
                      <span>Save as Image</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={handleReset} 
                  className="text-xs uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-colors pb-1 border-b border-transparent hover:border-white"
                >
                  {isAdmin ? "Back to Dashboard" : "Issue Another"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-50 print-hide">
        <button 
          onClick={() => setIsAdmin(!isAdmin)}
          className={`p-3 rounded-full backdrop-blur-md transition-all ${isAdmin ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-black/40 text-gray-600 border border-white/10 hover:text-white'}`}
          title="Organizer Login"
        >
          <Lock size={16} />
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Abhaya+Libre:wght@800&family=Montserrat:wght@200;300;400;500&family=Cinzel+Decorative:wght@400;700;900&display=swap');
        
        .text-3d-gold {
          background-image: linear-gradient(to right, #D4AF37, #FFF8DC, #D4AF37, #FFF8DC, #D4AF37);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0px 1px 0px #5c3a02)
                  drop-shadow(0px 2px 0px #422901)
                  drop-shadow(0px 3px 0px #2e1c00)
                  drop-shadow(0px 4px 15px rgba(212,175,55,0.4));
        }

        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }

        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes shine {
          to { background-position: 200% center; }
        }
        @keyframes spotlight-sweep {
          0%, 100% { transform: rotate(12deg) scale(1); opacity: 0.5; }
          50% { transform: rotate(15deg) scale(1.1); opacity: 0.8; }
        }
        @keyframes spotlight-sweep-reverse {
          0%, 100% { transform: rotate(-12deg) scale(1); opacity: 0.5; }
          50% { transform: rotate(-15deg) scale(1.1); opacity: 0.8; }
        }
        @keyframes dust {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-150px) translateX(80px); opacity: 0; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes twinkle-star {
          0%, 100% { opacity: 0.2; transform: scale(0.6) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(45deg); }
        }
        
        .animate-fade-in-up { animation: fade-in-up 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
        .animate-shine { animation: shine 6s linear infinite; }
        .animate-spotlight-sweep { animation: spotlight-sweep 10s ease-in-out infinite; }
        .animate-spotlight-sweep-reverse { animation: spotlight-sweep-reverse 12s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 5s ease-in-out infinite; }
        .animate-twinkle-star { animation: twinkle-star 3s ease-in-out infinite; }
        
        @media print {
          @page { size: landscape; margin: 10mm; }
          
          html, body { 
            background: #150103 !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          
          .print-hide {
            display: none !important;
          }
          
          #digital-ticket { 
            transform: none !important; 
            box-shadow: none !important;
            margin: 0 auto !important;
            page-break-inside: avoid;
          }
          
          .mix-blend-screen { 
            display: none !important; 
          }
        }
      `}} />
    </div>
  );
}
