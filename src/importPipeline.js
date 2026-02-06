import Papa from 'papaparse';

export const LOW_CONFIDENCE_THRESHOLD = 0.72;

const DATE_KEYS = [
  'date',
  'transaction date',
  'posting date',
  'value date',
  '交易日期',
  '入账日期',
  '记账日期',
  '交易时间',
  '日期',
];

const DESC_KEYS = [
  'description',
  'merchant',
  'narrative',
  'details',
  'remark',
  '交易描述',
  '交易详情',
  '商户',
  '商户名称',
  '摘要',
  '交易内容',
];

const AMOUNT_KEYS = [
  'amount',
  'debit',
  'transaction amount',
  'billing amount',
  'local amount',
  '消费金额',
  '交易金额',
  '金额',
  '人民币金额',
  '本币金额',
  '签账金额',
];

const CATEGORY_KEYS = ['category', 'mcc', 'merchant category', '类别', '交易类型', '行业'];
const CHANNEL_KEYS = ['channel', 'payment method', '支付方式', '交易渠道', '支付渠道'];

const DINING_KEYWORDS = [
  'RESTAURANT',
  'DINING',
  'CAFE',
  'COFFEE',
  'BAR',
  'FOOD',
  'MEITUAN',
  'ELEME',
  'MCDONALD',
  'KFC',
  'STARBUCKS',
  '海底捞',
  '餐饮',
  '餐厅',
  '咖啡',
  '美团',
  '饿了么',
  '小吃',
  '饭店',
  '酒楼',
  '茶餐厅',
];

const MOBILE_PAY_KEYWORDS = [
  'APPLE PAY',
  'APPLEPAY',
  'GOOGLE PAY',
  'SAMSUNG PAY',
  'ALIPAY',
  'WECHAT',
  'PAYME',
  'FPS',
  'QR',
  'QUICK PASS',
  'UNIONPAY APP',
  'QR UNIONPAY',
  'QRUNIONPAY',
  'UNIONPAY QR',
  '云闪付',
  '二维码',
  '扫码',
  '支付宝',
  '微信支付',
  '手机支付',
  '移动支付',
];

const NON_SPEND_KEYWORDS = [
  'PAYMENT',
  '还款',
  'REVERSAL',
  'TRANSFER',
  '自动扣款',
  '利息',
  'INTEREST',
  'ANNUAL FEE',
  '年费',
  'CASH ADVANCE',
];

const REFUND_KEYWORDS = [
  '退款',
  'REFUND',
  'RETURN',
  'RETRUN',
  'RETUAN',
  'RETURM',
  'RETUN',
  '退货',
  '撤销',
];

const DINING_MCC = new Set(['5811', '5812', '5813', '5814']);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round2 = (value) => Number(value.toFixed(2));
const EPSILON = 0.01;

const safeString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeText = (value) => safeString(value).toUpperCase();

const containsAny = (text, keywords) => keywords.some((keyword) => text.includes(keyword));

const amountToKey = (value) => {
  if (!Number.isFinite(value)) return '';
  return round2(value).toFixed(2);
};

const descDedupeKey = (description) =>
  normalizeText(description)
    .replace(/[^A-Z0-9\u4E00-\u9FFF]+/g, '')
    .trim();

const dateToKey = (isoDate, monthKey) => {
  if (isoDate) {
    const day = isoDate.slice(0, 10);
    if (day && !Number.isNaN(new Date(day).getTime())) return day;
  }
  return monthKey || '';
};

const merchantKey = (description) => {
  const text = normalizeText(description)
    .replace(/[:.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

  const stopwords = new Set([
    'RETURN',
    'REFUND',
    'REVERSED',
    'REVERSAL',
    'APPLEPAY',
    'APPLE',
    'PAY',
    'QR',
    'UNIONPAY',
    'MERCHANT',
    'CHN',
    'CN',
    'CNY',
    'RMB',
  ]);

  const tokens = text
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !stopwords.has(token));

  return tokens.join(' ');
};

const normalizedDescriptionKey = (description) => {
  let key = merchantKey(description);
  if (!key) {
    key = descDedupeKey(description)
      .replace(/RETURN|REFUND|APPLEPAY|UNIONPAY|MERCHANT|CHNCN|CHN|CN|CNY|RMB|QR|FPS/g, '')
      .trim();
  }
  if (!key || key.length < 4) return 'GENERIC';
  return key;
};

const qualityScore = (tx) =>
  (tx.monthKey ? 2 : 0) +
  (tx.categoryUncertain ? 0 : 1) +
  (tx.signUncertain ? 0 : 1) +
  (Number.isFinite(tx.confidence) ? tx.confidence : 0);

const normalizeHeader = (value) =>
  safeString(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const isLikelyNonSpend = (description) => {
  const text = normalizeText(description);
  return containsAny(text, NON_SPEND_KEYWORDS);
};

const parseAmount = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw === 0) return null;
    return raw;
  }

  const text = safeString(raw);
  if (!text) return null;

  const hasParentheses = /\(.*\)/.test(text);
  const isCredit = /\bCR\b/i.test(text);
  const isDebit = /\bDR\b/i.test(text);

  const normalized = text
    .replace(/[,$¥￥HKDRMB\s]/gi, '')
    .replace(/\((.*)\)/, '$1')
    .replace(/CR|DR/gi, '');

  const number = Number.parseFloat(normalized);
  if (!Number.isFinite(number) || number === 0) return null;

  if ((hasParentheses || isCredit) && !isDebit) {
    return -Math.abs(number);
  }
  return number;
};

const deriveSignedSpendImpact = (rawAmount, parsedAmount, description) => {
  const rawAmountText = safeString(rawAmount).toUpperCase();
  const descText = normalizeText(description);

  const hasExplicitPlus = /\+\s*[\d,.]/.test(rawAmountText);
  const hasExplicitMinus = /-\s*[\d,.]/.test(rawAmountText);
  const hasLeadingPlus = rawAmountText.trim().startsWith('+');
  const hasLeadingMinus = rawAmountText.trim().startsWith('-');
  const hasCR = /\bCR\b/.test(rawAmountText);
  const hasDR = /\bDR\b/.test(rawAmountText);
  const isRefundByDesc = containsAny(descText, REFUND_KEYWORDS);

  let signedSpendImpact = Math.abs(parsedAmount);
  let signUncertain = false;

  if (hasExplicitPlus || hasLeadingPlus || hasCR || isRefundByDesc) {
    signedSpendImpact = -Math.abs(parsedAmount);
  } else if (hasExplicitMinus || hasLeadingMinus || hasDR) {
    signedSpendImpact = Math.abs(parsedAmount);
  } else if (parsedAmount < 0) {
    signedSpendImpact = Math.abs(parsedAmount);
  } else {
    // OCR 常把 + / - 漏掉；没有明确方向时标记为待复审
    signUncertain = true;
  }

  return {
    signedSpendImpact,
    signUncertain,
  };
};

const parseDate = (raw) => {
  if (!raw) return null;

  if (raw instanceof Date && Number.isFinite(raw.getTime())) {
    return raw;
  }

  if (typeof raw === 'number' && raw > 25000 && raw < 70000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const fromExcel = new Date(excelEpoch + raw * 86400000);
    return Number.isFinite(fromExcel.getTime()) ? fromExcel : null;
  }

  const text = safeString(raw);
  if (!text) return null;

  const normalized = text
    .replace(/[年/.]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\//g, '-')
    .replace(/\s+/g, '')
    .trim();

  const ymd = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    const date = new Date(year, month - 1, day);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  const md = normalized.match(/^(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?$/);
  if (md) {
    const month = Number(md[1]);
    const day = Number(md[2]);
    const rawYear = md[3];
    let year = new Date().getFullYear();
    if (rawYear) {
      year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    }

    const date = new Date(year, month - 1, day);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  const fallback = new Date(text);
  if (Number.isFinite(fallback.getTime())) {
    return fallback;
  }
  return null;
};

const toMonthKey = (date) => {
  if (!date || !Number.isFinite(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
};

const pickField = (row, candidates) => {
  const entries = Object.entries(row || {});
  for (const [key, value] of entries) {
    const normalizedKey = normalizeHeader(key);
    if (candidates.some((candidate) => normalizedKey === candidate || normalizedKey.includes(candidate))) {
      const content = safeString(value);
      if (content) return content;
    }
  }
  return '';
};

const pickAmountField = (row) => {
  const entries = Object.entries(row || {});
  for (const [key, value] of entries) {
    const normalizedKey = normalizeHeader(key);
    const isAmountKey = AMOUNT_KEYS.some((candidate) => normalizedKey === candidate || normalizedKey.includes(candidate));
    if (!isAmountKey) continue;

    const parsed = parseAmount(value);
    if (parsed !== null) return parsed;
  }

  for (const [, value] of entries) {
    const parsed = parseAmount(value);
    if (parsed !== null) return parsed;
  }

  return null;
};

const classifyTransaction = ({ description, category, channel }) => {
  let confidence = 0.56;
  const reasons = [];

  const descriptionText = normalizeText(description);
  const categoryText = normalizeText(category);
  const channelText = normalizeText(channel);
  const fullText = `${descriptionText} ${categoryText} ${channelText}`;

  let isDining = false;
  let isMobilePay = false;

  const mccMatch = categoryText.match(/\b(\d{4})\b/);
  if (mccMatch && DINING_MCC.has(mccMatch[1])) {
    isDining = true;
    confidence += 0.26;
    reasons.push(`MCC ${mccMatch[1]} 命中餐饮分类`);
  }

  if (containsAny(fullText, DINING_KEYWORDS)) {
    isDining = true;
    confidence += 0.18;
    reasons.push('商户关键词命中餐饮');
  }

  if (containsAny(channelText, MOBILE_PAY_KEYWORDS)) {
    isMobilePay = true;
    confidence += 0.24;
    reasons.push('支付渠道命中移动支付');
  } else if (containsAny(fullText, MOBILE_PAY_KEYWORDS)) {
    isMobilePay = true;
    confidence += 0.16;
    reasons.push('交易描述命中移动支付关键词');
  }

  const categoryUncertain = !isDining && !isMobilePay;

  if (categoryUncertain) {
    confidence -= 0.1;
    reasons.push('无明确分类关键词，建议复核');
  }

  return {
    isDining,
    isMobilePay,
    categoryUncertain,
    confidence: clamp(confidence, 0.25, 0.98),
    reasons,
  };
};

const buildTransaction = ({
  rawDate,
  rawDescription,
  rawAmount,
  rawCategory,
  rawChannel,
  source,
  index,
}) => {
  const description = safeString(rawDescription);
  if (!description) return null;

  if (isLikelyNonSpend(description)) return null;

  const parsedAmount = parseAmount(rawAmount);
  if (parsedAmount === null || parsedAmount === 0) return null;

  const { signedSpendImpact, signUncertain } = deriveSignedSpendImpact(
    rawAmount,
    parsedAmount,
    description
  );
  const amount = Math.abs(signedSpendImpact);
  const isRefund = signedSpendImpact < 0;
  const date = parseDate(rawDate);
  const monthKey = toMonthKey(date);

  const classification = classifyTransaction({
    description,
    category: rawCategory,
    channel: rawChannel,
  });

  let confidence = classification.confidence;
  const reasons = [...classification.reasons];

  if (!monthKey) {
    confidence -= 0.2;
    reasons.push('未识别日期，需要手动指定月份');
  }

  if (signUncertain) {
    confidence -= 0.16;
    reasons.push('金额方向不确定，建议人工复审');
  }

  if (isRefund) {
    confidence += 0.04;
    reasons.push('识别为退款，会扣减对应返现');
  }

  const finalConfidence = clamp(confidence, 0.2, 0.98);
  const uncertainty = clamp(1 - finalConfidence, 0.02, 0.98);
  const needsReview = !monthKey || classification.categoryUncertain || signUncertain;

  return {
    id: `${source}-${Date.now()}-${index}`,
    source,
    date: date ? date.toISOString() : '',
    monthKey,
    description,
    amount,
    signedSpendImpact,
    isRefund,
    isDining: classification.isDining,
    isMobilePay: classification.isMobilePay,
    categoryUncertain: classification.categoryUncertain,
    signUncertain,
    confidence: finalConfidence,
    uncertainty,
    reasons,
    needsReview,
  };
};

const parseArrayRow = (row, source, index) => {
  const values = Array.isArray(row) ? row.map((item) => safeString(item)).filter(Boolean) : [];
  if (values.length < 3) return null;

  const date = values[0];
  const amount = values.find((value) => parseAmount(value) !== null);
  if (!amount) return null;

  const amountIndex = values.indexOf(amount);
  const descriptionParts = values.filter((_, idx) => idx !== 0 && idx !== amountIndex);

  return buildTransaction({
    rawDate: date,
    rawDescription: descriptionParts.join(' ').trim(),
    rawAmount: amount,
    rawCategory: '',
    rawChannel: '',
    source,
    index,
  });
};

const parseCsvRows = (rows, source) => {
  const transactions = [];

  rows.forEach((row, index) => {
    if (!row) return;

    if (Array.isArray(row)) {
      const transaction = parseArrayRow(row, source, index);
      if (transaction) transactions.push(transaction);
      return;
    }

    const transaction = buildTransaction({
      rawDate: pickField(row, DATE_KEYS),
      rawDescription: pickField(row, DESC_KEYS),
      rawAmount: pickAmountField(row),
      rawCategory: pickField(row, CATEGORY_KEYS),
      rawChannel: pickField(row, CHANNEL_KEYS),
      source,
      index,
    });

    if (transaction) transactions.push(transaction);
  });

  return transactions;
};

export const parseCsvStatementText = (text, source = 'csv') => {
  const withHeader = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  let transactions = parseCsvRows(withHeader.data, source);

  if (!transactions.length) {
    const withoutHeader = Papa.parse(text, {
      header: false,
      skipEmptyLines: true,
    });

    transactions = parseCsvRows(withoutHeader.data, source);
  }

  return transactions;
};

export const parseTransactionsFromRawText = (rawText, source = 'text') => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[－−—–]/g, '-')
        .replace(/[＋]/g, '+')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);

  const transactions = [];
  let currentDate = '';

  const patterns = [
    /^(?<date>\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?)\s+(?<desc>.+?)\s+(?<amount>-?[\d,]+(?:\.\d{1,2})?)$/,
    /^(?<date>\d{4}[年/-]\d{1,2}[月/-]\d{1,2}日?)\s+(?<desc>.+?)\s+(?<amount>-?[\d,]+(?:\.\d{1,2})?)$/,
    /^(?<date>\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?)\s+(?<amount>-?[\d,]+(?:\.\d{1,2})?)\s+(?<desc>.+)$/,
  ];

  const statementLinePatterns = [
    /^(?<desc>.+?)\s+(?<sign>[+-])\s*(?<amount>[\d,]+(?:\.\d{1,2})?)\s*(?<currency>[A-Z]{3})?$/i,
    /^(?<desc>.+?)\s+(?<amount>[+-][\d,]+(?:\.\d{1,2})?)\s*(?<currency>[A-Z]{3})?$/i,
  ];

  lines.forEach((line, index) => {
    const possibleDate = parseDate(line);
    const hasAmountToken = /[+-]\s*[\d,]+(?:\.\d{1,2})?\s*(?:CNY|RMB|HKD)?/i.test(line);
    if (possibleDate && !hasAmountToken) {
      currentDate = line;
      return;
    }

    let matched = false;

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match?.groups) continue;

      const tx = buildTransaction({
        rawDate: match.groups.date,
        rawDescription: match.groups.desc,
        rawAmount: match.groups.amount,
        rawCategory: '',
        rawChannel: '',
        source,
        index,
      });

      if (tx) {
        transactions.push(tx);
        matched = true;
      }
      break;
    }

    if (matched) {
      return;
    }

    for (const pattern of statementLinePatterns) {
      const match = line.match(pattern);
      if (!match?.groups) continue;

      const dateValue = currentDate || '';
      const amountValue =
        match.groups.amount && match.groups.sign
          ? `${match.groups.sign}${match.groups.amount}`
          : match.groups.amount;

      const tx = buildTransaction({
        rawDate: dateValue,
        rawDescription: match.groups.desc,
        rawAmount: amountValue,
        rawCategory: '',
        rawChannel: match.groups.desc,
        source,
        index,
      });

      if (tx) transactions.push(tx);
      break;
    }
  });

  return transactions;
};

export const parseCsvStatementFile = async (file, sourceTag = 'csv') => {
  const text = await file.text();
  return parseCsvStatementText(text, sourceTag);
};

export const parsePdfStatementFile = async (file, sourceTag = 'pdf') => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data, disableWorker: true }).promise;

  let fullText = '';
  for (let pageIndex = 1; pageIndex <= document.numPages; pageIndex += 1) {
    const page = await document.getPage(pageIndex);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join('\n');
    fullText += `\n${pageText}`;
  }

  return parseTransactionsFromRawText(fullText, sourceTag);
};

export const parseImageStatementFile = async (file, sourceTag = 'image') => {
  const { createWorker } = await import('tesseract.js');

  let worker;
  try {
    worker = await createWorker('eng+chi_sim');
  } catch {
    worker = await createWorker('eng');
  }

  try {
    const result = await worker.recognize(file);
    const text = result?.data?.text || '';
    return parseTransactionsFromRawText(text, sourceTag);
  } finally {
    await worker.terminate();
  }
};

const txDayKey = (tx) => {
  const day = dateToKey(tx.date, tx.monthKey);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
};

const txMonthKey = (tx) => {
  const direct = safeString(tx.monthKey);
  if (direct) return direct;
  const day = txDayKey(tx);
  return day ? day.slice(0, 7) : '';
};

const buildOverlapKey = (tx) => {
  const signKey = tx.isRefund ? 'R' : 'S';
  const amountKey = amountToKey(tx.signedSpendImpact);
  const day = txDayKey(tx);
  const month = txMonthKey(tx);
  const descriptionKey = normalizedDescriptionKey(tx.description);
  return `${day || month || 'UNKNOWN'}|${descriptionKey}|${amountKey}|${signKey}`;
};

const buildBucketKey = (tx) => {
  const signKey = tx.isRefund ? 'R' : 'S';
  const amountKey = amountToKey(tx.signedSpendImpact);
  const month = txMonthKey(tx);
  return `${month || 'UNKNOWN'}|${amountKey}|${signKey}`;
};

const buildCrossSourceDescriptionKey = (tx) => {
  const normalized = normalizedDescriptionKey(tx.description);
  if (normalized !== 'GENERIC') return normalized;
  const raw = descDedupeKey(tx.description);
  if (!raw) return 'GENERIC';
  return `RAW:${raw}`;
};

const buildCrossSourceSignature = (tx) => {
  const signKey = tx.isRefund ? 'R' : 'S';
  const amountKey = amountToKey(tx.signedSpendImpact);
  const day = txDayKey(tx);
  const month = txMonthKey(tx);
  const descriptionKey = buildCrossSourceDescriptionKey(tx);
  const scope = day ? `D:${day}` : `M:${month || 'UNKNOWN'}`;
  return `${scope}|${descriptionKey}|${amountKey}|${signKey}`;
};

const dedupeAcrossSourcesBySignature = (rows) => {
  const groups = new Map();

  rows.forEach((tx) => {
    const key = buildCrossSourceSignature(tx);
    const list = groups.get(key) || [];
    list.push(tx);
    groups.set(key, list);
  });

  const deduped = [];
  let removedCount = 0;

  groups.forEach((list) => {
    if (list.length <= 1) {
      deduped.push(...list);
      return;
    }

    const sourceCount = new Map();
    list.forEach((tx) => {
      const sourceId = tx.source || 'unknown';
      sourceCount.set(sourceId, (sourceCount.get(sourceId) || 0) + 1);
    });

    if (sourceCount.size <= 1) {
      deduped.push(...list);
      return;
    }

    const keepCount = Math.max(...Array.from(sourceCount.values()));
    const sorted = [...list].sort((a, b) => {
      const scoreDiff = qualityScore(b) - qualityScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.__importOrder - b.__importOrder;
    });

    deduped.push(...sorted.slice(0, keepCount));
    removedCount += Math.max(0, sorted.length - keepCount);
  });

  return { deduped, removedCount };
};

const toTokenSet = (text) =>
  new Set(
    safeString(text)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1)
  );

const tokenJaccard = (setA, setB) => {
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersection += 1;
  });
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
};

const merchantSimilarityScore = (txA, txB) => {
  const keyA = normalizedDescriptionKey(txA.description);
  const keyB = normalizedDescriptionKey(txB.description);
  if (keyA === keyB) return keyA === 'GENERIC' ? 0.72 : 1;

  const tokensA = toTokenSet(merchantKey(txA.description));
  const tokensB = toTokenSet(merchantKey(txB.description));
  const jaccard = tokenJaccard(tokensA, tokensB);
  if (jaccard > 0) return jaccard;

  const rawA = descDedupeKey(txA.description);
  const rawB = descDedupeKey(txB.description);
  if (!rawA || !rawB) return 0;
  if (rawA === rawB) return 0.88;
  if (rawA.includes(rawB) || rawB.includes(rawA)) return 0.66;
  return 0;
};

const overlapCount = (mapA, mapB) => {
  let count = 0;
  mapA.forEach((valueA, key) => {
    const valueB = mapB.get(key) || 0;
    count += Math.min(valueA, valueB);
  });
  return count;
};

const shouldTreatAsOverlapping = (overlap, minSize) => {
  if (overlap >= 4) return true;
  if (minSize <= 5 && overlap >= 2) return true;
  if (minSize <= 10 && overlap >= 3) return true;
  if (minSize > 0 && overlap >= 2 && overlap / minSize >= 0.45) return true;
  return false;
};

const clusterRowsInsideBucket = (rows) => {
  const clusters = [];

  const sortedRows = [...rows].sort((a, b) => {
    const dayA = txDayKey(a) ? 1 : 0;
    const dayB = txDayKey(b) ? 1 : 0;
    if (dayA !== dayB) return dayB - dayA;
    const scoreDiff = qualityScore(b) - qualityScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.__importOrder - b.__importOrder;
  });

  const addToCluster = (cluster, tx) => {
    cluster.items.push(tx);
    cluster.sources.add(tx.source || 'unknown');

    const day = txDayKey(tx);
    const month = txMonthKey(tx);
    const descKey = normalizedDescriptionKey(tx.description);

    if (day) cluster.dayKeys.add(day);
    if (month) cluster.monthKeys.add(month);
    cluster.descKeys.add(descKey);
    if (descKey !== 'GENERIC') cluster.hasSpecificDesc = true;
  };

  const getCompatibility = (tx, cluster) => {
    const txDay = txDayKey(tx);
    const txMonth = txMonthKey(tx);
    const txDescKey = normalizedDescriptionKey(tx.description);

    if (txMonth && cluster.monthKeys.size > 0 && !cluster.monthKeys.has(txMonth)) {
      return { match: false, score: 0 };
    }

    let dateScore = 0;
    if (txDay && cluster.dayKeys.size > 0) {
      if (!cluster.dayKeys.has(txDay)) return { match: false, score: 0 };
      dateScore = 1;
    } else if (txDay && cluster.dayKeys.size === 0) {
      dateScore = 0.6;
    } else if (!txDay && cluster.dayKeys.size > 0) {
      dateScore = 0.4;
    } else {
      dateScore = 0.3;
    }

    let descScore = 0;
    if (cluster.descKeys.has(txDescKey)) {
      descScore = txDescKey === 'GENERIC' ? 0.45 : 1;
    } else {
      let bestSimilarity = 0;
      cluster.items.forEach((item) => {
        bestSimilarity = Math.max(bestSimilarity, merchantSimilarityScore(tx, item));
      });

      if (bestSimilarity >= 0.58) {
        descScore = bestSimilarity;
      } else if (
        txDescKey === 'GENERIC' &&
        cluster.hasSpecificDesc &&
        txDay &&
        cluster.dayKeys.has(txDay)
      ) {
        // OCR 有时把商户识别成通用文案，若同日同金额则允许并入
        descScore = 0.4;
      } else {
        return { match: false, score: 0 };
      }
    }

    const sourceBonus = cluster.sources.has(tx.source || 'unknown') ? -0.05 : 0.18;
    return {
      match: true,
      score: dateScore * 1.1 + descScore * 1.7 + sourceBonus,
    };
  };

  sortedRows.forEach((tx) => {
    let bestIndex = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < clusters.length; i += 1) {
      const candidate = clusters[i];
      const compatibility = getCompatibility(tx, candidate);
      if (!compatibility.match) continue;
      if (compatibility.score > bestScore) {
        bestScore = compatibility.score;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) {
      const cluster = {
        items: [],
        sources: new Set(),
        dayKeys: new Set(),
        monthKeys: new Set(),
        descKeys: new Set(),
        hasSpecificDesc: false,
      };
      addToCluster(cluster, tx);
      clusters.push(cluster);
      return;
    }

    addToCluster(clusters[bestIndex], tx);
  });

  return clusters;
};

const dedupeTransactions = (transactions) => {
  if (transactions.length <= 1) {
    return { deduped: transactions, duplicateCount: 0 };
  }

  const withOrder = transactions.map((tx, order) => ({ ...tx, __importOrder: order }));
  const sourceMap = new Map();
  withOrder.forEach((tx) => {
    const sourceId = tx.source || 'unknown';
    const list = sourceMap.get(sourceId) || [];
    list.push(tx);
    sourceMap.set(sourceId, list);
  });

  const sourceIds = Array.from(sourceMap.keys());
  if (sourceIds.length <= 1) {
    return {
      deduped: withOrder.map((item) => {
        const cleaned = { ...item };
        delete cleaned.__importOrder;
        return cleaned;
      }),
      duplicateCount: 0,
    };
  }

  const profileBySource = new Map();
  const totalBySource = new Map();
  sourceIds.forEach((sourceId) => {
    const countMap = new Map();
    const rows = sourceMap.get(sourceId) || [];
    rows.forEach((tx) => {
      const key = buildOverlapKey(tx);
      countMap.set(key, (countMap.get(key) || 0) + 1);
    });
    profileBySource.set(sourceId, countMap);
    totalBySource.set(sourceId, rows.length);
  });

  const adjacency = new Map();
  sourceIds.forEach((sourceId) => adjacency.set(sourceId, new Set()));

  for (let i = 0; i < sourceIds.length; i += 1) {
    for (let j = i + 1; j < sourceIds.length; j += 1) {
      const a = sourceIds[i];
      const b = sourceIds[j];
      const mapA = profileBySource.get(a);
      const mapB = profileBySource.get(b);
      const overlap = overlapCount(mapA, mapB);
      const minSize = Math.min(totalBySource.get(a) || 0, totalBySource.get(b) || 0);

      if (shouldTreatAsOverlapping(overlap, minSize)) {
        adjacency.get(a).add(b);
        adjacency.get(b).add(a);
      }
    }
  }

  const visited = new Set();
  const components = [];
  sourceIds.forEach((sourceId) => {
    if (visited.has(sourceId)) return;
    const queue = [sourceId];
    const component = [];
    visited.add(sourceId);

    while (queue.length) {
      const current = queue.shift();
      component.push(current);
      adjacency.get(current).forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
    components.push(component);
  });

  const deduped = [];
  let duplicateCount = 0;

  components.forEach((component) => {
    if (component.length === 1) {
      const rows = sourceMap.get(component[0]) || [];
      deduped.push(...rows);
      return;
    }

    const bucketMap = new Map();
    component.forEach((sourceId) => {
      const rows = sourceMap.get(sourceId) || [];
      rows.forEach((tx) => {
        const key = buildBucketKey(tx);
        const list = bucketMap.get(key) || [];
        list.push(tx);
        bucketMap.set(key, list);
      });
    });

    bucketMap.forEach((rows) => {
      const clusters = clusterRowsInsideBucket(rows);

      clusters.forEach((cluster) => {
        const countBySource = new Map();
        cluster.items.forEach((tx) => {
          const sourceId = tx.source || 'unknown';
          countBySource.set(sourceId, (countBySource.get(sourceId) || 0) + 1);
        });

        const keepCount = Math.max(...Array.from(countBySource.values()));
        const sorted = [...cluster.items].sort((a, b) => {
          const scoreDiff = qualityScore(b) - qualityScore(a);
          if (scoreDiff !== 0) return scoreDiff;
          return a.__importOrder - b.__importOrder;
        });

        deduped.push(...sorted.slice(0, keepCount));
        duplicateCount += Math.max(0, sorted.length - keepCount);
      });
    });
  });

  const crossSourcePass = dedupeAcrossSourcesBySignature(deduped);
  duplicateCount += crossSourcePass.removedCount;

  const normalized = crossSourcePass.deduped
    .sort((a, b) => a.__importOrder - b.__importOrder)
    .map((item) => {
      const cleaned = { ...item };
      delete cleaned.__importOrder;
      return cleaned;
    });

  return { deduped: normalized, duplicateCount };
};

const linkRefundsWithOriginalSpend = (transactions) => {
  const indexed = transactions.map((tx, idx) => ({ tx, idx }));
  const sorted = [...indexed].sort((a, b) => {
    const at = a.tx.date ? new Date(a.tx.date).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.tx.date ? new Date(b.tx.date).getTime() : Number.MAX_SAFE_INTEGER;
    if (at !== bt) return at - bt;
    return a.idx - b.idx;
  });

  const spendPool = [];
  let matchedRefundCount = 0;
  const outputById = new Map();

  sorted.forEach(({ tx }) => {
    if (!tx.isRefund) {
      spendPool.push(tx);
      outputById.set(tx.id, tx);
      return;
    }

    const refundAmountAbs = Math.abs(tx.signedSpendImpact || 0);
    const refundMerchantKey = merchantKey(tx.description);

    let matchedIndex = -1;
    for (let i = spendPool.length - 1; i >= 0; i -= 1) {
      const spend = spendPool[i];
      if (spend.isRefund) continue;

      const spendAmountAbs = Math.abs(spend.signedSpendImpact || 0);
      const amountMatches = Math.abs(spendAmountAbs - refundAmountAbs) <= EPSILON;
      if (!amountMatches) continue;

      const spendMerchantKey = merchantKey(spend.description);
      if (refundMerchantKey && spendMerchantKey && refundMerchantKey === spendMerchantKey) {
        matchedIndex = i;
        break;
      }
    }

    let linkedTx = tx;
    if (matchedIndex >= 0) {
      const spend = spendPool[matchedIndex];
      linkedTx = {
        ...tx,
        isMobilePay: tx.isMobilePay || spend.isMobilePay,
        isDining: tx.isDining || spend.isDining,
        categoryUncertain: false,
        needsReview: !tx.monthKey,
        uncertainty: tx.monthKey ? Math.min(tx.uncertainty ?? 0.2, 0.2) : tx.uncertainty ?? 0.2,
        reasons: [...(tx.reasons || []), `退款匹配到原交易：${spend.description}`],
      };
      spendPool.splice(matchedIndex, 1);
      matchedRefundCount += 1;
    }

    outputById.set(linkedTx.id, linkedTx);
  });

  const linkedTransactions = transactions.map((tx) => outputById.get(tx.id) || tx);
  return { linkedTransactions, matchedRefundCount };
};

export const prepareImportedTransactions = (transactions) => {
  const { deduped, duplicateCount } = dedupeTransactions(transactions);
  const { linkedTransactions, matchedRefundCount } = linkRefundsWithOriginalSpend(deduped);

  return {
    transactions: linkedTransactions,
    duplicateCount,
    matchedRefundCount,
  };
};

export const aggregateTransactionsByMonth = (transactions) => {
  const monthMap = new Map();

  transactions.forEach((transaction) => {
    const monthKey = transaction.monthKey;
    if (!monthKey) return;
    const spendImpact =
      typeof transaction.signedSpendImpact === 'number'
        ? transaction.signedSpendImpact
        : transaction.amount;
    if (!spendImpact) return;

    const current = monthMap.get(monthKey) || {
      monthKey,
      totalSpend: 0,
      diningSpend: 0,
      mobilePaySpend: 0,
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
      transactionCount: 0,
      reviewCount: 0,
    };

    current.totalNetSpend += spendImpact;
    if (transaction.isDining) current.diningNetSpend += spendImpact;
    if (transaction.isMobilePay) current.mobileNetSpend += spendImpact;

    if (spendImpact > 0) {
      current.totalSpend += spendImpact;
      current.rycTxnExtraRc += Math.floor(spendImpact / 50);

      if (transaction.isDining) current.diningSpend += spendImpact;
      if (transaction.isMobilePay) {
        current.mobilePaySpend += spendImpact;
        current.mobileTxnExtraRc += Math.floor(spendImpact / 50);
      }
    } else if (spendImpact < 0) {
      const refundAbs = Math.abs(spendImpact);
      current.totalRefundSpend += refundAbs;
      current.pendingRycClawback += Math.floor(refundAbs / 50);

      if (transaction.isDining) current.diningRefundSpend += refundAbs;
      if (transaction.isMobilePay) {
        current.mobileRefundSpend += refundAbs;
        current.pendingMobileClawback += Math.floor(refundAbs / 50);
      }
    }
    current.transactionCount += 1;
    if (transaction.needsReview) current.reviewCount += 1;

    monthMap.set(monthKey, current);
  });

  return Array.from(monthMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((item) => {
      let totalSpend = round2(item.totalSpend);
      let diningSpend = round2(item.diningSpend);
      let mobilePaySpend = round2(item.mobilePaySpend);
      const totalRefundSpend = round2(Math.max(0, item.totalRefundSpend || 0));
      const diningRefundSpend = round2(Math.max(0, item.diningRefundSpend || 0));
      const mobileRefundSpend = round2(Math.max(0, item.mobileRefundSpend || 0));
      const totalNetSpend = round2(item.totalNetSpend || 0);
      const diningNetSpend = round2(item.diningNetSpend || 0);
      const mobileNetSpend = round2(item.mobileNetSpend || 0);

      totalSpend = Math.max(0, totalSpend);
      diningSpend = Math.max(0, diningSpend);
      mobilePaySpend = Math.max(0, mobilePaySpend);

      return {
        ...item,
        totalSpend,
        diningSpend,
        mobilePaySpend,
        totalRefundSpend,
        diningRefundSpend,
        mobileRefundSpend,
        totalNetSpend,
        diningNetSpend,
        mobileNetSpend,
        pendingBaseClawback: Math.floor(totalRefundSpend / 250),
        pendingRycClawback: Math.max(0, Math.floor(item.pendingRycClawback || 0)),
        pendingMobileClawback: Math.max(0, Math.floor(item.pendingMobileClawback || 0)),
        rycTxnExtraRc: Math.max(0, Math.floor(item.rycTxnExtraRc || 0)),
        mobileTxnExtraRc: Math.max(0, Math.floor(item.mobileTxnExtraRc || 0)),
      };
    });
};
