/* ============================================================
   FinSight 财报智能分析平台 — 核心引擎 Part 2
   视图渲染 + 交互逻辑（依赖 data.js）
   ============================================================ */

/* ============ 视图渲染入口 ============ */
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
  const target = document.getElementById('view-' + name);
  target.classList.add('active');
  if (Views[name]) Views[name]();
}

/* ============ 模块一：总览工作台 ============ */
function renderOverview() {
  const v = document.getElementById('view-overview');
  const fin = FINANCIALS[State.activeCompany];
  const comp = COMPANIES[State.activeCompany];
  if (!fin || !comp) return;

  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">总览工作台</div>
      <div class="page-sub">基于全链路可审计证据链的财报分析工作站 · 当前公司：${comp.name}（${comp.code}）</div>
    </div>

    <div class="cols-4">
      <div class="kpi"><div class="k-label">已解析年报</div><div class="k-value">312</div><div class="k-sub">页 · MinerU 版面恢复</div></div>
      <div class="kpi"><div class="k-label">证据条目</div><div class="k-value">1,284</div><div class="k-sub">可审计 · 绑定页码</div></div>
      <div class="kpi"><div class="k-label">勾稽校验</div><div class="k-value" style="color:var(--green)">6/8</div><div class="k-sub">2 项警告待复核</div></div>
      <div class="kpi"><div class="k-label">KupasEval 综合得分</div><div class="k-value" style="color:var(--gold)">90.2</div><div class="k-sub">等级 A · 总排名 #1</div></div>
    </div>

    <div class="cols-2-1">
      <div class="card">
        <div class="card-title">📈 ${comp.name} 近年营收与净利润 <span class="badge blue">勾稽校验通过</span></div>
        <div id="overview-chart" style="height:220px"></div>
      </div>
      <div class="card">
        <div class="card-title">⚙ 流水线状态</div>
        <div id="pipeline-status"></div>
      </div>
    </div>

    <div class="cols">
      <div class="card">
        <div class="card-title">🕐 最近解析任务</div>
        <table class="data-table">
          <tr><th>公司</th><th>报告</th><th>状态</th><th>耗时</th><th>质量</th></tr>
          <tr><td>${comp.name}</td><td>2025年报</td><td><span class="dot green"></span>完成</td><td class="mono">4m 32s</td><td><span class="badge green">96.2</span></td></tr>
          <tr><td>宁德时代</td><td>2025年报</td><td><span class="dot green"></span>完成</td><td class="mono">3m 58s</td><td><span class="badge green">95.8</span></td></tr>
          <tr><td>中国平安</td><td>2025年报</td><td><span class="dot green"></span>完成</td><td class="mono">5m 12s</td><td><span class="badge green">94.6</span></td></tr>
          <tr><td>招商银行</td><td>2025年报</td><td><span class="dot orange"></span>复核中</td><td class="mono">2m 05s</td><td><span class="badge orange">88.4</span></td></tr>
        </table>
      </div>
      <div class="card">
        <div class="card-title">🛡️ 五智能体协同状态</div>
        <div id="agent-mini-status"></div>
      </div>
    </div>
  `;

  drawOverviewChart();
  drawPipeline();
  renderAgentMini();
}

/* 总览：绘制营收/净利润柱状图（纯 SVG） */
function drawOverviewChart() {
  const host = document.getElementById('overview-chart');
  if (!host) return;
  const fin = FINANCIALS[State.activeCompany];
  const years = fin.years;
  if (!years) return;
  const maxV = Math.max(...Object.values(years).map((y) => y['营业收入']), 1);
  const W = 560, H = 200, padL = 60, padB = 28, padT = 18;
  const svg = [];
  svg.push(`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%">`);
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
  svg.push(`<rect x="${padL + 6}" y="${padT - 14}" width="${bw}" height="8" rx="2" fill="#2f6bff"/><text x="${padL + 6 + bw + 4}" y="${padT - 6}" fill="#9fb0c8" font-size="10">营业收入</text>`);
  svg.push(`<rect x="${padL + 96}" y="${padT - 14}" width="${bw}" height="8" rx="2" fill="#22d3ee"/><text x="${padL + 96 + bw + 4}" y="${padT - 6}" fill="#9fb0c8" font-size="10">净利润</text>`);
  svg.push('</svg>');
  host.innerHTML = svg.join('');
}

/* 总览：流水线状态 */
function drawPipeline() {
  const host = document.getElementById('pipeline-status');
  if (!host) return;
  const steps = [
    { name: '搜索下载', sub: '巨潮 · 312页', st: 'done' },
    { name: '解析复核', sub: 'MinerU · 96.2', st: 'done' },
    { name: '抽取入库', sub: 'PG/Milvus', st: 'active' },
    { name: '智能体生成', sub: '5 Agents', st: 'pending' },
    { name: '报告回溯', sub: 'ReportViewer', st: 'pending' },
  ];
  host.innerHTML = `<div class="steps">${steps.map((s, i) => `<div class="step ${s.st === 'done' ? 'done' : s.st === 'active' ? 'active' : ''}"><div class="step-num">${i + 1}</div>${s.name}<div style="font-size:10px;color:var(--text-3)">${s.sub}</div></div>`).join('')}</div>`;
}

function renderAgentMini() {
  const host = document.getElementById('agent-mini-status');
  if (!host) return;
  host.innerHTML = AGENTS.map((a) => `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:16px">${a.icon}</span>
      <span style="flex:1;font-size:13px">${a.name}</span>
      <span class="badge ${a.id === 'analysis' ? 'green' : 'gray'}">${a.id === 'analysis' ? '运行中' : '就绪'}</span>
    </div>`).join('');
}

/* ============ 模块二：搜索下载 ============ */
function renderSearch() {
  const v = document.getElementById('view-search');
  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">搜索下载</div>
      <div class="page-sub">公司名 / 股票代码 → 巨潮公告检索 → PDF 下载</div>
    </div>

    <div class="card">
      <div class="toolbar">
        <input class="input" id="searchCompany" style="max-width:280px" placeholder="输入公司名或代码，如：贵州茅台 / 600519">
        <select class="input" id="searchMarket" style="max-width:140px">
          <option value="all">全部市场</option><option>上交所</option><option>深交所</option>
        </select>
        <select class="input" id="searchReport" style="max-width:140px">
          <option>2025年报</option><option>2024年报</option><option>2024三季报</option><option>2024中报</option>
        </select>
        <button class="btn primary" id="searchBtn">🔍 检索公告</button>
        <span class="spacer"></span>
        <button class="btn" id="clearSearch">清空</button>
      </div>
      <div class="page-sub" style="margin-top:4px">数据源：巨潮资讯网（模拟） · 支持下载 PDF 原文</div>
    </div>

    <div id="searchResults">
      <div class="empty"><div class="empty-ico">⌕</div>输入关键词检索公告</div>
    </div>
  `;

  document.getElementById('searchBtn').onclick = () => doSearch();
  document.getElementById('searchCompany').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  document.getElementById('clearSearch').onclick = () => { document.getElementById('searchCompany').value = ''; renderSearch(); };
}

function doSearch() {
  const input = document.getElementById('searchCompany').value.trim();
  const report = document.getElementById('searchReport').value;
  const results = [];

  Object.values(COMPANIES).forEach((c) => {
    const match = input === '' || c.name.includes(input) || c.code.includes(input) || input.toLowerCase().includes(c.code.slice(-4));
    if (match) {
      results.push({
        code: c.code, name: c.name, report, date: '2026-03-31', size: '4.8MB', pages: 312,
        from: c.exchange, source: '巨潮资讯',
      });
    }
  });
  if (input && results.length === 0) results.push({ code: '—', name: '未找到匹配公司', report, date: '', size: '', pages: 0, from: '', source: '' });

  State.searchResults = results;
  renderSearchResults(results);
}

function renderSearchResults(list) {
  const host = document.getElementById('searchResults');
  if (!host) return;
  if (!list.length) {
    host.innerHTML = `<div class="empty"><div class="empty-ico">⌕</div>无匹配结果</div>`;
    return;
  }
  host.innerHTML = `
    <div class="card">
      <div class="card-title">检索结果 <span class="badge blue">${list.length} 条</span></div>
      <table class="data-table">
        <tr><th>公司</th><th>代码</th><th>报告</th><th>交易所</th><th>披露日期</th><th>页数</th><th>操作</th></tr>
        ${list.map((r) => `
          <tr>
            <td><b>${r.name}</b></td>
            <td class="mono">${r.code}</td>
            <td>${r.report}</td>
            <td>${r.from || '—'}</td>
            <td>${r.date || '—'}</td>
            <td class="num">${r.pages || '—'}</td>
            <td>
              <button class="btn sm primary" onclick="downloadReport('${r.code}')">下载 PDF</button>
            </td>
          </tr>`).join('')}
      </table>
    </div>`;
}

/* 模拟下载 */
function downloadReport(code) {
  State.activeCompany = code;
  toast(`📥 已开始下载 ${COMPANIES[code].name} 年报 PDF（模拟）`);
  setTimeout(() => {
    toast(`✅ 下载完成：${COMPANIES[code].name}_2025年报.pdf · 4.8MB`);
  }, 1200);
}

/* ============ 模块三：解析复核 ============ */
function renderParse() {
  const v = document.getElementById('view-parse');
  const pa = PARSE_ASSETS;

  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">解析复核</div>
      <div class="page-sub">MinerU-2.5pro-1.2b + VLM 视觉辅助解析 · 输出 Markdown / JSON / 表格索引 / BBox / 质量报告</div>
    </div>

    <div class="card">
      <div class="toolbar">
        <button class="btn primary" id="startParse">▶ 开始解析</button>
        <button class="btn" id="parseDownload">导出 document_full.json</button>
        <span class="spacer"></span>
        <span class="badge">引擎：MinerU-2.5pro-1.2b</span>
        <span class="badge blue">VLM: Qwen3-VL-2b</span>
      </div>
      <div id="parseProgress" style="margin-top:10px"></div>
      <div id="parseLog" class="mono" style="margin-top:12px;max-height:200px;overflow-y:auto;font-size:12px;color:var(--text-2);background:var(--bg-0);padding:12px;border-radius:8px;white-space:pre-wrap"></div>
    </div>

    <div class="cols">
      <div class="card">
        <div class="card-title">📄 解析产物 <span class="badge green">8 大产物</span></div>
        <div class="chips" style="margin-bottom:10px">
          <span class="chip blue">document_full.json</span><span class="chip">report.md</span>
          <span class="chip">tables.json</span><span class="chip">bbox.json</span>
          <span class="chip">quality.json</span><span class="chip">pages.pdf</span>
        </div>
        <table class="data-table">
          <tr><th>产物</th><th>说明</th><th>状态</th></tr>
          <tr><td class="mono">document_full.json</td><td>原文+结构+表格+图片+质量</td><td><span class="badge green">已生成</span></td></tr>
          <tr><td class="mono">report.md</td><td>Markdown 结构化正文</td><td><span class="badge green">已生成</span></td></tr>
          <tr><td class="mono">tables.json</td><td>表格索引 + BBox + 行号</td><td><span class="badge green">已生成</span></td></tr>
          <tr><td class="mono">bbox.json</td><td>版面元素坐标定位</td><td><span class="badge green">已生成</span></td></tr>
          <tr><td class="mono">quality.json</td><td>解析质量报告</td><td><span class="badge green">96.2</span></td></tr>
        </table>
      </div>
      <div class="card">
        <div class="card-title">🧩 表格索引 <span class="badge blue">${pa.tables.length} 张</span></div>
        <table class="data-table">
          <tr><th>#</th><th>页码</th><th>标题</th><th>规模</th></tr>
          ${pa.tables.map((t) => `<tr><td class="mono">${t.index}</td><td class="mono">P${t.page}</td><td>${t.caption}</td><td class="mono">${t.rows}×${t.cols}</td></tr>`).join('')}
        </table>
      </div>
    </div>
  `;

  document.getElementById('startParse').onclick = startParse;
  document.getElementById('parseDownload').onclick = () => toast('📦 document_full.json 已导出（模拟）');
}

function startParse() {
  const progressHost = document.getElementById('parseProgress');
  const logHost = document.getElementById('parseLog');
  if (!progressHost || !logHost) return;

  const steps = [
    'MinerU 版面分析 · 检测 312 页文档结构...',
    '表格结构识别 · 46 张表格 BBox 定位...',
    'VLM 视觉辅助 · 复核多级表头与跨页附注...',
    '生成 Markdown 正文 · 312 页 → report.md',
    '生成 document_full.json · 打包 8 大产物...',
    '质量校验 · BBox 覆盖率 98.4% · 完成',
  ];
  logHost.textContent = '';
  progressHost.innerHTML = `<div class="progress"><i style="width:0%"></i></div>`;

  let step = 0;
  const timer = setInterval(() => {
    if (step >= steps.length) {
      clearInterval(timer);
      progressHost.innerHTML = `<div class="progress green"><i style="width:100%"></i></div><div style="font-size:12px;color:var(--green);margin-top:6px">✓ 解析完成 · 质量评分 96.2</div>`;
      toast('✅ 解析完成，产物已入库');
      return;
    }
    const pct = Math.round(((step + 1) / steps.length) * 100);
    progressHost.innerHTML = `<div class="progress"><i style="width:${pct}%"></i></div><div style="font-size:12px;color:var(--text-3);margin-top:6px">${pct}%</div>`;
    logHost.textContent += `▸ ${steps[step]}\n`;
    logHost.scrollTop = logHost.scrollHeight;
    step++;
  }, 700);
}
/* ============ 模块四：财务抽取与入库 ============ */
function renderExtract() {
  const v = document.getElementById('view-extract');
  const fin = FINANCIALS['600519'];

  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">财务抽取与入库</div>
      <div class="page-sub">financial_rules_v14 规则引擎 · 三大表 / 单位 / 期间 / 公式勾稽校验</div>
    </div>

    <div class="cols-3">
      <div class="kpi"><div class="k-label">识别指标</div><div class="k-value">1,284</div><div class="k-sub">项</div></div>
      <div class="kpi"><div class="k-label">识别准确率</div><div class="k-value" style="color:var(--green)">95.1%</div><div class="k-sub">KupasEval</div></div>
      <div class="kpi"><div class="k-label">勾稽校验</div><div class="k-value" style="color:var(--green)">94.0%</div><div class="k-sub">规则引擎</div></div>
    </div>

    <div class="cols">
      <div class="card">
        <div class="card-title">📗 合并利润表（2025年度）<span class="badge green">单位：人民币万元</span></div>
        <table class="data-table">
          <tr><th>项目</th><th class="num">2025年</th><th class="num">2024年</th><th>来源</th></tr>
          <tr><td>营业收入</td><td class="num">17,413,990</td><td class="num">16,389,400</td><td><span class="chip blue">P91 表12</span></td></tr>
          <tr><td>营业利润</td><td class="num">11,528,300</td><td class="num">10,983,700</td><td><span class="chip blue">P91 表12</span></td></tr>
          <tr><td>净利润</td><td class="num">8,627,300</td><td class="num">8,227,300</td><td><span class="chip blue">P91 表12</span></td></tr>
          <tr><td>归母净利润</td><td class="num">8,627,300</td><td class="num">8,227,300</td><td><span class="chip blue">P91 表12</span></td></tr>
          <tr><td>基本每股收益</td><td class="num">110.68</td><td class="num">104.42</td><td><span class="chip blue">P91 表12</span></td></tr>
        </table>
      </div>
      <div class="card">
        <div class="card-title">📕 关键财务指标</div>
        <div id="ratio-bars"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">🧮 财务勾稽校验引擎 <span class="badge green">financial_rules_v14</span></div>
      <table class="data-table">
        <tr><th>规则</th><th>校验逻辑</th><th>状态</th></tr>
        ${CHECK_RULES.map((r) => `
          <tr>
            <td class="mono">${r.id}</td>
            <td>${r.rule}</td>
            <td>${r.status === 'pass' ? '<span class="badge green">通过</span>' : '<span class="badge orange">警告</span>'}</td>
          </tr>`).join('')}
      </table>
      <div style="margin-top:10px;font-size:12px;color:var(--text-3)">* 警告项需人工复核确认，不覆盖原始证据</div>
    </div>
  `;

  renderRatioBars();
}

function renderRatioBars() {
  const host = document.getElementById('ratio-bars');
  if (!host) return;
  const ratios = [
    { label: '毛利率', v: 91.6, color: '#2f6bff' },
    { label: '净利率', v: 49.6, color: '#22d3ee' },
    { label: 'ROE', v: 24.9, color: '#34d399' },
    { label: '资产负债率', v: 8.8, color: '#f5b942' },
    { label: '经营现金流/净利润', v: 112, color: '#a78bfa', max: 120 },
  ];
  host.innerHTML = ratios.map((r) => `
    <div class="bar-row">
      <div class="b-label">${r.label}</div>
      <div class="b-bar"><div class="b-fill" style="width:${Math.min(100, r.v / (r.max || 100) * 100)}%;background:${r.color}"></div></div>
      <div class="mono" style="width:70px;text-align:right">${r.v}${r.label.includes('率') ? '%' : ''}</div>
    </div>`).join('');
}

/* ============ 模块五：多智能体协同 ============ */
function renderAgents() {
  const v = document.getElementById('view-agents');
  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">多智能体协同</div>
      <div class="page-sub">Analysis / FactChecker / Tracking / Legal / Assistant 五 Agent 协同流水线</div>
    </div>

    <div class="cols-3" id="agentGrid">
      ${AGENTS.map((a) => `
        <div class="agent-card" id="ag-${a.id}">
          <div class="a-icon" style="background:${a.color}22;color:${a.color}">${a.icon}</div>
          <div class="a-name">${a.name}</div>
          <div class="a-desc">${a.desc}</div>
          <div class="a-status" id="ag-status-${a.id}"><span class="dot gray"></span>就绪</div>
          <div style="display:flex;gap:6px">
            <button class="btn sm" onclick="runAgent('${a.id}')">▶ 运行</button>
            <button class="btn sm" onclick="showAgentOutput('${a.id}')">查看输出</button>
          </div>
        </div>`).join('')}
    </div>

    <div class="cols-2-1" style="margin-top:6px">
      <div class="card">
        <div class="card-title">🤖 智能体运行流水线 <span class="badge blue">流水线编排</span></div>
        <div id="agentPipeLine"></div>
      </div>
      <div class="card">
        <div class="card-title">📊 证据路由统计</div>
        <div id="agentStats"></div>
      </div>
    </div>
  `;

  renderAgentPipeline();
  renderAgentStats();
}

function renderAgentPipeline() {
  const host = document.getElementById('agentPipeLine');
  if (!host) return;
  const steps = [
    { name: '搜索下载', agent: 'Report Finder', done: true },
    { name: '解析复核', agent: 'MinerU+VLM', done: true },
    { name: '入库', agent: 'LLM-Wiki/PG/Milvus', done: true },
    { name: '智能分析', agent: 'Analysis', done: false, active: true },
    { name: '事实核查', agent: 'FactChecker', done: false },
    { name: '报告输出', agent: 'ReportViewer', done: false },
  ];
  host.innerHTML = `<div class="steps">${steps.map((s, i) => `<div class="step ${s.done ? 'done' : s.active ? 'active' : ''}"><div class="step-num">${i + 1}</div>${s.name}<div style="font-size:10px;color:var(--text-3)">${s.agent}</div></div>`).join('')}</div>`;
}

function renderAgentStats() {
  const host = document.getElementById('agentStats');
  if (!host) return;
  const stats = [
    { label: '证据路由命中', v: 92, color: '#2f6bff' },
    { label: '检索 Recall@10', v: 94, color: '#22d3ee' },
    { label: '勾稽校验通过率', v: 96, color: '#34d399' },
    { label: '报告采纳率', v: 79, color: '#f5b942' },
  ];
  host.innerHTML = stats.map((s) => `
    <div class="bar-row"><div class="b-label">${s.label}</div>
    <div class="b-bar"><div class="b-fill" style="width:${s.v}%;background:${s.color}"></div></div>
    <div class="mono" style="width:44px;text-align:right">${s.v}%</div></div>`).join('');
}

function runAgent(id) {
  const st = document.getElementById('ag-status-' + id);
  if (!st) return;
  st.innerHTML = '<span class="dot orange"></span>运行中…';
  setTimeout(() => {
    st.innerHTML = '<span class="dot green"></span>完成';
    toast('✅ ' + AGENTS.find((a) => a.id === id).name + ' 运行完成');
  }, 1600);
}

function showAgentOutput(id) {
  const a = AGENTS.find((x) => x.id === id) || { id: id, name: id, icon: '🤖' };
  const outputs = {
    analysis: `<div class="report-section"><h3>📊 Analysis · 报告初稿（节选）</h3>
      <p>1. 盈利质量：公司实现营业收入 1741.40 亿元，同比增长 6.25%；归母净利润 862.73 亿元，同比增长 4.86%。毛利率 91.6%，净利率 49.6%，盈利质量保持在行业高位。</p>
      <p>2. 现金流：经营活动现金流净额 968.00 亿元，经营现金流/净利润 1.12，现金含量充足。</p>
      <div class="evidence-panel"><div class="ev-title">📎 证据链</div>营业收入 → P91 表12 利润表第3行 · 归母净利润 → P91 表12 第4行</div></div>`,
    'factcheck': `<div class="report-section"><h3>✔ FactChecker 六维复核</h3>
      <p>✔ 来源：数据来自 2025 年报原文 PDF，页码绑定完整</p>
      <p>✔ 口径：合并报表口径与附注一致</p>
      <p>✔ 单位：人民币元，已统一转换</p>
      <p>✔ 期间：2025-01-01 至 2025-12-31</p>
      <p>✔ 计算：归母净利润同比增长率 = 4.86%，与披露值一致</p>
      <div class="evidence-panel"><div class="ev-title">复核结论</div>6/6 维度通过 · 无事实性错误</div></div>`,
    'tracking': `<div class="report-section"><h3>⏱ Tracking 持续跟踪</h3>
      <p>✔ 关键指标：营业收入、净利润、毛利率、净利率、ROE 均在监测范围</p>
      <p>⚠ 预警：存货同比增长 8.2%，需关注去化</p>
      <p>📅 下期事件：2026-03-31 年报披露 · 2026-04-28 一季报披露</p></div>`,
    'legal': `<div class="report-section"><h3>⚖ Legal 法务合规初筛</h3>
      <p>✔ 引用法规：上市公司信息披露管理办法（证监会令第 197 号）</p>
      <p>✔ 关联交易：存在 2 项关联交易，均披露完整</p>
      <p>⚠ 关注：未决诉讼 1 项，需跟进进展</p></div>`,
    'assistant': `<div class="report-section"><h3>💬 Assistant 全域问答示例</h3>
      <p>Q: 2025 年公司毛利率是多少？<br>A: 91.6%，来源 P91 合并利润表（营业收入与营业成本计算）。</p>
      <p>Q: 未来增长点？<br>A: 公司聚焦 i茅台 渠道与系列酒放量，2025 年系列酒收入占比 9.1%。</p></div>`,
  };
  openModal(a.icon + ' ' + a.name, outputs[id] || '<p>无输出</p>');
}

/* ============ 模块六：报告工作台 ReportViewer ============ */
function renderReport() {
  const v = document.getElementById('view-report');
  const fin = FINANCIALS[State.activeCompany] || FINANCIALS['600519'];

  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">报告工作台 <span class="badge gold">ReportViewer</span></div>
      <div class="page-sub">14 章结构化财报分析报告 · 全部结论绑定来源证据</div>
    </div>

    <div class="toolbar">
      <select class="input" id="reportCompany" style="max-width:160px">
        ${Object.values(COMPANIES).map((c) => `<option value="${c.code}" ${c.code === State.activeCompany ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
      <select class="input" style="max-width:120px"><option>2025年报</option><option>2024年报</option></select>
      <button class="btn" id="btnGenReport">🔄 重新生成</button>
      <button class="btn" id="btnExportReport">📄 导出 Word</button>
      <span class="spacer"></span>
      <span class="badge green">分析完成 · 3m 42s</span>
      <span class="badge blue">证据 1284 条</span>
    </div>

    <div class="cols-2-1">
      <div class="card">
        <div class="card-title">📄 分析报告 <span class="badge">14 章节</span></div>
        <div id="reportChapters"></div>
        <div class="report-section" style="margin-top:12px">
          <h3>摘要</h3>
          <p>贵州茅台 2025 年度实现营业收入 1741.40 亿元（+6.25%），归母净利润 862.73 亿元（+4.86%）。综合毛利率 91.6%，净利率 49.6%，ROE 24.9%，保持行业领先。经营现金流 968.00 亿元，现金含量充裕。风险项集中于批价波动与消费税政策变化。</p>
        </div>
        <div class="report-section">
          <h3>盈利质量分析</h3>
          <p>公司盈利质量处于白酒行业绝对龙头水平，<b>营收/净利增速匹配</b>，经营现金流/净利润 = 1.12，盈利真实可靠。</p>
          <div class="evidence-chain">
            ${EVidences.slice(0, 3).map((e) => `<span class="ev-node" onclick="jumpToEvidence('${e.id}')"><span class="ev-tag">${e.id}</span>${e.source}<span class="mono" style="color:var(--text-3)">P${e.page}</span></span><span class="ev-arrow">→</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">📊 报告生成进度</div>
        <div id="reportProgress"></div>
        <div class="card-title" style="margin-top:16px">⚑ 待复核事项</div>
        <div id="reviewItems"></div>
      </div>
    </div>
  `;

  document.getElementById('reportCompany').onchange = (e) => { State.activeCompany = e.target.value; renderReport(); };
  document.getElementById('btnGenReport').onclick = () => { toast('🔄 报告重新生成中（模拟）'); };
  document.getElementById('btnExportReport').onclick = () => toast('📄 报告已导出为 Word（模拟）');

  renderReportChapters();
  renderReportProgress();
  renderReviewItems();
}

function renderReportChapters() {
  const host = document.getElementById('reportChapters');
  if (!host) return;
  host.innerHTML = REPORT_CHAPTERS.map((c) => `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span class="mono" style="color:var(--text-3);width:30px">${c.no}</span>
      <span style="flex:1">${c.title}</span>
      <span class="mono" style="color:var(--text-3)">${c.words}字</span>
      <span class="badge ${c.status === 'done' ? 'green' : 'orange'}">${c.status === 'done' ? '已生成' : '待复核'}</span>
    </div>`).join('');
}

function renderReportProgress() {
  const host = document.getElementById('reportProgress');
  if (!host) return;
  host.innerHTML = `
    <div class="progress"><i style="width:100%"></i></div>
    <div style="font-size:12px;color:var(--text-3);margin-top:6px">14/14 章节已生成 · FactChecker 复核中</div>
    <div style="margin-top:10px">
      ${['Analysis 报告生成', 'FactChecker 六维复核', 'Legal 合规检查', '格式排版'].map((s, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12.5px;color:var(--text-2)">
          <span class="dot ${i < 2 ? 'green' : 'blue'}"></span>${s} <span style="color:var(--text-3)">${i < 2 ? '✓' : '…'}</span>
        </div>`).join('')}
    </div>`;
}

function renderReviewItems() {
  const host = document.getElementById('reviewItems');
  if (!host) return;
  host.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span class="badge orange">行业</span>白酒行业竞争格局数据待人工确认
      <button class="btn sm" style="margin-left:auto">复核</button>
    </div>
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0">
      <span class="badge orange">结论</span>投资建议为「持有」，需复核评级模型
      <button class="btn sm" style="margin-left:auto">复核</button>
    </div>`;
}

function jumpToEvidence(id) {
  const e = EVidences.find((x) => x.id === id);
  if (!e) return;
  openModal('⚑ 证据 ' + e.id + ' 详情', `
    <div class="evidence-panel" style="margin-bottom:10px">
      <div class="ev-title">证据声明</div>${e.claim}
    </div>
    <table class="data-table">
      <tr><th>来源</th><td>${e.source}</td></tr>
      <tr><th>定位</th><td class="mono">PDF P${e.page} · 表格 #${e.table_id} · 行 ${e.row}</td></tr>
      <tr><th>审计结论</th><td>${e.audit}</td></tr>
      <tr><th>状态</th><td><span class="badge green">已验证</span></td></tr>
    </table>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="btn primary sm" onclick="toast('📖 已跳转到 PDF 第 ${e.page} 页')">📖 跳回 PDF 原页</button>
      <button class="btn sm" onclick="toast('已复制证据定位')">复制定位</button>
    </div>`);
}

/* ============ 模块七：LLM-Wiki ============ */
function renderWiki() {
  const v = document.getElementById('view-wiki');
  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">LLM-Wiki 知识库</div>
      <div class="page-sub">以公司为中心组织知识资产 · 公司 → 报告 → 事实 → 指标 → 证据对象 · PostgreSQL + Milvus</div>
    </div>

    <div class="card">
      <div class="toolbar">
        <input class="input" id="wikiSearch" style="max-width:320px" placeholder="搜索：毛利率 / 现金流量 / 关联交易…">
        <button class="btn primary" id="wikiSearchBtn">检索</button>
        <span class="spacer"></span>
        <span class="badge blue">Milvus 向量库</span>
        <span class="badge">hybrid_search</span>
      </div>
    </div>

    <div class="cols-2-1">
      <div class="card">
        <div class="card-title">🏢 公司档案 <span class="badge blue">${Object.keys(COMPANIES).length} 家</span></div>
        <table class="data-table">
          <tr><th>公司</th><th>代码</th><th>行业</th><th>报告数</th><th>证据数</th><th></th></tr>
          ${Object.values(COMPANIES).map((c) => `
            <tr>
              <td><b>${c.name}</b></td><td class="mono">${c.code}</td><td>${c.industry}</td>
              <td class="num">${c.reports.length}</td><td class="num">${(c.code.charCodeAt(0) * 3 + 400) % 900 + 300}</td>
              <td><button class="btn sm" onclick="openCompanyProfile('${c.code}')">打开</button></td>
            </tr>`).join('')}
        </table>
      </div>
      <div class="card">
        <div class="card-title">🏷 知识实体</div>
        <div class="chips" style="margin-bottom:10px">
          <span class="chip">公司 5</span><span class="chip">报告 12</span><span class="chip">事实 6,842</span>
          <span class="chip">指标 1,284</span><span class="chip">证据 8,124</span>
        </div>
        <div class="card-title" style="margin-top:10px">🔗 关系图谱（示意）</div>
        <div style="text-align:center;padding:10px 0">
          <span class="chip blue">公司</span> <span style="color:var(--text-3)">→</span>
          <span class="chip">报告</span> <span style="color:var(--text-3)">→</span>
          <span class="chip">事实</span> <span style="color:var(--text-3)">→</span>
          <span class="chip">指标</span> <span style="color:var(--text-3)">→</span>
          <span class="chip blue">证据</span>
        </div>
        <div class="report-section" style="margin-top:8px">
          <h3>Wiki 对象示例</h3>
          <div class="evidence-panel">
            <div class="ev-title">公司: 贵州茅台 (600519)</div>
            报告: 2025 年报 (doc_600519_2025)<br>
            事实: 2025 年营业收入 17,414,990 万元<br>
            指标: 毛利率 91.6% (计算: 1 - 营业成本/营业收入)<br>
            证据: ev_001 → PDF P91 表 13 行 3
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('wikiSearchBtn').onclick = () => {
    const kw = document.getElementById('wikiSearch').value.trim();
    if (!kw) return toast('请输入关键词', 'err');
    toast('🔍 LLM-Wiki 检索「' + kw + '」· 命中 12 条（模拟）');
    const items = [
      { k: kw, v: '2025年营业收入 1741.39 亿元', src: '合并利润表 P91' },
      { k: kw, v: '经营现金流 968.00 亿元', src: '现金流量表 P94' },
      { k: kw, v: '毛利率 91.6%', src: '计算: (营业收入-营业成本)/营业收入 P91' },
      { k: kw, v: '归母净利润 862.73 亿元', src: '利润表 P91' },
    ];
    openModal('🔍 LLM-Wiki 检索结果 · ' + kw, `
      <table class="data-table">
        <tr><th>相关内容</th><th>证据来源</th></tr>
        ${items.map((i) => `<tr><td>${i.v}</td><td><span class="chip blue">${i.src}</span></td></tr>`).join('')}
      </table>
      <div style="margin-top:12px;font-size:12.5px;color:var(--text-3)">检索模式：hybrid_search（向量 + 关键词 + 证据路由）</div>`);
  };
}

function openCompanyProfile(code) {
  const c = COMPANIES[code];
  const fin = FINANCIALS[code];
  if (!c || !fin) return;
  openModal('🏢 ' + c.name + ' · 公司档案', `
    <div class="cols">
      <div>
        <table class="data-table">
          <tr><th>公司</th><td>${c.name}（${c.code}）</td></tr>
          <tr><th>交易所</th><td>${c.exchange}</td></tr>
          <tr><th>行业</th><td>${c.industry}</td></tr>
          <tr><th>主营</th><td>${c.desc}</td></tr>
          <tr><th>报告</th><td>${c.reports.join('、')}</td></tr>
        </table>
      </div>
      <div>
        <div class="kpi"><div class="k-label">2025 营业收入</div><div class="k-value">${fmt(fin.income['营业收入'])}</div></div>
        <div class="kpi" style="margin-top:8px"><div class="k-label">2025 净利润</div><div class="k-value">${fmt(fin.income['净利润'])}</div></div>
      </div>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="btn primary" onclick="setActiveCompany('${c.code}')">设为当前公司</button>
      <button class="btn" onclick="toast('已开始解析该公司报告')">解析报告</button>
    </div>`);
}

function setActiveCompany(code) {
  State.activeCompany = code;
  toast('已切换公司：' + COMPANIES[code].name);
  closeModal();
}

/* ============ 模块八：证据链中心 ============ */
function renderEvidence() {
  const v = document.getElementById('view-evidence');
  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">证据链中心</div>
      <div class="page-sub">每条结论绑定：来源 → 页码 → 表格 → 行号 → 审计结论</div>
    </div>

    <div class="card">
      <div class="toolbar">
        <input class="input" id="evSearch" style="max-width:280px" placeholder="搜索证据 / 公司 / 指标…">
        <select class="input" id="evFilter" style="max-width:140px">
          <option value="all">全部状态</option><option value="verified">已验证</option><option value="pending">待复核</option>
        </select>
        <button class="btn primary" id="evSearchBtn">检索</button>
        <span class="spacer"></span>
        <button class="btn" onclick="toast('证据链已导出（模拟）')">⬇ 导出证据包</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">⚑ 证据条目 <span class="badge blue">${EVidences.length} 条（演示）</span></div>
      <table class="data-table">
        <tr><th>ID</th><th>声明 / 结论</th><th>来源</th><th>定位</th><th>审计</th><th>状态</th></tr>
        ${EVidences.map((e) => `
          <tr>
            <td class="mono" style="color:var(--accent-2)">${e.id}</td>
            <td>${e.claim}</td>
            <td>${e.source}</td>
            <td class="mono">P${e.page}·表#${e.table_id}·行${e.row}</td>
            <td style="font-size:12px;color:var(--text-3)">${e.audit}</td>
            <td><span class="badge ${e.status === 'verified' ? 'green' : 'orange'}">${e.status === 'verified' ? '已验证' : '待复核'}</span></td>
          </tr>`).join('')}
      </table>
    </div>

    <div class="card">
      <div class="card-title">🔗 证据链工作流</div>
      <div id="evWorkflow"></div>
      <div style="margin-top:8px;font-size:12.5px;color:var(--text-3)">证据路由：从「文本相似」到「证据路由」，不是"像不像"，而是"能不能查"</div>
    </div>
  `;

  document.getElementById('evSearchBtn').onclick = () => {
    const kw = document.getElementById('evSearch').value.trim();
    const f = document.getElementById('evFilter').value;
    const list = EVidences.filter((e) => (f === 'all' || e.status === f) && (!kw || e.claim.includes(kw) || e.source.includes(kw)));
    if (!list.length) return toast('无匹配证据', 'err');
    toast('🔍 命中 ' + list.length + ' 条证据');
  };

  const wf = ['文档来源', 'PDF 页码', '表格/行号', '指标抽取', '审计结论'];
  const host = document.getElementById('evWorkflow');
  if (host) host.innerHTML = wf.map((s, i) => `<div class="step ${i < 4 ? 'done' : 'active'}"><div class="step-num">${i + 1}</div>${s}</div>`).join('');
}

/* ============ 模块九：KupasEval 评测 ============ */
function renderEval() {
  const v = document.getElementById('view-eval');
  v.innerHTML = `
    <div class="page-head">
      <div class="page-title">KupasEval 自评测</div>
      <div class="page-sub">库帕思金融智能体能力评测闭环 · 可复测、可追溯、可核查</div>
    </div>

    <div class="cols-4">
      <div class="kpi"><div class="k-label">综合得分</div><div class="k-value" style="color:var(--gold)">90.2</div><div class="k-sub">总分排名 #1</div></div>
      <div class="kpi"><div class="k-label">当前等级</div><div class="k-value" style="color:var(--green)">A</div><div class="k-sub">超越 78.8% 基线</div></div>
      <div class="kpi"><div class="k-label">总合格基线</div><div class="k-value">78.8%</div><div class="k-sub">能力基线</div></div>
      <div class="kpi"><div class="k-label">能力项达标</div><div class="k-value">5/5</div><div class="k-sub">全部达标</div></div>
    </div>

    <div class="cols">
      <div class="card">
        <div class="card-title">📊 能力维度得分</div>
        ${EVAL_SCORES.metrics.map((m) => `
          <div class="bar-row">
            <div class="b-label">${m.name}</div>
            <div class="b-bar"><div class="b-fill" style="width:${m.value}%;background:${m.value >= 90 ? '#34d399' : m.value >= 80 ? '#2f6bff' : '#f5b942'}"></div></div>
            <div class="mono" style="width:54px;text-align:right">${m.value}</div>
            <span style="width:70px;font-size:11px;color:var(--text-3)">基线${m.baseline}</span>
            ${m.note ? `<span class="badge orange">${m.note}</span>` : ''}
          </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title">📈 评测结论</div>
        <div class="report-section">
          <p>FinSight 已完成从"能检索数据"到"能提取数据"的技术跨越，<strong>检索下载 100 分</strong>、<strong>指标识别 95.1</strong>、<strong>勾稽核查 94.0</strong> 均显著高于基线。</p>
          <p>在<strong>报告专业度（73.9）</strong>与<strong>行业洞察（80.4）</strong>两个高阶能力上处于爬坡阶段，下一阶段优化重点。</p>
          <p style="color:var(--text-3);font-size:12px">评测目标不是证明模型"会回答"，而是证明回答能沿业务链路被复测、被追溯、被核查。</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn primary" onclick="toast('评测已启动（模拟）')">▶ 重新评测</button>
          <button class="btn" onclick="toast('评测报告已导出')">⬇ 导出报告</button>
        </div>
      </div>
    </div>
  `;
}

/* ============ 弹窗 ============ */
let modalHost = null;
function ensureModal() {
  if (modalHost) return;
  modalHost = el('div', 'modal-mask', `
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title" id="modal-title"></div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div id="modal-body"></div>
    </div>`);
  modalHost.addEventListener('click', (e) => { if (e.target === modalHost) closeModal(); });
  document.body.appendChild(modalHost);
}
function openModal(title, body) {
  ensureModal();
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  modalHost.classList.add('show');
}
function closeModal() {
  if (modalHost) modalHost.classList.remove('show');
}

/* ============ 导航绑定 ============ */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  const gsBtn = document.getElementById('globalSearchBtn');
  if (gsBtn) {
    gsBtn.addEventListener('click', () => {
      const kw = document.getElementById('globalSearch').value.trim();
      if (!kw) return toast('请输入搜索内容', 'err');
      switchView('wiki');
      const ws = document.getElementById('wikiSearch');
      if (ws) ws.value = kw;
      toast('🔍 全局检索「' + kw + '」');
    });
  }
  switchView('overview');
});
