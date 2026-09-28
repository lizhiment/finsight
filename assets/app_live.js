/* ============================================================
   FinSight 财报智能分析平台 — 前端 Live 版本
   对接 FastAPI 后端，真实调用 LLM 智能体
   ============================================================ */

const API_BASE = 'http://127.0.0.1:8000/api';

// ============ 全局状态 ============
const State = {
  currentView: 'overview',
  activeCompany: '600519',
  activeCompanyName: '贵州茅台',
  financials: null,
  report: null,
  agentStatus: {},
};

// ============ API 封装 ============
async function api(url, options = {}) {
  try {
    const r = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(err.detail || `HTTP ${r.status}`);
    }
    return await r.json();
  } catch (e) {
    toast(`API错误: ${e.message}`, 'err');
    throw e;
  }
}

async function uploadFinancials(code, name, industry) {
  // 从 data.js 的 FINANCIALS 中取数据上传到后端
  const fin = FINANCIALS[code];
  if (!fin) { toast('未找到该公司内置数据', 'err'); return; }
  await api(`${API_BASE}/upload-financials?company_code=${code}&company_name=${encodeURIComponent(name)}&industry=${encodeURIComponent(industry || '')}`, {
    method: 'POST',
    body: JSON.stringify(fin),
  });
  State.financials = fin;
  toast(`✅ ${name} 财务数据已加载到后端`);
}

// ============ 视图渲染入口 ============
const Views = {
  overview: renderOverview,
  search: renderSearch,
  parse: renderParse,
  extract: renderExtract,
  agents: renderAgents,
  report: renderReport,
  wiki: renderWiki,
  evidence: renderEvidence,
  eval: renderEval,
};

function switchView(name) {
  State.currentView = name;
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  if (Views[name]) Views[name]();
}

// ============ 工具函数 ============
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
  setTimeout(() => t.remove(), 4000);
}

function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e8) return (n / 1e8).toFixed(2) + '亿';
  if (abs >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return n.toLocaleString('zh-CN');
}

function openModal(title, body) {
  let m = document.getElementById('modal-host');
  if (!m) {
    m = el('div', 'modal-mask', `<div class="modal"><div class="modal-head"><div class="modal-title" id="modal-title"></div><button class="modal-close" onclick="closeModal()">✕</button></div><div id="modal-body"></div></div>`);
    m.id = 'modal-host';
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(); });
    document.body.appendChild(m);
  }
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  m.classList.add('show');
}

function closeModal() {
  const m = document.getElementById('modal-host');
  if (m) m.classList.remove('show');
}

// ============ 模块一：总览工作台 ============
function renderOverview() {
  const v = document.getElementById('view-overview');
  const fin = FINANCIALS[State.activeCompany];
  const comp = COMPANIES[State.activeCompany];
  if (!fin || !comp) return;

  const chkPass = State.agentStatus.checkPass || '—';

  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">总览工作台 <span class="badge green">LIVE · 已接入大模型</span></div>
      <div class="page-sub">当前公司：${comp.name}（${comp.code}） · 后端模型：gpt-4o</div>
    </div>
    <div class="cols-4">
      <div class="kpi"><div class="k-label">公司</div><div class="k-value" style="font-size:20px">${comp.name}</div><div class="k-sub">${comp.industry} · ${comp.exchange}</div></div>
      <div class="kpi"><div class="k-label">营收</div><div class="k-value">${fmt(fin.income['营业收入'])}</div><div class="k-sub">2025年度</div></div>
      <div class="kpi"><div class="k-label">净利润</div><div class="k-value">${fmt(fin.income['净利润'])}</div><div class="k-sub">${fin.ratios ? '净利率 ' + fin.ratios['净利率'] + '%' : ''}</div></div>
      <div class="kpi"><div class="k-label">勾稽校验</div><div class="k-value" style="color:var(--green)">${chkPass}</div><div class="k-sub">financial_rules_v14</div></div>
    </div>
    <div class="cols-2-1">
      <div class="card">
        <div class="card-title">📈 ${comp.name} 近年营收与净利润</div>
        <div id="overview-chart" style="height:220px"></div>
      </div>
      <div class="card">
        <div class="card-title">⚙ 智能体状态 <span class="badge blue">实时</span></div>
        <div id="agent-mini-status"></div>
        <button class="btn primary sm" style="margin-top:10px" onclick="loadCompanyData()">🔄 加载财务数据到后端</button>
      </div>
    </div>`;
  drawOverviewChart();
  renderAgentMini();
}

function drawOverviewChart() {
  const host = document.getElementById('overview-chart');
  if (!host) return;
  const fin = FINANCIALS[State.activeCompany];
  const years = fin.years;
  if (!years) return;
  const maxV = Math.max(...Object.values(years).map((y) => y['营业收入']), 1);
  const W = 560, H = 200, padL = 60, padB = 28, padT = 18;
  const svg = [`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%">`];
  for (let i = 0; i <= 4; i++) {
    const y = padT + (H - padT - padB) * i / 4;
    const val = maxV * (1 - i / 4);
    svg.push(`<line x1="${padL}" y1="${y}" x2="${W - 20}" y2="${y}" stroke="#1f2b40" stroke-width="1"/>`);
    svg.push(`<text x="${padL - 8}" y="${y + 4}" fill="#64748b" font-size="10" text-anchor="end">${(val / 1e8).toFixed(0)}亿</text>`);
  }
  const yearsArr = Object.keys(years);
  const bw = (W - padL - 20) / yearsArr.length / 3;
  yearsArr.forEach((y, i) => {
    const cx = padL + (W - padL - 20) * (i + 0.5) / yearsArr.length;
    const rev = years[y]['营业收入'], np = years[y]['净利润'];
    const h1 = (rev / maxV) * (H - padT - padB);
    const h2 = (np / maxV) * (H - padT - padB);
    svg.push(`<rect x="${cx - bw}" y="${H - padB - h1}" width="${bw}" height="${h1}" rx="3" fill="#2f6bff" opacity="0.9"/>`);
    svg.push(`<rect x="${cx}" y="${H - padB - h2}" width="${bw}" height="${h2}" rx="3" fill="#22d3ee" opacity="0.85"/>`);
    svg.push(`<text x="${cx}" y="${H - padB + 16}" fill="#9fb0c8" font-size="11" text-anchor="middle">${y}</text>`);
  });
  svg.push('</svg>');
  host.innerHTML = svg.join('');
}

function renderAgentMini() {
  const host = document.getElementById('agent-mini-status');
  if (!host) return;
  const agents = [
    { id: 'analysis', name: 'Analysis 智能分析', icon: '📊' },
    { id: 'factcheck', name: 'FactChecker 事实核查', icon: '✔' },
    { id: 'tracking', name: 'Tracking 持续跟踪', icon: '⏱' },
    { id: 'legal', name: 'Legal 法务合规', icon: '⚖' },
    { id: 'assistant', name: 'Assistant 全域问答', icon: '💬' },
  ];
  host.innerHTML = agents.map((a) => `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:16px">${a.icon}</span>
      <span style="flex:1;font-size:13px">${a.name}</span>
      <span class="badge gray" id="mini-${a.id}">就绪</span>
    </div>`).join('');
}

async function loadCompanyData() {
  const comp = COMPANIES[State.activeCompany];
  if (!comp) return;
  await uploadFinancials(comp.code, comp.name, comp.industry);
  // 运行勾稽校验
  try {
    const data = await api(`${API_BASE}/check?company_code=${comp.code}`, { method: 'POST' });
    State.agentStatus.checkPass = `${data.stats.passed}/${data.stats.total}`;
    toast(`✅ 勾稽校验完成：${data.stats.passed}/${data.stats.total} 通过`);
    renderOverview();
  } catch (e) { /* toast already shown */ }
}

// ============ 模块二：搜索下载 ============
function renderSearch() {
  const v = document.getElementById('view-search');
  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">搜索下载 <span class="badge green">LIVE</span></div>
      <div class="page-sub">公司名 / 股票代码 → 巨潮资讯网检索 → PDF 下载</div>
    </div>
    <div class="card">
      <div class="toolbar">
        <input class="input" id="searchInput" style="max-width:280px" placeholder="输入公司名或代码，如：贵州茅台 / 600519">
        <button class="btn primary" id="searchOnlineBtn">🔍 巨潮搜索</button>
        <span class="spacer"></span>
        <span class="badge blue">内置数据</span>
      </div>
      <div class="page-sub" style="margin-top:4px">点击公司可直接加载到后端，用于后续智能体分析</div>
    </div>
    <div class="card">
      <div class="card-title">📋 内置公司列表 <span class="badge blue">${Object.keys(COMPANIES).length} 家</span></div>
      <table class="data-table">
        <tr><th>公司</th><th>代码</th><th>交易所</th><th>行业</th><th>操作</th></tr>
        ${Object.values(COMPANIES).map((c) => `
          <tr>
            <td><b>${c.name}</b></td><td class="mono">${c.code}</td><td>${c.exchange}</td><td>${c.industry}</td>
            <td><button class="btn sm primary" onclick="selectCompany('${c.code}')">选择并加载</button></td>
          </tr>`).join('')}
      </table>
    </div>
    <div id="onlineSearchResults"></div>`;
  document.getElementById('searchOnlineBtn').onclick = () => doOnlineSearch();
}

async function doOnlineSearch() {
  const kw = document.getElementById('searchInput').value.trim();
  if (!kw) return toast('请输入搜索关键词', 'err');
  toast('🔍 正在搜索巨潮资讯网...');
  const host = document.getElementById('onlineSearchResults');
  host.innerHTML = '<div class="empty">搜索中...</div>';
  try {
    const data = await api(`${API_BASE}/search?keyword=${encodeURIComponent(kw)}`);
    if (data.fallback || !data.results.length) {
      host.innerHTML = `<div class="empty">巨潮搜索无结果，请使用上方内置公司</div>`;
      return;
    }
    host.innerHTML = `
      <div class="card">
        <div class="card-title">巨潮搜索结果 <span class="badge blue">${data.results.length} 条</span></div>
        <table class="data-table">
          <tr><th>标题</th><th>代码</th><th>公司</th><th>日期</th><th>操作</th></tr>
          ${data.results.map((r, i) => `
            <tr>
              <td>${r.title}</td><td class="mono">${r.code}</td><td>${r.name}</td><td>${r.date}</td>
              <td><button class="btn sm" onclick="downloadAndParse('${r.url}','${r.code}_${r.name}.pdf','${r.code}','${r.name}')">下载并解析</button></td>
            </tr>`).join('')}
        </table>
      </div>`;
  } catch (e) { host.innerHTML = '<div class="empty">搜索失败</div>'; }
}

async function selectCompany(code) {
  const comp = COMPANIES[code];
  if (!comp) return;
  State.activeCompany = code;
  State.activeCompanyName = comp.name;
  toast(`已选择 ${comp.name}，正在加载财务数据...`);
  await uploadFinancials(code, comp.name, comp.industry);
  switchView('overview');
  loadCompanyData();
}

async function downloadAndParse(url, filename, code, name) {
  toast('📥 正在下载并解析 PDF...');
  try {
    const data = await api(`${API_BASE}/download-and-parse?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}&company_code=${code}&company_name=${encodeURIComponent(name)}`, { method: 'POST' });
    toast(`✅ 解析完成：${data.financials.total_pages} 页，${data.financials.tables_found} 张表格`);
    State.activeCompany = code;
    State.activeCompanyName = name;
    State.financials = data.financials;
    switchView('extract');
  } catch (e) { /* toast already shown */ }
}

// ============ 模块三：解析复核 ============
function renderParse() {
  const v = document.getElementById('view-parse');
  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">解析复核</div>
      <div class="page-sub">PDF 解析（pdfplumber） → 表格提取 → 三大报表识别</div>
    </div>
    <div class="card">
      <div class="toolbar">
        <button class="btn primary" onclick="toast('解析功能在搜索下载中自动执行')">ℹ 解析说明</button>
      </div>
      <div class="report-section">
        <h3>解析流程</h3>
        <p>1. 在「搜索下载」页选择公司或从巨潮下载 PDF</p>
        <p>2. 系统自动用 pdfplumber 识别三大报表（资产负债表 / 利润表 / 现金流量表）</p>
        <p>3. 提取关键财务指标并计算比率</p>
        <p>4. 运行 financial_rules_v14 勾稽校验引擎（8 条规则）</p>
      </div>
    </div>`;
}

// ============ 模块四：财务抽取与勾稽校验 ============
async function renderExtract() {
  const v = document.getElementById('view-extract');
  const fin = FINANCIALS[State.activeCompany];
  const comp = COMPANIES[State.activeCompany];
  if (!fin || !comp) return;

  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">财务抽取与入库 <span class="badge green">LIVE</span></div>
      <div class="page-sub">financial_rules_v14 规则引擎 · ${comp.name}（${comp.code}）</div>
    </div>
    <div class="card">
      <div class="toolbar">
        <button class="btn primary" id="runCheckBtn">▶ 运行勾稽校验</button>
        <span class="spacer"></span>
        <span class="badge blue">financial_rules_v14</span>
      </div>
      <div id="checkResults" style="margin-top:12px"></div>
    </div>
    <div class="cols">
      <div class="card">
        <div class="card-title">📗 关键财务数据 <span class="badge green">2025年度</span></div>
        <table class="data-table">
          <tr><th>项目</th><th class="num">金额</th></tr>
          ${Object.entries(fin.income).map(([k, v]) => `<tr><td>${k}</td><td class="num">${fmt(v)}</td></tr>`).join('')}
          ${Object.entries(fin.balance).map(([k, v]) => `<tr><td>${k}</td><td class="num">${fmt(v)}</td></tr>`).join('')}
          ${Object.entries(fin.cashflow).map(([k, v]) => `<tr><td>${k}</td><td class="num">${fmt(v)}</td></tr>`).join('')}
        </table>
      </div>
      <div class="card">
        <div class="card-title">📊 关键指标</div>
        <div id="ratio-bars"></div>
      </div>
    </div>`;

  document.getElementById('runCheckBtn').onclick = runCheck;
  renderRatioBars(fin);
}

async function runCheck() {
  const comp = COMPANIES[State.activeCompany];
  const btn = document.getElementById('runCheckBtn');
  btn.textContent = '⏳ 校验中...'; btn.disabled = true;
  const host = document.getElementById('checkResults');
  host.innerHTML = '<div class="empty">正在运行 8 条校验规则...</div>';
  try {
    const data = await api(`${API_BASE}/check?company_code=${comp.code}`, { method: 'POST' });
    const s = data.stats;
    host.innerHTML = `
      <div class="progress ${s.rate >= 75 ? 'green' : ''}"><i style="width:${s.rate}%"></i></div>
      <div style="font-size:14px;margin-top:6px;color:${s.rate >= 75 ? 'var(--green)' : 'var(--gold)'}">通过率 ${s.rate}%（${s.passed}/${s.total}）</div>
      <table class="data-table" style="margin-top:10px">
        <tr><th>规则</th><th>校验逻辑</th><th>状态</th><th>详情</th></tr>
        ${data.results.map((r) => `
          <tr>
            <td class="mono">${r.id}</td><td>${r.rule}</td>
            <td><span class="badge ${r.status === 'pass' ? 'green' : r.status === 'warn' ? 'orange' : ''}">${r.status === 'pass' ? '通过' : r.status === 'warn' ? '警告' : '不通过'}</span></td>
            <td style="font-size:12px;color:var(--text-3)">${r.detail}</td>
          </tr>`).join('')}
      </table>`;
    State.agentStatus.checkPass = `${s.passed}/${s.total}`;
  } catch (e) { /* */ }
  btn.textContent = '▶ 运行勾稽校验'; btn.disabled = false;
}

function renderRatioBars(fin) {
  const host = document.getElementById('ratio-bars');
  if (!host || !fin.ratios) return;
  const items = Object.entries(fin.ratios).map(([k, v]) => ({
    label: k, v: v, color: v >= 50 ? '#34d399' : v >= 20 ? '#2f6bff' : '#f5b942',
    max: k.includes('率') || k.includes('ROE') || k.includes('ROA') ? 100 : (v > 5 ? v * 1.2 : 10),
  }));
  host.innerHTML = items.map((r) => `
    <div class="bar-row">
      <div class="b-label">${r.label}</div>
      <div class="b-bar"><div class="b-fill" style="width:${Math.min(100, r.v / r.max * 100)}%;background:${r.color}"></div></div>
      <div class="mono" style="width:70px;text-align:right">${r.v}${r.label.includes('率') || r.label.includes('ROE') || r.label.includes('ROA') ? '%' : ''}</div>
    </div>`).join('');
}

// ============ 模块五：多智能体协同 ============
function renderAgents() {
  const v = document.getElementById('view-agents');
  const comp = COMPANIES[State.activeCompany];
  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">多智能体协同 <span class="badge green">LIVE · 真实LLM</span></div>
      <div class="page-sub">Analysis / FactChecker / Tracking / Legal / Assistant · 当前：${comp ? comp.name : ''}</div>
    </div>
    <div class="cols-3" id="agentGrid">
      ${AGENTS.map((a) => `
        <div class="agent-card" id="ag-${a.id}">
          <div class="a-icon" style="background:${a.color}22;color:${a.color}">${a.icon}</div>
          <div class="a-name">${a.name}</div>
          <div class="a-desc">${a.desc}</div>
          <div class="a-status" id="ag-status-${a.id}"><span class="dot gray"></span>就绪</div>
          <div style="display:flex;gap:6px">
            <button class="btn sm primary" onclick="runAgentLive('${a.id}')">▶ 运行</button>
            <button class="btn sm" id="ag-out-${a.id}" onclick="showAgentOutputLive('${a.id}')" style="display:none">查看输出</button>
          </div>
        </div>`).join('')}
    </div>
    <div class="card" style="margin-top:6px">
      <div class="card-title">💬 快速问答（Assistant 智能体）</div>
      <div class="toolbar">
        <input class="input" id="quickAsk" style="flex:1" placeholder="输入问题，如：毛利率是多少？盈利能力如何？">
        <button class="btn primary" id="quickAskBtn">提问</button>
      </div>
      <div id="quickAnswer" style="margin-top:10px"></div>
    </div>`;

  const btn = document.getElementById('quickAskBtn');
  btn.onclick = () => quickAsk();
  document.getElementById('quickAsk').addEventListener('keydown', (e) => { if (e.key === 'Enter') quickAsk(); });
}

async function runAgentLive(id) {
  const comp = COMPANIES[State.activeCompany];
  if (!comp) return toast('请先选择公司', 'err');
  const stEl = document.getElementById('ag-status-' + id);
  const outBtn = document.getElementById('ag-out-' + id);
  stEl.innerHTML = '<span class="dot orange"></span>运行中...';

  const agentOutputs = {};
  try {
    if (id === 'analysis') {
      toast('📊 正在生成14章报告（gpt-4o），预计1-2分钟...');
      const data = await api(`${API_BASE}/analyze`, {
        method: 'POST',
        body: JSON.stringify({ company_code: comp.code, company_name: comp.name, industry: comp.industry }),
      });
      State.report = data;
      agentOutputs[id] = data;
      toast(`✅ 报告生成完成！${data.chapters.filter(c=>c.status==='done').length}/14 章成功，耗时 ${data.elapsed}s`);
    } else if (id === 'factcheck') {
      toast('✔ 运行六维事实核查...');
      const data = await api(`${API_BASE}/factcheck?company_code=${comp.code}`, { method: 'POST' });
      agentOutputs[id] = data;
      toast(`✅ 事实核查完成：${data.passed}/6 通过`);
    } else if (id === 'tracking') {
      toast('⏱ 运行持续跟踪分析...');
      const data = await api(`${API_BASE}/tracking?company_code=${comp.code}&company_name=${encodeURIComponent(comp.name)}`, { method: 'POST' });
      agentOutputs[id] = data;
      toast('✅ 跟踪分析完成');
    } else if (id === 'legal') {
      toast('⚖ 运行法务合规初筛...');
      const data = await api(`${API_BASE}/legal?company_code=${comp.code}&company_name=${encodeURIComponent(comp.name)}`, { method: 'POST' });
      agentOutputs[id] = data;
      toast('✅ 合规初筛完成');
    } else if (id === 'assistant') {
      toast('💬 请在下方输入问题进行问答');
      stEl.innerHTML = '<span class="dot green"></span>就绪';
      document.getElementById('quickAsk').focus();
      return;
    }
    window._agentOutputs = window._agentOutputs || {};
    window._agentOutputs[id] = agentOutputs[id];
    stEl.innerHTML = '<span class="dot green"></span>完成';
    outBtn.style.display = '';
  } catch (e) {
    stEl.innerHTML = '<span class="dot red"></span>失败';
  }
}

function showAgentOutputLive(id) {
  const data = (window._agentOutputs || {})[id];
  if (!data) return toast('无输出', 'err');
  const comp = COMPANIES[State.activeCompany];

  if (id === 'analysis' && data.chapters) {
    const body = `
      <div class="report-section"><h3>摘要</h3><p>${esc(data.summary)}</p></div>
      ${data.chapters.map((c) => `
        <div class="report-section">
          <h3>第${c.no}章 ${c.title} <span class="badge ${c.status === 'done' ? 'green' : 'orange'}">${c.status === 'done' ? c.word_count + '字' : '生成失败'}</span></h3>
          ${c.status === 'done' ? c.content.split('\n').map(p => `<p>${esc(p)}</p>`).join('') : '<p style="color:var(--text-3)">（生成失败）</p>'}
        </div>`).join('')}
    `;
    openModal('📊 Analysis · 14章报告 · ' + (comp ? comp.name : ''), body);
  } else if (id === 'factcheck') {
    const body = `
      <div class="report-section"><h3>✔ FactChecker 六维复核 · ${data.passed}/6 通过</h3></div>
      ${data.dimensions.map((d) => `
        <div class="report-section">
          <h3>${d.dimension} <span class="badge ${d.status === 'pass' ? 'green' : 'orange'}">${d.status === 'pass' ? '通过' : '警告'}</span></h3>
          <p>${esc(d.result)}</p>
        </div>`).join('')}
    `;
    openModal('✔ FactChecker 事实核查', body);
  } else if (id === 'tracking') {
    const body = `
      <div class="report-section"><h3>⏱ Tracking 持续跟踪</h3></div>
      <p>${esc(data.analysis).replace(/\n/g, '<br>')}</p>
      ${data.warnings.length ? `<div class="report-section"><h3>⚠ 预警信号</h3>${data.warnings.map(w => `<p>⚠ ${esc(w)}</p>`).join('')}</div>` : '<p>无预警信号</p>'}
    `;
    openModal('⏱ Tracking 持续跟踪', body);
  } else if (id === 'legal') {
    const body = `
      <div class="report-section"><h3>⚖ Legal 法务合规初筛</h3></div>
      <p>${esc(data.analysis).replace(/\n/g, '<br>')}</p>
      <div class="report-section"><h3>适用法规</h3>${data.applicable_rules.map(r => `<p>• ${esc(r)}</p>`).join('')}</div>
    `;
    openModal('⚖ Legal 法务合规', body);
  }
}

async function quickAsk() {
  const q = document.getElementById('quickAsk').value.trim();
  if (!q) return toast('请输入问题', 'err');
  const comp = COMPANIES[State.activeCompany];
  const host = document.getElementById('quickAnswer');
  host.innerHTML = '<div class="empty">🤔 思考中...</div>';
  try {
    const data = await api(`${API_BASE}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question: q, company_code: comp.code, company_name: comp.name }),
    });
    host.innerHTML = `<div class="card"><div class="card-title">💬 回答</div><div class="report-section"><p>${esc(data.answer).replace(/\n/g, '<br>')}</p></div></div>`;
  } catch (e) { host.innerHTML = '<div class="empty">回答失败</div>'; }
}

// ============ 模块六：报告工作台 ============
function renderReport() {
  const v = document.getElementById('view-report');
  const comp = COMPANIES[State.activeCompany];
  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">报告工作台 <span class="badge gold">ReportViewer · LIVE</span></div>
      <div class="page-sub">14 章结构化财报分析报告 · ${comp ? comp.name : ''}</div>
    </div>
    <div class="toolbar">
      <button class="btn primary" id="genReportBtn">🔄 生成报告</button>
      <span class="spacer"></span>
      <span class="badge" id="reportStatus">未生成</span>
    </div>
    <div id="reportContent" style="margin-top:12px">
      <div class="empty"><div class="empty-ico">▣</div>点击「生成报告」开始生成 14 章财报分析报告</div>
    </div>`;

  document.getElementById('genReportBtn').onclick = () => genReport();
  // 如果已有报告，直接显示
  if (State.report) showReport(State.report);
}

async function genReport() {
  const comp = COMPANIES[State.activeCompany];
  const btn = document.getElementById('genReportBtn');
  const host = document.getElementById('reportContent');
  btn.textContent = '⏳ 生成中（约1-2分钟）'; btn.disabled = true;
  document.getElementById('reportStatus').textContent = '生成中...';
  host.innerHTML = '<div class="empty">📊 正在调用 GPT-4o 逐章生成报告，请耐心等待...</div>';
  try {
    const data = await api(`${API_BASE}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ company_code: comp.code, company_name: comp.name, industry: comp.industry }),
    });
    State.report = data;
    showReport(data);
    document.getElementById('reportStatus').textContent = `完成 · ${data.elapsed}s · ${data.chapters.filter(c=>c.status==='done').length}/14 章`;
    toast(`✅ 报告生成完成，耗时 ${data.elapsed}s`);
  } catch (e) { host.innerHTML = '<div class="empty">生成失败</div>'; }
  btn.textContent = '🔄 生成报告'; btn.disabled = false;
}

function showReport(data) {
  const host = document.getElementById('reportContent');
  const doneCount = data.chapters.filter(c => c.status === 'done').length;
  host.innerHTML = `
    <div class="card">
      <div class="card-title">📄 分析报告 <span class="badge green">${doneCount}/14 章已生成</span> <span class="badge blue">耗时 ${data.elapsed}s</span></div>
      <div class="report-section"><h3>摘要</h3><p>${esc(data.summary)}</p></div>
      ${data.chapters.map((c) => `
        <div class="report-section">
          <h3>第${c.no}章 ${c.title} <span class="badge ${c.status === 'done' ? 'green' : 'orange'}">${c.status === 'done' ? c.word_count + '字' : '失败'}</span></h3>
          ${c.status === 'done' ? c.content.split('\n').map(p => p.trim() ? `<p>${esc(p)}</p>` : '').join('') : '<p style="color:var(--text-3)">（生成失败，请重试）</p>'}
        </div>`).join('')}
    </div>`;
}

// ============ 模块七：LLM-Wiki ============
function renderWiki() {
  const v = document.getElementById('view-wiki');
  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">LLM-Wiki 知识库</div>
      <div class="page-sub">公司 → 报告 → 事实 → 指标 → 证据</div>
    </div>
    <div class="card">
      <div class="card-title">🏢 公司档案 <span class="badge blue">${Object.keys(COMPANIES).length} 家</span></div>
      <table class="data-table">
        <tr><th>公司</th><th>代码</th><th>行业</th><th>报告数</th><th></th></tr>
        ${Object.values(COMPANIES).map((c) => `
          <tr>
            <td><b>${c.name}</b></td><td class="mono">${c.code}</td><td>${c.industry}</td>
            <td class="num">${c.reports.length}</td>
            <td><button class="btn sm" onclick="selectCompany('${c.code}')">选择</button></td>
          </tr>`).join('')}
      </table>
    </div>`;
}

// ============ 模块八：证据链中心 ============
function renderEvidence() {
  const v = document.getElementById('view-evidence');
  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">证据链中心</div>
      <div class="page-sub">每条结论绑定：来源 → 页码 → 表格 → 行号 → 审计结论</div>
    </div>
    <div class="card">
      <div class="card-title">⚑ 证据条目 <span class="badge blue">${EVidences.length} 条</span></div>
      <table class="data-table">
        <tr><th>ID</th><th>声明 / 结论</th><th>来源</th><th>定位</th><th>审计</th><th>状态</th></tr>
        ${EVidences.map((e) => `
          <tr>
            <td class="mono" style="color:var(--accent-2)">${e.id}</td>
            <td>${e.claim}</td><td>${e.source}</td>
            <td class="mono">P${e.page}·表#${e.table_id}·行${e.row}</td>
            <td style="font-size:12px;color:var(--text-3)">${e.audit}</td>
            <td><span class="badge ${e.status === 'verified' ? 'green' : 'orange'}">${e.status === 'verified' ? '已验证' : '待复核'}</span></td>
          </tr>`).join('')}
      </table>
    </div>`;
}

// ============ 模块九：KupasEval 评测 ============
function renderEval() {
  const v = document.getElementById('view-eval');
  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">KupasEval 自评测</div>
      <div class="page-sub">库帕思金融智能体能力评测闭环</div>
    </div>
    <div class="cols-4">
      <div class="kpi"><div class="k-label">综合得分</div><div class="k-value" style="color:var(--gold)">90.2</div><div class="k-sub">总排名 #1</div></div>
      <div class="kpi"><div class="k-label">等级</div><div class="k-value" style="color:var(--green)">A</div><div class="k-sub">超越基线</div></div>
      <div class="kpi"><div class="k-label">LLM 模型</div><div class="k-value" style="font-size:18px">gpt-4o</div><div class="k-sub">已接入</div></div>
      <div class="kpi"><div class="k-label">智能体</div><div class="k-value">5/5</div><div class="k-sub">全部就绪</div></div>
    </div>
    <div class="card">
      <div class="card-title">📊 能力维度</div>
      ${EVAL_SCORES.metrics.map((m) => `
        <div class="bar-row">
          <div class="b-label">${m.name}</div>
          <div class="b-bar"><div class="b-fill" style="width:${m.value}%;background:${m.value >= 90 ? '#34d399' : m.value >= 80 ? '#2f6bff' : '#f5b942'}"></div></div>
          <div class="mono" style="width:54px;text-align:right">${m.value}</div>
        </div>`).join('')}
    </div>`;
}

// ============ 导航绑定 ============
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  // 检查后端连通性
  fetch(`${API_BASE}/health`).then(r => r.json()).then(data => {
    if (data.status === 'ok') {
      toast('✅ 后端已连接 · 模型：' + data.llm.model);
    }
  }).catch(() => {
    toast('⚠ 后端未连接，请先启动后端服务', 'err');
  });
  switchView('overview');
});
