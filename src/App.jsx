
import React, { useState, useEffect, useMemo, useRef } from 'react';

// ==================== 常量定义 ====================
const CONSTANTS = {
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
  <div className="relative w-full aspect-[1.586/1] max-w-[340px] rounded-2xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] mx-auto transform hover:scale-[1.02] transition-transform duration-500">
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
    <div className="relative z-10 p-6 flex flex-col justify-between h-full font-sans">
      <div className="flex justify-between items-start">
        <div className="mt-8 ml-2">
           <div className="w-12 h-9 rounded bg-gradient-to-br from-[#eecda3] to-[#dbb688] shadow-inner opacity-90"></div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2 mb-1">
             <div className="relative w-8 h-5">
                <div className="absolute left-0 top-0 border-l-[10px] border-r-[10px] border-b-[10px] border-l-transparent border-r-transparent border-b-[#db0011]"></div>
                <div className="absolute right-0 bottom-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-[#db0011]"></div>
             </div>
             <span className="text-white font-bold text-lg tracking-wide">HSBC</span>
          </div>
          <div className="text-[10px] text-gray-400 font-medium tracking-wide flex flex-col items-end">
             <span>Pulse | HKD : RMB</span>
             <div className="flex items-center gap-1 mt-1">
                <span className="text-white/90 border border-white/30 px-1 rounded-[2px] text-[9px] bg-white/10 backdrop-blur-sm">DIAMOND</span>
                <Icons.Wifi />
             </div>
          </div>
        </div>
      </div>
      <div className="mt-2">
         <div className="text-xl md:text-2xl text-transparent bg-clip-text bg-gradient-to-b from-gray-100 to-gray-400 font-mono tracking-widest shadow-black drop-shadow-md">
           6250 9888 8888 8888
         </div>
         <div className="flex justify-center gap-1 text-[9px] text-gray-300 font-mono mt-1">
            <span className="text-[7px] self-center">VALID<br/>THRU</span>
            <span className="text-sm self-center">12/27</span>
         </div>
      </div>
      <div className="flex justify-between items-end">
        <div className="text-gray-300 font-mono text-sm tracking-widest uppercase shadow-black drop-shadow-sm">
          VIC P LEE
        </div>
        <div className="w-12 h-8 bg-gradient-to-r from-gray-300 via-white to-gray-300 rounded-[4px] flex items-center justify-center skew-x-[-10deg] shadow-lg relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10"></div>
             <div className="flex flex-col items-end leading-none transform skew-x-[10deg] pr-1">
                <span className="text-[10px] font-bold text-gray-800 italic">UnionPay</span>
                <span className="text-[8px] font-bold text-gray-800">银联</span>
             </div>
        </div>
      </div>
    </div>
  </div>
);

// ==================== Liquid Input Component (无边框终极版) ====================
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

  return (
    <div 
      className={`
        group relative rounded-3xl transition-all duration-500 ease-out
        ${disabled ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-text'}
        /* 核心修改：移除所有 border 和 ring，完全使用 shadow 和 bg 混合 */
        ${isFocused 
          ? 'bg-white shadow-[0_15px_40px_-10px_rgba(0,0,0,0.1)] translate-y-[-2px]' 
          : 'bg-white/40 hover:bg-white/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]'
        }
      `}
      onClick={() => !disabled && inputRef.current.focus()}
    >
      {/* 动态光晕背景：仅在Focus时出现，极为柔和 */}
      <div 
        className={`absolute inset-0 rounded-3xl bg-gradient-to-r from-red-500/5 to-purple-500/5 blur-xl transition-opacity duration-700 pointer-events-none 
        ${isFocused ? 'opacity-100' : 'opacity-0'}`} 
      />

      <div className="relative z-10 px-6 py-5 flex flex-col h-26 justify-center">
        {/* Label Row */}
        <div className="flex justify-between items-center mb-2">
          <label className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isFocused ? 'text-red-500' : 'text-gray-400'}`}>
            {label}
          </label>
          {subLabel && (
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wide transition-colors ${
              disabled ? 'bg-gray-100/50 text-gray-300' : 'bg-red-50 text-red-500/80'
            }`}>
              {subLabel}
            </span>
          )}
        </div>
        
        {/* Input Row */}
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-light transition-colors duration-300 ${isFocused ? 'text-gray-800' : 'text-gray-300'}`}>¥</span>
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
            // 关键：强制 appearance-none 移除原生样式，outline-none 移除聚焦框
            className="w-full bg-transparent border-none outline-none ring-0 appearance-none text-3xl font-bold text-gray-800 placeholder-gray-200/80 p-0 m-0 font-mono tracking-tight"
            style={{ boxShadow: 'none' }} // Double ensure no shadow on input element
          />
        </div>
      </div>
    </div>
  );
};

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`
      relative w-11 h-6 rounded-full transition-all duration-500 ease-out 
      ${checked ? 'bg-[#db0011] shadow-[0_2px_8px_rgba(219,0,17,0.4)]' : 'bg-gray-200/80'}
    `}
  >
    <div className={`
      absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)
      ${checked ? 'translate-x-6' : 'translate-x-1'}
    `} />
  </button>
);

const ProgressBar = ({ label, used, cap }) => {
  const percentage = Math.min((used / cap) * 100, 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-bold text-white font-mono">{percentage.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-[#db0011] to-[#ff4d4d] shadow-[0_0_15px_rgba(219,0,17,0.8)] relative" 
          style={{ width: `${percentage}%` }}
        >
        </div>
      </div>
      <div className="text-right text-[10px] text-gray-500 font-mono tracking-tight">
        <span className="text-gray-400">{used.toLocaleString()}</span> / {cap.toLocaleString()}
      </div>
    </div>
  );
};

// ==================== Main App ====================

function calculate(mode, activities, inputData) {
  let totalRc = 0, totalSpend = 0;
  let rcBase = 0, rcRyc = 0, rcMobile = 0, rcDining = 0;
  let rycUsed = 0, mpUsed = 0, diningUsed = 0;

  if (mode === 'monthly') {
    inputData.forEach(m => {
      const base = m.totalSpend * CONSTANTS.BASE_RATE;
      rcBase += base; totalSpend += m.totalSpend;

      if (activities.ryc) {
        const remaining = Math.max(0, CONSTANTS.RYC_CAP_RMB - rycUsed);
        const eligible = Math.min(m.totalSpend, remaining);
        rcRyc += eligible * CONSTANTS.RYC_RATE; rycUsed += eligible;
      }
      if (activities.mobilePay) {
        const remaining = Math.max(0, CONSTANTS.MP_CAP_RMB - mpUsed);
        const eligible = Math.min(m.mobilePaySpend, remaining);
        rcMobile += eligible * CONSTANTS.MP_RATE; mpUsed += eligible;
      }
      if (activities.dining && m.diningSpend > 0) {
        if (m.totalSpend >= CONSTANTS.DINING_THRESHOLD_RMB) {
          diningUsed += Math.min(m.diningSpend, CONSTANTS.DINING_MONTHLY_CAP_SPEND);
          rcDining += (Math.min(m.diningSpend * CONSTANTS.DINING_A_RATE, CONSTANTS.DINING_A_CAP) + Math.min(m.diningSpend * CONSTANTS.DINING_B_RATE, CONSTANTS.DINING_B_CAP));
        }
      }
    });
  } else {
    const y = inputData;
    totalSpend = y.totalSpend;
    rcBase = totalSpend * CONSTANTS.BASE_RATE;

    if (activities.ryc) {
      rycUsed = Math.min(totalSpend, CONSTANTS.RYC_CAP_RMB);
      rcRyc = rycUsed * CONSTANTS.RYC_RATE;
    }
    if (activities.mobilePay) {
      mpUsed = Math.min(y.mobilePaySpend, CONSTANTS.MP_CAP_RMB);
      rcMobile = mpUsed * CONSTANTS.MP_RATE;
    }
    if (activities.dining && y.diningSpend > 0) {
      diningUsed = Math.min(y.diningSpend, CONSTANTS.DINING_YEARLY_CAP_SPEND);
      const avgTotal = totalSpend / 12;
      const avgDining = y.diningSpend / 12;
      if (y.forceThreshold || avgTotal >= CONSTANTS.DINING_THRESHOLD_RMB) {
         rcDining = (Math.min(avgDining * CONSTANTS.DINING_A_RATE, CONSTANTS.DINING_A_CAP) + Math.min(avgDining * CONSTANTS.DINING_B_RATE, CONSTANTS.DINING_B_CAP)) * 12;
      }
    }
  }
  totalRc = rcBase + rcRyc + rcMobile + rcDining;
  return { totalRc, totalSpend, rcBase, rcRyc, rcMobile, rcDining, rycUsed, mpUsed, diningUsed, asiaMiles: totalRc * CONSTANTS.RC_TO_ASIAMILES, returnRate: totalSpend > 0 ? (totalRc / totalSpend) * 100 : 0 };
}

export default function PulseLiquidNoBorder() {
  const [activeTab, setActiveTab] = useState('monthly');
  const [activities, setActivities] = useState({ ryc: true, mobilePay: true, dining: true });
  const [months, setMonths] = useState([{ id: 1, totalSpend: 0, mobilePaySpend: 0, diningSpend: 0 }]);
  const [yearly, setYearly] = useState({ totalSpend: 0, mobilePaySpend: 0, diningSpend: 0, forceThreshold: true });

  const result = useMemo(() => calculate(activeTab, activities, activeTab === 'monthly' ? months : yearly), [activeTab, activities, months, yearly]);

  const addMonth = () => setMonths([...months, { id: Date.now(), totalSpend: 0, mobilePaySpend: 0, diningSpend: 0 }]);
  const removeMonth = (id) => setMonths(months.filter(m => m.id !== id));
  const updateMonth = (id, field, val) => setMonths(months.map(m => m.id === id ? { ...m, [field]: val } : m));

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-gray-900 font-sans selection:bg-red-100 pb-32">
      
      {/* 动态背景光 (Soft Ambient) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-[-20%] left-[10%] w-[1000px] h-[1000px] bg-indigo-200/20 rounded-full blur-[150px] mix-blend-multiply opacity-50"></div>
         <div className="absolute top-[10%] right-[-10%] w-[800px] h-[800px] bg-red-200/20 rounded-full blur-[150px] mix-blend-multiply opacity-50"></div>
      </div>

      {/* 悬浮导航栏 (Floating Island) */}
      <nav className="fixed top-6 left-0 right-0 z-50 px-4 flex justify-center">
        <div className="bg-white/70 backdrop-blur-2xl rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-white/40 pl-6 pr-2 py-2 flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white shadow-lg">
               <div className="scale-75"><Icons.Diamond /></div>
            </div>
            <span className="font-bold text-lg tracking-tight text-gray-900">Pulse <span className="text-[#db0011]">Calculator</span></span>
          </div>
          
          <div className="bg-gray-100/50 p-1 rounded-full flex backdrop-blur-md">
            {['monthly', 'yearly'].map(t => (
              <button 
                key={t} 
                onClick={() => setActiveTab(t)} 
                className={`
                  px-6 py-2.5 rounded-full text-xs font-bold transition-all duration-300
                  ${activeTab === t 
                    ? 'bg-white text-black shadow-[0_4px_12px_rgba(0,0,0,0.08)]' 
                    : 'text-gray-400 hover:text-gray-600'
                  }
                `}
              >
                {t === 'monthly' ? '按月' : '按年'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-4 pt-32 space-y-12">
        
        {/* 卡片区 */}
        <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          <PulseBlackCard />
        </section>

        {/* 核心配置 (Liquid Glass Panel) - 移除所有 border */}
        <section className="bg-white/30 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.01)]">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2 px-1">
             <Icons.Settings />
             <span>奖励系数配置</span>
           </h3>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                 { key: 'ryc', label: '赏世界 RYC', sub: '5X 积分 / 年限10万' },
                 { key: 'mobilePay', label: '移动支付', sub: '5X 积分 / 年限8万' },
                 { key: 'dining', label: '内地餐饮', sub: '3%+2% / 月限2千' }
               ].map(item => (
                 <div key={item.key} className="flex flex-col gap-3 p-5 rounded-[1.5rem] bg-white/40 transition-all hover:bg-white/60 hover:shadow-lg hover:-translate-y-1 duration-300">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-gray-800 text-sm">{item.label}</div>
                      <Toggle checked={activities[item.key]} onChange={v => setActivities({...activities, [item.key]: v})} />
                    </div>
                    <div className="text-[10px] text-gray-500 font-medium bg-white/30 self-start px-2 py-1 rounded-md">{item.sub}</div>
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
                     {/* 容器移除所有 border */}
                     <div className="bg-white/30 backdrop-blur-2xl rounded-[2.5rem] p-8 shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all hover:bg-white/40">
                        <div className="flex justify-between items-center mb-6 px-1">
                           <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                             {idx + 1} 月消费详情
                           </span>
                           <button onClick={() => removeMonth(m.id)} className="text-gray-300 hover:text-red-500 transition-colors p-2"><Icons.Trash /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-10 gap-6">
                           <div className="md:col-span-4"><LiquidInput label="当月总消费" value={m.totalSpend} onChange={v => updateMonth(m.id, 'totalSpend', v)} /></div>
                           <div className="md:col-span-3"><LiquidInput label="餐饮消费" subLabel={activities.dining ? "封顶2k" : null} disabled={!activities.dining} value={m.diningSpend} onChange={v => updateMonth(m.id, 'diningSpend', v)} /></div>
                           <div className="md:col-span-3"><LiquidInput label="移动支付" subLabel={activities.mobilePay ? "封顶8w" : null} disabled={!activities.mobilePay} value={m.mobilePaySpend} onChange={v => updateMonth(m.id, 'mobilePaySpend', v)} /></div>
                        </div>
                     </div>
                  </div>
               ))}
               <button onClick={addMonth} className="w-full py-6 rounded-[2.5rem] bg-white/20 border-2 border-dashed border-gray-200 text-gray-400 font-bold hover:bg-white/40 hover:border-gray-300 hover:text-gray-600 transition-all flex items-center justify-center gap-2 group">
                  <div className="bg-gray-200/50 text-gray-500 rounded-full w-8 h-8 flex items-center justify-center group-hover:bg-gray-300 group-hover:text-gray-700 transition-colors"><Icons.Plus /></div>
                  <span>添加更多月份</span>
               </button>
             </div>
           ) : (
             <div className="bg-white/30 backdrop-blur-2xl rounded-[3rem] p-10 shadow-[0_4px_30px_rgba(0,0,0,0.02)] animate-in fade-in">
               <div className="flex items-center gap-3 mb-10 px-1">
                 <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]"></div>
                 <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">年度均摊预估</h3>
               </div>
               
               <div className="space-y-8">
                  <LiquidInput label="全年总消费" value={yearly.totalSpend} onChange={v => setYearly({...yearly, totalSpend: v})} />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <LiquidInput label="移动/二维码" subLabel="年限80,000" disabled={!activities.mobilePay} value={yearly.mobilePaySpend} onChange={v => setYearly({...yearly, mobilePaySpend: v})} />
                     
                     <div className="space-y-4">
                        <LiquidInput label="内地餐饮" subLabel="年限24,000" disabled={!activities.dining} value={yearly.diningSpend} onChange={v => setYearly({...yearly, diningSpend: v})} />
                        
                        {activities.dining && (
                          <div 
                            onClick={() => setYearly({...yearly, forceThreshold: !yearly.forceThreshold})}
                            className={`
                              flex items-center gap-4 p-4 rounded-3xl cursor-pointer transition-all
                              ${yearly.forceThreshold ? 'bg-blue-50/80' : 'bg-transparent hover:bg-white/30'}
                            `}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${yearly.forceThreshold ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-200'}`}>
                              {yearly.forceThreshold && <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                            </div>
                            <div className="flex flex-col">
                              <span className={`text-sm font-bold transition-colors ${yearly.forceThreshold ? 'text-blue-700' : 'text-gray-500'}`}>假设每月均达标</span>
                              <span className="text-[10px] text-gray-400">单月消费 ≥ 1200元</span>
                            </div>
                          </div>
                        )}
                     </div>
                  </div>
               </div>
             </div>
           )}
        </section>

        {/* 黑色汇总卡片 (Black Diamond) */}
        <section>
          <div className="relative overflow-hidden rounded-[3rem] bg-[#050505] text-white p-10 md:p-14 shadow-2xl shadow-gray-900/30">
             <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#db0011]/10 rounded-full blur-[150px] pointer-events-none mix-blend-screen"></div>
             
             <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16">
               <div className="flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em] mb-4">Total Estimated Rewards</div>
                    <div className="flex items-baseline gap-3">
                       <span className="text-8xl font-bold tracking-tighter text-white">{result.totalRc.toFixed(0)}</span>
                       <span className="text-3xl text-gray-600 font-light tracking-tight">.{result.totalRc.toFixed(2).split('.')[1]} <span className="text-xl font-bold text-gray-700">RC</span></span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6 mt-12 lg:mt-0">
                     <div className="p-6 rounded-[2rem] bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                       <div className="text-3xl font-bold tracking-tight text-gray-100">{result.asiaMiles.toLocaleString()}</div>
                       <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Asia Miles</div>
                     </div>
                     <div className="p-6 rounded-[2rem] bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                       <div className="text-3xl font-bold tracking-tight text-gray-100">{result.returnRate.toFixed(2)}%</div>
                       <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Return Rate</div>
                     </div>
                  </div>
               </div>

               <div className="flex flex-col justify-center gap-10 pl-0 lg:pl-10 border-l-0 lg:border-l border-white/5">
                  <div className="space-y-8">
                    {activities.ryc && <ProgressBar label="赏世界 (RYC)" used={result.rycUsed} cap={CONSTANTS.RYC_CAP_RMB} />}
                    {activities.mobilePay && <ProgressBar label="移动支付 (Mobile)" used={result.mpUsed} cap={CONSTANTS.MP_CAP_RMB} />}
                    {activities.dining && <ProgressBar label="内地餐饮 (Dining)" used={result.diningUsed} cap={CONSTANTS.DINING_YEARLY_CAP_SPEND} />}
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-[10px] text-gray-600 pt-8 border-t border-white/5 font-mono uppercase tracking-widest">
                     <div>Base<br/><span className="text-white text-base tracking-normal">{result.rcBase.toFixed(0)}</span></div>
                     {activities.ryc && <div>RYC<br/><span className="text-[#ff4d4d] text-base tracking-normal">{result.rcRyc.toFixed(0)}</span></div>}
                     {activities.mobilePay && <div>Mobile<br/><span className="text-[#ff4d4d] text-base tracking-normal">{result.rcMobile.toFixed(0)}</span></div>}
                     {activities.dining && <div>Dining<br/><span className="text-orange-400 text-base tracking-normal">{result.rcDining.toFixed(0)}</span></div>}
                  </div>
               </div>
             </div>
          </div>
        </section>

      </main>
    </div>
  );
}
