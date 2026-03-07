import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, Ticket, Download, CheckCircle, ChevronRight, Mail, Sparkles, Lock, ShieldCheck, Users, DollarSign, Image as ImageIcon, Loader2 } from 'lucide-react';

// Ensure the attached photo is saved in your project's "public" folder as "dinali-portrait.jpg"
const DINALI_TICKET_IMAGE_URL = "/dinali-portrait.jpg";

export default function App() {
  const TICKET_PRICE = 40;
  
  // --- Core Dynamic States ---
  const [maxTickets, setMaxTickets] = useState(() => {
    const saved = localStorage.getItem('dinali_max_tickets');
    return saved !== null ? parseInt(saved, 10) : 372;
  });

  const [ticketsSold, setTicketsSold] = useState(() => {
    const saved = localStorage.getItem('dinali_tickets_sold');
    return saved !== null ? parseInt(saved, 10) : 145;
  });

  const [nextSequenceNumber, setNextSequenceNumber] = useState(() => {
    const saved = localStorage.getItem('dinali_sequence_num');
    if (saved !== null) return parseInt(saved, 10);
    // Fallback if migrating from old version
    const savedSold = localStorage.getItem('dinali_tickets_sold');
    return savedSold !== null ? parseInt(savedSold, 10) + 1 : 146;
  });

  const [nextOrderId, setNextOrderId] = useState(() => {
    const saved = localStorage.getItem('dinali_next_order_id');
    return saved !== null ? parseInt(saved, 10) : 1;
  });

  // --- Organizer / Admin States ---
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState(false);
  const [adminTicketType, setAdminTicketType] = useState('General'); // General or VIP
  const [customStartNumber, setCustomStartNumber] = useState<string>(''); // For overriding sequences
  const [customOrderId, setCustomOrderId] = useState<string>(''); // For overriding order ID
  const [confirmReset, setConfirmReset] = useState(false); // Restored confirm reset state

  const [ticketDatabase, setTicketDatabase] = useState<any[]>(() => {
    const saved = localStorage.getItem('dinali_ticket_database');
    return saved !== null ? JSON.parse(saved) : [];
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [requestStatus, setRequestStatus] = useState('idle');
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [userTicket, setUserTicket] = useState<any>(null);

  // --- 3D Ticket Interactive States ---
  const ticketRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glareX: 50, glareY: 50, opacity: 0 });

  useEffect(() => {
    document.title = "Swaranga 2026";
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.async = true;
    document.body.appendChild(script);

    localStorage.setItem('dinali_tickets_sold', ticketsSold.toString());
    localStorage.setItem('dinali_max_tickets', maxTickets.toString());
    localStorage.setItem('dinali_sequence_num', nextSequenceNumber.toString());
    localStorage.setItem('dinali_next_order_id', nextOrderId.toString());
    localStorage.setItem('dinali_ticket_database', JSON.stringify(ticketDatabase));
  }, [ticketsSold, maxTickets, nextSequenceNumber, nextOrderId, ticketDatabase]);

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

  const handleGenerateTicket = async (e: any) => {
    e.preventDefault();
    if (ticketsSold + quantity > maxTickets) return;
    if (!name && !isAdmin) return; 
    
    const guestName = name || "VIP Guest";
    const type = isAdmin ? adminTicketType : "General";
    const source = isAdmin ? "Admin" : "Public"; // Identifies who generated the ticket
    
    // Calculate sequential order ID as a fallback fallback
    const currentOrderId = customOrderId ? parseInt(customOrderId, 10) : nextOrderId;
    const purchaseId = currentOrderId.toString();

    setRequestStatus('submitting');
    
    // Calculate precise ticket numbering as a local fallback
    const startNum = customStartNumber ? parseInt(customStartNumber, 10) : nextSequenceNumber;
    const endNum = startNum + quantity - 1;
    const ticketNumString = `${startNum}${quantity > 1 ? ` - ${endNum}` : ''}`;
    
    const formattedNumber = endNum.toString().padStart(3, '0');
    const uniqueId = `DINALI-26-${formattedNumber}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const payload = {
      action: "generate", // CRITICAL FOR BACKEND ROUTING
      purchaseId: purchaseId, 
      name: guestName,
      source: source,
      email: email,
      quantity: quantity,
      ticketId: uniqueId,
      ticketNumber: ticketNumString,
      totalPrice: quantity * TICKET_PRICE,
      ticketType: type,
      incrementSeq: !customStartNumber,  // Tells server to handle sequencing if not overridden
      incrementOrder: !customOrderId     // Tells server to handle order IDs if not overridden
    };

    try {
      const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbwEAl6PCJ3OiU9i5ePGhz0z67vIYQ0X31-wo5S0aVtDAM_XP3EIBaZBdrso761FxZDG/exec";

      // Await the server so that the server becomes the source of truth for IDs
      const response = await fetch(GOOGLE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.success) {
        // Use the SERVER returned IDs to avoid desync
        generateFinalTicket(
          guestName, 
          email, 
          quantity, 
          result.uniqueId || uniqueId, 
          type, 
          result.ticketNumber || ticketNumString, 
          result.endNum > 0 ? result.endNum : endNum, 
          result.orderId || purchaseId, 
          parseInt(result.orderId || currentOrderId, 10)
        );
      } else {
        if (result.error === "SOLD_OUT") {
          alert("We're sorry, but the event just sold out!");
          setTicketsSold(maxTickets);
        } else {
          throw new Error("Backend failed");
        }
        setRequestStatus('idle');
      }

    } catch (error) {
      console.error("Failed to connect to backend:", error);
      if (isAdmin) {
        alert("Warning: Ticketing server is unreachable. Ticket generated locally and might duplicate IDs when you reconnect.");
        generateFinalTicket(guestName, email, quantity, uniqueId, type, ticketNumString, endNum, purchaseId, currentOrderId);
      } else {
        alert("We are experiencing high traffic and couldn't connect to the ticketing server. Please try again.");
        setRequestStatus('idle');
      }
    }
  };

  const generateFinalTicket = (guestName: any, guestEmail: any, qty: any, predefinedId: any, type: string, ticketNumString: string, endNum: number, purchaseId: string, currentOrderId: number) => {
    const finalTicket = {
      purchaseId: purchaseId,
      name: guestName,
      email: guestEmail || 'No Email Provided',
      quantity: qty,
      totalPrice: qty * TICKET_PRICE,
      number: ticketNumString,
      id: predefinedId,
      date: "Saturday 27th June 2026",
      time: "6.00pm",
      venue: "Pioneer Theatre, Castle Hill",
      type: type, 
      timestamp: new Date().toLocaleString()
    };

    setUserTicket(finalTicket);
    setTicketsSold(prev => prev + qty);
    setNextSequenceNumber(endNum + 1);
    setNextOrderId(currentOrderId + 1);
    setCustomStartNumber(''); // Reset override after use
    setCustomOrderId(''); // Reset order ID override
    setTicketDatabase([finalTicket, ...ticketDatabase]);
    setRequestStatus('approved');
  };

  const handleReset = () => {
    setUserTicket(null);
    setName('');
    setEmail('');
    setQuantity(1);
    setRequestStatus('idle');
  };

  const viewExistingTicket = (ticket: any) => {
    setUserTicket(ticket);
    setRequestStatus('approved');
  };

  // --- Restored Factory Reset Function ---
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

  // --- Download as High-Res Image Logic (RESTORED iPHONE FIX) ---
  const downloadTicketAsImage = async () => {
    if (!ticketRef.current || !(window as any).html2canvas) return;
    
    setIsDownloading(true);
    const element = ticketRef.current as any;

    // Temporarily remove the 3D mouse transform to get a flat, perfect screenshot
    const originalTransform = element.style.transform;
    element.style.transform = 'none';

    // FIX FOR BLANK LETTERS: html2canvas struggles with transparent gradients
    // We swap it to solid gold just for the screenshot, then swap back!
    const goldTextElements = element.querySelectorAll('.text-3d-gold');
    goldTextElements.forEach((el: any) => {
      el.dataset.originalClass = el.className;
      el.classList.remove('text-3d-gold');
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

      // Restore all visual styles
      element.style.transform = originalTransform;
      goldTextElements.forEach((el: any) => {
        el.className = el.dataset.originalClass;
        el.style.color = '';
        el.style.textShadow = '';
      });

      const fileName = `Swaranga_Ticket_${userTicket.name.replace(/\s+/g, '_')}.png`;
      const dataUrl = canvas.toDataURL("image/png");
      
      // IPHONE FALLBACK LOGIC
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const nav = navigator as any;

      if (isMobile && blob && nav.canShare && nav.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] })) {
        try {
          const file = new File([blob], fileName, { type: 'image/png' });
          await nav.share({ files: [file] });
        } catch (shareErr: any) {
          if (shareErr.name !== 'AbortError') {
            const link = document.createElement('a'); 
            link.download = fileName; 
            link.href = dataUrl; 
            link.click();
          }
        }
      } else {
        // Desktop fallback
        const link = document.createElement('a'); 
        link.download = fileName; 
        link.href = dataUrl; 
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link);
      }

    } catch (err) {
      console.error("Failed to generate image:", err);
      element.style.transform = originalTransform;
      alert("Something went wrong generating the image. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  // --- 3D Tilt Logic ---
  const handleMouseMove = (e: any) => {
    if (!ticketRef.current) return;
    const rect = (ticketRef.current as any).getBoundingClientRect();
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
  const progressPercentage = (ticketsSold / maxTickets) * 100;

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
        
        {/* Volumetric Spotlights */}
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[150vh] bg-[conic-gradient(from_120deg_at_50%_0%,rgba(212,175,55,0.15)_0deg,transparent_60deg)] origin-top transform rotate-12 blur-[40px] animate-spotlight-sweep"></div>
        <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[150vh] bg-[conic-gradient(from_240deg_at_50%_0%,transparent_0deg,rgba(212,175,55,0.1)_60deg)] origin-top transform -rotate-12 blur-[50px] animate-spotlight-sweep-reverse"></div>
        
        {/* Dynamic Twinkling Stars */}
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

        {/* Floating Gold Particles */}
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
        
        {/* --- HERO SECTION (Titles & Image) --- */}
        <div className="text-center w-full flex flex-col items-center relative z-20 print-hide">
          
          <div className="inline-flex items-center space-x-3 px-6 py-1.5 border border-white/10 rounded-full text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase text-yellow-500/80 mb-6 backdrop-blur-md bg-black/20 shadow-[0_0_30px_rgba(212,175,55,0.1)]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            <span>Live Experience</span>
          </div>
          
          {/* Main Title Typography */}
          <div className="relative w-full flex flex-col items-center justify-center z-30 mb-8 md:mb-16">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-[#D4AF37] rounded-full blur-[100px] md:blur-[150px] opacity-20 mix-blend-screen z-0 animate-pulse-slow pointer-events-none"></div>

            <h2 
              className="text-xs md:text-lg uppercase tracking-[0.6em] md:tracking-[0.8em] text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-white to-gray-400 mb-2 font-light ml-[0.8em] drop-shadow-md relative z-10" 
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              A Musical Journey
            </h2>

            <h1 
              className="text-6xl md:text-[8rem] lg:text-[10rem] font-extrabold tracking-widest mb-1 text-3d-gold animate-shine leading-none drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] relative z-10"
              style={{ fontFamily: "'Abhaya Libre', serif", paddingBottom: '0.15em' }}
            >
              ස්වරාංග
            </h1>
            
            <h3 
              className="text-lg md:text-4xl tracking-[0.3em] md:tracking-[0.4em] text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37] mt-[-15px] md:mt-[-30px] font-bold drop-shadow-[0_10px_20px_rgba(0,0,0,1)] relative z-10" 
              style={{ fontFamily: "'Cinzel Decorative', serif" }}
            >
              DINALI IN CONCERT
            </h3>

            {/* Event Details */}
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
                <span>Pioneer Theatre</span>
              </div>
            </div>
          </div>
        </div>

        {/* --- MAIN CONTENT AREA (Booking Widget & Admin Dashboard) --- */}
        <div className="w-full flex justify-center mt-8 md:mt-12 relative z-30">
          
          {isAdmin && !userTicket ? (
            /* --- ORGANIZER DASHBOARD --- */
            <div className="w-full max-w-6xl relative group animate-fade-in print-hide">
              <div className="absolute -inset-1 bg-gradient-to-r from-green-600/20 to-emerald-900/40 rounded-3xl blur-xl opacity-50"></div>
              
              <div className="relative w-full bg-[#0a120a]/90 border border-green-900/40 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-2xl">
                <div className="flex justify-between items-center mb-8 border-b border-green-900/50 pb-6">
                  <div>
                    <h2 className="text-3xl font-light tracking-wide mb-1 text-white flex items-center gap-3">
                      <ShieldCheck className="text-green-500" />
                      Organizer Dashboard
                    </h2>
                    <p className="text-green-500 text-xs uppercase tracking-[0.2em]">soulsoundsbydinali@gmail.com</p>
                  </div>
                  <button onClick={() => setIsAdmin(false)} className="text-xs uppercase tracking-widest text-gray-400 hover:text-white border border-gray-600 px-4 py-2 rounded-full">
                    Exit Admin
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  <div className="bg-black/40 border border-green-900/30 p-6 rounded-2xl flex items-center space-x-4">
                    <Ticket className="text-green-500" size={32} />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest">Tickets Sold</p>
                      <p className="text-2xl font-light text-white">{ticketsSold} <span className="text-sm text-gray-600">/ {maxTickets}</span></p>
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
                      <p className="text-2xl font-light text-white">${ticketsSold * TICKET_PRICE}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  {/* Direct Generation Form */}
                  <div className="lg:col-span-1 bg-black/40 border border-green-900/20 p-6 rounded-2xl flex flex-col h-full">
                    <div>
                      <h3 className="text-sm font-medium uppercase tracking-widest text-green-400 mb-6">Direct Ticket Generator</h3>
                      <p className="text-xs text-gray-400 mb-6">Generate tickets instantly. An email will be dispatched with the ticket.</p>
                      
                      <form onSubmit={handleGenerateTicket} className="space-y-4">
                        <input 
                          type="text" 
                          value={name}
                          onChange={(e: any) => setName(e.target.value)}
                          className="w-full bg-transparent border-b border-green-900/50 px-2 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm"
                          placeholder="Guest Name (e.g. Smith Family)"
                        />
                        <input 
                          type="email" 
                          value={email}
                          onChange={(e: any) => setEmail(e.target.value)}
                          className="w-full bg-transparent border-b border-green-900/50 px-2 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm"
                          placeholder="Email (Optional)"
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
                          <span className="text-gray-400 text-sm px-2">Total Passes</span>
                          <select
                            value={quantity}
                            onChange={(e: any) => setQuantity(parseInt(e.target.value, 10))}
                            className="bg-transparent text-white focus:outline-none text-right"
                          >
                            {[...Array(20)].map((_: any, i: any) => (
                              <option key={i + 1} value={i + 1} className="bg-black">{i + 1}</option>
                            ))}
                          </select>
                        </div>
                        <button type="submit" disabled={requestStatus === 'submitting'} className="w-full bg-green-600 hover:bg-green-500 text-black font-bold uppercase tracking-widest text-xs py-3 rounded mt-4 transition-colors disabled:opacity-50">
                          {requestStatus === 'submitting' ? 'Generating...' : 'Generate & Open Ticket'}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Database List */}
                  <div className="lg:col-span-2">
                    <h3 className="text-sm font-medium uppercase tracking-widest text-green-400 mb-4">Ticket Database (Local Demo)</h3>
                    <div className="bg-black/40 border border-green-900/20 rounded-2xl overflow-hidden">
                      <div className="max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-green-900/20 text-green-500 uppercase tracking-widest sticky top-0 backdrop-blur-md">
                            <tr>
                              <th className="p-4 font-medium">Order ID</th>
                              <th className="p-4 font-medium">Guest</th>
                              <th className="p-4 font-medium">Type</th>
                              <th className="p-4 font-medium">Passes</th>
                              <th className="p-4 font-medium">Ticket #</th>
                              <th className="p-4 font-medium text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-green-900/20">
                            {ticketDatabase.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500">No tickets generated yet.</td>
                              </tr>
                            ) : (
                              ticketDatabase.map((ticket: any, idx: any) => (
                                <tr key={idx} className="hover:bg-green-900/10 transition-colors">
                                  <td className="p-4 text-yellow-500 font-mono text-[10px]">{ticket.purchaseId}</td>
                                  <td className="p-4 text-white">{ticket.name}</td>
                                  <td className="p-4 text-white">{ticket.type || 'General'}</td>
                                  <td className="p-4 text-gray-400">{ticket.quantity}</td>
                                  <td className="p-4 text-gray-500 font-mono">{ticket.number}</td>
                                  <td className="p-4 text-right">
                                    <button 
                                      onClick={() => viewExistingTicket(ticket)}
                                      className="text-green-400 hover:text-white transition-colors border border-green-900/50 px-3 py-1 rounded-full"
                                    >
                                      View
                                    </button>
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
                  <div className="lg:col-span-3 bg-black/40 border border-green-900/20 p-6 rounded-2xl">
                    <h3 className="text-sm font-medium uppercase tracking-widest text-green-400 mb-6 flex items-center gap-2">
                      <Lock size={16} /> System Controls
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    
                    {/* RESTORED FACTORY RESET BUTTON */}
                    <div className="mt-8 pt-6 border-t border-green-900/30 flex justify-end items-center">
                      <button 
                        onClick={() => setConfirmReset(!confirmReset)} 
                        onDoubleClick={handleFactoryReset} 
                        className={`text-xs border px-6 py-3 rounded-lg transition-all ${confirmReset ? 'bg-red-900 text-white border-red-900' : 'text-red-500 border-red-900/30 hover:bg-red-900/20'}`}
                      >
                        {confirmReset ? "Double Click to Reset Local Database" : "Clear Local Cache & Reset"}
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
                  <div className="text-right">
                    <span className="block text-2xl font-light text-white">${TICKET_PRICE}</span>
                    <span className="text-gray-500 text-xs uppercase tracking-widest">Per Pass</span>
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
                        onChange={(e: any) => setName(e.target.value)}
                        className="w-full bg-transparent border-b border-red-900/50 px-2 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors text-lg font-light tracking-wide"
                        placeholder="Guest Name"
                      />
                    </div>
                    <div className="space-y-1">
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e: any) => setEmail(e.target.value)}
                        className="w-full bg-transparent border-b border-red-900/50 px-2 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors text-lg font-light tracking-wide"
                        placeholder="Email Address"
                      />
                    </div>
                    
                    <div className="pt-4 flex items-center justify-between border-b border-red-900/50 pb-2">
                      <span className="text-gray-300 font-light tracking-wide px-2">Passes</span>
                      <select
                        value={quantity}
                        onChange={(e: any) => setQuantity(parseInt(e.target.value, 10))}
                        className="bg-transparent text-white text-xl font-light focus:outline-none appearance-none cursor-pointer pr-4 text-right"
                        style={{ textAlignLast: 'right' }}
                      >
                        {[...Array(Math.min(10, ticketsRemaining))].map((_: any, i: any) => (
                          <option key={i + 1} value={i + 1} className="bg-[#1a0205]">{i + 1}</option>
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
                            <span>Secure Passes • ${quantity * TICKET_PRICE}</span>
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

              {/* 3D Ticket Container */}
              <div 
                className="perspective-1000 mb-8"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <div 
                  ref={ticketRef}
                  id="digital-ticket" 
                  className="w-full max-w-4xl relative rounded-xl overflow-hidden flex flex-col md:flex-row bg-[#1a0205] border border-red-900/50 shadow-[0_30px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(212,175,55,0.2)] transition-transform duration-200 ease-out preserve-3d"
                  style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
                >
                  
                  {/* Holographic Glare Overlay */}
                  <div 
                    className="absolute inset-0 pointer-events-none mix-blend-screen z-50 transition-opacity duration-300"
                    style={{
                      opacity: tilt.opacity,
                      background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 50%)`,
                    }}
                  ></div>

                  {/* Left Side: The Main Pass */}
                  <div className="relative flex-1 p-8 md:p-12 bg-gradient-to-br from-[#3a0612] via-[#1a0205] to-[#0a0102] overflow-hidden">
                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px)', backgroundSize: '15px 15px' }}></div>
                    
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37]"></div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-[#D4AF37] via-[#FFF8DC] to-[#D4AF37]"></div>
                    
                    <div className="relative z-10 flex flex-col h-full justify-between min-h-[350px]">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2 text-yellow-500 mb-6 border border-yellow-500/30 px-3 py-1 inline-flex rounded-sm">
                            <Sparkles size={12} />
                            <span className="text-[10px] font-bold tracking-[0.4em] uppercase">Theatre</span>
                          </div>
                          
                          <h2 className="text-xs md:text-sm uppercase tracking-[0.5em] text-gray-400 mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                            A Musical Journey
                          </h2>
                          <h1 
                            className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text text-3d-gold mb-1"
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
                          
                          {/* Dinali's Photo on Ticket */}
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
                          <p className="font-light text-sm tracking-wider">Pioneer Theatre</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Admit</p>
                          <p className="font-light text-sm tracking-wider">{userTicket.quantity} Person(s)</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: The Stub */}
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
                      {[...Array(30)].map((_: any, i: any) => (
                        <div key={i} className="h-full bg-white" style={{ width: Math.random() * 4 + 1 + 'px', marginRight: Math.random() * 3 + 1 + 'px' }}></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Below Ticket */}
              <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-6 print-hide w-full max-w-4xl mt-4">
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

      {/* --- SECRET ADMIN TOGGLE --- */}
      <div className="fixed bottom-4 right-4 z-50 print-hide">
        <button 
          onClick={() => {
            if (isAdmin) setIsAdmin(false);
            else setShowAdminAuth(true);
          }}
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
        
        @media print {
          body { background: white !important; color: black !important; }
          #digital-ticket { 
            box-shadow: none !important; 
            border: 1px solid #ccc !important; 
            transform: none !important;
            background: #fff !important;
          }
          #digital-ticket * { color: black !important; text-shadow: none !important; }
          .print-hide, .fixed { display: none !important; }
        }
      `}} />
    </div>
  );
}
