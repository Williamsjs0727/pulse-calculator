
# HSBC Pulse 收益计算器 - 产品技术文档

## 1. 产品概述
**HSBC Pulse Calculator** 是一款专为汇丰 Pulse 银联双币钻石信用卡用户设计的收益测算工具。它通过模拟用户的日常消费场景（境外、移动支付、内地餐饮），实时计算“奖赏钱 (RC)”、对应的“亚洲万里通 (Asia Miles)”里程数以及综合回赠率。

**当前版本状态**：
- **版本号**：v2.1 (Dark Mode Fixed)
- **核心修复**：修复了在系统深色模式下，输入框背景与文字同为白色导致不可见的问题。

---

## 2. 核心算法与配置 (Business Logic)

计算逻辑基于以下常量配置（见代码 `CONSTANTS` 对象）：

### 2.1 基础回赠 (Base Reward)
- **比率**：0.4% (即 1X 积分)
- **适用范围**：所有合格签账。
- **无上限**。

### 2.2 赏世界 (RYC - Reward Your World)
- **开关**：可选。
- **比率**：额外 2% (即额外 5X 积分)。
- **上限**：每年首 RMB 100,000 签账。
- **计算逻辑**：`min(总消费, 剩余额度) * 2%`。

### 2.3 移动支付 (Mobile Payments)
- **开关**：可选。
- **比率**：额外 2% (即额外 5X 积分)。
- **上限**：每年首 RMB 80,000 移动支付/二维码签账。
- **计算逻辑**：`min(移动支付消费, 剩余额度) * 2%`。

### 2.4 内地餐饮 (Mainland Dining)
- **开关**：可选。
- **触发门槛**：当月总消费需 $\ge$ RMB 1,200（若未达标，即使有餐饮消费也不计算奖励）。
- **奖励上限**：每月仅计算首 RMB 2,000 餐饮签账。
- **比率结构**：
    - 部分 A (周五六日等): 3% (代码中 `DINING_A_RATE`)
    - 部分 B (其他): 2% (代码中 `DINING_B_RATE`)
    - *注：代码中简化处理，通过 cap 限制计算总和。*

### 2.5 汇总换算
- **RC 总额** = 基础 + 赏世界 + 移动支付 + 餐饮
- **亚洲万里通** = RC 总额 $\times$ 10
- **回赠率** = (RC 总额 / 总消费) $\times$ 100%

---

## 3. 交互模式 (User Interaction)

系统提供两种计算模式，逻辑略有不同：

### 3.1 按月模式 (Monthly Mode)
- **精度**：最高。用户逐月添加消费记录。
- **扣减逻辑**：
    - RYC 和 Mobile 的额度（Cap）会随着月份累加而被消耗。前几个月用完后，后续月份不再享受加成。
    - 餐饮奖励严格判断当月总消费是否 $\ge$ 1200。

### 3.2 按年模式 (Yearly Mode)
- **精度**：估算。用户输入全年总数。
- **假设**：
    - RYC 和 Mobile 直接对比年上限。
    - 餐饮计算假设平均每月消费。
    - **强制达标开关 (Force Threshold)**：提供一个开关，允许用户强制假设每月都达到了 1200 元的门槛（即使平均值可能看起来不够），用于模拟“虽然总额少，但我集中在某几个月消费”的场景。

---

## 4. UI/UX 设计规范

### 4.1 视觉风格 (Visual Identity)
- **主题**：Liquid Glass (液态玻璃拟态) + Apple Style。
- **配色**：
    - **品牌色**：汇丰红 (`#db0011`)。
    - **背景**：
        - 亮色：浅灰 (`#F5F5F7`) + 动态彩色光斑。
        - 暗色：纯黑 (`#050505`) + 低饱和度光斑 + 混合模式调整。
- **动画**：
    - 背景光斑：`animate-blob` (缓慢变形移动)。
    - 信用卡：`animate-float` (悬浮呼吸效果)。

### 4.2 核心组件：Pulse Black Card (CSS Art)
- 纯 CSS 绘制的信用卡 UI。
- **响应式优化**：
    - 增加 `whitespace-nowrap` 防止卡号换行。
    - 调整 Flex 布局防止 Logo 与姓名重叠。
    - 暗黑模式下增加微弱的白色描边 (`ring-white/10`) 以凸显轮廓。

### 4.3 核心组件：Liquid Input (输入框)
这是本次修复的重点组件。

- **交互**：
    - 点击时有光晕聚焦动画。
    - 支持简易数学运算 (如输入 `200*12` 自动计算)。
- **深色模式适配 (Dark Mode Fix)**：
    - **默认状态**：
        - 亮色：`bg-white/40`
        - 暗色：`bg-white/5` (透明度极低的白，呈现深灰玻璃感)
        - 文字：灰色
    - **聚焦/输入状态**：
        - 亮色：`bg-white`，文字深灰。
        - 暗色：`bg-[#1a1a1a]` (深炭灰)，**文字亮白 (`text-gray-100`)**。
    - *技术注意*：移除了动态拼接字符串的写法，改用完整的 Tailwind 类名，确保 PostCSS 编译时能正确提取样式。

---

## 5. 代码库快照 (Source Code)

以下是当前稳定版代码，包含所有修复：

```javascript
import React, { useState, useEffect, useMemo, useRef } from 'react';

// ==================== CSS 动画注入 ====================
const GlobalStyles = () => (
  <style>{`
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

// ==================== Liquid Input Component (修复版) ====================
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

  // 修复核心：完全拆解动态 class，让 Tailwind 能够扫描到完整的 dark 类名
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

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`
      relative w-10 h-5 md:w-11 md:h-6 rounded-full transition-all duration-500 ease-out 
      ${checked ? 'bg-[#db0011] shadow-[0_2px_8px_rgba(219,0,17,0.4)]' : 'bg-gray-200/80 dark:bg-gray-700'}
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

export default function PulseLiquidFixed() {
  const [activeTab, setActiveTab] = useState('monthly');
  const [activities, setActivities] = useState({ ryc: true, mobilePay: true, dining: true });
  const [months, setMonths] = useState([{ id: 1, totalSpend: 0, mobilePaySpend: 0, diningSpend: 0 }]);
  const [yearly, setYearly] = useState({ totalSpend: 0, mobilePaySpend: 0, diningSpend: 0, forceThreshold: true });

  const result = useMemo(() => calculate(activeTab, activities, activeTab === 'monthly' ? months : yearly), [activeTab, activities, months, yearly]);

  const addMonth = () => setMonths([...months, { id: Date.now(), totalSpend: 0, mobilePaySpend: 0, diningSpend: 0 }]);
  const removeMonth = (id) => setMonths(months.filter(m => m.id !== id));
  const updateMonth = (id, field, val) => setMonths(months.map(m => m.id === id ? { ...m, [field]: val } : m));

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#050505] text-gray-900 dark:text-gray-100 font-sans selection:bg-red-100 dark:selection:bg-red-900 pb-32 overflow-x-hidden relative transition-colors duration-500">
      <GlobalStyles />
      
      {/* 动态背景光 (Living Ambient) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
         <div className="animate-blob absolute top-[-10%] left-[20%] w-[300px] md:w-[800px] h-[300px] md:h-[800px] bg-indigo-300/30 dark:bg-indigo-900/20 rounded-full blur-[80px] md:blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
         <div className="animate-blob animation-delay-2000 absolute top-[10%] right-[-10%] w-[250px] md:w-[600px] h-[250px] md:h-[600px] bg-red-200/30 dark:bg-red-900/20 rounded-full blur-[80px] md:blur-[100px] mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
         <div className="animate-blob animation-delay-4000 absolute bottom-[10%] left-[10%] w-[250px] md:w-[600px] h-[250px] md:h-[600px] bg-purple-200/30 dark:bg-purple-900/20 rounded-full blur-[80px] md:blur-[100px] mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
      </div>

      {/* 悬浮导航栏 (Floating Island) */}
      <nav className="fixed top-4 md:top-6 left-0 right-0 z-50 px-4 flex justify-center">
        <div className="bg-white/70 dark:bg-black/70 backdrop-blur-2xl rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-white/40 dark:border-white/10 pl-4 pr-1.5 py-1.5 md:pl-6 md:pr-2 md:py-2 flex items-center gap-3 md:gap-6 w-full max-w-[360px] md:max-w-max justify-between md:justify-start transition-all duration-300">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black shadow-lg">
               <div className="scale-75"><Icons.Diamond /></div>
            </div>
            <span className="font-bold text-sm md:text-lg tracking-tight text-gray-900 dark:text-white">
              HSBC Pulse <span className="text-[#db0011] dark:text-[#ff4d4d]">Calculator</span>
            </span>
          </div>
          
          <div className="bg-gray-100/50 dark:bg-white/10 p-1 rounded-full flex backdrop-blur-md">
            {['monthly', 'yearly'].map(t => (
              <button 
                key={t} 
                onClick={() => setActiveTab(t)} 
                className={`
                  px-4 py-1.5 md:px-6 md:py-2.5 rounded-full text-[10px] md:text-xs font-bold transition-all duration-300
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
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-4 pt-28 md:pt-32 space-y-8 md:space-y-12">
        
        {/* 卡片区 (带浮动动画) */}
        <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          <PulseBlackCard />
        </section>

        {/* 核心配置 (Liquid Glass Panel) */}
        <section className="bg-white/30 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.01)] border border-white/20 dark:border-white/5 transition-colors">
           <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2 px-1">
             <Icons.Settings />
             <span>奖励系数配置</span>
           </h3>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              {[
                 { key: 'ryc', label: '赏世界 RYC', sub: '5X 积分 / 年限10万' },
                 { key: 'mobilePay', label: '移动支付', sub: '5X 积分 / 年限8万' },
                 { key: 'dining', label: '内地餐饮', sub: '3%+2% / 月限2千' }
               ].map(item => (
                 <div key={item.key} className="flex flex-col gap-3 p-4 md:p-5 rounded-[1.5rem] bg-white/40 dark:bg-white/5 transition-all hover:bg-white/60 dark:hover:bg-white/10 hover:shadow-lg hover:-translate-y-1 duration-300 border border-transparent hover:border-white/40 dark:hover:border-white/10">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-gray-800 dark:text-gray-200 text-sm">{item.label}</div>
                      <Toggle checked={activities[item.key]} onChange={v => setActivities({...activities, [item.key]: v})} />
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
                             {idx + 1} 月消费详情
                           </span>
                           <button onClick={() => removeMonth(m.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors p-2"><Icons.Trash /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-10 gap-4 md:gap-6">
                           <div className="md:col-span-4"><LiquidInput label="当月总消费" value={m.totalSpend} onChange={v => updateMonth(m.id, 'totalSpend', v)} /></div>
                           <div className="md:col-span-3"><LiquidInput label="餐饮消费" subLabel={activities.dining ? "封顶2k" : null} disabled={!activities.dining} value={m.diningSpend} onChange={v => updateMonth(m.id, 'diningSpend', v)} /></div>
                           <div className="md:col-span-3"><LiquidInput label="移动支付" subLabel={activities.mobilePay ? "封顶8w" : null} disabled={!activities.mobilePay} value={m.mobilePaySpend} onChange={v => updateMonth(m.id, 'mobilePaySpend', v)} /></div>
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
               </div>
             </div>
           )}
        </section>

        {/* 黑色汇总卡片 (Black Diamond) */}
        <section>
          <div className="relative overflow-hidden rounded-[2rem] md:rounded-[3rem] bg-[#050505] dark:bg-black text-white p-6 md:p-14 shadow-2xl shadow-gray-900/30 dark:shadow-white/5 ring-1 ring-white/10">
             <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#db0011]/10 rounded-full blur-[150px] pointer-events-none mix-blend-screen"></div>
             
             <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16">
               <div className="flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-4">Total Estimated Rewards</div>
                    <div className="flex items-baseline gap-2 md:gap-3 flex-wrap">
                       <span className="text-6xl md:text-8xl font-bold tracking-tighter text-white">{result.totalRc.toFixed(0)}</span>
                       <span className="text-2xl md:text-3xl text-gray-600 font-light tracking-tight">.{result.totalRc.toFixed(2).split('.')[1]} <span className="text-lg md:text-xl font-bold text-gray-700">RC</span></span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 md:gap-6 mt-8 md:mt-12 lg:mt-0">
                     <div className="p-4 md:p-6 rounded-2xl md:rounded-[2rem] bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                       <div className="text-xl md:text-3xl font-bold tracking-tight text-gray-100">{result.asiaMiles.toLocaleString()}</div>
                       <div className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Asia Miles</div>
                     </div>
                     <div className="p-4 md:p-6 rounded-2xl md:rounded-[2rem] bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                       <div className="text-xl md:text-3xl font-bold tracking-tight text-gray-100">{result.returnRate.toFixed(2)}%</div>
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
                  <div className="grid grid-cols-4 gap-2 md:gap-4 text-[9px] md:text-[10px] text-gray-600 pt-8 border-t border-white/5 font-mono uppercase tracking-widest">
                     <div>Base<br/><span className="text-white text-sm md:text-base tracking-normal">{result.rcBase.toFixed(0)}</span></div>
                     {activities.ryc && <div>RYC<br/><span className="text-[#ff4d4d] text-sm md:text-base tracking-normal">{result.rcRyc.toFixed(0)}</span></div>}
                     {activities.mobilePay && <div>Mobile<br/><span className="text-[#ff4d4d] text-sm md:text-base tracking-normal">{result.rcMobile.toFixed(0)}</span></div>}
                     {activities.dining && <div>Dining<br/><span className="text-orange-400 text-sm md:text-base tracking-normal">{result.rcDining.toFixed(0)}</span></div>}
                  </div>
               </div>
             </div>
          </div>
        </section>

      </main>
    </div>
  );
}
```
