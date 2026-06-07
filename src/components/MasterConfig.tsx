/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppDatabase, Client, Genset, CompanyConfig, BankDetails } from '../types';
import { 
  Building2, 
  MapPin, 
  Users, 
  Settings2, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  CreditCard,
  PenTool,
  Upload,
  RefreshCw
} from 'lucide-react';

interface MasterConfigProps {
  db: AppDatabase;
  onUpdateDb: (updater: (prev: AppDatabase) => AppDatabase) => void;
}

export default function MasterConfig({ db, onUpdateDb }: MasterConfigProps) {
  const [activeSubTab, setActiveSubTab] = useState<'company' | 'clients' | 'gensets' | 'fuel-rates'>('company');
  
  // Dynamic lists from DB with fallbacks for legacy/undefined arrays
  const companiesList: CompanyConfig[] = db.companies && db.companies.length > 0 
    ? db.companies 
    : [{ ...db.company, id: 'co-engineers' }];

  const bankAccountsList: BankDetails[] = db.bankAccounts && db.bankAccounts.length > 0
    ? db.bankAccounts
    : [{ ...db.company.bankDetails, id: 'bank-canara' }];

  const uniqueSubzones = useMemo(() => {
    const zones = new Set<string>();
    db.zonePrices.forEach(zp => {
      if (zp.zoneName) zones.add(zp.zoneName);
    });
    // Fallbacks if empty
    if (zones.size === 0) {
      ['Salem Area', 'Namakkal Area', 'Pathanam Area', 'Kottayam Area', 'Idukki Area', 'Alapuzha Area'].forEach(z => zones.add(z));
    }
    return Array.from(zones).sort();
  }, [db.zonePrices]);

  // Active Selected Company in editor
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companiesList[0]?.id || 'co-engineers');

  // Signature Drawing state
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Form states for clients
  const [cName, setCName] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cGstin, setCGstin] = useState('');
  const [cZone, setCZone] = useState('');
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  // Form states for Gensets
  const [gSiteName, setGSiteName] = useState('');
  const [gClientId, setGClientId] = useState('');
  const [gCapacity, setGCapacity] = useState('');
  const [gDieselPerHour, setGDieselPerHour] = useState('');
  const [gGstType, setGGstType] = useState<'CGST_SGST' | 'IGST'>('CGST_SGST');
  const [gMeterFormat, setGMeterFormat] = useState<'HH:MM' | 'DECIMAL'>('HH:MM');
  const [gCompanyId, setGCompanyId] = useState('');
  const [gBankAccountId, setGBankAccountId] = useState('');
  const [editingGensetId, setEditingGensetId] = useState<string | null>(null);

  // Genset subzone linking
  const [gZoneName, setGZoneName] = useState('');
  const [newSubzoneName, setNewSubzoneName] = useState('');
  const [showNewSubzoneInput, setShowNewSubzoneInput] = useState(false);

  // States for Master Subzone tab
  const [selectedSubzoneMonth, setSelectedSubzoneMonth] = useState('2026-04');
  const [subzoneNameInput, setSubzoneNameInput] = useState('');
  const [editingSubzoneId, setEditingSubzoneId] = useState<string | null>(null);
  const [szPrice1st, setSzPrice1st] = useState('');
  const [szPriceLast, setSzPriceLast] = useState('');
  const [szPriceAvg, setSzPriceAvg] = useState('');

  // Company states
  const [coName, setCoName] = useState(db.company.name || '');
  const [coLogoUrl, setCoLogoUrl] = useState(db.company.logoUrl || '');
  const [coHideName, setCoHideName] = useState(db.company.hideCompanyNameWithLogo || false);
  const [coAddress, setCoAddress] = useState(db.company.address || '');
  const [coContact, setCoContact] = useState(db.company.contactNumber || '');
  const [coEmail, setCoEmail] = useState(db.company.email || '');
  const [coGstin, setCoGstin] = useState(db.company.gstin || '');
  const [coPan, setCoPan] = useState(db.company.pan || '');
  const [sigUrl, setSigUrl] = useState(db.company.signatureUrl || '');

  // Form states for dynamic bank additions
  const [bName, setBName] = useState('');
  const [bBranch, setBBranch] = useState('');
  const [bAccount, setBAccount] = useState('');
  const [bIfsc, setBIfsc] = useState('');
  const [editingBankId, setEditingBankId] = useState<string | null>(null);

  // Load selected company into form inputs whenever selectedCompanyId changes
  useEffect(() => {
    if (selectedCompanyId === 'new-company') {
      setCoName('');
      setCoLogoUrl('');
      setCoHideName(false);
      setCoAddress('');
      setCoContact('');
      setCoEmail('');
      setCoGstin('');
      setCoPan('');
      setSigUrl('');
    } else {
      const currentCo = companiesList.find(c => c.id === selectedCompanyId);
      if (currentCo) {
        setCoName(currentCo.name);
        setCoLogoUrl(currentCo.logoUrl || '');
        setCoHideName(currentCo.hideCompanyNameWithLogo || false);
        setCoAddress(currentCo.address);
        setCoContact(currentCo.contactNumber);
        setCoEmail(currentCo.email || '');
        setCoGstin(currentCo.gstin);
        setCoPan(currentCo.pan);
        setSigUrl(currentCo.signatureUrl || '');
      }
    }
  }, [selectedCompanyId, db.companies]);

  // Save company data directly on logo or signature upload to prevent tab-switch unmount loss
  const saveCompanyWithParams = (newLogo?: string, newSig?: string) => {
    const savedCompanyId = selectedCompanyId === 'new-company' ? `co-${Date.now()}` : selectedCompanyId;
    const logoToUse = newLogo !== undefined ? newLogo : coLogoUrl;
    const sigToUse = newSig !== undefined ? newSig : sigUrl;

    const updatedCompanyObj: CompanyConfig = {
      id: savedCompanyId,
      name: coName || 'My Company',
      logoUrl: logoToUse,
      hideCompanyNameWithLogo: coHideName,
      address: coAddress,
      contactNumber: coContact,
      email: coEmail,
      gstin: coGstin,
      pan: coPan,
      bankDetails: {
        id: bankAccountsList[0]?.id || 'bank-canara',
        bankName: bankAccountsList[0]?.bankName || 'CANARA BANK',
        branch: bankAccountsList[0]?.branch || '',
        accountNumber: bankAccountsList[0]?.accountNumber || '',
        ifscCode: bankAccountsList[0]?.ifscCode || ''
      },
      signatureUrl: sigToUse
    };

    onUpdateDb((prev) => {
      let currentCompanies = prev.companies && prev.companies.length > 0 
        ? [...prev.companies] 
        : [{ ...prev.company, id: 'co-engineers' }];

      const exists = currentCompanies.some(c => c.id === savedCompanyId);
      if (exists) {
        currentCompanies = currentCompanies.map(c => c.id === savedCompanyId ? updatedCompanyObj : c);
      } else {
        currentCompanies.push(updatedCompanyObj);
      }

      return {
        ...prev,
        company: updatedCompanyObj, // Always sync active legacy fallback
        companies: currentCompanies
      };
    });

    if (selectedCompanyId === 'new-company') {
      setSelectedCompanyId(savedCompanyId);
    }
  };

  // Handle company info save
  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coName) {
      alert('Please enter a Company Name.');
      return;
    }

    const savedCompanyId = selectedCompanyId === 'new-company' ? `co-${Date.now()}` : selectedCompanyId;

    const updatedCompanyObj: CompanyConfig = {
      id: savedCompanyId,
      name: coName,
      logoUrl: coLogoUrl,
      hideCompanyNameWithLogo: coHideName,
      address: coAddress,
      contactNumber: coContact,
      email: coEmail,
      gstin: coGstin,
      pan: coPan,
      bankDetails: {
        id: bankAccountsList[0]?.id || 'bank-canara',
        bankName: bankAccountsList[0]?.bankName || 'CANARA BANK',
        branch: bankAccountsList[0]?.branch || '',
        accountNumber: bankAccountsList[0]?.accountNumber || '',
        ifscCode: bankAccountsList[0]?.ifscCode || ''
      },
      signatureUrl: sigUrl
    };

    onUpdateDb((prev) => {
      let currentCompanies = prev.companies && prev.companies.length > 0 
        ? [...prev.companies] 
        : [{ ...prev.company, id: 'co-engineers' }];

      const exists = currentCompanies.some(c => c.id === savedCompanyId);
      if (exists) {
        currentCompanies = currentCompanies.map(c => c.id === savedCompanyId ? updatedCompanyObj : c);
      } else {
        currentCompanies.push(updatedCompanyObj);
      }

      return {
        ...prev,
        company: updatedCompanyObj, // Always sync active legacy fallback
        companies: currentCompanies
      };
    });

    setSelectedCompanyId(savedCompanyId);
    alert('Company Profile saved successfully!');
  };

  const handleDeleteCompany = (coId: string) => {
    if (companiesList.length <= 1) {
      alert('You must have at least one registered Company Profile.');
      return;
    }
    const associatedGensets = db.gensets.filter(g => g.companyId === coId);
    if (associatedGensets.length > 0) {
      alert(`Cannot delete this company profile because it is registered to ${associatedGensets.length} generator sites. Retarget those sites first.`);
      return;
    }

    if (confirm('Are you sure you want to delete this Company Profile?')) {
      onUpdateDb(prev => {
        const remaining = (prev.companies || []).filter(c => c.id !== coId);
        const fallbackCompany = remaining[0] || prev.company;
        return {
          ...prev,
          companies: remaining,
          company: fallbackCompany
        };
      });
      const remainingList = companiesList.filter(c => c.id !== coId);
      setSelectedCompanyId(remainingList[0]?.id || 'co-engineers');
    }
  };

  // Handle Bank Account Submit
  const handleBankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName || !bAccount || !bIfsc) {
      alert('Please fill out Bank Name, Account Number and IFSC.');
      return;
    }

    onUpdateDb(prev => {
      let currentBanks = prev.bankAccounts && prev.bankAccounts.length > 0 
        ? [...prev.bankAccounts] 
        : [{ ...prev.company.bankDetails, id: 'bank-canara' }];
      
      if (editingBankId) {
        currentBanks = currentBanks.map(b => b.id === editingBankId ? { ...b, bankName: bName, branch: bBranch, accountNumber: bAccount, ifscCode: bIfsc } : b);
      } else {
        currentBanks.push({
          id: `bank-${Date.now()}`,
          bankName: bName,
          branch: bBranch,
          accountNumber: bAccount,
          ifscCode: bIfsc
        });
      }
      return { ...prev, bankAccounts: currentBanks };
    });

    setBName('');
    setBBranch('');
    setBAccount('');
    setBIfsc('');
    setEditingBankId(null);
    alert('Bank account details saved!');
  };

  const startEditBank = (b: BankDetails) => {
    setEditingBankId(b.id || null);
    setBName(b.bankName);
    setBBranch(b.branch);
    setBAccount(b.accountNumber);
    setBIfsc(b.ifscCode);
  };

  const handleDeleteBank = (bankId: string) => {
    const associatedGensets = db.gensets.filter(g => g.bankAccountId === bankId);
    if (associatedGensets.length > 0) {
      alert(`Cannot delete this bank account because it is already linked to ${associatedGensets.length} generator sites. Please unlink them in the Gensets Master first.`);
      return;
    }

    if (confirm('Are you sure you want to delete this settlement bank account?')) {
      onUpdateDb(prev => {
        const remaining = (prev.bankAccounts || []).filter(b => b.id !== bankId);
        return {
          ...prev,
          bankAccounts: remaining
        };
      });
    }
  };

  // Drawing Canvas helpers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // get accurate coordinate
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e3a8a'; // Deep blue sign ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    saveCanvasToSig();
  };

  const clearCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigUrl('');
    saveCompanyWithParams(undefined, '');
  };

  const saveCanvasToSig = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    setSigUrl(url);
    saveCompanyWithParams(undefined, url);
  };

  // Create or Update client
  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName || !cZone) {
      alert('Please enter Client Name and pricing Zone');
      return;
    }

    onUpdateDb((prev) => {
      let updatedClients = [...prev.clients];
      if (editingClientId) {
        // Edit existing client
        updatedClients = updatedClients.map(c => 
          c.id === editingClientId ? { ...c, name: cName, address: cAddress, gstin: cGstin, zone: cZone } : c
        );
      } else {
        // Add new
        const newClient: Client = {
          id: `client-${Date.now()}`,
          name: cName,
          address: cAddress,
          gstin: cGstin,
          zone: cZone
        };
        updatedClients.push(newClient);
      }
      return { ...prev, clients: updatedClients };
    });

    // Reset Form
    setCName('');
    setCAddress('');
    setCGstin('');
    setCZone('');
    setEditingClientId(null);
  };

  const startEditClient = (c: Client) => {
    setEditingClientId(c.id);
    setCName(c.name);
    setCAddress(c.address);
    setCGstin(c.gstin);
    setCZone(c.zone);
  };

  const handleDeleteClient = (clientId: string) => {
    const associatedGensets = db.gensets.filter(g => g.clientId === clientId);
    if (associatedGensets.length > 0) {
      alert(`Cannot delete this client. It has ${associatedGensets.length} associated Generator site locations. Please delete those generator sites first.`);
      return;
    }
    if (confirm('Are you sure you want to delete this client?')) {
      onUpdateDb((prev) => ({
        ...prev,
        clients: prev.clients.filter(c => c.id !== clientId)
      }));
    }
  };

  // Create or Update Genset Site
  const handleGensetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gSiteName || !gClientId || !gCapacity || !gDieselPerHour) {
      alert('Please fill out all generator site fields.');
      return;
    }

    const dRate = parseFloat(gDieselPerHour);
    if (isNaN(dRate) || dRate < 0) {
      alert('Valid Hourly Fuel Consumption Rate (Liters/Hr) is required.');
      return;
    }

    let finalZoneName = gZoneName;
    if (showNewSubzoneInput) {
      if (!newSubzoneName.trim()) {
        alert('Please enter a valid new Sub Zone name.');
        return;
      }
      finalZoneName = newSubzoneName.trim();
    }

    onUpdateDb((prev) => {
      let updatedGensets = [...prev.gensets];
      let updatedZonePrices = [...prev.zonePrices];

      // If we added a new subzone, ensure it exists in zonePrices for all relevant months
      if (showNewSubzoneInput && finalZoneName) {
        const uniqueMonths = Array.from(new Set([
          '2026-04',
          '2026-05',
          new Date().toISOString().split('T')[0].substring(0, 7),
          ...prev.zonePrices.map(zp => zp.monthKey),
          ...prev.siteLogs.map(l => l.monthKey)
        ]));

        uniqueMonths.forEach(mKey => {
          const alreadyExists = prev.zonePrices.some(zp => zp.zoneName.toLowerCase() === finalZoneName.toLowerCase() && zp.monthKey === mKey);
          if (!alreadyExists) {
            updatedZonePrices.push({
              id: `zp-${mKey}-${finalZoneName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
              zoneName: finalZoneName,
              monthKey: mKey,
              price1st: 0,
              priceLast: 0,
              averagePrice: 0
            });
          }
        });
      }

      if (editingGensetId) {
        updatedGensets = updatedGensets.map(g => 
          g.id === editingGensetId 
            ? { 
                ...g, 
                siteName: gSiteName, 
                clientId: gClientId, 
                capacity: gCapacity, 
                dieselQuantityPerHour: dRate, 
                gstType: gGstType, 
                meterFormat: gMeterFormat,
                companyId: gCompanyId || undefined,
                bankAccountId: gBankAccountId || undefined,
                zoneName: finalZoneName || undefined
              } 
            : g
        );
      } else {
        const newGenset: Genset = {
          id: `genset-${Date.now()}`,
          clientId: gClientId,
          siteName: gSiteName,
          capacity: gCapacity,
          dieselQuantityPerHour: dRate,
          gstType: gGstType,
          meterFormat: gMeterFormat,
          companyId: gCompanyId || undefined,
          bankAccountId: gBankAccountId || undefined,
          zoneName: finalZoneName || undefined
        };
        updatedGensets.push(newGenset);
      }
      return { 
        ...prev, 
        gensets: updatedGensets,
        zonePrices: updatedZonePrices
      };
    });

    // Reset Form
    setGSiteName('');
    setGClientId('');
    setGCapacity('');
    setGDieselPerHour('');
    setGGstType('CGST_SGST');
    setGMeterFormat('HH:MM');
    setGCompanyId('');
    setGBankAccountId('');
    setGZoneName('');
    setNewSubzoneName('');
    setShowNewSubzoneInput(false);
    setEditingGensetId(null);
  };

  const startEditGenset = (g: Genset) => {
    setEditingGensetId(g.id);
    setGSiteName(g.siteName);
    setGClientId(g.clientId);
    setGCapacity(g.capacity);
    setGDieselPerHour(g.dieselQuantityPerHour.toString());
    setGGstType(g.gstType);
    setGMeterFormat(g.meterFormat || 'HH:MM');
    setGCompanyId(g.companyId || '');
    setGBankAccountId(g.bankAccountId || '');
    setGZoneName(g.zoneName || '');
    setNewSubzoneName('');
    setShowNewSubzoneInput(false);
  };

  const handleDeleteGenset = (id: string) => {
    if (confirm('Are you sure you want to delete this generator site? This will remove it from future billing calculations.')) {
      onUpdateDb(prev => ({
        ...prev,
        gensets: prev.gensets.filter(g => g.id !== id)
      }));
    }
  };

  const fuelMonthsOptions = useMemo(() => {
    const list = new Set<string>();
    db.zonePrices.forEach(zp => {
      if (zp.monthKey) list.add(zp.monthKey);
    });
    db.siteLogs.forEach(l => {
      if (l.monthKey) list.add(l.monthKey);
    });
    
    // add fallback/standard months
    const today = new Date();
    for (let i = -12; i <= 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.add(key);
    }
    return Array.from(list).sort().reverse();
  }, [db.zonePrices, db.siteLogs]);

  const subzonePricesForMonth = useMemo(() => {
    return db.zonePrices.filter(zp => zp.monthKey === selectedSubzoneMonth);
  }, [db.zonePrices, selectedSubzoneMonth]);

  const handleAddSubzoneMaster = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subzoneNameInput.trim()) {
      alert('Please enter a valid Subzone Name.');
      return;
    }
    const sName = subzoneNameInput.trim();
    
    const exists = db.zonePrices.some(zp => zp.zoneName.toLowerCase() === sName.toLowerCase() && zp.monthKey === selectedSubzoneMonth);
    if (exists) {
      alert(`Subzone "${sName}" already exists for ${selectedSubzoneMonth}!`);
      return;
    }

    onUpdateDb(prev => {
      const newConfig = {
        id: `zp-${selectedSubzoneMonth}-${sName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
        zoneName: sName,
        monthKey: selectedSubzoneMonth,
        price1st: 0,
        priceLast: 0,
        averagePrice: 0
      };
      return {
        ...prev,
        zonePrices: [...prev.zonePrices, newConfig]
      };
    });

    setSubzoneNameInput('');
  };

  const startEditSubzonePricing = (zp: any) => {
    setEditingSubzoneId(zp.id);
    setSzPrice1st(zp.price1st.toString());
    setSzPriceLast(zp.priceLast.toString());
    setSzPriceAvg(zp.averagePrice.toString());
  };

  const handleSaveSubzonePricing = (id: string) => {
    const p1 = parseFloat(szPrice1st) || 0;
    const pL = parseFloat(szPriceLast) || 0;
    
    let pA = parseFloat(szPriceAvg) || 0;
    if (pA === 0 || !szPriceAvg) {
      pA = parseFloat(((p1 + pL) / 2).toFixed(2));
    }

    onUpdateDb(prev => ({
      ...prev,
      zonePrices: prev.zonePrices.map(zp => 
        zp.id === id ? { ...zp, price1st: p1, priceLast: pL, averagePrice: pA } : zp
      )
    }));

    setEditingSubzoneId(null);
  };

  const handleDeleteSubzone = (zoneName: string) => {
    const isAssociated = db.gensets.some(g => g.zoneName?.toLowerCase() === zoneName.toLowerCase());
    const extraMsg = isAssociated ? "\n\n⚠️ WARNING: Some Generator site locations are linked to this rate zone. Deleting it will cause them to fall back to auto-matching." : "";
    
    if (confirm(`Are you sure you want to delete the Subzone "${zoneName}" fuel prices for ${selectedSubzoneMonth}?${extraMsg}`)) {
      onUpdateDb(prev => ({
        ...prev,
        zonePrices: prev.zonePrices.filter(zp => !(zp.zoneName.toLowerCase() === zoneName.toLowerCase() && zp.monthKey === selectedSubzoneMonth))
      }));
    }
  };

  return (
    <div className="space-y-4" id="master-config-tab">
      
      {/* Header Panel */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Masters Maintenance & Setup</h1>
          <p className="text-slate-500 text-xs mt-0.5">Configure company particulars, client offices and genset sizes.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg gap-1 h-fit text-xs">
          <button
            onClick={() => setActiveSubTab('company')}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${activeSubTab === 'company' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
          >
            Company Profile
          </button>
          <button
            onClick={() => setActiveSubTab('clients')}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${activeSubTab === 'clients' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
          >
            Clients Master
          </button>
          <button
            onClick={() => setActiveSubTab('gensets')}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${activeSubTab === 'gensets' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
          >
            Gensets Master
          </button>
          <button
            onClick={() => setActiveSubTab('fuel-rates')}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${activeSubTab === 'fuel-rates' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
          >
            Subzone Fuel Rates
          </button>
        </div>
      </div>

      {activeSubTab === 'company' && (
        <div className="space-y-6">
          {/* Company switcher bar */}
          <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Building2 className="h-5 w-5 text-blue-400 shrink-0" />
              <div className="w-full sm:w-64">
                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">Active Company Profile</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="bg-slate-850 hover:bg-slate-800 text-sm py-1.5 px-3 rounded border border-slate-700 text-white font-semibold cursor-pointer w-full focus:ring-1 focus:ring-blue-500"
                >
                  {companiesList.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.id === db.company.id ? '(Active Default)' : ''}</option>
                  ))}
                  <option value="new-company">+ Add New Company Profile</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              {selectedCompanyId !== 'new-company' && (
                <button
                  type="button"
                  onClick={() => handleDeleteCompany(selectedCompanyId)}
                  className="px-3 py-1.5 bg-rose-950/40 text-rose-400 border border-rose-900 rounded-lg text-xs font-bold hover:bg-rose-900/60 flex items-center gap-1.5 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Company
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedCompanyId('new-company')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                New Company
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveCompany} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Info */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-150 pb-2">
                <Building2 className="h-4.5 w-4.5 text-blue-600 font-bold" />
                {selectedCompanyId === 'new-company' ? 'New Company Profile Details' : `${coName || 'Company'} Profile Specification`}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Company Display Name (Letterhead Name)</label>
                  <input
                    type="text"
                    value={coName}
                    onChange={(e) => setCoName(e.target.value)}
                    className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500 p-2.5"
                    required
                    placeholder="e.g. ENGINEERS ENTERPRISES"
                  />
                </div>

                {/* Logo Upload Row */}
                <div id="company-logo-uploader-card" className="space-y-1.5 md:col-span-2 border border-slate-150 rounded-lg p-3 bg-slate-50/50">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-sans">
                    <div className="space-y-1">
                      <label className="text-xs font-extrabold text-blue-900 uppercase tracking-wide flex items-center gap-1">
                        <Upload className="h-3.5 w-3.5" />
                        Company Logo Image (Header)
                      </label>
                      <p className="text-[10px] text-slate-400">Supporting PNG/JPG/SVG formats.</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      id="company-logo-file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const dataUrl = reader.result as string;
                            setCoLogoUrl(dataUrl);
                            // Immediate database persistence!
                            saveCompanyWithParams(dataUrl, undefined);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
                    />
                  </div>

                  {coLogoUrl && (
                    <div className="mt-3.5 p-2 bg-white rounded border border-slate-200 flex items-center justify-between gap-4 animate-fadeIn">
                      <div className="flex items-center gap-3">
                        <img referrerPolicy="no-referrer" src={coLogoUrl} alt="Logo preview" className="h-10 object-contain max-w-[140px]" />
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                          <Check className="h-3.5 w-3.5 shrink-0" />
                          Logo Saved to Database!
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCoLogoUrl('');
                          saveCompanyWithParams('', undefined);
                        }}
                        className="text-red-500 hover:text-red-700 text-xs font-bold font-sans cursor-pointer"
                      >
                        Remove Logo
                      </button>
                    </div>
                  )}

                  {coLogoUrl && (
                    <div className="mt-2.5 border-t border-slate-150 pt-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-semibold select-none">
                        <input
                          type="checkbox"
                          checked={coHideName}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setCoHideName(checked);
                            
                            // Immediate save to DB
                            onUpdateDb((prev) => {
                              const updatedCompanyObj: CompanyConfig = {
                                ...prev.company,
                                id: selectedCompanyId,
                                hideCompanyNameWithLogo: checked
                              };
                              return {
                                ...prev,
                                company: updatedCompanyObj,
                                companies: (prev.companies || []).map(c => c.id === selectedCompanyId ? updatedCompanyObj : c)
                              };
                            });
                          }}
                          className="rounded text-blue-650 focus:ring-blue-500 h-4 w-4"
                        />
                        Hide text company display name (If logo image contains name graphic already)
                      </label>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Registered Office Address</label>
                  <textarea
                    value={coAddress}
                    onChange={(e) => setCoAddress(e.target.value)}
                    className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500 p-2.5"
                    rows={2}
                    required
                    placeholder="Provide full tax address"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Primary Contact Phone</label>
                  <input
                    type="text"
                    value={coContact}
                    onChange={(e) => setCoContact(e.target.value)}
                    className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500 p-2.5"
                    required
                    placeholder="944..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email Id</label>
                  <input
                    type="email"
                    value={coEmail}
                    onChange={(e) => setCoEmail(e.target.value)}
                    className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500 p-2.5"
                    placeholder="contact@..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">GSTIN (Company GST)</label>
                  <input
                    type="text"
                    value={coGstin}
                    onChange={(e) => setCoGstin(e.target.value)}
                    className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500 p-2.5"
                    required
                    placeholder="GSTIN Number"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">PAN Account No.</label>
                  <input
                    type="text"
                    value={coPan}
                    onChange={(e) => setCoPan(e.target.value)}
                    className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500 p-2.5"
                    required
                    placeholder="10-digit PAN ID"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                {selectedCompanyId === 'new-company' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCompanyId(companiesList[0]?.id || 'co-engineers')}
                    className="px-4 py-2 border-slate-200 text-slate-650 border rounded-lg text-sm font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  id="save-company-btn"
                  className="bg-blue-650 text-white font-bold text-sm px-6 py-2.5 rounded-lg hover:bg-blue-700 transition shadow-sm"
                >
                  {selectedCompanyId === 'new-company' ? 'Register New Profile' : 'Save Company Details'}
                </button>
              </div>
            </div>

            {/* Sub-tab sidebar widgets (Sign Pad) */}

          {/* Authorised Seal & Sign Pad */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <PenTool className="h-5 w-5 text-blue-600" />
              Company Authorized Seal & Signature Info
            </h2>
            
            <p className="text-xs text-slate-500">
              Draw or sign below using your cursor. This signature can then be dynamically included or omitted before generating finalized billing PDFs to directly email clients.
            </p>

            {/* Signature Pad */}
            <div className="border border-slate-200 rounded-xl bg-slate-50 relative overflow-hidden h-44">
              <canvas
                ref={sigCanvasRef}
                width={320}
                height={170}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="absolute inset-0 cursor-crosshair w-full h-full touch-none"
              />
              {sigUrl && (
                <div className="absolute top-2 right-2 bg-emerald-150 text-emerald-800 font-semibold text-[10px] px-2 py-0.5 rounded border border-emerald-300">
                  Signature Active
                </div>
              )}
            </div>

            {/* Canvas buttons */}
            <div className="flex gap-2 justify-between items-center border-b border-slate-100 pb-3.5 mb-2">
              <button
                type="button"
                onClick={clearCanvas}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg px-3 py-2 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Clear Sign Pad
              </button>
              
              <div className="text-[11px] text-slate-400 italic flex items-center">
                Sign with cursor above
              </div>
            </div>

            {/* OR Upload a File option */}
            <div className="space-y-2 border border-slate-150 rounded-xl p-3 bg-indigo-50/20">
              <label className="text-[11px] font-extrabold text-indigo-950 uppercase block tracking-wider flex items-center gap-1">
                <Upload className="h-3.5 w-3.5" />
                OR Upload Scanned Seal & Sign File
              </label>
              <p className="text-[10px] text-slate-400 leading-normal">
                Upload a scanned stamp and signature image file directly (transparent background PNG is highly recommended).
              </p>
              <input
                type="file"
                accept="image/*"
                id="signature-file-uploader"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const dataUrl = reader.result as string;
                      setSigUrl(dataUrl);
                      // Save immediately to DB
                      saveCompanyWithParams(undefined, dataUrl);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-black file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"
              />
            </div>

            {/* Preview loaded */}
            {sigUrl && (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                <span className="text-xs font-semibold text-slate-500 block mb-1">Generated Seal Preview:</span>
                <img referrerPolicy="no-referrer" src={sigUrl} alt="Signature Preview" className="mx-auto h-20 object-contain mix-blend-multiply" />
                <span className="text-[10px] text-emerald-600 font-bold block mt-1">✓ Signature Saved to Database!</span>
              </div>
            )}
          </div>

        </form>

        {/* Dynamic Settlement Bank Accounts Section */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs mt-6 space-y-4">
          <div className="border-b border-slate-150 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                Settlement Bank Accounts Directory
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Define multiple corporate bank accounts. Generator sites can be mapped to individual banks directly.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Inline Bank Form */}
            <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 h-fit space-y-3">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                {editingBankId ? '✏️ Edit Settlement Account' : '➕ Register New Bank Account'}
              </h3>
              
              <form onSubmit={handleBankSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Beneficiary Bank Name</label>
                  <input
                    type="text"
                    value={bName}
                    onChange={(e) => setBName(e.target.value)}
                    placeholder="e.g. STATE BANK OF INDIA"
                    className="w-full text-xs rounded-md border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Branch City/Details</label>
                  <input
                    type="text"
                    value={bBranch}
                    onChange={(e) => setBBranch(e.target.value)}
                    placeholder="e.g. Industrial Area Branch, Madurai"
                    className="w-full text-xs rounded-md border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Savings/Current Account Number</label>
                  <input
                    type="text"
                    value={bAccount}
                    onChange={(e) => setBAccount(e.target.value)}
                    placeholder="e.g. 3420201000269"
                    className="w-full text-xs font-mono rounded-md border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">IFSC Routing Code</label>
                  <input
                    type="text"
                    value={bIfsc}
                    onChange={(e) => setBIfsc(e.target.value)}
                    placeholder="e.g. SBIN0001235"
                    className="w-full text-xs font-mono uppercase rounded-md border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded transition shadow-xs"
                  >
                    {editingBankId ? 'Update Bank' : 'Add Bank Account'}
                  </button>
                  {editingBankId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBankId(null);
                        setBName('');
                        setBBranch('');
                        setBAccount('');
                        setBIfsc('');
                      }}
                      className="border border-slate-200 text-slate-500 text-xs py-2 px-2.5 rounded hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* List of accounts directory */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Configured Accounts Directory</h3>
              {bankAccountsList.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center border border-dashed border-slate-200 rounded-lg">No settlement banks defined yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                  {bankAccountsList.map(bank => (
                    <div key={bank.id || `${bank.accountNumber}-${bank.ifscCode}`} className="border border-slate-200 rounded-xl p-3 bg-white hover:border-slate-350 transition relative flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded uppercase tracking-wide">
                            {bank.bankName}
                          </span>
                          <div className="flex gap-1.5 z-10">
                            <button
                              onClick={() => startEditBank(bank)}
                              className="text-slate-400 hover:text-blue-600 p-1 transition"
                              title="Edit account details"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBank(bank.id || '')}
                              className="text-slate-400 hover:text-red-500 p-1 transition"
                              title="Delete account"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 space-y-1 text-slate-600">
                          <p className="text-[11px] font-semibold text-slate-800 font-mono">A/C: {bank.accountNumber}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">IFSC: {bank.ifscCode}</p>
                          <p className="text-[10px] text-slate-500 leading-tight">Branch: {bank.branch}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    )}

      {activeSubTab === 'clients' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Client Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-fit">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <Users className="h-5 w-5 text-blue-600" />
              {editingClientId ? 'Edit Client Parameters' : 'Add New Client Profile'}
            </h2>

            <form onSubmit={handleClientSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Client Office Type/M.s</label>
                <input
                  type="text"
                  placeholder="e.g. The Manager, LIC of India"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  className="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2.5"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Zone / Division</label>
                <input
                  type="text"
                  placeholder="e.g. Salem DO or Kottayam DO"
                  value={cZone}
                  onChange={(e) => setCZone(e.target.value)}
                  className="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2.5"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">GSTIN (Client GST No)</label>
                <input
                  type="text"
                  placeholder="e.g. 33AAACL0582H1ZT"
                  value={cGstin}
                  onChange={(e) => setCGstin(e.target.value)}
                  className="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2.5"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Full Office Billing Address</label>
                <textarea
                  placeholder="Street information, post codes"
                  value={cAddress}
                  onChange={(e) => setCAddress(e.target.value)}
                  className="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2.5"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white font-semibold text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  {editingClientId ? 'Update Client' : 'Add Client'}
                </button>
                {editingClientId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClientId(null);
                      setCName('');
                      setCAddress('');
                      setCGstin('');
                      setCZone('');
                    }}
                    className="border border-slate-200 text-slate-500 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Client List */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">
              Registered Clients Master List ({db.clients.length})
            </h2>

            {db.clients.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No clients registered. Use the left form to add.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
                {db.clients.map(c => (
                  <div key={c.id} className="border border-slate-150 rounded-xl p-4 hover:bg-slate-50 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">{c.zone}</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => startEditClient(c)}
                            className="text-slate-500 hover:text-blue-600 p-1"
                            title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClient(c.id)}
                            className="text-slate-500 hover:text-rose-600 p-1"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm mt-2">{c.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.address || 'No Address Provided'}</p>
                    </div>
                    {c.gstin && (
                      <div className="border-t border-slate-100 mt-3 pt-2">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">GSTIN / Party GST</span>
                        <span className="text-xs font-mono text-slate-600 block">{c.gstin}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {activeSubTab === 'gensets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Genset Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-fit">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <Settings2 className="h-5 w-5 text-blue-600" />
              {editingGensetId ? 'Edit Site Genset Details' : 'Register New Site Generator'}
            </h2>

            <form onSubmit={handleGensetSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Site/Location Name</label>
                <input
                  type="text"
                  placeholder="e.g. Namakkal, Salem North, Thiruvella"
                  value={gSiteName}
                  onChange={(e) => setGSiteName(e.target.value)}
                  className="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2.5"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Belongs to Client</label>
                <select
                  value={gClientId}
                  onChange={(e) => setGClientId(e.target.value)}
                  className="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2.5"
                  required
                >
                  <option value="">Select Associated Division Client</option>
                  {db.clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.zone})</option>
                  ))}
                </select>
              </div>

              {/* Subzone Fuel Area Select with Create Trigger option */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Subzone Fuel Area</label>
                <select
                  value={showNewSubzoneInput ? "ADD_NEW_SUBZONE" : gZoneName}
                  onChange={(e) => {
                    if (e.target.value === "ADD_NEW_SUBZONE") {
                      setShowNewSubzoneInput(true);
                      setGZoneName('');
                    } else {
                      setShowNewSubzoneInput(false);
                      setGZoneName(e.target.value);
                    }
                  }}
                  className="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-slate-50/50"
                  required={!showNewSubzoneInput}
                >
                  <option value="">Select or Link Fuel Rate Zone</option>
                  {uniqueSubzones.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                  <option value="ADD_NEW_SUBZONE" className="text-blue-600 font-bold font-mono">+ Create & Link a New Sub Zone...</option>
                </select>
              </div>

              {showNewSubzoneInput && (
                <div className="space-y-1 p-2.5 bg-blue-50/50 border border-blue-150 rounded-lg animate-fadeIn">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">New Sub Zone Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Trichy Area"
                    value={newSubzoneName}
                    onChange={(e) => setNewSubzoneName(e.target.value)}
                    className="w-full text-xs rounded border border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2 bg-white"
                    required
                  />
                  <div className="text-[9px] text-slate-400 font-medium">This will automatically map this site, and register a new pricing node across standard periods.</div>
                </div>
              )}

              {/* Company and Bank Selection Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Linked Company</label>
                  <select
                    value={gCompanyId}
                    onChange={(e) => setGCompanyId(e.target.value)}
                    className="w-full text-xs rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2"
                  >
                    <option value="">Default Company</option>
                    {companiesList.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Settlement Bank</label>
                  <select
                    value={gBankAccountId}
                    onChange={(e) => setGBankAccountId(e.target.value)}
                    className="w-full text-xs rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2"
                  >
                    <option value="">Default Bank</option>
                    {bankAccountsList.map(b => (
                      <option key={b.id} value={b.id}>{b.bankName} - A/c {b.accountNumber.slice(-4)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Capacity</label>
                  <input
                    type="text"
                    placeholder="e.g. 100 KVA, 30 KVA"
                    value={gCapacity}
                    onChange={(e) => setGCapacity(e.target.value)}
                    className="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2.5"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Diesel Ltr/Hr</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 16.9 or 5.8"
                    value={gDieselPerHour}
                    onChange={(e) => setGDieselPerHour(e.target.value)}
                    className="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2.5"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Tax Pattern / GST Type</label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="gstType"
                      checked={gGstType === 'CGST_SGST'}
                      onChange={() => setGGstType('CGST_SGST')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    CGST + SGST (9%+9%)
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="gstType"
                      checked={gGstType === 'IGST'}
                      onChange={() => setGGstType('IGST')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    IGST (18%)
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Generator Meter Format</label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="meterFormat"
                      checked={gMeterFormat === 'HH:MM'}
                      onChange={() => setGMeterFormat('HH:MM')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    HH:MM (e.g. 100:30)
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="meterFormat"
                      checked={gMeterFormat === 'DECIMAL'}
                      onChange={() => setGMeterFormat('DECIMAL')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    DECIMAL (e.g. 100.5)
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white font-semibold text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  {editingGensetId ? 'Update Generator Site' : 'Add Generator Site'}
                </button>
                {editingGensetId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGensetId(null);
                      setGSiteName('');
                      setGClientId('');
                      setGCapacity('');
                      setGDieselPerHour('');
                      setGGstType('CGST_SGST');
                      setGCompanyId('');
                      setGBankAccountId('');
                    }}
                    className="border border-slate-200 text-slate-500 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Genset List */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">
              Registered Locations & Generator Sizes ({db.gensets.length})
            </h2>

            {db.gensets.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No sites configured. Fill out form to begin.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                      <th className="py-2.5 px-3">Location / Site Name</th>
                      <th className="py-2.5 px-3">KVA Genset</th>
                      <th className="py-2.5 px-3">Company & Settlement Bank Details</th>
                      <th className="py-2.5 px-3 text-right">Ltrs Ratio / Hr</th>
                      <th className="py-2.5 px-3">Client (Zone)</th>
                      <th className="py-2.5 px-3 text-center">GST</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {db.gensets.map(g => {
                      const client = db.clients.find(c => c.id === g.clientId);
                      const co = companiesList.find(c => c.id === g.companyId) || companiesList[0];
                      const bk = bankAccountsList.find(b => b.id === g.bankAccountId) || bankAccountsList[0];
                      return (
                        <tr key={g.id} className="hover:bg-slate-55 transition text-slate-700 text-xs">
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            <div>{g.siteName}</div>
                            <div className="flex flex-wrap gap-1 items-center mt-1">
                              <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[9px] bg-slate-100 text-slate-700">
                                Format: {g.meterFormat || 'HH:MM'}
                              </span>
                              {g.zoneName ? (
                                <span className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-150">
                                  Rate Zone: {g.zoneName}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-gray-50 text-gray-400 italic" title="Will auto-match based on site/client name">
                                  Auto Rate Match
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-medium text-blue-650">{g.capacity}</td>
                          <td className="py-3 px-3">
                            <div className="text-[11px] font-bold text-slate-800 truncate max-w-[180px]">{co?.name || 'Main Company'}</div>
                            <div className="text-[10px] text-emerald-600 truncate max-w-[180px]">{bk?.bankName} (..{bk?.accountNumber.slice(-4)})</div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-600 font-bold">{g.dieselQuantityPerHour} L</td>
                          <td className="py-3 px-3 text-slate-500 font-medium">
                            {client ? `${client.name} (${client.zone})` : 'Orphan Generator'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${g.gstType === 'IGST' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {g.gstType}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center flex justify-center gap-1">
                            <button
                              onClick={() => startEditGenset(g)}
                              className="text-slate-450 hover:text-blue-600 p-1 transition"
                              title="Edit Site parameters"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteGenset(g.id)}
                              className="text-slate-450 hover:text-rose-600 p-1 transition"
                              title="Delete site"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {activeSubTab === 'fuel-rates' && (
        <div className="space-y-6" id="master-fuel-rates-panel">
          
          {/* Subzone Month selector & Create header */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Subzone Pricing Periods</h3>
                <p className="text-[10px] text-slate-400">Configure distinct diesel fuel prices for each region/subzone.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <span className="text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Select Period Month:</span>
              <select
                value={selectedSubzoneMonth}
                onChange={(e) => setSelectedSubzoneMonth(e.target.value)}
                className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs py-1.5 px-3 rounded-lg border border-slate-700 cursor-pointer focus:ring-1 focus:ring-emerald-500"
              >
                {fuelMonthsOptions.map(m => (
                  <option key={m} value={m}>
                    {new Date(m + '-01').toLocaleDateString('en', { month: 'long', year: 'numeric' })} ({m})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left side: Register new subzone */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit space-y-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-150 pb-2.5">
                <Plus className="h-4 w-4 text-emerald-600" />
                Add New Pricing Subzone
              </h2>

              <form onSubmit={handleAddSubzoneMaster} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Subzone Area Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Tiruchirappalli Area"
                    value={subzoneNameInput}
                    onChange={(e) => setSubzoneNameInput(e.target.value)}
                    className="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2.5"
                    required
                  />
                  <span className="text-[9.5px] text-slate-400 block leading-tight mt-1">
                    This adds a new subzone template for fuel rate index mapping. Generator sites can link to this to fetch precise rates.
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2.5 px-4 rounded-lg cursor-pointer shadow-sm transition"
                >
                  Create Fuel Subzone
                </button>
              </form>
            </div>

            {/* Right side: Subzones pricing list spreadsheet */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-800 border-b border-slate-150 pb-2.5 mb-4">
                Fuel Rates for {new Date(selectedSubzoneMonth + '-01').toLocaleDateString('en', { month: 'long', year: 'numeric' })} ({subzonePricesForMonth.length} Regions)
              </h2>

              {subzonePricesForMonth.length === 0 ? (
                <div className="text-center py-10 space-y-2 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-400 italic">No subzone prices configured for this month key.</p>
                  <button
                    onClick={() => {
                      // Seed standard zones
                      onUpdateDb(prev => {
                        const standardList = ['Salem Area', 'Namakkal Area', 'Pathanam Area', 'Kottayam Area', 'Idukki Area', 'Alapuzha Area'];
                        const newSeeded = standardList.map((sn, index) => ({
                          id: `zp-${selectedSubzoneMonth}-${index}-${Date.now()}`,
                          zoneName: sn,
                          monthKey: selectedSubzoneMonth,
                          price1st: 0,
                          priceLast: 0,
                          averagePrice: 0
                        }));
                        return {
                          ...prev,
                          zonePrices: [...prev.zonePrices, ...newSeeded]
                        };
                      });
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    + Auto-Seed Default 6 Regions (₹0.00 rate)
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-150 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider text-[10px] border-b border-slate-150">
                        <th className="p-2.5 border-r border-slate-150">Subzone Name</th>
                        <th className="p-2.5 border-r border-slate-150 w-24 text-right">Price on 1st (₹)</th>
                        <th className="p-2.5 border-r border-slate-150 w-24 text-right">Price on Last (₹)</th>
                        <th className="p-2.5 border-r border-slate-150 w-24 text-right">Average (₹)</th>
                        <th className="p-2.5 text-center w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {subzonePricesForMonth.map(zp => {
                        const isEditing = editingSubzoneId === zp.id;
                        return (
                          <tr key={zp.id} className="hover:bg-slate-50">
                            <td className="p-2.5 border-r border-slate-150 font-bold text-slate-700 uppercase">
                              {zp.zoneName}
                            </td>
                            <td className="p-2.5 border-r border-slate-150 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={szPrice1st}
                                  onChange={(e) => setSzPrice1st(e.target.value)}
                                  className="w-16 text-right p-1 text-xs border rounded focus:ring-1 focus:ring-emerald-500"
                                />
                              ) : (
                                <span className={zp.price1st === 0 ? "text-rose-500 font-bold" : "font-mono font-semibold"}>
                                  ₹{zp.price1st.toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 border-r border-slate-150 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={szPriceLast}
                                  onChange={(e) => setSzPriceLast(e.target.value)}
                                  className="w-16 text-right p-1 text-xs border rounded focus:ring-1 focus:ring-emerald-500"
                                />
                              ) : (
                                <span className={zp.priceLast === 0 ? "text-rose-500 font-bold" : "font-mono font-semibold"}>
                                  ₹{zp.priceLast.toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 border-r border-slate-150 text-right font-bold text-slate-800">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={szPriceAvg}
                                  onChange={(e) => setSzPriceAvg(e.target.value)}
                                  placeholder="Auto"
                                  className="w-16 text-right p-1 text-xs border rounded focus:ring-1 focus:ring-emerald-500"
                                />
                              ) : (
                                <span className={zp.averagePrice === 0 ? "text-rose-500" : "font-mono"}>
                                  ₹{zp.averagePrice.toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {isEditing ? (
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={() => handleSaveSubzonePricing(zp.id)}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                    title="Save rates"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingSubzoneId(null)}
                                    className="p-1 text-slate-400 hover:bg-slate-50 rounded"
                                    title="Cancel"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={() => startEditSubzonePricing(zp)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit rate"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSubzone(zp.zoneName)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    title="Delete subzone pricing"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
