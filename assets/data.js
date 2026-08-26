/* ============================================================
   FinSight 财报智能分析平台 — 核心引擎 Part 1
   数据层 + 渲染工具
   ============================================================ */

/* ---------- 全局状态 ---------- */
const State = {
  currentView: 'overview',
  activeCompany: '600519',
  activeReport: 'rpt_2025',
  searchResults: [],
  parseTasks: [],
  parseLogs: [],
  chat: [],
  wikiSearchResults: [],
  evidFilter: 'all',
  evalRun: false,
};

/* ---------- 演示数据：A股样本公司 ---------- */
const COMPANIES = {
  '600519': {
    code: '600519', name: '贵州茅台', short: '茅台', exchange: '上交所',
    industry: '白酒', regDate: '1999-11-20',
    reports: ['2025年报', '2024年报', '2024三季报', '2024中报'],
    desc: 'A股白酒龙头，主营茅台酒及系列酒生产销售。',
  },
  '300750': {
    code: '300750', name: '宁德时代', short: '宁德', exchange: '深交所',
    industry: '动力电池', regDate: '2018-06-11',
    reports: ['2025年报', '2024年报', '2024三季报'],
    desc: '全球动力电池龙头，主营动力电池系统与储能系统。',
  },
  '601318': {
    code: '601318', name: '中国平安', short: '平安', exchange: '上交所',
    industry: '综合金融', regDate: '2004-06-24',
    reports: ['2025年报', '2024年报', '2024三季报'],
    desc: '综合金融集团，覆盖保险、银行、资管等业务。',
  },
  '600036': {
    code: '600036', name: '招商银行', short: '招行', exchange: '上交所',
    industry: '银行', regDate: '2002-04-09',
    reports: ['2025年报', '2024年报', '2024三季报'],
    desc: '零售银行标杆，财富管理与公司金融并重。',
  },
  '000858': {
    code: '000858', name: '五粮液', short: '五粮', exchange: '深交所',
    industry: '白酒', regDate: '1998-04-27',
    reports: ['2025年报', '2024年报'],
    desc: '浓香型白酒龙头，五粮液品牌价值领先。',
  },
};

/* ---------- 财务数据（元） ---------- */
const FINANCIALS = {
  '600519': {
    company: '贵州茅台', code: '600519', report: '2025年年度报告', reportDate: '2026-03-31',
    period: '2025-12-31', currency: '人民币元',
    income: {
      '营业收入': 174139000000, '营业成本': 22400000000, '营业利润': 115283000000,
      '利润总额': 115059000000, '净利润': 86273000000, '归母净利润': 86273000000,
      '扣非净利润': 86273000000, '基本每股收益': 68.68,
    },
    balance: {
      '总资产': 274536000000, '总负债': 45670000000, '股东权益合计': 228866000000,
      '归母净资产': 228866000000, '流动资产': 249827000000, '流动负债': 44130000000,
      '货币资金': 182023000000, '应收账款': 264900000, '存货': 6220000000,
    },
    cashflow: {
      '经营活动现金流净额': 96800000000, '投资活动现金流净额': -21000000000,
      '筹资活动现金流净额': -80100000000, '现金及等价物净增加额': -4300000000,
    },
    ratios: {
      '毛利率': 91.6, '净利率': 49.6, 'ROE': 24.9, 'ROA': 16.6,
      '资产负债率': 8.8, '流动比率': 5.66, '经营现金流/净利润': 1.12,
      '市盈率': 21.3, '市净率': 5.8, '每股收益': 68.68,
    },
    segments: [
      { name: '茅台酒', revenue: 158388400, ratio: 90.9 },
      { name: '系列酒', revenue: 15750000, ratio: 9.1 },
    ],
    years: {
      '2023': { '营业收入': 147719000000, '净利润': 74734000000 },
      '2024': { '营业收入': 163894000000, '净利润': 82273000000 },
      '2025': { '营业收入': 174139000000, '净利润': 86273000000 },
    },
  },
  '300750': {
    company: '宁德时代', code: '300750', report: '2025年年度报告', reportDate: '2026-03-14',
    period: '2025-12-31', currency: '人民币元',
    income: { '营业收入': 400917000000, '净利润': 47656000000, '归母净利润': 47656000000, '基本每股收益': 10.83 },
    balance: { '总资产': 980000000000, '总负债': 560000000000, '归母净资产': 380000000000, '货币资金': 200000000000, '存货': 88000000000 },
    cashflow: { '经营活动现金流净额': 88000000000, '投资活动现金流净额': -65000000000, '筹资活动现金流净额': -10000000000 },
    ratios: { '毛利率': 24.8, '净利率': 11.9, 'ROE': 21.6, '资产负债率': 57.1 },
  },
  '601318': {
    company: '中国平安', code: '601318', report: '2025年年度报告', reportDate: '2026-03-19',
    period: '2025-12-31', currency: '人民币元',
    income: { '营业收入': 870000000000, '净利润': 103000000000, '基本每股收益': 5.63 },
    balance: { '总资产': 1200000000000, '总负债': 1080000000000, '归母净资产': 120000000000 },
    ratios: { '净利率': 11.8, 'ROE': 12.9, '资产负债率': 90.1 },
  },
};

/* ---------- 财务勾稽校验规则（financial_rules_v14 模拟） ---------- */
const CHECK_RULES = [
  { id: 'R01', name: '资产负债表平衡', rule: '总资产 = 总负债 + 所有者权益', status: 'pass' },
  { id: 'R02', name: '利润表勾稽', rule: '营业收入 - 营业成本 - 费用 = 营业利润', status: 'pass' },
  { id: 'R03', name: '现金流量表勾稽', rule: '经营 + 投资 + 筹资 = 现金净增加额', status: 'pass' },
  { id: 'R04', name: '货币资金匹配', rule: '资产负债表货币资金 ≥ 现金流量表期末现金', status: 'pass' },
  { id: 'R05', name: '单位校验', rule: '报表单位与披露单位一致（人民币元）', status: 'pass' },
  { id: 'R06', name: '期间校验', rule: '报告期间 = 2025-01-01 ~ 2025-12-31', status: 'pass' },
  { id: 'R07', name: '合并口径校验', rule: '合并报表项目 = 母公司 + 少数股东权益', status: 'warn' },
  { id: 'R08', name: '同比增长率校验', rule: 'YoY = (本期-上期)/上期', status: 'pass' },
];

/* ---------- PDF 解析产物（模拟 MinerU 输出） ---------- */
const PARSE_OUTPUTS = {
  markdown: '# 贵州茅台 2025 年年度报告\n\n## 第一节 重要提示\n...\n\n## 第三节 会计数据与财务指标摘要\n\n| 项目 | 2025年 | 2024年 | 同比 |\n| --- | --- | --- | --- |\n| 营业收入 | 1741.40亿 | 1638.94亿 | +6.25% |\n',
  json: {
    document_id: 'doc_600519_2025', pages: 312, tables: 46, images: 28,
    structure: ['cover', 'toc', 'sections', 'financial-statements', 'notes', 'audit'],
  },
  tables: [
    { index: 12, page: 88, caption: '合并资产负债表', rows: 42, cols: 5 },
    { index: 13, page: 91, caption: '合并利润表', rows: 38, cols: 5 },
    { index: 14, page: 94, caption: '合并现金流量表', rows: 45, cols: 5 },
    { index: 28, page: 150, caption: '营业收入构成', rows: 18, cols: 4 },
    { index: 31, page: 172, caption: '主要控股参股公司', rows: 12, cols: 6 },
  ],
  quality: { score: 96.2, pages: 312, tables_detected: 46, images_detected: 62, noise_ratio: 1.2, warnings: ['表12 表头存在跨页'] },
  bbox: [
    { type: 'table', page: 88, x: 34, y: 52, w: 521, h: 288 },
    { type: 'paragraph', page: 12, x: 34, y: 40, w: 521, h: 60 },
  ],
};

/* ---------- 证据链数据 ---------- */
const EVIDENCES = [
  { id: 'EV-001', claim: '2025年营业收入 1741.39 亿元', source: '合并利润表-营业收入', page: 91, table_id: 13, row: 3, audit: '经核查，与年报原文一致', status: 'verified' },
  { id: 'EV-002', claim: '净利润 862.73 亿元，同比增长 4.86%', source: '合并利润表-净利润', page: 91, table_id: 13, row: 8, audit: '勾稽校验通过', status: 'verified' },
  { id: 'EV-003', claim: '毛利率 91.6%', source: '计算：1-营业成本/营业收入', page: 91, table_id: 13, row: 2, audit: '计算复现通过', status: 'verified' },
  { id: 'EV-004', claim: '茅台酒收入占比 90.9%', source: '营业收入构成附注', page: 150, table_id: 28, row: 5, audit: '经核查，与附注明细一致', status: 'verified' },
  { id: 'EV-005', claim: '资产负债率 8.8%', source: '合并资产负债表', page: 88, table_id: 12, row: 1, audit: '勾稽校验通过', status: 'verified' },
];

/* ---------- 智能体定义 ---------- */
const AGENTS = [
  { id: 'analysis', name: 'Analysis 智能分析', icon: '📊', color: '#2f6bff', desc: '基于财务规则与证据路由，自动生成 14 章结构化财报分析初稿', status: 'idle' },
  { id: 'factcheck', name: 'FactChecker 事实核查', icon: '✔', color: '#34d399', desc: '六维复核：来源、页码、口径、单位、期间、计算', status: 'idle' },
  { id: 'tracking', name: 'Tracking 持续跟踪', icon: '⏱', color: '#f5b942', desc: '监控关键指标变化、预警信号与重大事项跟踪', status: 'idle' },
  { id: 'legal', name: 'Legal 法务合规', icon: '⚖', color: '#a78bfa', desc: '引用法规库与处罚案例，进行信披合规初筛', status: 'idle' },
  { id: 'assistant', name: 'Assistant 全域问答', icon: '💬', color: '#22d3ee', desc: '基于 LLM-Wiki + 证据索引的全域问答助手', status: 'idle' },
];

/* ---------- 14章报告结构 ---------- */
const REPORT_14 = [
  { no: '01', title: '公司概况', status: 'done', words: '1,284' },
  { no: '02', title: '主营业务分析', status: 'done', words: '2,016' },
  { no: '03', title: '盈利能力分析', status: 'done', words: '1,872' },
  { no: '04', title: '偿债能力分析', status: 'done', words: '1,634' },
  { no: '05', title: '运营效率分析', status: 'done', words: '1,298' },
  { no: '06', title: '现金流分析', status: 'done', words: '1,521' },
  { no: '07', title: '成长性分析', status: 'done', words: '1,102' },
  { no: '08', title: '杜邦分析', status: 'done', words: '986' },
  { no: '09', title: '风险因素识别', status: 'done', words: '1,446' },
  { no: '10', title: '行业与竞争格局', status: 'warn', words: '1,210' },
  { no: '11', title: '管理层讨论与分析', status: 'done', words: '2,310' },
  { no: '12', title: '关联交易与合规', status: 'done', words: '1,034' },
  { no: '13', title: '重大事项提示', status: 'done', words: '762' },
  { no: '14', title: '投资结论', status: 'warn', words: '884' },
];

/* ---------- KupasEval 评测数据 ---------- */
const EVAL_SCORES = {
  overall: 90.2, rank: 1, grade: 'A', baseline: 78.8,
  metrics: [
    { name: '财报检索与下载', value: 100.0, baseline: 85, note: '满分' },
    { name: '财务指标识别准确率', value: 95.1, baseline: 80, note: '' },
    { name: '数据勾稽与事实核查', value: 94.0, baseline: 78, note: '' },
    { name: '报告专业度与可采纳性', value: 73.9, baseline: 70, note: '低分区' },
    { name: '行业分析与经营洞察', value: 80.4, baseline: 70, note: '' },
  ],
};

/* ---------- 别名常量 ---------- */
const PARSE_ASSETS = PARSE_OUTPUTS;
const EVidences = EVIDENCES;
const REPORT_CHAPTERS = REPORT_14;

/* ============ 渲染工具 ============ */
const fmt = (n) => {
  if (n === undefined || n === null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e8) return (n / 1e8).toFixed(2) + '亿';
  if (abs >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return n.toLocaleString('zh-CN');
};

function el(tag, cls, html) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

function toast(msg, type = 'ok') {
  const root = document.getElementById('toast-root');
  const t = el('div', 'toast ' + type, msg);
  root.appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}