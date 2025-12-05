import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Upload, Settings, LayoutGrid, AlertCircle, Check, Download, Table as TableIcon, RefreshCw, User, Trash2, FileSpreadsheet, FileText, Utensils, Sparkles, Loader2, ArrowRight, ListFilter, Briefcase, PieChart, ChevronRight, Circle, Square, Users, Lock, Unlock, Map, GripHorizontal, Shuffle, Search, FileDown, ChevronDown, Move, ShieldCheck, ShieldAlert, Globe } from 'lucide-react';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

const SeatingApp = () => {
  // State
  const [activeTab, setActiveTab] = useState('upload'); 
  const [fileData, setFileData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAICleaning, setIsAICleaning] = useState(false);
  const [useAICleaning, setUseAICleaning] = useState(false);
  const [excelLibLoaded, setExcelLibLoaded] = useState(false);
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [html2CanvasLoaded, setHtml2CanvasLoaded] = useState(false);
  
  // Security State
  const [privacyMode, setPrivacyMode] = useState(true); 
  
  // Accessibility & UI State
  const [announcement, setAnnouncement] = useState(''); 
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isGeneratingLayoutPdf, setIsGeneratingLayoutPdf] = useState(false);
  
  // Refs
  const layoutRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Drag and Drop State
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedGuest, setDraggedGuest] = useState(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  
  // Event Type State
  const [eventType, setEventType] = useState('meal'); 

  // Configuration State
  const [tableSize, setTableSize] = useState(8);
  const [seatingStrategy, setSeatingStrategy] = useState('sequential'); 
  const [tableShape, setTableShape] = useState('round'); 
  const [generatedTables, setGeneratedTables] = useState([]);
  
  // Dynamic Grouping State
  const [availableColumns, setAvailableColumns] = useState([]);
  const [groupByColumn, setGroupByColumn] = useState('');

  // --- BRANDING CONSTANTS (MIT Sloan Guidelines) ---
  const BRAND_RED = '#750014'; // Official MIT Red (PMS 202 C)
  const BRAND_RED_HOVER = '#50000d'; // Darker shade for hover
  const BRAND_SILVER = '#8B959E'; // MIT Silver Gray (PMS 7543)
  const BRAND_LIGHT_GRAY = '#F2F4F8'; // MIT Light Gray 1

  // Strategy Display Map
  const strategyDisplayNames = {
      'sequential': 'Sequential',
      'random': 'Randomized',
      'group_diet': 'Group by Diet',
      'group_attribute': 'Group by Attribute',
      'separate_attribute': 'Separate by Attribute'
  };

  // Helper to announce changes to screen readers
  const announce = (message) => {
      setAnnouncement(message);
      setTimeout(() => setAnnouncement(''), 3000);
  };

  // --- AI Logic ---
  const cleanDataWithGemini = async (rawData) => {
    // Security Guard: Prevent execution if in Privacy Mode
    if (privacyMode) {
        alert("Sensitive Data Protection is ENABLED. You must disable it in the top right to use AI features.");
        return rawData;
    }

    announce("Starting AI data cleaning. This may take a few seconds.");
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    const systemPrompt = `You are a data cleaning assistant for a seating planner application.
    Your task is to process a list of guests and normalize specific fields while strictly preserving all other data.
    Output must be a JSON array of objects.
    Rules:
    1. Look for name columns. If combined, split into "firstname" and "lastname". If separate, normalize keys to "firstname" and "lastname".
    2. Look for diet/allergy columns. Normalize key to "diet". Standardize values (e.g., "gf" -> "Gluten-Free", "veg" -> "Vegetarian"). If empty, set to "None".
    3. **CRITICAL:** You MUST preserve ALL other keys and values from the original objects exactly as they are. Do not remove any columns (like "Department", "Cohort", "Language", "Table", etc).
    4. Return ONLY the raw JSON array. Do not include markdown formatting.`;

    const dataSubset = rawData.slice(0, 150); 
    const userPrompt = `Here is the raw guest list data: ${JSON.stringify(dataSubset)}`;

    try {
        const fetchWithRetry = async (retries = 3, delay = 1000) => {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: userPrompt }] }],
                        systemInstruction: { parts: [{ text: systemPrompt }] }
                    })
                });
                if (!response.ok) throw new Error('Gemini API request failed');
                return await response.json();
            } catch (err) {
                if (retries > 0) {
                    await new Promise(res => setTimeout(res, delay));
                    return fetchWithRetry(retries - 1, delay * 2);
                }
                throw err;
            }
        };

        const result = await fetchWithRetry();
        let text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('No content in response');
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        announce("Data cleaning complete.");
        return JSON.parse(text);
    } catch (error) {
        console.error("AI Cleaning failed:", error);
        alert("AI Cleaning failed or took too long. Using original data.");
        announce("AI Cleaning failed. Reverting to original data.");
        return rawData; 
    }
  };

  // --- Handlers ---

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
        setSelectedFile(file);
        setFileName(file.name);
        announce(`Selected file: ${file.name}`);
    }
  };

  // Keyboard support for file drop zone
  const handleDropZoneKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInputRef.current.click();
      }
  };

  const handleDragOverFile = (e) => { e.preventDefault(); setIsDraggingFile(true); };
  const handleDragLeaveFile = (e) => { e.preventDefault(); setIsDraggingFile(false); };
  const handleDropFile = (e) => {
      e.preventDefault();
      setIsDraggingFile(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
          setSelectedFile(file);
          setFileName(file.name);
          announce(`Dropped file: ${file.name}`);
      } else {
          alert("Please drop a valid Excel or CSV file.");
      }
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;
    if (!excelLibLoaded) { alert("Excel parser is still loading..."); return; }

    setIsProcessing(true);
    announce("Processing file...");
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = window.XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = window.XLSX.utils.sheet_to_json(ws);
      
      if (data.length > 0) {
          const headers = Object.keys(data[0]);
          setAvailableColumns(headers);
          const smartDefault = headers.find(h => !h.toLowerCase().includes('name') && !h.toLowerCase().includes('diet')) || headers[0];
          setGroupByColumn(smartDefault);
      }

      let finalData = data;
      // Basic Normalization
      finalData = data.map(row => {
            const newRow = { ...row }; 
            Object.keys(row).forEach(key => {
                const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                newRow[cleanKey] = row[key]; 
                newRow[key.toLowerCase()] = row[key]; 
            });
            return newRow;
      });

      // Security check for AI usage
      if (useAICleaning && !privacyMode) {
          setIsAICleaning(true);
          const rawPrepared = data.map(row => { const r = {}; Object.keys(row).forEach(k => r[k] = row[k]); return r; });
          const cleanedData = await cleanDataWithGemini(rawPrepared);
          finalData = cleanedData;
          setIsAICleaning(false);
      } else if (useAICleaning && privacyMode) {
          // If user tried to enable AI but Privacy Mode is on, skip silently or warn
      }

      setFileData(finalData);
      setIsProcessing(false);
      setActiveTab('config');
      announce(`Successfully processed ${finalData.length} guests. Proceeding to configuration.`);
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleRecleanData = async () => {
      if (privacyMode) {
          alert("Please disable Sensitive Data Protection (top right) to use AI features. This involves sending data to cloud services.");
          return;
      }
      if (isAICleaning || fileData.length === 0) return;
      setIsAICleaning(true);
      const rawPrepared = fileData.map(row => row.raw || row);
      const cleanedData = await cleanDataWithGemini(rawPrepared);
      setFileData(cleanedData);
      generateSeatingPlan(cleanedData);
      setIsAICleaning(false);
  };

  const loadSampleData = () => {
    const names = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy", "Mallory", "Niaj", "Olivia", "Peggy", "Rupert", "Sybil", "Ted", "Victor", "Walter"];
    const diets = ["None", "None", "Vegetarian", "None", "Gluten-Free", "None", "None", "Vegan", "None", "Nut Allergy", "None", "None", "None", "None", "Vegetarian", "None", "None", "None", "None"];
    const depts = ["Sales", "Marketing", "Engineering", "HR", "Product", "Legal"];
    const langs = ["English", "Spanish", "French", "German", "Mandarin", "Hindi"];

    const sample = Array.from({ length: 45 }, (_, i) => ({
      firstname: names[i % names.length],
      lastname: `Doe ${Math.floor(i / names.length) + 1}`,
      diet: diets[i % diets.length],
      department: depts[i % depts.length],
      language: langs[i % langs.length],
      id: i
    }));
    
    setFileData(sample);
    setFileName("sample_event_data.xlsx");
    setAvailableColumns(["firstname", "lastname", "diet", "department", "language", "id"]);
    setGroupByColumn("language");
    setActiveTab('config');
    announce("Sample data loaded.");
  };

  const handleClear = () => {
    // Explicitly nullify data for security
    setFileData([]);
    setFileName('');
    setSelectedFile(null);
    setGeneratedTables([]);
    setTableSize(8);
    setSeatingStrategy('sequential');
    setTableShape('round');
    setSearchQuery('');
    setIsAICleaning(false);
    setIsEditMode(false);
    setShowExportMenu(false);
    setActiveTab('upload');
    // Privacy mode stays as user set it, default is secure
    announce("Application reset. All guest data cleared from memory.");
  };

  const downloadTemplate = () => {
      const headers = ["First Name", "Last Name", "Dietary Restrictions", "Department", "Role", "Group"];
      const ws = window.XLSX.utils.aoa_to_sheet([headers]);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Template");
      window.XLSX.writeFile(wb, "Sloan_Guest_List_Template.xlsx");
  };

  // --- Manual Drag & Drop & Keyboard Move Handlers ---
  const handleGuestDragStart = (e, guest, sourceTableIndex, guestIndex) => {
      if (!isEditMode) return;
      setDraggedGuest({ guest, sourceTableIndex, guestIndex });
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleTableDragOver = (e) => {
      if (!isEditMode) return;
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'move';
  };

  const handleGuestDrop = (e, targetTableIndex) => {
      if (!isEditMode || !draggedGuest) return;
      e.preventDefault();
      moveGuest(draggedGuest.guest, draggedGuest.sourceTableIndex, draggedGuest.guestIndex, targetTableIndex);
      setDraggedGuest(null);
  };

  // Accessible move function for keyboard users
  const handleKeyboardMove = (guest, sourceTableIndex, guestIndex) => {
      const targetInput = window.prompt(`Move ${guest.name} to which table number? (1-${generatedTables.length})`);
      if (!targetInput) return;
      
      const targetNum = parseInt(targetInput);
      if (isNaN(targetNum) || targetNum < 1 || targetNum > generatedTables.length) {
          alert("Invalid table number.");
          return;
      }
      
      const targetTableIndex = targetNum - 1;
      moveGuest(guest, sourceTableIndex, guestIndex, targetTableIndex);
  };

  const moveGuest = (guest, sourceTableIndex, guestIndex, targetTableIndex) => {
      const newTables = [...generatedTables];
      const sourceTable = newTables[sourceTableIndex];
      const targetTable = newTables[targetTableIndex];

      // Remove from source
      sourceTable.guests.splice(guestIndex, 1);
      
      // Add to target
      targetTable.guests.push(guest);

      // Re-calculate restrictions for both tables
      [sourceTable, targetTable].forEach(table => {
          const dietaryRestrictions = table.guests.filter(g => g.diet && g.diet.toLowerCase() !== 'none' && g.diet !== '');
          table.hasRestrictions = dietaryRestrictions.length > 0;
          table.restrictionsList = [...new Set(dietaryRestrictions.map(d => d.diet))];
          
          // Logic for tagging group/separate attribute
          if ((seatingStrategy === 'group_attribute' || seatingStrategy === 'separate_attribute') && groupByColumn) {
                const uniqueVals = [...new Set(table.guests.map(g => g.raw?.[groupByColumn]).filter(v => v !== undefined && v !== null && v !== ''))];
                if (uniqueVals.length === 1) table.attributeTag = uniqueVals[0];
                else if (uniqueVals.length > 1) table.attributeTag = uniqueVals.length === 2 ? `Mixed: ${uniqueVals.join(' & ')}` : "Mixed Group";
                else table.attributeTag = null;
          }
      });

      setGeneratedTables(newTables);
      announce(`Moved ${guest.name} to Table ${targetTableIndex + 1}`);
  };

  // --- Core Algorithm ---
  const generateSeatingPlan = (dataOverride = null, isShuffle = false) => {
    const sourceData = dataOverride || fileData;
    if (!sourceData || sourceData.length === 0) return;

    let guests = [...sourceData].map(g => {
        const keys = Object.keys(g);
        // Name Strategy
        const fNameKey = keys.find(k => (k.includes('first') && k.includes('name')) || k === 'fname' || k === 'forename' || k === 'first' || k === 'firstname');
        const lNameKey = keys.find(k => ((k.includes('last') && k.includes('name')) || k.includes('surname') || k === 'lname' || k === 'last' || k === 'lastname'));
        
        let finalName = "Unknown Guest";
        if (g.firstname && g.lastname) finalName = `${g.firstname} ${g.lastname}`.trim();
        else if (g.firstname) finalName = g.firstname;
        else if (fNameKey && lNameKey && g[fNameKey] && g[lNameKey]) finalName = `${g[fNameKey]} ${g[lNameKey]}`.trim();
        else {
            const nameKey = keys.find(k => k.includes('name') || k.includes('guest')) || keys[0];
            finalName = g[nameKey] || "Unknown Guest";
        }

        const dietKey = keys.find(k => k.includes('diet') || k.includes('restriction') || k.includes('allergy'));
        
        return {
            name: finalName,
            diet: dietKey ? g[dietKey] : "None",
            raw: g
        };
    });

    if (isShuffle || seatingStrategy === 'random') {
        guests = guests.sort(() => Math.random() - 0.5);
    }

    if (seatingStrategy === 'group_diet') {
       guests = guests.sort((a, b) => {
           const dietA = (a.diet || "").toString().toLowerCase();
           const dietB = (b.diet || "").toString().toLowerCase();
           if (dietA < dietB) return -1;
           if (dietA > dietB) return 1;
           return 0;
       });
    } else if (seatingStrategy === 'group_attribute' && groupByColumn) {
        guests = guests.sort((a, b) => {
            const valA = (a.raw[groupByColumn] ?? "").toString().toLowerCase();
            const valB = (b.raw[groupByColumn] ?? "").toString().toLowerCase();
            if (valA < valB) return -1;
            if (valA > valB) return 1;
            return 0;
        });
    } else if (seatingStrategy === 'separate_attribute' && groupByColumn) {
        // Interleaving / Round-Robin Distribution for diversity
        const buckets = {};
        guests.forEach(g => {
            const val = (g.raw[groupByColumn] ?? "Unknown").toString();
            if (!buckets[val]) buckets[val] = [];
            buckets[val].push(g);
        });
        
        // Convert to array of arrays, sort by size to distribute largest groups first
        const bucketArrays = Object.values(buckets).sort((a, b) => b.length - a.length);
        
        const distributedGuests = [];
        let index = 0;
        let active = true;
        
        // Pick one from each bucket round-robin style
        while(active) {
            active = false;
            for(let i=0; i<bucketArrays.length; i++) {
                if (index < bucketArrays[i].length) {
                    distributedGuests.push(bucketArrays[i][index]);
                    active = true;
                }
            }
            index++;
        }
        guests = distributedGuests;
    }

    const tables = [];
    let tableCounter = 0;

    for (let i = 0; i < guests.length; i += parseInt(tableSize)) {
      const seatChunk = guests.slice(i, i + parseInt(tableSize));
      const dietaryRestrictions = seatChunk.filter(g => g.diet && g.diet.toLowerCase() !== 'none' && g.diet !== '');
      const hasRestrictions = dietaryRestrictions.length > 0;
      
      let attributeTag = null;
      if ((seatingStrategy === 'group_attribute' || seatingStrategy === 'separate_attribute') && groupByColumn) {
          const uniqueVals = [...new Set(seatChunk.map(g => g.raw?.[groupByColumn]).filter(v => v !== undefined && v !== null && v !== ''))];
          if (uniqueVals.length === 1) attributeTag = uniqueVals[0];
          else if (uniqueVals.length > 1) attributeTag = uniqueVals.length === 2 ? `Mixed: ${uniqueVals.join(' & ')}` : "Mixed Group";
      }

      tables.push({
        id: tableCounter, 
        guests: seatChunk,
        hasRestrictions,
        restrictionsList: [...new Set(dietaryRestrictions.map(d => d.diet))],
        attributeTag
      });
      tableCounter++;
    }

    setGeneratedTables(tables);
    setActiveTab('view');
    announce(`Seating plan generated with ${tables.length} tables.`);
  };

  // --- Exports ---
  const exportToExcel = () => {
    if (generatedTables.length === 0) return;
    const exportData = [];
    
    generatedTables.forEach(table => {
        table.guests.forEach(guest => {
            const row = { "Table Number": table.id + 1, "Guest Name": guest.name };
            if (eventType === 'meal') row["Dietary Restrictions"] = guest.diet;
            if ((seatingStrategy === 'group_attribute' || seatingStrategy === 'separate_attribute') && groupByColumn) {
                row[groupByColumn] = guest.raw[groupByColumn] ?? "";
            }
            exportData.push(row);
        });
    });

    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Seating Plan");
    window.XLSX.writeFile(wb, "sloan_seating_plan.xlsx");
    announce("Excel file exported.");
  };

  const exportToPDF = () => {
    if (generatedTables.length === 0) return;
    if (!pdfLibLoaded || !window.jspdf) { alert("PDF generator loading..."); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    // Brand RGB for #750014
    const brandRed = [117, 0, 20]; 

    doc.setFontSize(20);
    doc.setTextColor(...brandRed); 
    doc.text("Sloan SeatSmart Planner", 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()} | MIT Sloan School of Management`, 14, 30);
    
    const headRow = ["Table #", "Guest Name"];
    if (eventType === 'meal') headRow.push("Dietary Restrictions");
    if ((seatingStrategy === 'group_attribute' || seatingStrategy === 'separate_attribute') && groupByColumn) headRow.push(groupByColumn);
    const head = [headRow];

    const tableRows = [];
    
    generatedTables.forEach(table => {
        table.guests.forEach(guest => {
            const rowData = [`Table ${table.id + 1}`, guest.name];
            if (eventType === 'meal') rowData.push(guest.diet);
            if ((seatingStrategy === 'group_attribute' || seatingStrategy === 'separate_attribute') && groupByColumn) {
                 rowData.push(guest.raw[groupByColumn] ?? "");
            }
            tableRows.push(rowData);
        });
    });

    doc.autoTable({
        head: head,
        body: tableRows,
        startY: 35,
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: brandRed },
        alternateRowStyles: { fillColor: [250, 245, 246] }
    });
    doc.save("sloan_seating_plan.pdf");
    announce("PDF file exported.");
  };

  const exportLayoutToPDF = async () => {
    if (!layoutRef.current || !window.html2canvas || !window.jspdf) {
        alert("PDF tools are loading...");
        return;
    }
    
    setIsGeneratingLayoutPdf(true);
    announce("Generating layout PDF...");

    try {
        // Wait a brief moment to ensure any rendering is complete
        await new Promise(resolve => setTimeout(resolve, 500));

        const canvas = await window.html2canvas(layoutRef.current, {
            scale: 2, 
            useCORS: true,
            logging: false,
            backgroundColor: '#f1f5f9' 
        });
        
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4');
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        const widthRatio = pageWidth / canvas.width;
        const heightRatio = pageHeight / canvas.height;
        const ratio = widthRatio > heightRatio ? heightRatio : widthRatio;
        
        const canvasWidth = canvas.width * ratio;
        const canvasHeight = canvas.height * ratio;
        
        const marginX = (pageWidth - canvasWidth) / 2;
        const marginY = (pageHeight - canvasHeight) / 2;

        pdf.addImage(imgData, 'PNG', marginX, marginY, canvasWidth, canvasHeight);
        pdf.save("sloan_room_layout.pdf");
        announce("Layout PDF exported.");
    } catch (err) {
        console.error("Layout PDF Error:", err);
        alert("Could not generate layout PDF.");
    } finally {
        setIsGeneratingLayoutPdf(false);
    }
  };

  // --- Catering Stats ---
  const cateringStats = useMemo(() => {
      if (generatedTables.length === 0) return {};
      const stats = {};
      generatedTables.forEach(t => {
          t.guests.forEach(g => {
              if (g.diet && g.diet !== 'None') {
                  stats[g.diet] = (stats[g.diet] || 0) + 1;
              }
          });
      });
      return stats;
  }, [generatedTables]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col" style={{fontFamily: "'Roboto', sans-serif"}}>
      {/* Accessibility Live Region */}
      <div aria-live="polite" className="sr-only">
          {announcement}
      </div>

      {/* Header */}
      <header className="bg-[#750014] text-white p-6 shadow-lg sticky top-0 z-50" role="banner">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div 
            className="flex items-center space-x-3 cursor-pointer focus-visible:ring-2 focus-visible:ring-white rounded-md p-1 outline-none" 
            onClick={() => setActiveTab('upload')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('upload')}
            tabIndex={0}
            role="button"
            aria-label="Go to Upload Screen"
          >
            <LayoutGrid className="w-8 h-8 opacity-90" aria-hidden="true" />
            <div className="flex flex-col">
                 <h1 className="text-2xl font-bold tracking-tight leading-none">MIT Sloan SeatSmart</h1>
                 <span className="text-xs text-red-100 opacity-80 uppercase tracking-widest mt-1">Planner</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
             
             {/* Security Indicator */}
             <button
                onClick={() => {
                    const newMode = !privacyMode;
                    setPrivacyMode(newMode);
                    setUseAICleaning(false); // Reset AI flag if switching modes
                    announce(newMode ? "Sensitive Data Protection Enabled" : "Sensitive Data Protection Disabled");
                }}
                className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors focus-visible:ring-2 focus-visible:ring-white outline-none ${privacyMode ? 'bg-emerald-800 text-emerald-50 border border-emerald-500' : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'}`}
                title={privacyMode ? "AI Disabled. Data remains in browser." : "AI Enabled. Data processed in cloud."}
             >
                {privacyMode ? <ShieldCheck className="w-4 h-4 mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5 text-yellow-400" />}
                {privacyMode ? 'Sensitive Data: Protected' : 'AI Features: Enabled'}
             </button>

             <div className="text-red-100 text-sm hidden sm:block" aria-live="polite">
                {fileData.length > 0 ? `${fileData.length} Guests` : ''}
            </div>
            {fileData.length > 0 && (
                 <button 
                    onClick={handleClear} 
                    className="flex items-center px-3 py-1.5 bg-[#50000d] hover:bg-[#3d000a] rounded-md text-xs font-medium transition-colors border border-[#750014] focus-visible:ring-2 focus-visible:ring-white outline-none"
                    aria-label="Start Over and Clear Data"
                >
                    <Trash2 className="w-3 h-3 mr-1.5" aria-hidden="true" /> Start Over
                </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6 flex-grow w-full" role="main">
        
        {/* Interactive Progress Stepper */}
        <nav aria-label="Progress Steps" className="flex justify-center mb-8">
            <ol className="flex items-center space-x-4 list-none">
                <li>
                    <StepButton icon={Upload} label="1. Upload" isActive={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
                </li>
                <li aria-hidden="true" className={`w-12 h-0.5 ${fileData.length > 0 ? 'bg-[#750014]' : 'bg-slate-300'}`} />
                <li>
                    <StepButton icon={Settings} label="2. Configure" isActive={activeTab === 'config'} disabled={fileData.length === 0} onClick={() => setActiveTab('config')} />
                </li>
                <li aria-hidden="true" className={`w-12 h-0.5 ${generatedTables.length > 0 ? 'bg-[#750014]' : 'bg-slate-300'}`} />
                <li>
                    <StepButton icon={TableIcon} label="3. Visualize" isActive={activeTab === 'view'} disabled={generatedTables.length === 0} onClick={() => setActiveTab('view')} />
                </li>
                
                {/* Only show Layout tab if NOT in Groups mode */}
                {tableShape !== 'groups' && (
                    <>
                        <li aria-hidden="true" className={`w-12 h-0.5 ${generatedTables.length > 0 ? 'bg-[#750014]' : 'bg-slate-300'}`} />
                        <li>
                            <StepButton icon={Map} label="4. Layout" isActive={activeTab === 'layout'} disabled={generatedTables.length === 0} onClick={() => setActiveTab('layout')} />
                        </li>
                    </>
                )}
            </ol>
        </nav>

        <div className="bg-white rounded-sm shadow-md border border-slate-200 min-h-[500px] overflow-hidden">
            
            {/* View: Upload */}
            {activeTab === 'upload' && (
                <section className="p-12 flex flex-col items-center text-center justify-center h-full space-y-6" aria-label="Upload Section">
                    {isAICleaning ? (
                        <div className="flex flex-col items-center animate-pulse" role="status">
                            <Sparkles className="w-16 h-16 text-[#750014] mb-4" aria-hidden="true" />
                            <h2 className="text-2xl font-bold text-slate-800">Cleaning Data with AI...</h2>
                            <p className="text-slate-500 mt-2">Standardizing names and dietary formats</p>
                            <Loader2 className="w-8 h-8 text-[#750014] mt-6 animate-spin" aria-hidden="true" />
                        </div>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4" aria-hidden="true">
                                <Upload className="w-10 h-10 text-[#750014]" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Upload Guest List</h2>
                                <p className="text-slate-500 max-w-md mt-2">
                                    Upload an Excel (.xlsx) or CSV file to get started.
                                </p>
                                <p className="text-xs text-slate-400 mt-2 flex items-center justify-center">
                                    <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                                    Recommended limit: 300 guests for optimal performance.
                                </p>
                            </div>

                            <div role="radiogroup" aria-label="Event Type" className="w-full max-w-md my-4 grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setEventType('meal')} 
                                    className={`p-3 rounded-lg border flex flex-col items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-[#750014] outline-none ${eventType === 'meal' ? 'bg-red-50 border-[#750014] text-[#750014]' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                    aria-checked={eventType === 'meal'}
                                    role="radio"
                                >
                                    <Utensils className="w-6 h-6 mb-2" aria-hidden="true" />
                                    <span className="font-bold text-sm">Seated Meal</span>
                                    <span className="text-xs opacity-70 mt-1">Tracks diets</span>
                                </button>
                                <button 
                                    onClick={() => setEventType('workshop')} 
                                    className={`p-3 rounded-lg border flex flex-col items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-[#750014] outline-none ${eventType === 'workshop' ? 'bg-red-50 border-[#750014] text-[#750014]' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                    aria-checked={eventType === 'workshop'}
                                    role="radio"
                                >
                                    <Briefcase className="w-6 h-6 mb-2" aria-hidden="true" />
                                    <span className="font-bold text-sm">Workshop / Class</span>
                                    <span className="text-xs opacity-70 mt-1">Groups only</span>
                                </button>
                            </div>
                            
                            <div className={`bg-slate-50 border border-slate-200 p-4 rounded-lg flex items-center space-x-3 max-w-md w-full transition-opacity ${privacyMode ? 'opacity-50 cursor-not-allowed' : 'opacity-100'}`}>
                                <button 
                                    onClick={() => !privacyMode && setUseAICleaning(!useAICleaning)} 
                                    disabled={privacyMode}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#750014] ${useAICleaning ? 'bg-[#750014]' : 'bg-slate-300'} disabled:cursor-not-allowed`}
                                    role="switch"
                                    aria-checked={useAICleaning}
                                    aria-label="Clean Data with AI Toggle"
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useAICleaning ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                                <div className="flex-1 text-left" onClick={() => !privacyMode && setUseAICleaning(!useAICleaning)}>
                                    <label className={`text-sm font-bold text-slate-700 flex items-center ${privacyMode ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                        <Sparkles className="w-4 h-4 mr-1 text-[#750014]" aria-hidden="true" /> Clean Data with AI
                                    </label>
                                    <p className="text-xs text-slate-500">{privacyMode ? 'Disabled in Protected Mode' : 'Fix typos and standardize formats.'}</p>
                                </div>
                            </div>

                            <div className="flex flex-col space-y-4 w-full max-w-md relative">
                                <label 
                                    htmlFor="file-upload"
                                    onDragOver={handleDragOverFile}
                                    onDragLeave={handleDragLeaveFile}
                                    onDrop={handleDropFile}
                                    onKeyDown={handleDropZoneKeyDown}
                                    tabIndex="0"
                                    className={`flex flex-col items-center px-4 py-8 bg-white rounded-lg shadow-sm tracking-wide uppercase border-2 border-dashed cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#750014] ${isDraggingFile ? 'border-[#750014] bg-red-50 scale-105' : selectedFile ? 'border-green-400 bg-green-50 text-green-700' : 'border-slate-300 text-slate-400 hover:bg-slate-50'}`}
                                    role="button"
                                    aria-label="File Upload Drop Zone"
                                >
                                    {selectedFile ? <FileSpreadsheet className="w-10 h-10 text-green-600 mb-2" aria-hidden="true" /> : <Upload className="w-10 h-10 mb-2" aria-hidden="true" />}
                                    <span className="mt-2 text-base leading-normal text-center break-all font-semibold">{fileName || 'Drag & Drop or Select File'}</span>
                                    <input 
                                        id="file-upload" 
                                        ref={fileInputRef}
                                        type='file' 
                                        className="hidden" 
                                        accept=".xlsx, .xls, .csv" 
                                        onChange={handleFileSelect} 
                                    />
                                </label>
                                
                                {selectedFile && (
                                    <button onClick={handleProcessFile} className="w-full py-3 px-4 bg-[#750014] hover:bg-[#50000d] text-white font-bold rounded-lg shadow-lg transform transition-all active:scale-95 flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#750014] outline-none">
                                        <ArrowRight className="w-5 h-5 mr-2" aria-hidden="true" /> Process Guest List {useAICleaning && !privacyMode && "& Clean Data"}
                                    </button>
                                )}

                                <div className="relative flex py-2 items-center">
                                    <div className="flex-grow border-t border-slate-200"></div>
                                    <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">Or try it out</span>
                                    <div className="flex-grow border-t border-slate-200"></div>
                                </div>

                                <div className="flex gap-2">
                                    <button onClick={loadSampleData} className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors flex items-center justify-center space-x-2 focus-visible:ring-2 focus-visible:ring-[#750014] outline-none">
                                        <Download className="w-4 h-4" aria-hidden="true" /> <span>Sample Data</span>
                                    </button>
                                    <button onClick={downloadTemplate} className="w-full py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-lg transition-colors flex items-center justify-center space-x-2 focus-visible:ring-2 focus-visible:ring-[#750014] outline-none">
                                        <FileDown className="w-4 h-4" aria-hidden="true" /> <span>Download Template</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            )}

            {/* View: Configuration */}
            {activeTab === 'config' && (
                <section className="p-8" aria-label="Configuration">
                    {/* ... Configuration UI ... */}
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                        <h2 className="text-2xl font-bold text-slate-800">Seating Parameters</h2>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{eventType === 'meal' ? 'Meal Planning' : 'Workshop Mode'}</span>
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                                <Check className="w-4 h-4 mr-1" aria-hidden="true" /> {fileData.length} Guests
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-8">
                            <div>
                                <label htmlFor="table-size-slider" className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
                                    <span>Guests per Table</span>
                                    <span className="text-[#750014]">{tableSize}</span>
                                </label>
                                <input 
                                    id="table-size-slider"
                                    type="range" 
                                    min="2" 
                                    max="12" 
                                    step="1" 
                                    value={tableSize} 
                                    onChange={(e) => setTableSize(e.target.value)} 
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#750014] focus-visible:ring-2 focus-visible:ring-[#750014] outline-none" 
                                    aria-valuemin="2"
                                    aria-valuemax="12"
                                    aria-valuenow={tableSize}
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-2" aria-hidden="true"><span>2 Seats</span><span>12 Seats</span></div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Table Shape</label>
                                <div role="radiogroup" aria-label="Table Shape" className="grid grid-cols-3 gap-3 mb-6">
                                    <button 
                                        onClick={() => setTableShape('round')} 
                                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all focus-visible:ring-2 focus-visible:ring-[#750014] outline-none ${tableShape === 'round' ? 'bg-red-50 border-[#750014] text-[#750014]' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                        role="radio"
                                        aria-checked={tableShape === 'round'}
                                    >
                                        <Circle className="w-6 h-6 mb-1" aria-hidden="true" /><span className="text-xs font-medium">Round</span>
                                    </button>
                                    <button 
                                        onClick={() => setTableShape('rectangle')} 
                                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all focus-visible:ring-2 focus-visible:ring-[#750014] outline-none ${tableShape === 'rectangle' ? 'bg-red-50 border-[#750014] text-[#750014]' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                        role="radio"
                                        aria-checked={tableShape === 'rectangle'}
                                    >
                                        <Square className="w-6 h-6 mb-1" aria-hidden="true" /><span className="text-xs font-medium">Rectangle</span>
                                    </button>
                                    <button 
                                        onClick={() => setTableShape('groups')} 
                                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all focus-visible:ring-2 focus-visible:ring-[#750014] outline-none ${tableShape === 'groups' ? 'bg-red-50 border-[#750014] text-[#750014]' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                        role="radio"
                                        aria-checked={tableShape === 'groups'}
                                    >
                                        <Users className="w-6 h-6 mb-1" aria-hidden="true" /><span className="text-xs font-medium">Groups Only</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-4">Seating Strategy</label>
                                <div role="radiogroup" aria-label="Seating Strategy" className="grid grid-cols-1 gap-3">
                                    <StrategyOption active={seatingStrategy === 'sequential'} onClick={() => setSeatingStrategy('sequential')} title="Sequential" desc="Fill tables in spreadsheet order." />
                                    {eventType === 'meal' && (<StrategyOption active={seatingStrategy === 'group_diet'} onClick={() => setSeatingStrategy('group_diet')} title="Group by Diet" desc="Group similar dietary needs together." icon={Utensils} />)}
                                    <StrategyOption active={seatingStrategy === 'group_attribute'} onClick={() => setSeatingStrategy('group_attribute')} title="Group by Attribute" desc="Group by Department, Team, etc." icon={ListFilter} />
                                    <StrategyOption active={seatingStrategy === 'separate_attribute'} onClick={() => setSeatingStrategy('separate_attribute')} title="Separate by Attribute" desc="Distribute evenly to maximize diversity." icon={Shuffle} />
                                    
                                    {(seatingStrategy === 'group_attribute' || seatingStrategy === 'separate_attribute') && (
                                        <div className="ml-4 mt-2 p-3 bg-slate-50 border-l-4 border-[#750014] animate-in slide-in-from-left-2">
                                            <label htmlFor="group-column-select" className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Column</label>
                                            <select 
                                                id="group-column-select"
                                                value={groupByColumn} 
                                                onChange={(e) => setGroupByColumn(e.target.value)} 
                                                className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-[#750014] outline-none"
                                            >
                                                {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <StrategyOption active={seatingStrategy === 'random'} onClick={() => setSeatingStrategy('random')} title="Randomized" desc="Shuffle guests randomly." />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 h-fit">
                            <h3 className="text-lg font-bold text-slate-700 mb-4">Projected Layout</h3>
                            <div className="space-y-4">
                                <StatRow label="Total Guests" value={fileData.length} />
                                <StatRow label="Target Table Size" value={tableSize} />
                                <StatRow label="Estimated Tables" value={Math.ceil(fileData.length / tableSize)} />
                                <StatRow label="Strategy" value={strategyDisplayNames[seatingStrategy] || seatingStrategy} />
                                <StatRow label="Table Shape" value={tableShape.charAt(0).toUpperCase() + tableShape.slice(1)} />
                            </div>
                            <button onClick={() => generateSeatingPlan()} className="w-full mt-8 py-4 bg-[#750014] hover:bg-[#50000d] text-white font-bold rounded-lg shadow-md hover:shadow-lg transform transition-all active:scale-95 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#750014] outline-none">
                                <LayoutGrid className="w-5 h-5 mr-2" aria-hidden="true" /> Create Seating Plan
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* View: Results */}
            {activeTab === 'view' && (
                <section className="p-8 bg-slate-50 min-h-[600px] relative" aria-label="Seating Visualization">
                     {isAICleaning && (
                        <div className="fixed inset-0 bg-white/90 z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300 backdrop-blur-sm" role="alert" aria-busy="true">
                            <div className="flex flex-col items-center animate-pulse">
                                <Sparkles className="w-16 h-16 text-[#750014] mb-4" aria-hidden="true" />
                                <h2 className="text-2xl font-bold text-slate-800">Cleaning Data & Refreshing...</h2>
                                <p className="text-slate-500 mt-2">Standardizing names, diets, and preserving custom attributes</p>
                                <Loader2 className="w-8 h-8 text-[#750014] mt-6 animate-spin" aria-hidden="true" />
                            </div>
                        </div>
                     )}

                     <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-6 space-y-4 xl:space-y-0">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Seating Plan</h2>
                                <p className="text-slate-500">{generatedTables.length} tables generated for {fileData.length} guests</p>
                            </div>
                            
                            {/* Search Bar */}
                            <div className="relative group w-full sm:w-64">
                                <label htmlFor="guest-search" className="sr-only">Search Guest Name</label>
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-slate-400 group-focus-within:text-[#750014]" aria-hidden="true" />
                                </div>
                                <input
                                    id="guest-search"
                                    type="text"
                                    placeholder="Search guest name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:border-[#750014] focus:ring-1 focus:ring-[#750014] sm:text-sm transition-colors"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end">
                            {/* Editing Tools Group */}
                            <div className="flex space-x-1 border-r border-slate-200 pr-2 mr-1">
                                <button 
                                    onClick={() => setIsEditMode(!isEditMode)} 
                                    className={`px-3 py-2 border rounded-lg font-medium flex items-center text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[#750014] outline-none ${isEditMode ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-slate-300 text-slate-600'}`}
                                    aria-pressed={isEditMode}
                                >
                                    {isEditMode ? <Unlock className="w-4 h-4 mr-1.5" aria-hidden="true" /> : <Lock className="w-4 h-4 mr-1.5" aria-hidden="true" />}
                                    {isEditMode ? 'Finish' : 'Edit'}
                                </button>
                                <button onClick={() => generateSeatingPlan(null, true)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 flex items-center text-sm focus-visible:ring-2 focus-visible:ring-[#750014] outline-none" title="Reshuffle current grouping" aria-label="Shuffle Tables">
                                    <Shuffle className="w-4 h-4" aria-hidden="true" />
                                </button>
                            </div>

                            {/* Data Tools */}
                            <button 
                                onClick={handleRecleanData} 
                                disabled={isAICleaning || privacyMode} 
                                className={`px-3 py-2 border rounded-lg font-medium flex items-center text-sm focus-visible:ring-2 focus-visible:ring-[#750014] outline-none ${privacyMode ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}
                                title={privacyMode ? "Disabled in Protected Mode" : "Clean Data with AI"}
                            >
                                <Sparkles className="w-4 h-4 mr-1.5" aria-hidden="true" /> AI Clean
                            </button>
                            
                            <button onClick={() => setActiveTab('config')} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 flex items-center text-sm focus-visible:ring-2 focus-visible:ring-[#750014] outline-none">
                                <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden="true" /> Reconfigure
                            </button>

                            {/* Export Dropdown */}
                            <div className="relative">
                                <button 
                                    onClick={() => setShowExportMenu(!showExportMenu)} 
                                    className="px-3 py-2 bg-[#750014] hover:bg-[#50000d] text-white rounded-lg text-sm font-medium flex items-center shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#750014] outline-none"
                                    aria-expanded={showExportMenu}
                                    aria-haspopup="true"
                                >
                                    <Download className="w-4 h-4 mr-1.5" aria-hidden="true" /> Export <ChevronDown className="w-3 h-3 ml-1" aria-hidden="true" />
                                </button>
                                {showExportMenu && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                                        <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2" role="menu">
                                            <button onClick={() => { exportToPDF(); setShowExportMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm flex items-center text-slate-700 focus-visible:bg-slate-100 focus:outline-none" role="menuitem">
                                                <FileText className="w-4 h-4 mr-2 text-[#750014]" aria-hidden="true" /> PDF
                                            </button>
                                            <button onClick={() => { exportToExcel(); setShowExportMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm flex items-center text-slate-700 border-t border-slate-100 focus-visible:bg-slate-100 focus:outline-none" role="menuitem">
                                                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" aria-hidden="true" /> Excel
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {isEditMode && (
                        <div className="mb-4 bg-orange-50 border-l-4 border-orange-400 p-3 text-sm text-orange-700 animate-in fade-in slide-in-from-top-2" role="alert">
                            <span className="font-bold">Editing Enabled:</span> Drag guests to move, or use the <Move className="w-3 h-3 inline mx-1" /> button to move by keyboard.
                        </div>
                    )}

                    {/* Quick Stats Bar for Meals */}
                    {eventType === 'meal' && Object.keys(cateringStats).length > 0 && (
                        <div className="mb-8 p-4 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center" aria-label="Catering Summary">
                            <div className="flex items-center text-slate-500 text-sm font-semibold border-r border-slate-200 pr-4">
                                <PieChart className="w-4 h-4 mr-2" aria-hidden="true" /> Catering Summary:
                            </div>
                            {Object.entries(cateringStats).map(([diet, count]) => (
                                <div key={diet} className="flex items-center text-sm">
                                    <span className="font-bold text-slate-700 mr-1">{count}</span>
                                    <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-xs">{diet}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-2">
                        {generatedTables.map((table, idx) => (
                            <TableCard 
                                key={idx} 
                                tableIndex={idx}
                                tableNumber={table.id + 1} 
                                data={table} 
                                groupByColumn={groupByColumn}
                                seatingStrategy={seatingStrategy}
                                eventType={eventType}
                                tableShape={tableShape}
                                isEditMode={isEditMode}
                                onGuestDragStart={handleGuestDragStart}
                                onTableDragOver={handleTableDragOver}
                                onGuestDrop={handleGuestDrop}
                                onGuestKeyboardMove={handleKeyboardMove}
                                searchQuery={searchQuery}
                                capacity={tableSize}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* View: Room Layout (New Tab) */}
            {activeTab === 'layout' && (
                <section className="bg-slate-100 min-h-[600px] flex flex-col" aria-label="Room Layout">
                    <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-40">
                        <h2 className="text-2xl font-bold text-slate-800">Room Layout Visualization</h2>
                        <div className="flex gap-2">
                             <button 
                                onClick={exportLayoutToPDF} 
                                disabled={isGeneratingLayoutPdf}
                                className="px-3 py-2 bg-[#750014] text-white rounded-lg text-sm font-medium hover:bg-[#50000d] flex items-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#750014] outline-none"
                            >
                                {isGeneratingLayoutPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <FileText className="w-4 h-4 mr-2" aria-hidden="true" />}
                                {isGeneratingLayoutPdf ? 'Generating...' : 'Export PDF'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-8 overflow-auto flex-grow">
                        <div ref={layoutRef} className="bg-slate-100 p-8 min-w-max">
                            <RoomLayoutView tables={generatedTables} shape={tableShape} />
                        </div>
                    </div>
                </section>
            )}
        </div>
        
        {/* Footer */}
        <footer className="mt-12 py-6 text-center text-slate-400 text-sm border-t border-slate-200" role="contentinfo">
            <p className="font-medium text-slate-500">MIT Sloan School of Management</p>
            <p className="text-xs mt-1">© {new Date().getFullYear()} SeatSmart Planner</p>
        </footer>
      </main>
    </div>
  );
};

// --- Sub-components ---

// Room Layout Component
const RoomLayoutView = ({ tables, shape }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 print:grid-cols-2">
            {tables.map((table, i) => (
                <div key={i} className="flex flex-col items-center break-inside-avoid">
                    {/* Increased container size to w-80 h-80 (320px) to accommodate wider radius */}
                    <div className="relative w-80 h-80 flex items-center justify-center mb-8">
                        {/* The Table Surface */}
                        <div className={`
                            absolute flex items-center justify-center bg-white border-2 border-slate-300 shadow-md z-10
                            ${shape === 'rectangle' ? 'w-40 h-24 rounded-md' : 'w-32 h-32 rounded-full'}
                        `}>
                            <div className="text-center">
                                <div className="font-bold text-slate-700 text-lg">Table {table.id + 1}</div>
                                {table.attributeTag && <div className="text-[10px] text-[#750014] uppercase font-bold tracking-wider px-2">{table.attributeTag}</div>}
                            </div>
                        </div>

                        {/* The Guests (Chairs) */}
                        {table.guests.map((guest, idx) => {
                            const total = table.guests.length;
                            
                            // Positioning Logic
                            let style = {};
                            if (shape === 'rectangle') {
                                // Elliptical distribution to match rectangle shape and clear the w-40 (160px) width
                                const angle = (idx / total) * 2 * Math.PI - (Math.PI / 2); // Start top
                                const xRadius = 140; // Wider horizontal spread
                                const yRadius = 100; // Taller vertical spread
                                const x = Math.cos(angle) * xRadius;
                                const y = Math.sin(angle) * yRadius;
                                style = { transform: `translate(${x}px, ${y}px)` };

                            } else {
                                // Circle Logic
                                const angle = (idx / total) * 2 * Math.PI - (Math.PI / 2); // Start top
                                // Increased radius from 100 to 125 to ensure nameplates don't overlap the table
                                const radius = 125; // Distance from center
                                const x = Math.cos(angle) * radius;
                                const y = Math.sin(angle) * radius;
                                style = { transform: `translate(${x}px, ${y}px)` };
                            }

                            return (
                                <div key={idx} className="absolute flex flex-col items-center justify-center w-24" style={style}>
                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center mb-1 shadow-sm text-xs font-bold text-slate-500 z-30 relative">
                                        {idx + 1}
                                    </div>
                                    <div className="text-[10px] font-medium text-slate-800 text-center leading-tight bg-white/95 px-2 py-0.5 rounded shadow-sm border border-slate-200 min-w-[80px] w-auto max-w-[120px] z-20 break-words">
                                        {guest.name}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

const StepButton = ({ icon: Icon, label, isActive, disabled, onClick }) => (
    <button 
        disabled={disabled}
        onClick={onClick}
        className={`flex items-center px-4 py-2 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-[#750014] outline-none ${
            isActive 
            ? 'bg-[#750014] text-white shadow-md' 
            : disabled 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
        }`}
        aria-current={isActive ? 'step' : undefined}
    >
        <Icon className="w-4 h-4 mr-2" aria-hidden="true" />
        <span className="font-medium text-sm">{label}</span>
    </button>
);

const StrategyOption = ({ active, onClick, title, desc, icon: Icon }) => (
    <button 
        onClick={onClick}
        className={`p-3 rounded-lg border text-left transition-all flex items-start focus-visible:ring-2 focus-visible:ring-[#750014] outline-none ${active ? 'border-[#750014] bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}
        role="radio"
        aria-checked={active}
    >
        {Icon && <Icon className={`w-5 h-5 mr-3 mt-0.5 ${active ? 'text-[#750014]' : 'text-slate-400'}`} aria-hidden="true" />}
        <div>
            <div className={`font-bold ${active ? 'text-[#750014]' : 'text-slate-800'}`}>{title}</div>
            <div className="text-sm text-slate-500 mt-1">{desc}</div>
        </div>
    </button>
);

const StatRow = ({ label, value }) => (
    <div className="flex justify-between items-center pb-3 border-b border-slate-200 last:border-0">
        <span className="text-slate-500">{label}</span>
        <span className="font-bold text-slate-800">{value}</span>
    </div>
);

const TableCard = ({ tableNumber, tableIndex, data, groupByColumn, seatingStrategy, eventType, tableShape, isEditMode, onGuestDragStart, onTableDragOver, onGuestDrop, onGuestKeyboardMove, searchQuery, capacity }) => {
    const isRound = tableShape === 'round';
    const isGroups = tableShape === 'groups';
    const isOverCapacity = data.guests.length > capacity;
    
    let containerClasses = "bg-white overflow-hidden flex flex-col h-full break-inside-avoid transition-all";
    if (isGroups) containerClasses += " border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50";
    else {
        containerClasses += " rounded-xl shadow-sm border-2";
        if (data.hasRestrictions && eventType === 'meal') containerClasses += " border-amber-400";
        else containerClasses += " border-transparent";
    }

    return (
        <article 
            className={containerClasses}
            onDragOver={isEditMode ? onTableDragOver : undefined}
            onDrop={isEditMode ? (e) => onGuestDrop(e, tableIndex) : undefined}
            aria-label={`Table ${tableNumber}, ${data.guests.length} guests`}
        >
            <div className={`p-3 flex justify-between items-center ${isGroups ? 'bg-transparent' : (data.hasRestrictions && eventType === 'meal' ? 'bg-amber-50' : 'bg-slate-100')}`}>
                <div className="flex items-center">
                    <div className={`w-8 h-8 flex items-center justify-center font-bold text-[#750014] mr-3 shadow-sm bg-white border border-slate-200 ${isRound ? 'rounded-full' : 'rounded-md'}`}>
                        {tableNumber}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-700 text-base m-0">
                                {isGroups ? `Group ${tableNumber}` : `Table ${tableNumber}`}
                            </h3>
                            {/* Capacity Counter */}
                            <span 
                                className={`text-xs font-medium px-1.5 py-0.5 rounded ${isOverCapacity ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}
                                aria-label={`${data.guests.length} of ${capacity} seats filled`}
                            >
                                {data.guests.length}/{capacity}
                            </span>
                        </div>
                        {data.attributeTag && (
                             <span 
                                title={data.attributeTag} 
                                className="text-xs text-[#750014] font-semibold uppercase tracking-wider line-clamp-1 max-w-[140px] cursor-help"
                             >
                                {data.attributeTag}
                             </span>
                        )}
                    </div>
                </div>
                {data.hasRestrictions && eventType === 'meal' && !isGroups && (
                    <div className="group relative">
                        <AlertCircle className="w-5 h-5 text-amber-500 cursor-help" aria-label="Dietary restriction warning" />
                        <div className="absolute right-0 top-6 w-48 bg-slate-800 text-white text-xs p-2 rounded z-10 hidden group-hover:block" role="tooltip">
                            Dietary needs: {data.restrictionsList.join(', ')}
                        </div>
                    </div>
                )}
            </div>
            
            <div className={`p-4 flex-grow ${isEditMode ? 'bg-orange-50/30' : ''}`}>
                <ul className="space-y-3 list-none p-0 m-0">
                    {data.guests.map((guest, i) => {
                        let attributeValue = null;
                        if ((seatingStrategy === 'group_attribute' || seatingStrategy === 'separate_attribute') && groupByColumn && guest.raw) {
                            const val = guest.raw[groupByColumn];
                            if (val !== undefined && val !== null) attributeValue = val;
                        }

                        // Search Highlighting
                        const isMatch = searchQuery && guest.name.toLowerCase().includes(searchQuery.toLowerCase());
                        const isDimmed = searchQuery && !isMatch;

                        return (
                        <li 
                            key={i} 
                            className={`flex items-start text-sm p-2 rounded-md transition-all 
                                ${isEditMode ? 'cursor-grab hover:bg-white hover:shadow-md border border-transparent hover:border-orange-200 active:cursor-grabbing' : ''}
                                ${isMatch ? 'bg-yellow-100 border border-yellow-300 ring-2 ring-yellow-200' : ''}
                                ${isDimmed ? 'opacity-25 blur-[0.5px]' : 'opacity-100'}
                            `}
                            draggable={isEditMode}
                            onDragStart={(e) => onGuestDragStart(e, guest, tableIndex, i)}
                        >
                            {isEditMode ? (
                                <button 
                                    onClick={() => onGuestKeyboardMove(guest, tableIndex, i)}
                                    className="p-1 -ml-1 mr-1 text-orange-400 hover:text-orange-600 hover:bg-orange-100 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    aria-label={`Move ${guest.name} to another table`}
                                >
                                    <Move className="w-4 h-4" aria-hidden="true" />
                                </button>
                            ) : (
                                <User className="w-4 h-4 text-slate-300 mt-0.5 mr-2 flex-shrink-0" aria-hidden="true" />
                            )}
                            
                            <div className="flex-1">
                                <div className="text-slate-800 font-medium">{guest.name}</div>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                    {eventType === 'meal' && guest.diet && guest.diet.toLowerCase() !== 'none' && guest.diet !== '' && (
                                        <div className="text-xs text-amber-600 bg-amber-50 inline-block px-1.5 py-0.5 rounded border border-amber-100">
                                            {guest.diet}
                                        </div>
                                    )}
                                    {attributeValue !== null && (
                                        <div className="text-xs text-[#750014] bg-red-50 inline-block px-1.5 py-0.5 rounded border border-red-100">
                                            {attributeValue}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </li>
                    )})}
                    {Array.from({ length: Math.max(0, capacity - data.guests.length) }).map((_, k) => (
                         <li key={`empty-${k}`} className="flex items-center text-sm opacity-30 p-2" aria-hidden="true">
                            <div className={`w-4 h-4 border border-slate-400 mr-2 border-dashed ${isRound ? 'rounded-full' : 'rounded-sm'}`}></div>
                            <span className="text-slate-400 italic">Open Seat</span>
                        </li>
                    ))}
                </ul>
            </div>
        </article>
    );
};

export default SeatingApp;