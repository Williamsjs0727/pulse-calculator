
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LOW_CONFIDENCE_THRESHOLD,
  aggregateTransactionsByMonth,
  parseCsvStatementFile,
  parseImageStatementFile,
  parsePdfStatementFile,
  prepareImportedTransactions,
  parseTransactionsFromRawText,
} from './importPipeline';

// ==================== CSS 动画与全局样式注入 ====================
// 修复核心 1: 强制 html/body 背景色，防止下拉回弹时露出白色底色
const GlobalStyles = () => (
  <style>{`
    html, body {
      background-color: #F5F5F7;
      transition: background-color 0.5s ease;
    }
    html.dark, html.dark body {
      background-color: #000000; /* 纯黑，适配 OLED 屏幕和刘海 */
    }
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-15px); }
      100% { transform: translateY(0px); }
    }
    @keyframes blob {
      0% { transform: translate(0px, 0px) scale(1); }
      33% { transform: translate(30px, -50px) scale(1.1); }
      66% { transform: translate(-20px, 20px) scale(0.9); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    .animate-float {
      animation: float 6s ease-in-out infinite;
    }
    .animate-blob {
      animation: blob 7s infinite;
    }
    .animation-delay-2000 {
      animation-delay: 2s;
    }
    .animation-delay-4000 {
      animation-delay: 4s;
    }
  `}</style>
);

// ==================== 常量定义 ====================
const CONSTANTS = {
  RC_UNIT_SPEND: 250,
  BASE_RC_PER_UNIT: 1,
  EXTRA_RC_PER_UNIT: 5,
  BASE_RATE: 0.004, 
  RYC_RATE: 0.02,
  RYC_CAP_RMB: 100000, 
  MP_RATE: 0.02,
  MP_CAP_RMB: 80000,   
  DINING_MONTHLY_CAP_SPEND: 2000,
  DINING_YEARLY_CAP_SPEND: 24000, 
  DINING_THRESHOLD_RMB: 1200, 
  DINING_A_RATE: 0.03,
  DINING_A_CAP: 60,
  DINING_B_RATE: 0.02,
  DINING_B_CAP: 40,
  RC_TO_ASIAMILES: 10,
};

// ==================== 图标组件 ====================
const Icons = {
  Settings: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Trash: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>,
  Plus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Diamond: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3h12l4 6-10 10L2 9l4-6z"/></svg>,
  Wifi: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2"><path d="M5 12.55a11 11 0 0114.08 0" /><path d="M1.42 9a16 16 0 0121.16 0" /><path d="M8.53 16.11a6 6 0 016.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3"/></svg>
};

// ==================== CSS Art: HSBC Pulse Card ====================
const PulseBlackCard = () => (
  <div className="animate-float relative w-full aspect-[1.586/1] max-w-[360px] md:max-w-[400px] rounded-2xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] mx-auto ring-1 ring-white/10 dark:shadow-[0_25px_60px_-15px_rgba(255,255,255,0.1)]">
    <div className="absolute inset-0 bg-[#0f0f11]"></div>
    <div className="absolute inset-0 opacity-80" 
         style={{
           backgroundImage: 'radial-gradient(circle, #db0011 1px, transparent 1.5px)',
           backgroundSize: '8px 8px',
           maskImage: 'linear-gradient(110deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0) 100%)',
           WebkitMaskImage: 'linear-gradient(110deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0) 100%)'
         }}>
    </div>
    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-50"></div>
    <div className="relative z-10 p-5 md:p-7 flex flex-col justify-between h-full font-sans">
      
      {/* Top Row */}
      <div className="flex justify-between items-start">
        <div className="mt-6 md:mt-8 ml-1 md:ml-2">
           <div className="w-10 h-7 md:w-14 md:h-10 rounded bg-gradient-to-br from-[#eecda3] to-[#dbb688] shadow-inner opacity-90 border border-white/10"></div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2 mb-1">
             <div className="relative w-6 h-4 md:w-8 md:h-5">
                <div className="absolute left-0 top-0 border-l-[8px] md:border-l-[10px] border-r-[8px] md:border-r-[10px] border-b-[8px] md:border-b-[10px] border-l-transparent border-r-transparent border-b-[#db0011]"></div>
                <div className="absolute right-0 bottom-0 border-l-[8px] md:border-l-[10px] border-r-[8px] md:border-r-[10px] border-t-[8px] md:border-t-[10px] border-l-transparent border-r-transparent border-t-[#db0011]"></div>
             </div>
             <span className="text-white font-bold text-base md:text-lg tracking-wide">HSBC</span>
          </div>
          <div className="text-[9px] md:text-[10px] text-gray-400 font-medium tracking-wide flex flex-col items-end">
             <span>Pulse | HKD : RMB</span>
             <div className="flex items-center gap-1 mt-1">
                <span className="text-white/90 border border-white/30 px-1 rounded-[2px] text-[8px] md:text-[9px] bg-white/10 backdrop-blur-sm">DIAMOND</span>
                <Icons.Wifi />
             </div>
          </div>
        </div>
      </div>
      
      {/* Middle Row */}
      <div className="mt-1 md:mt-2">
         <div className="text-lg md:text-2xl text-transparent bg-clip-text bg-gradient-to-b from-gray-100 to-gray-400 font-mono tracking-widest shadow-black drop-shadow-md whitespace-nowrap">
           6250 9888 8888 8888
         </div>
         <div className="flex justify-center gap-1 text-[8px] md:text-[9px] text-gray-300 font-mono mt-1">
            <span className="text-[6px] md:text-[7px] self-center">VALID<br/>THRU</span>
            <span className="text-xs md:text-sm self-center">12/27</span>
         </div>
      </div>

      {/* Bottom Row */}
      <div className="flex justify-between items-end">
        <div className="text-gray-300 font-mono text-xs md:text-sm tracking-widest uppercase shadow-black drop-shadow-sm truncate max-w-[150px]">
          VIC P LEE
        </div>
        <div className="w-10 h-6 md:w-14 md:h-9 bg-gradient-to-r from-gray-300 via-white to-gray-300 rounded-[3px] md:rounded-[4px] flex items-center justify-center skew-x-[-10deg] shadow-lg relative overflow-hidden flex-shrink-0">
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10"></div>
             <div className="flex flex-col items-end leading-none transform skew-x-[10deg] pr-1">
                <span className="text-[8px] md:text-[10px] font-bold text-gray-800 italic">UnionPay</span>
                <span className="text-[6px] md:text-[8px] font-bold text-gray-800">银联</span>
             </div>
        </div>
      </div>
    </div>
  </div>
);

// ==================== Liquid Input Component ====================
const LiquidInput = ({ value, onChange, label, subLabel, disabled, placeholder }) => {
  const [displayVal, setDisplayVal] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDisplayVal(value > 0 ? value.toString() : '');
    }
  }, [value]);

  const handleCalculate = () => {
    if (disabled) return;
    const raw = displayVal.trim();
    if (!raw) {
      onChange(0);
      return;
    }
    try {
      if (!/^[0-9+\-*/().\s]+$/.test(raw)) return;
      const result = new Function('return ' + raw)();
      if (isFinite(result) && !isNaN(result)) {
        onChange(Math.max(0, result));
      }
    } catch (e) {}
  };

  const containerClasses = `
    group relative rounded-3xl transition-all duration-500 ease-out w-full border border-transparent
    ${disabled ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-text'}
    ${isFocused 
      ? 'bg-white dark:bg-[#1a1a1a] shadow-[0_15px_40px_-10px_rgba(0,0,0,0.1)] translate-y-[-2px] dark:border-white/10' 
      : 'bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:border-white/5'
    }
  `;

  const labelClasses = `
    text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-colors
    ${isFocused ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}
  `;

  const subLabelClasses = `
    text-[8px] md:text-[9px] px-1.5 py-0.5 rounded-full font-bold tracking-wide transition-colors
    ${disabled 
      ? 'bg-gray-100/50 text-gray-300 dark:bg-gray-800 dark:text-gray-600' 
      : 'bg-red-50 text-red-500/80 dark:bg-red-900/20 dark:text-red-400'}
  `;

  const inputSymbolClasses = `
    text-xl md:text-2xl font-light transition-colors duration-300
    ${isFocused ? 'text-gray-800 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'}
  `;

  return (
    <div 
      className={containerClasses}
      onClick={() => !disabled && inputRef.current.focus()}
    >
      <div 
        className={`absolute inset-0 rounded-3xl bg-gradient-to-r from-red-500/5 to-purple-500/5 blur-xl transition-opacity duration-700 pointer-events-none 
        ${isFocused ? 'opacity-100' : 'opacity-0'}`} 
      />

      <div className="relative z-10 px-5 py-4 md:px-6 md:py-5 flex flex-col h-24 md:h-26 justify-center">
        <div className="flex justify-between items-center mb-1 md:mb-2">
          <label className={labelClasses}>
            {label}
          </label>
          {subLabel && (
            <span className={subLabelClasses}>
              {subLabel}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className={inputSymbolClasses}>¥</span>
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={displayVal}
            onFocus={() => setIsFocused(true)}
            onBlur={() => { setIsFocused(false); handleCalculate(); }}
            onChange={(e) => setDisplayVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current.blur()}
            placeholder="0"
            className={`w-full bg-transparent border-none outline-none ring-0 appearance-none text-2xl md:text-3xl font-bold p-0 m-0 font-mono tracking-tight
              text-gray-800 dark:text-gray-100
              placeholder-gray-200/80 dark:placeholder-gray-700
            `}
            style={{ boxShadow: 'none' }} 
          />
        </div>
      </div>
    </div>
  );
};

const Toggle = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    onClick={() => {
      if (disabled) return;
      onChange(!checked);
    }}
    disabled={disabled}
    className={`
      relative w-10 h-5 md:w-11 md:h-6 rounded-full transition-all duration-500 ease-out 
      ${checked ? 'bg-[#db0011] shadow-[0_2px_8px_rgba(219,0,17,0.4)]' : 'bg-gray-200/80 dark:bg-gray-700'}
      ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    <div className={`
      absolute top-1 w-3 h-3 md:w-4 md:h-4 rounded-full bg-white shadow-sm transform transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)
      ${checked ? 'translate-x-6' : 'translate-x-1'}
    `} />
  </button>
);

const ProgressBar = ({ label, used, cap }) => {
  const percentage = Math.min((used / cap) * 100, 100);
  return (
    <div className="space-y-1 md:space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-[9px] md:text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{label}</span>
        <span className="text-[9px] md:text-[10px] font-bold text-white font-mono">{percentage.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full bg-gray-800 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-[#db0011] to-[#ff4d4d] shadow-[0_0_15px_rgba(219,0,17,0.8)] relative" 
          style={{ width: `${percentage}%` }}
        >
        </div>
      </div>
      <div className="text-right text-[9px] md:text-[10px] text-gray-500 dark:text-gray-400 font-mono tracking-tight">
        <span className="text-gray-400 dark:text-gray-600">{used.toLocaleString()}</span> / {cap.toLocaleString()}
      </div>
    </div>
  );
};

const SmartImportPanel = ({ onReplaceMonths, onAppendMonths }) => {
  const [transactions, setTransactions] = useState([]);
  const [rawText, setRawText] = useState('');
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showAllForReview, setShowAllForReview] = useState(false);
  const fileInputRef = useRef(null);

  const monthPreview = useMemo(() => aggregateTransactionsByMonth(transactions), [transactions]);
  const reviewCount = useMemo(
    () => transactions.filter((tx) => tx.needsReview).length,
    [transactions]
  );
  const previewReviewRows = useMemo(() => {
    const sourceRows = showAllForReview ? transactions : transactions.filter((tx) => tx.needsReview);
    return sourceRows;
  }, [transactions, showAllForReview]);

  const mergeReviewedTransaction = (id, patch) => {
    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        const merged = { ...tx, ...patch };
        const boostedConfidence = Math.max(merged.confidence ?? 0, LOW_CONFIDENCE_THRESHOLD);
        const categoryUncertain = Boolean(merged.categoryUncertain);
        const needsReview = !merged.monthKey || categoryUncertain;
        const uncertainty = needsReview
          ? Math.max(merged.uncertainty ?? 0.45, 0.45)
          : Math.min(merged.uncertainty ?? 0.15, 0.15);

        return {
          ...merged,
          confidence: boostedConfidence,
          uncertainty,
          needsReview,
        };
      })
    );
  };

  const deleteTransaction = (id) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  const updateCategoryMode = (id, mode) => {
    const modePatch = {
      isDining: mode === 'dining' || mode === 'both',
      isMobilePay: mode === 'mobile' || mode === 'both',
      categoryUncertain: mode === 'unknown',
    };
    mergeReviewedTransaction(id, modePatch);
  };

  const getCategoryMode = (tx) => {
    if (tx.categoryUncertain) return 'unknown';
    if (tx.isDining && tx.isMobilePay) return 'both';
    if (tx.isDining) return 'dining';
    if (tx.isMobilePay) return 'mobile';
    return 'none';
  };

  const importTransactions = async (loader, sourceLabel) => {
    setIsImporting(true);
    setErrorText('');
    setStatusText(`${sourceLabel} 识别中，请稍候...`);

    try {
      const rawParsed = await loader();
      if (!rawParsed.length) {
        setStatusText('');
        setErrorText('未识别到有效交易，请优先使用 CSV，或在下方粘贴文本后再试。');
        return;
      }
      const prepared = prepareImportedTransactions(rawParsed);
      const parsed = prepared.transactions;
      setTransactions(parsed);
      const uncertainCount = parsed.filter((tx) => tx.needsReview).length;

      const extra = [];
      if (prepared.duplicateCount > 0) extra.push(`自动排重 ${prepared.duplicateCount} 笔`);
      if (prepared.matchedRefundCount > 0) extra.push(`匹配退款 ${prepared.matchedRefundCount} 笔`);

      setStatusText(
        `已导入 ${parsed.length} 笔交易，需复审 ${uncertainCount} 笔${
          extra.length ? `（${extra.join('，')}）` : ''
        }。`
      );
    } catch (error) {
      setStatusText('');
      setErrorText(error instanceof Error ? error.message : '导入失败，请稍后重试。');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileImport = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const supportedFiles = files.filter((file) => {
      const name = file.name.toLowerCase();
      return (
        name.endsWith('.csv') ||
        name.endsWith('.pdf') ||
        name.endsWith('.png') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.webp')
      );
    });

    if (!supportedFiles.length) {
      setErrorText('目前支持 CSV / PDF / PNG / JPG / WEBP。');
      return;
    }

    await importTransactions(async () => {
      const merged = [];

      for (let index = 0; index < supportedFiles.length; index += 1) {
        const file = supportedFiles[index];
        const name = file.name.toLowerCase();
        const sourceTag = `${name.split('.').pop() || 'file'}-${index}-${file.lastModified}-${file.size}`;
        if (name.endsWith('.csv')) {
          merged.push(...(await parseCsvStatementFile(file, sourceTag)));
          continue;
        }
        if (name.endsWith('.pdf')) {
          merged.push(...(await parsePdfStatementFile(file, sourceTag)));
          continue;
        }
        if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) {
          merged.push(...(await parseImageStatementFile(file, sourceTag)));
          continue;
        }
      }

      return merged;
    }, supportedFiles.length > 1 ? `${supportedFiles.length} 个文件` : '文件');
  };

  const handleRawTextImport = () => {
    if (!rawText.trim()) {
      setErrorText('请先粘贴 statement 文本。');
      return;
    }

    const rawParsed = parseTransactionsFromRawText(rawText, 'text');
    const prepared = prepareImportedTransactions(rawParsed);
    const parsed = prepared.transactions;
    if (!parsed.length) {
      setErrorText('文本中未提取到交易行，请检查格式（日期 + 商户 + 金额）。');
      return;
    }

    setTransactions(parsed);
    setErrorText('');
    const uncertainCount = parsed.filter((tx) => tx.needsReview).length;
    const extra = [];
    if (prepared.duplicateCount > 0) extra.push(`自动排重 ${prepared.duplicateCount} 笔`);
    if (prepared.matchedRefundCount > 0) extra.push(`匹配退款 ${prepared.matchedRefundCount} 笔`);
    setStatusText(
      `文本识别完成：${parsed.length} 笔交易，需复审 ${uncertainCount} 笔${
        extra.length ? `（${extra.join('，')}）` : ''
      }。`
    );
  };

  const toMonthRecords = () => {
    const seed = Date.now();
    return monthPreview.map((month, index) => ({
      id: seed + index,
      monthKey: month.monthKey,
      hasRefund:
        (month.totalRefundSpend || 0) > 0 ||
        (month.mobileRefundSpend || 0) > 0 ||
        (month.diningRefundSpend || 0) > 0,
      totalSpend: month.totalSpend,
      diningSpend: month.diningSpend,
      mobilePaySpend: month.mobilePaySpend,
      totalRefundSpend: month.totalRefundSpend || 0,
      diningRefundSpend: month.diningRefundSpend || 0,
      mobileRefundSpend: month.mobileRefundSpend || 0,
      totalNetSpend: month.totalNetSpend || 0,
      diningNetSpend: month.diningNetSpend || 0,
      mobileNetSpend: month.mobileNetSpend || 0,
      rycTxnExtraRc: month.rycTxnExtraRc || 0,
      mobileTxnExtraRc: month.mobileTxnExtraRc || 0,
      pendingBaseClawback: month.pendingBaseClawback || 0,
      pendingRycClawback: month.pendingRycClawback || 0,
      pendingMobileClawback: month.pendingMobileClawback || 0,
    }));
  };

  const canApply = monthPreview.length > 0;

  return (
    <section className="bg-white/30 dark:bg-white/5 backdrop-blur-2xl rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.02)] border border-white/20 dark:border-white/5 space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 xl:items-end">
        <div className="space-y-1 xl:col-span-8 text-center xl:text-left">
          <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">智能导入（可选）</div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            上传 statement（CSV / PDF / 截图）后自动归类，不确定类别交易可人工复审。
          </p>
        </div>
        <div className="xl:col-span-4 text-[11px] text-gray-500 dark:text-gray-400 text-center xl:text-right">
          导入结果会映射到现有“按月输入”，不会移除当前手工功能。
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-white/30 dark:border-white/10 p-4 md:p-5 space-y-3">
          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">上传文件</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.pdf,.png,.jpg,.jpeg,.webp"
            multiple
            className="hidden"
            onChange={handleFileImport}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="w-full py-4 px-4 rounded-2xl bg-black text-white dark:bg-white dark:text-black font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isImporting ? '导入中...' : '上传 statement / 截图（支持多选）'}
          </button>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            建议优先上传 CSV（准确率最高）；PDF 与截图会尝试文本识别。
          </p>
        </div>

        <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-white/30 dark:border-white/10 p-4 md:p-5 space-y-3">
          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">粘贴文本</div>
          <textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder="可粘贴账单文本（每行建议包含：日期 + 商户 + 金额）"
            className="w-full h-32 rounded-2xl px-4 py-3 bg-white/60 dark:bg-black/30 border border-white/40 dark:border-white/10 text-sm text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-[#db0011]/40"
          />
          <button
            type="button"
            onClick={handleRawTextImport}
            disabled={isImporting}
            className="w-full py-3 rounded-2xl bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/10 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-white/20 disabled:opacity-50 transition-colors"
          >
            从粘贴文本识别
          </button>
        </div>
      </div>

      {(statusText || errorText) && (
        <div className={`rounded-2xl px-4 py-3 text-sm ${errorText ? 'bg-red-50/80 dark:bg-red-900/20 text-red-600 dark:text-red-300' : 'bg-green-50/80 dark:bg-green-900/20 text-green-700 dark:text-green-300'}`}>
          {errorText || statusText}
        </div>
      )}

      {transactions.length > 0 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/50 dark:bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">已识别交易</div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">{transactions.length}</div>
            </div>
            <div className="rounded-2xl bg-white/50 dark:bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">需复审</div>
              <div className="text-2xl font-bold text-orange-500">{reviewCount}</div>
            </div>
            <div className="rounded-2xl bg-white/50 dark:bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">识别月份</div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">{monthPreview.length}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/30 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/60 dark:bg-white/5 text-gray-500 dark:text-gray-400 uppercase text-[10px] tracking-widest">
                <tr>
                  <th className="text-left px-3 py-2">月份</th>
                  <th className="text-right px-3 py-2">总消费</th>
                  <th className="text-right px-3 py-2">餐饮</th>
                  <th className="text-right px-3 py-2">移动支付</th>
                  <th className="text-right px-3 py-2">待复审</th>
                </tr>
              </thead>
              <tbody>
                {monthPreview.map((month) => (
                  <tr key={month.monthKey} className="border-t border-white/20 dark:border-white/5">
                    <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-200">{month.monthKey}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-200">{month.totalSpend.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-200">{month.diningSpend.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-200">{month.mobilePaySpend.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono text-orange-500">{month.reviewCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {transactions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  不确定类别交易可人工复审（支持人工删除）
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllForReview((v) => !v)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/10 text-gray-600 dark:text-gray-300"
                >
                  {showAllForReview ? '仅看不确定交易' : '显示全部交易'}
                </button>
              </div>
              {previewReviewRows.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 bg-white/40 dark:bg-white/5 rounded-2xl px-4 py-3">
                  当前没有不确定交易，可点击“显示全部交易”手动校对分类。
                </div>
              ) : (
              <div className="space-y-2">
                {previewReviewRows.map((tx) => (
                  <div key={tx.id} className="rounded-2xl bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10 px-4 py-3 space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="text-sm text-gray-700 dark:text-gray-200">
                        <span className="font-semibold">{tx.description}</span>
                        <span className="ml-2 font-mono text-gray-500 dark:text-gray-400">¥{tx.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 self-start md:self-center">
                        <div className={`text-[11px] px-2 py-1 rounded-full ${tx.needsReview ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                          不确定程度 {((tx.uncertainty ?? (1 - (tx.confidence ?? 0.5))) * 100).toFixed(0)}%
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteTransaction(tx.id)}
                          className="inline-flex items-center justify-center rounded-lg border border-red-200/80 dark:border-red-500/30 bg-white/80 dark:bg-red-900/20 text-red-500 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1"
                          title="删除交易"
                          aria-label={`删除交易 ${tx.description}`}
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        分类
                        <select
                          value={getCategoryMode(tx)}
                          onChange={(event) => updateCategoryMode(tx.id, event.target.value)}
                          className="rounded-lg px-2 py-1 bg-white/70 dark:bg-black/30 border border-white/40 dark:border-white/10"
                        >
                          <option value="unknown">不确定（待复审）</option>
                          <option value="dining">仅内地餐饮</option>
                          <option value="mobile">仅移动支付</option>
                          <option value="both">餐饮 + 移动支付</option>
                          <option value="none">都不是</option>
                        </select>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        月份
                        <input
                          type="month"
                          value={tx.monthKey}
                          onChange={(event) => mergeReviewedTransaction(tx.id, { monthKey: event.target.value })}
                          className="rounded-lg px-2 py-1 bg-white/70 dark:bg-black/30 border border-white/40 dark:border-white/10"
                        />
                      </label>
                    </div>
                    {tx.reasons?.length > 0 && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {tx.reasons.join('；')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-3">
            <button
              type="button"
              disabled={!canApply}
              onClick={() => onReplaceMonths(toMonthRecords())}
              className="flex-1 py-3 rounded-2xl bg-[#db0011] text-white font-bold disabled:opacity-50"
            >
              替换当前按月输入
            </button>
            <button
              type="button"
              disabled={!canApply}
              onClick={() => onAppendMonths(toMonthRecords())}
              className="flex-1 py-3 rounded-2xl bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/10 text-gray-700 dark:text-gray-200 font-bold disabled:opacity-50"
            >
              追加到当前按月输入
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

// ==================== Main App ====================

const toSafeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortMonthlyRows = (inputData) => {
  const rows = Array.isArray(inputData) ? inputData : [];
  return rows
    .map((row, index) => ({
      ...row,
      hasRefund: Boolean(row.hasRefund),
      totalSpend: toSafeNumber(row.totalSpend),
      mobilePaySpend: toSafeNumber(row.mobilePaySpend),
      diningSpend: toSafeNumber(row.diningSpend),
      totalRefundSpend: toSafeNumber(row.totalRefundSpend),
      mobileRefundSpend: toSafeNumber(row.mobileRefundSpend),
      diningRefundSpend: toSafeNumber(row.diningRefundSpend),
      pendingBaseClawback: toSafeNumber(row.pendingBaseClawback),
      pendingRycClawback: toSafeNumber(row.pendingRycClawback),
      pendingMobileClawback: toSafeNumber(row.pendingMobileClawback),
      __index: index,
    }))
    .sort((a, b) => {
      if (a.monthKey && b.monthKey && a.monthKey !== b.monthKey) {
        return String(a.monthKey).localeCompare(String(b.monthKey));
      }
      return a.__index - b.__index;
    });
};

const toSyntheticMonthlyRows = (yearlyData) => {
  const monthCount = 12;
  const yearlyTotal = toSafeNumber(yearlyData?.totalSpend);
  const yearlyMobile = toSafeNumber(yearlyData?.mobilePaySpend);
  const yearlyDining = toSafeNumber(yearlyData?.diningSpend);
  const yearlyTotalRefund = toSafeNumber(yearlyData?.totalRefundSpend);
  const yearlyMobileRefund = toSafeNumber(yearlyData?.mobileRefundSpend);
  const yearlyDiningRefund = toSafeNumber(yearlyData?.diningRefundSpend);
  const hasRefund = Boolean(yearlyData?.hasRefund);
  const forceThreshold = Boolean(yearlyData?.forceThreshold);

  return Array.from({ length: monthCount }, (_, index) => ({
    monthKey: `Y-${String(index + 1).padStart(2, '0')}`,
    hasRefund,
    totalSpend: yearlyTotal / monthCount,
    mobilePaySpend: yearlyMobile / monthCount,
    diningSpend: yearlyDining / monthCount,
    totalRefundSpend: hasRefund ? yearlyTotalRefund / monthCount : 0,
    mobileRefundSpend: hasRefund ? yearlyMobileRefund / monthCount : 0,
    diningRefundSpend: hasRefund ? yearlyDiningRefund / monthCount : 0,
    forceThreshold,
    __index: index,
  }));
};

const roundDiningPromotionRc = (value) => {
  if (value > 0) return Math.ceil(value);
  if (value < 0) return Math.floor(value);
  return 0;
};

const calculateEstimate = (mode, activities, inputData, options = {}) => {
  const includePendingDining = Boolean(options.includePendingDining);
  let totalRc = 0;
  let totalSpend = 0;
  let rcBase = 0;
  let rcRyc = 0;
  let rcMobile = 0;
  let rcDiningPending = 0;
  let rycUsed = 0;
  let mpUsed = 0;
  let diningUsed = 0;

  if (mode === 'monthly') {
    inputData.forEach((m) => {
      const hasRefund = Boolean(m.hasRefund);
      const totalRefund = hasRefund ? toSafeNumber(m.totalRefundSpend) : 0;
      const mobileRefund = hasRefund ? toSafeNumber(m.mobileRefundSpend) : 0;
      const diningRefund = hasRefund ? toSafeNumber(m.diningRefundSpend) : 0;
      const monthTotal = toSafeNumber(
        m.totalNetSpend ??
        (toSafeNumber(m.totalSpend) - totalRefund)
      );
      const monthMobile = toSafeNumber(
        m.mobileNetSpend ??
        (toSafeNumber(m.mobilePaySpend) - mobileRefund)
      );
      const monthDining = toSafeNumber(
        m.diningNetSpend ??
        (toSafeNumber(m.diningSpend) - diningRefund)
      );
      const base = monthTotal * CONSTANTS.BASE_RATE;
      rcBase += base;
      totalSpend += monthTotal;

      if (activities.ryc) {
        const remaining = Math.max(0, CONSTANTS.RYC_CAP_RMB - rycUsed);
        const eligibleRaw = Math.min(monthTotal, remaining);
        const eligible = Math.max(-rycUsed, eligibleRaw);
        rcRyc += eligible * CONSTANTS.RYC_RATE;
        rycUsed += eligible;
      }
      if (activities.mobilePay) {
        const remaining = Math.max(0, CONSTANTS.MP_CAP_RMB - mpUsed);
        const eligibleRaw = Math.min(monthMobile, remaining);
        const eligible = Math.max(-mpUsed, eligibleRaw);
        rcMobile += eligible * CONSTANTS.MP_RATE;
        mpUsed += eligible;
      }
      if (activities.dining && monthDining !== 0) {
        const monthlyCapped =
          Math.sign(monthDining) * Math.min(Math.abs(monthDining), CONSTANTS.DINING_MONTHLY_CAP_SPEND);
        const eligibleByThreshold =
          monthlyCapped > 0
            ? (monthTotal >= CONSTANTS.DINING_THRESHOLD_RMB ? monthlyCapped : 0)
            : monthlyCapped;
        const eligibleDiningSpend = Math.max(-diningUsed, eligibleByThreshold);

        diningUsed += eligibleDiningSpend;

        const diningA = Math.max(
          -CONSTANTS.DINING_A_CAP,
          Math.min(eligibleDiningSpend * CONSTANTS.DINING_A_RATE, CONSTANTS.DINING_A_CAP)
        );
        const diningB = Math.max(
          -CONSTANTS.DINING_B_CAP,
          Math.min(eligibleDiningSpend * CONSTANTS.DINING_B_RATE, CONSTANTS.DINING_B_CAP)
        );

        rcDiningPending += diningA + diningB;
      }
    });
  } else {
    const y = inputData;
    const hasRefund = Boolean(y.hasRefund);
    const totalRefund = hasRefund ? toSafeNumber(y.totalRefundSpend) : 0;
    const mobileRefund = hasRefund ? toSafeNumber(y.mobileRefundSpend) : 0;
    totalSpend = toSafeNumber(
      y.totalNetSpend ??
      (toSafeNumber(y.totalSpend) - totalRefund)
    );
    rcBase = totalSpend * CONSTANTS.BASE_RATE;

    if (activities.ryc) {
      rycUsed = Math.min(Math.max(totalSpend, 0), CONSTANTS.RYC_CAP_RMB);
      rcRyc = rycUsed * CONSTANTS.RYC_RATE;
    }
    if (activities.mobilePay) {
      const yearlyMobileNet = toSafeNumber(
        y.mobileNetSpend ??
        (toSafeNumber(y.mobilePaySpend) - mobileRefund)
      );
      mpUsed = Math.min(Math.max(yearlyMobileNet, 0), CONSTANTS.MP_CAP_RMB);
      rcMobile = mpUsed * CONSTANTS.MP_RATE;
    }
    if (activities.dining && toSafeNumber(y.diningSpend) > 0) {
      const diningSpend = toSafeNumber(y.diningSpend);
      diningUsed = Math.min(Math.max(diningSpend, 0), CONSTANTS.DINING_YEARLY_CAP_SPEND);
      const avgTotal = totalSpend / 12;
      const avgDining = diningSpend / 12;
      if (y.forceThreshold || avgTotal >= CONSTANTS.DINING_THRESHOLD_RMB) {
        rcDiningPending =
          (Math.min(avgDining * CONSTANTS.DINING_A_RATE, CONSTANTS.DINING_A_CAP) +
            Math.min(avgDining * CONSTANTS.DINING_B_RATE, CONSTANTS.DINING_B_CAP)) *
          12;
      }
    }
  }

  const rcDiningIncluded = includePendingDining ? rcDiningPending : 0;
  totalRc = rcBase + rcRyc + rcMobile + rcDiningIncluded;

  return {
    calcMode: 'estimate',
    totalRc,
    totalSpend,
    rcBase,
    rcRyc,
    rcMobile,
    rcDiningPending,
    rcDiningPendingRaw: rcDiningPending,
    rcDiningIncluded,
    includePendingDining,
    rycUsed,
    mpUsed,
    diningUsed,
    baseCarry: 0,
    rycCarry: 0,
    mpCarry: 0,
    pendingBaseClawback: 0,
    pendingRycClawback: 0,
    pendingMobileClawback: 0,
    pendingClawbackTotal: 0,
    asiaMiles: totalRc * CONSTANTS.RC_TO_ASIAMILES,
    returnRate: totalSpend > 0 ? (totalRc / totalSpend) * 100 : 0,
  };
};

const calculateReconcile = (mode, activities, inputData, options = {}) => {
  const includePendingDining = Boolean(options.includePendingDining);
  const rows = mode === 'monthly' ? sortMonthlyRows(inputData) : toSyntheticMonthlyRows(inputData);

  let totalSpend = 0;
  let rcBase = 0;
  let rcRyc = 0;
  let rcMobile = 0;
  let rcDiningPendingRaw = 0;
  let rycUsed = 0;
  let mpUsed = 0;
  let diningUsed = 0;
  let baseCarry = 0;
  let pendingBaseClawback = 0;
  let pendingRycClawback = 0;
  let pendingMobileClawback = 0;

  rows.forEach((m) => {
    const hasRefund = Boolean(m.hasRefund);
    const monthTotal = Math.max(0, toSafeNumber(m.totalSpend));
    const monthMobile = Math.max(0, toSafeNumber(m.mobilePaySpend));
    const monthDining = Math.max(0, toSafeNumber(m.diningSpend));
    const monthTotalRefund = hasRefund ? Math.max(0, toSafeNumber(m.totalRefundSpend)) : 0;
    const monthMobileRefund = hasRefund ? Math.max(0, toSafeNumber(m.mobileRefundSpend)) : 0;
    totalSpend += monthTotal;

    // HSBC 当前 Earned 口径：仅统计正向消费；退款先进入待扣回，不即时冲减 Earned。
    baseCarry += monthTotal;
    const baseUnits = Math.floor(baseCarry / CONSTANTS.RC_UNIT_SPEND);
    rcBase += baseUnits * CONSTANTS.BASE_RC_PER_UNIT;
    baseCarry = Number((baseCarry - baseUnits * CONSTANTS.RC_UNIT_SPEND).toFixed(2));

    if (activities.ryc) {
      const remainingRycCap = Math.max(0, CONSTANTS.RYC_CAP_RMB - rycUsed);
      const rycEligibleSpend = Math.min(monthTotal, remainingRycCap);
      const monthRycTxnExtra = Math.max(0, Math.floor(toSafeNumber(m.rycTxnExtraRc)));
      const hasTxnLevelRyc = monthRycTxnExtra > 0 && Math.abs(rycEligibleSpend - monthTotal) < 0.01;

      rcRyc += hasTxnLevelRyc
        ? monthRycTxnExtra
        : Math.floor(rycEligibleSpend / 50);
      rycUsed = Number((rycUsed + rycEligibleSpend).toFixed(2));
    }

    if (activities.mobilePay) {
      const remainingMobileCap = Math.max(0, CONSTANTS.MP_CAP_RMB - mpUsed);
      const mobileEligibleSpend = Math.min(monthMobile, remainingMobileCap);
      const monthMobileTxnExtra = Math.max(0, Math.floor(toSafeNumber(m.mobileTxnExtraRc)));
      const hasTxnLevelMobile = monthMobileTxnExtra > 0 && Math.abs(mobileEligibleSpend - monthMobile) < 0.01;

      rcMobile += hasTxnLevelMobile
        ? monthMobileTxnExtra
        : Math.floor(mobileEligibleSpend / 50);
      mpUsed = Number((mpUsed + mobileEligibleSpend).toFixed(2));
    }

    if (activities.dining && monthDining > 0) {
      const thresholdPassed = Boolean(m.forceThreshold) || monthTotal >= CONSTANTS.DINING_THRESHOLD_RMB;
      if (thresholdPassed) {
        let eligibleDiningSpend = Math.min(monthDining, CONSTANTS.DINING_MONTHLY_CAP_SPEND);
        const remainingDining = Math.max(0, CONSTANTS.DINING_YEARLY_CAP_SPEND - diningUsed);
        eligibleDiningSpend = Math.min(eligibleDiningSpend, remainingDining);
        diningUsed += eligibleDiningSpend;

        rcDiningPendingRaw +=
          eligibleDiningSpend * CONSTANTS.DINING_A_RATE +
          eligibleDiningSpend * CONSTANTS.DINING_B_RATE;
      }
    }

    const monthPendingBase = hasRefund
      ? Math.max(
          0,
          Math.floor(
            toSafeNumber(m.pendingBaseClawback) || (monthTotalRefund / CONSTANTS.RC_UNIT_SPEND)
          )
        )
      : 0;
    const monthPendingRyc = hasRefund
      ? Math.max(
          0,
          Math.floor(
            toSafeNumber(m.pendingRycClawback) || Math.floor(monthTotalRefund / 50)
          )
        )
      : 0;
    const monthPendingMobile = hasRefund
      ? Math.max(
          0,
          Math.floor(
            toSafeNumber(m.pendingMobileClawback) || Math.floor(monthMobileRefund / 50)
          )
        )
      : 0;

    pendingBaseClawback += monthPendingBase;
    pendingRycClawback += monthPendingRyc;
    pendingMobileClawback += monthPendingMobile;
  });

  if (mode === 'yearly') {
    totalSpend = toSafeNumber(inputData?.totalSpend);
  }

  const rcDiningPending = activities.dining ? roundDiningPromotionRc(rcDiningPendingRaw) : 0;
  const rcDiningIncluded = includePendingDining ? rcDiningPending : 0;
  const totalRc = rcBase + rcRyc + rcMobile + rcDiningIncluded;

  return {
    calcMode: 'reconcile',
    totalRc,
    totalSpend,
    rcBase,
    rcRyc,
    rcMobile,
    rcDiningPending,
    rcDiningPendingRaw,
    rcDiningIncluded,
    includePendingDining,
    rycUsed,
    mpUsed,
    diningUsed,
    baseCarry,
    rycCarry: 0,
    mpCarry: 0,
    pendingBaseClawback,
    pendingRycClawback,
    pendingMobileClawback,
    pendingClawbackTotal: pendingBaseClawback + pendingRycClawback + pendingMobileClawback,
    asiaMiles: totalRc * CONSTANTS.RC_TO_ASIAMILES,
    returnRate: totalSpend > 0 ? (totalRc / totalSpend) * 100 : 0,
  };
};

function calculate(mode, activities, inputData, options = {}) {
  const calcMode = options.calcMode === 'estimate' ? 'estimate' : 'reconcile';
  if (calcMode === 'estimate') {
    return calculateEstimate(mode, activities, inputData, options);
  }
  return calculateReconcile(mode, activities, inputData, options);
}

const createMonthRecord = (id = Date.now()) => ({
  id,
  monthKey: '',
  hasRefund: false,
  totalSpend: 0,
  mobilePaySpend: 0,
  diningSpend: 0,
  totalRefundSpend: 0,
  diningRefundSpend: 0,
  mobileRefundSpend: 0,
  totalNetSpend: 0,
  diningNetSpend: 0,
  mobileNetSpend: 0,
  rycTxnExtraRc: 0,
  mobileTxnExtraRc: 0,
  pendingBaseClawback: 0,
  pendingRycClawback: 0,
  pendingMobileClawback: 0,
});

const createYearlyRecord = () => ({
  totalSpend: 0,
  mobilePaySpend: 0,
  diningSpend: 0,
  hasRefund: false,
  totalRefundSpend: 0,
  mobileRefundSpend: 0,
  diningRefundSpend: 0,
  forceThreshold: true,
});

export default function PulseLiquidFixed() {
  const [activeTab, setActiveTab] = useState('monthly');
  const [activities, setActivities] = useState({ ryc: true, mobilePay: true, dining: true });
  const [includePendingDining, setIncludePendingDining] = useState(false);
  const [deductPendingClawback, setDeductPendingClawback] = useState(() => {
    try {
      return localStorage.getItem('pulse-deduct-pending-clawback') === '1';
    } catch {
      return false;
    }
  });
  const [calcMode, setCalcMode] = useState(() => {
    try {
      return localStorage.getItem('pulse-calc-mode') || 'reconcile';
    } catch {
      return 'reconcile';
    }
  });
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem('pulse-theme-mode') || 'system';
    } catch {
      return 'system';
    }
  });
  const [resolvedTheme, setResolvedTheme] = useState('light');
  const [months, setMonths] = useState([createMonthRecord(1)]);
  const [yearly, setYearly] = useState(createYearlyRecord());

  const result = useMemo(
    () =>
      calculate(
        activeTab,
        activities,
        activeTab === 'monthly' ? months : yearly,
        { includePendingDining, calcMode }
      ),
    [activeTab, activities, months, yearly, includePendingDining, calcMode]
  );

  const addMonth = () => setMonths([...months, createMonthRecord()]);
  const removeMonth = (id) => setMonths(months.filter(m => m.id !== id));
  const updateMonth = (id, field, val) => setMonths(months.map(m => m.id === id ? { ...m, [field]: val } : m));

  const replaceMonthsFromImport = (importedMonths) => {
    if (!importedMonths.length) return;
    setMonths(importedMonths);
    setActiveTab('monthly');
  };

  const appendMonthsFromImport = (importedMonths) => {
    if (!importedMonths.length) return;
    setMonths((prev) => [...prev, ...importedMonths]);
    setActiveTab('monthly');
  };

  const handleResetInputs = () => {
    const confirmed = window.confirm('确认重置所有输入数据？这不会改变主题、计算模式和奖励配置。');
    if (!confirmed) return;

    setMonths([createMonthRecord(1)]);
    setYearly(createYearlyRecord());
  };

  const displayedTotalRc = result.totalRc - (deductPendingClawback ? result.pendingClawbackTotal : 0);
  const displayedAsiaMiles = displayedTotalRc * CONSTANTS.RC_TO_ASIAMILES;
  const displayedReturnRate = result.totalSpend > 0 ? (displayedTotalRc / result.totalSpend) * 100 : 0;

  useEffect(() => {
    const matcher = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = themeMode === 'dark' || (themeMode === 'system' && matcher.matches);
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
      setResolvedTheme(isDark ? 'dark' : 'light');
    };

    applyTheme();

    if (themeMode === 'system') {
      matcher.addEventListener('change', applyTheme);
      return () => matcher.removeEventListener('change', applyTheme);
    }

    return undefined;
  }, [themeMode]);

  useEffect(() => {
    try {
      localStorage.setItem('pulse-calc-mode', calcMode);
    } catch (error) {
      void error;
    }
  }, [calcMode]);

  useEffect(() => {
    try {
      localStorage.setItem('pulse-deduct-pending-clawback', deductPendingClawback ? '1' : '0');
    } catch (error) {
      void error;
    }
  }, [deductPendingClawback]);

  useEffect(() => {
    try {
      localStorage.setItem('pulse-theme-mode', themeMode);
    } catch (error) {
      void error;
    }
  }, [themeMode]);

  // 动态注入 theme-color meta 标签，让 Safari 地址栏跟随主题
  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = resolvedTheme === 'dark' ? '#000000' : '#F5F5F7';
  }, [resolvedTheme]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-black text-gray-900 dark:text-gray-100 font-sans selection:bg-red-100 dark:selection:bg-red-900 pb-32 overflow-x-hidden relative transition-colors duration-500">
      <GlobalStyles />
      
      {/* 动态背景光 (Living Ambient) - 调暗了深色模式下的透明度，使其在纯黑背景下更自然 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
         <div className="animate-blob absolute top-[-10%] left-[20%] w-[300px] md:w-[800px] h-[300px] md:h-[800px] bg-indigo-300/30 dark:bg-indigo-900/10 rounded-full blur-[80px] md:blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
         <div className="animate-blob animation-delay-2000 absolute top-[10%] right-[-10%] w-[250px] md:w-[600px] h-[250px] md:h-[600px] bg-red-200/30 dark:bg-red-900/10 rounded-full blur-[80px] md:blur-[100px] mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
         <div className="animate-blob animation-delay-4000 absolute bottom-[10%] left-[10%] w-[250px] md:w-[600px] h-[250px] md:h-[600px] bg-purple-200/30 dark:bg-purple-900/10 rounded-full blur-[80px] md:blur-[100px] mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
      </div>

      {/* 悬浮导航栏 */}
      <nav className="fixed top-4 md:top-6 left-0 right-0 z-50 px-4 flex justify-center">
        <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl rounded-[1.4rem] md:rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-white/40 dark:border-white/10 px-3 py-2 md:px-6 md:py-3 flex flex-col items-center gap-2 w-full max-w-[390px] md:max-w-[680px] transition-all duration-300">
          <div className="flex items-center justify-center gap-2 min-w-0 w-full md:w-auto">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black shadow-lg">
               <div className="scale-75"><Icons.Diamond /></div>
            </div>
            <span className="font-bold text-sm md:text-lg tracking-tight text-gray-900 dark:text-white leading-tight">
              HSBC Pulse <span className="text-[#db0011] dark:text-[#ff4d4d]">Calculator</span>
            </span>
          </div>

          <div className="w-full flex justify-center">
            <div className="bg-gray-100/50 dark:bg-white/10 p-1 rounded-full flex backdrop-blur-md w-full md:w-[360px]">
              {['monthly', 'yearly'].map(t => (
                <button 
                  key={t} 
                  onClick={() => setActiveTab(t)} 
                  className={`
                    flex-1 px-2.5 py-1.5 md:px-6 md:py-2.5 rounded-full text-[10px] md:text-xs font-bold transition-all duration-300 min-w-0 text-center
                    ${activeTab === t 
                      ? 'bg-white dark:bg-gray-800 text-black dark:text-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]' 
                      : 'text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                    }
                  `}
                >
                  {t === 'monthly' ? '按月' : '按年'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-4 pt-36 md:pt-28 space-y-8 md:space-y-12">
        
        {/* 卡片区 */}
        <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          <PulseBlackCard />
        </section>

        <section className="bg-white/30 dark:bg-white/5 backdrop-blur-xl rounded-3xl px-5 py-4 border border-white/20 dark:border-white/10">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">计算模式说明</div>

            <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <div className="rounded-full px-4 py-2.5 bg-white/75 dark:bg-black/35 border border-white/40 dark:border-white/10 text-sm font-bold text-gray-700 dark:text-gray-200 text-center">
                  {calcMode === 'reconcile' ? '对账' : '估算'}
                </div>
                <select
                  value={calcMode}
                  onChange={(event) => setCalcMode(event.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="计算模式"
                >
                  <option value="reconcile">对账</option>
                  <option value="estimate">估算</option>
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-300">▾</span>
              </div>

              <div className="relative">
                <div className="rounded-full px-4 py-2.5 bg-white/75 dark:bg-black/35 border border-white/40 dark:border-white/10 text-sm font-bold text-gray-700 dark:text-gray-200 text-center">
                  主题
                </div>
                <select
                  value={themeMode}
                  onChange={(event) => setThemeMode(event.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="主题"
                >
                  <option value="system">自动</option>
                  <option value="dark">深色</option>
                  <option value="light">浅色</option>
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-300">▾</span>
              </div>
            </div>

            <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed space-y-1.5 max-w-3xl mx-auto">
              <div>
                <span className="font-semibold text-emerald-600 dark:text-emerald-300">对账模式</span>：更接近 HSBC 的算法，RC 数量更准确。
              </div>
              <div>
                <span className="font-semibold text-amber-600 dark:text-amber-300">估算模式</span>：直接按百分比计算，结果可能有误差。
              </div>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              建议优先按月精准计算；按年计算在存在内地餐饮消费时会有误差。
            </div>
          </div>
        </section>

        {/* 核心配置 */}
        <section className="bg-white/30 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.01)] border border-white/20 dark:border-white/5 transition-colors">
           <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-1">
             <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
               <Icons.Settings />
               <span>奖励系数配置</span>
             </h3>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              {[
                 { key: 'mobilePay', label: '移动支付', sub: '默认开启（无需注册）', locked: true },
                 { key: 'ryc', label: '赏世界 RYC', sub: '5X 积分 / 年限10万' },
                 { key: 'dining', label: '内地餐饮', sub: '3%+2% / 月限2千' }
               ].map(item => (
                 <div key={item.key} className="flex flex-col gap-3 p-4 md:p-5 rounded-[1.5rem] bg-white/40 dark:bg-white/5 transition-all hover:bg-white/60 dark:hover:bg-white/10 hover:shadow-lg hover:-translate-y-1 duration-300 border border-transparent hover:border-white/40 dark:hover:border-white/10">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-gray-800 dark:text-gray-200 text-sm">{item.label}</div>
                      <Toggle
                        checked={item.locked ? true : activities[item.key]}
                        disabled={Boolean(item.locked)}
                        onChange={v => setActivities({...activities, [item.key]: v})}
                      />
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium bg-white/30 dark:bg-black/20 self-start px-2 py-1 rounded-md">{item.sub}</div>
                 </div>
               ))}
           </div>
        </section>

        {/* 输入区域 */}
        <section className="space-y-6">
           {activeTab === 'monthly' ? (
             <div className="space-y-6">
               {months.map((m, idx) => (
                  <div key={m.id} className="relative animate-in slide-in-from-bottom-4 fade-in duration-500">
                     <div className="bg-white/30 dark:bg-white/5 backdrop-blur-2xl rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all hover:bg-white/40 dark:hover:bg-white/10 border border-white/20 dark:border-white/5">
                        <div className="flex justify-between items-center mb-6 px-1">
                           <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                             {m.monthKey ? `${m.monthKey} 消费详情` : `${idx + 1} 月消费详情`}
                           </span>
                           <button onClick={() => removeMonth(m.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors p-2"><Icons.Trash /></button>
                        </div>
                        <div className="space-y-4 md:space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-10 gap-4 md:gap-6">
                             <div className="md:col-span-4"><LiquidInput label="当月总消费" value={m.totalSpend} onChange={v => updateMonth(m.id, 'totalSpend', v)} /></div>
                             <div className="md:col-span-3"><LiquidInput label="移动支付" subLabel={activities.mobilePay ? "封顶8w" : null} disabled={!activities.mobilePay} value={m.mobilePaySpend} onChange={v => updateMonth(m.id, 'mobilePaySpend', v)} /></div>
                             <div className="md:col-span-3"><LiquidInput label="内地餐饮" subLabel={activities.dining ? "封顶2k" : null} disabled={!activities.dining} value={m.diningSpend} onChange={v => updateMonth(m.id, 'diningSpend', v)} /></div>
                          </div>
                          <div
                            className={`
                              flex items-center justify-between gap-4 p-4 rounded-3xl transition-all
                              ${m.hasRefund ? 'bg-amber-50/80 dark:bg-amber-900/20' : 'bg-transparent hover:bg-white/30 dark:hover:bg-white/5'}
                            `}
                          >
                            <div className="flex flex-col">
                              <span className={`text-sm font-bold transition-colors ${m.hasRefund ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'}`}>本月有退款</span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">开启后填写退款金额并计入待扣回 RC</span>
                            </div>
                            <Toggle checked={Boolean(m.hasRefund)} onChange={(v) => updateMonth(m.id, 'hasRefund', v)} />
                          </div>
                          {m.hasRefund && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                              <LiquidInput
                                label="当月总退款"
                                subLabel="用于待扣回"
                                value={m.totalRefundSpend}
                                onChange={v => updateMonth(m.id, 'totalRefundSpend', v)}
                              />
                              <LiquidInput
                                label="移动支付退款"
                                subLabel={activities.mobilePay ? "用于Mobile待扣回" : null}
                                disabled={!activities.mobilePay}
                                value={m.mobileRefundSpend}
                                onChange={v => updateMonth(m.id, 'mobileRefundSpend', v)}
                              />
                              <LiquidInput
                                label="内地餐饮退款"
                                subLabel={activities.dining ? "用于Dining待扣回" : null}
                                disabled={!activities.dining}
                                value={m.diningRefundSpend}
                                onChange={v => updateMonth(m.id, 'diningRefundSpend', v)}
                              />
                            </div>
                          )}
                        </div>
                     </div>
                  </div>
               ))}
               <button onClick={addMonth} className="w-full py-5 md:py-6 rounded-[2rem] md:rounded-[2.5rem] bg-white/20 dark:bg-white/5 border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 font-bold hover:bg-white/40 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-all flex items-center justify-center gap-2 group">
                  <div className="bg-gray-200/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 rounded-full w-8 h-8 flex items-center justify-center group-hover:bg-gray-300 dark:group-hover:bg-gray-600 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"><Icons.Plus /></div>
                  <span>添加更多月份</span>
               </button>
             </div>
           ) : (
             <div className="bg-white/30 dark:bg-white/5 backdrop-blur-2xl rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-[0_4px_30px_rgba(0,0,0,0.02)] animate-in fade-in border border-white/20 dark:border-white/5">
               <div className="flex items-center gap-3 mb-8 md:mb-10 px-1">
                 <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]"></div>
                 <h3 className="text-xs md:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">年度均摊预估</h3>
               </div>
               
               <div className="space-y-6 md:space-y-8">
                  <LiquidInput label="全年总消费" value={yearly.totalSpend} onChange={v => setYearly({...yearly, totalSpend: v})} />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                     <LiquidInput label="移动/二维码" subLabel="年限80,000" disabled={!activities.mobilePay} value={yearly.mobilePaySpend} onChange={v => setYearly({...yearly, mobilePaySpend: v})} />
                     
                     <div className="space-y-4">
                        <LiquidInput label="内地餐饮" subLabel="年限24,000" disabled={!activities.dining} value={yearly.diningSpend} onChange={v => setYearly({...yearly, diningSpend: v})} />
                        
                        {activities.dining && (
                          <div 
                            onClick={() => setYearly({...yearly, forceThreshold: !yearly.forceThreshold})}
                            className={`
                              flex items-center gap-4 p-4 rounded-3xl cursor-pointer transition-all
                              ${yearly.forceThreshold ? 'bg-blue-50/80 dark:bg-blue-900/30' : 'bg-transparent hover:bg-white/30 dark:hover:bg-white/5'}
                            `}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${yearly.forceThreshold ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-200 dark:bg-gray-700'}`}>
                              {yearly.forceThreshold && <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                            </div>
                            <div className="flex flex-col">
                              <span className={`text-sm font-bold transition-colors ${yearly.forceThreshold ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>假设每月均达标</span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">单月消费 ≥ 1200元</span>
                            </div>
                          </div>
                        )}
                     </div>
                  </div>

                  <div
                    className={`
                      flex items-center justify-between gap-4 p-4 rounded-3xl transition-all
                      ${yearly.hasRefund ? 'bg-amber-50/80 dark:bg-amber-900/20' : 'bg-transparent hover:bg-white/30 dark:hover:bg-white/5'}
                    `}
                  >
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold transition-colors ${yearly.hasRefund ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'}`}>全年有退款</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">开启后填写退款金额并计入待扣回 RC</span>
                    </div>
                    <Toggle checked={Boolean(yearly.hasRefund)} onChange={(v) => setYearly({...yearly, hasRefund: v})} />
                  </div>

                  {yearly.hasRefund && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                      <LiquidInput
                        label="全年总退款"
                        subLabel="用于待扣回"
                        value={yearly.totalRefundSpend}
                        onChange={v => setYearly({...yearly, totalRefundSpend: v})}
                      />
                      <LiquidInput
                        label="全年移动退款"
                        subLabel={activities.mobilePay ? "用于Mobile待扣回" : null}
                        disabled={!activities.mobilePay}
                        value={yearly.mobileRefundSpend}
                        onChange={v => setYearly({...yearly, mobileRefundSpend: v})}
                      />
                      <LiquidInput
                        label="全年餐饮退款"
                        subLabel={activities.dining ? "用于Dining待扣回" : null}
                        disabled={!activities.dining}
                        value={yearly.diningRefundSpend}
                        onChange={v => setYearly({...yearly, diningRefundSpend: v})}
                      />
                    </div>
                  )}
               </div>
             </div>
           )}
        </section>

        <section>
          <button
            type="button"
            onClick={handleResetInputs}
            className="w-full py-4 md:py-5 rounded-[1.5rem] md:rounded-[2rem] bg-gradient-to-r from-red-600 to-[#db0011] text-white font-bold text-sm md:text-base shadow-[0_12px_30px_-12px_rgba(219,0,17,0.8)] hover:opacity-95 transition-opacity"
          >
            一键重置输入数据
          </button>
        </section>

        <SmartImportPanel
          onReplaceMonths={replaceMonthsFromImport}
          onAppendMonths={appendMonthsFromImport}
        />

        {/* 黑色汇总卡片 */}
        <section>
          <div className="relative overflow-hidden rounded-[2rem] md:rounded-[3rem] bg-[#050505] dark:bg-black text-white p-6 md:p-14 shadow-2xl shadow-gray-900/30 dark:shadow-white/5 ring-1 ring-white/10">
             <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#db0011]/10 rounded-full blur-[150px] pointer-events-none mix-blend-screen"></div>
             
             <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16">
               <div className="flex flex-col justify-between">
                 <div className="space-y-4">
                    <div className="text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-4">
                      {calcMode === 'reconcile' ? '总奖励（对账） Total Reconciled Rewards' : '总奖励（估算） Total Estimated Rewards'}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {calcMode === 'reconcile'
                        ? '对账模式：Base/RYC/移动支付按每 RMB 250 阶梯计 RC；餐饮按活动期汇总取整。'
                        : '估算模式：沿用连续百分比估算，便于快速粗算。'}
                    </div>
                    {activities.dining && (
                      <div className="text-[10px] text-gray-500">
                        {includePendingDining ? '已计入待定餐饮 RC' : '未计入待定餐饮 RC（默认）'}
                      </div>
                    )}
                    {calcMode === 'reconcile' && result.pendingClawbackTotal > 0 && (
                      <div className="text-[10px] text-gray-500">
                        {deductPendingClawback ? '总 RC 已扣除待扣回值' : '总 RC 目前未扣除待扣回值'}
                      </div>
                    )}
                    <div className="flex items-baseline gap-2 md:gap-3 flex-wrap">
                       <span className="text-6xl md:text-8xl font-bold tracking-tighter text-white">{displayedTotalRc.toFixed(0)}</span>
                       <span className="text-2xl md:text-3xl text-gray-600 font-light tracking-tight">.{displayedTotalRc.toFixed(2).split('.')[1]} <span className="text-lg md:text-xl font-bold text-gray-700">RC</span></span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 md:gap-6 mt-8 md:mt-12 lg:mt-0">
                     <div className="p-4 md:p-6 rounded-2xl md:rounded-[2rem] bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                       <div className="text-xl md:text-3xl font-bold tracking-tight text-gray-100">{displayedAsiaMiles.toLocaleString()}</div>
                       <div className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Asia Miles</div>
                     </div>
                     <div className="p-4 md:p-6 rounded-2xl md:rounded-[2rem] bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                       <div className="text-xl md:text-3xl font-bold tracking-tight text-gray-100">{displayedReturnRate.toFixed(2)}%</div>
                       <div className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Return Rate</div>
                     </div>
                  </div>
               </div>

               <div className="flex flex-col justify-center gap-8 pl-0 lg:pl-10 border-l-0 lg:border-l border-white/5 pt-8 lg:pt-0 border-t lg:border-t-0 border-white/5">
                  <div className="space-y-6 md:space-y-8">
                    {activities.ryc && <ProgressBar label="赏世界 (RYC)" used={result.rycUsed} cap={CONSTANTS.RYC_CAP_RMB} />}
                    {activities.mobilePay && <ProgressBar label="移动支付 (Mobile)" used={result.mpUsed} cap={CONSTANTS.MP_CAP_RMB} />}
                    {activities.dining && <ProgressBar label="内地餐饮 (Dining)" used={result.diningUsed} cap={CONSTANTS.DINING_YEARLY_CAP_SPEND} />}
                  </div>
                  {activities.dining && (
                    <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-gray-500">待定内地餐饮 RC</div>
                          <div className="text-xl font-bold text-orange-300 font-mono">
                            {result.rcDiningPending.toFixed(0)}
                          </div>
                        </div>
                        <Toggle checked={includePendingDining} onChange={setIncludePendingDining} />
                      </div>
                      <div className="text-[10px] text-gray-500 leading-relaxed">
                        默认不计入总 RC。对账模式下按活动期汇总后取整（向上取整），并作为延后入账估算。
                      </div>
                      {calcMode === 'reconcile' && (
                        <div className="text-[10px] text-gray-500 leading-relaxed">
                          原始值 {result.rcDiningPendingRaw.toFixed(2)} RC，活动期取整后 {result.rcDiningPending.toFixed(0)} RC。
                        </div>
                      )}
                      <div className="text-[10px] text-gray-500 leading-relaxed">
                        打开开关后会把该待定值并入总 RC。
                      </div>
                    </div>
                  )}
                  {calcMode === 'reconcile' && result.pendingClawbackTotal > 0 && (
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-300/20 px-4 py-4 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-amber-300">
                            待扣回 RC
                          </div>
                          <div className="text-[10px] text-amber-100/80">
                            默认关闭；开启后总 RC 会减去待扣回数量。
                          </div>
                        </div>
                        <Toggle checked={deductPendingClawback} onChange={setDeductPendingClawback} />
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-[10px] text-amber-100 font-mono">
                        <div>Base<br/><span className="text-sm font-bold">{result.pendingBaseClawback}</span></div>
                        <div>RYC<br/><span className="text-sm font-bold">{result.pendingRycClawback}</span></div>
                        <div>Mobile<br/><span className="text-sm font-bold">{result.pendingMobileClawback}</span></div>
                        <div>Total<br/><span className="text-sm font-bold">{result.pendingClawbackTotal}</span></div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2 md:gap-4 text-[9px] md:text-[10px] text-gray-600 pt-8 border-t border-white/5 font-mono uppercase tracking-widest">
                     <div>Base<br/><span className="text-white text-sm md:text-base tracking-normal">{result.rcBase.toFixed(0)}</span></div>
                     {activities.ryc && <div>RYC<br/><span className="text-[#ff4d4d] text-sm md:text-base tracking-normal">{result.rcRyc.toFixed(0)}</span></div>}
                     {activities.mobilePay && <div>Mobile<br/><span className="text-[#ff4d4d] text-sm md:text-base tracking-normal">{result.rcMobile.toFixed(0)}</span></div>}
                     {activities.dining && <div>Dining<br/><span className="text-orange-400 text-sm md:text-base tracking-normal">{result.rcDiningIncluded.toFixed(0)}</span></div>}
                  </div>
               </div>
             </div>
          </div>
        </section>

      </main>
    </div>
  );
}
