let logs = [];

function getMonthKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getWeekLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function showTab(tab) {
  ['log', 'view', 'report'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.tab').forEach((el, i) => {
    el.classList.toggle('active', ['log', 'view', 'report'][i] === tab);
  });
  if (tab === 'view') renderLogs();
  if (tab === 'report') updateReportMonths();
}

function loadLogs(callback) {
  chrome.storage.local.get('worklogs', function(data) {
    logs = data.worklogs || [];
    if (callback) callback();
  });
}

function saveLogs(callback) {
  chrome.storage.local.set({ worklogs: logs }, callback);
}

function saveLog() {
  const story = document.getElementById('story').value.trim();
  const weekof = document.getElementById('weekof').value;
  const desc = document.getElementById('desc').value.trim();
  const component = document.getElementById('component-name').textContent.trim();
  const msg = document.getElementById('log-msg');

  if (!story || !weekof || !desc) {
    msg.innerHTML = '<div class="msg msg-error">Please fill in all fields.</div>';
    return;
  }

  logs.push({
    id: Date.now(),
    story,
    weekof,
    desc,
    component,
    month: getMonthKey(weekof)
  });

  saveLogs(function() {
    document.getElementById('story').value = '';
    document.getElementById('desc').value = '';
    msg.innerHTML = '<div class="msg msg-success">Task saved!</div>';
    setTimeout(() => msg.innerHTML = '', 2000);
  });
}

function renderLogs() {
  const filter = document.getElementById('month-filter').value;
  const filtered = filter ? logs.filter(l => l.month === filter) : logs;
  const container = document.getElementById('logs-list');

  if (!filtered.length) {
    container.innerHTML = '<div class="empty">No tasks logged yet.</div>';
    return;
  }

  container.innerHTML = filtered.slice().reverse().map(l => `
    <div class="log-item">
      <button class="delete-btn" onclick="deleteLog(${l.id})">✕</button>
      <span class="story">#${l.story}</span>
      <div class="component">${l.component}</div>
      <div class="desc">${l.desc}</div>
      <div class="week">Week of ${getWeekLabel(l.weekof)}</div>
    </div>
  `).join('');
}

function deleteLog(id) {
  logs = logs.filter(l => l.id !== id);
  saveLogs(() => renderLogs());
}

function updateMonthFilters() {
  const months = [...new Set(logs.map(l => l.month))].sort();
  const f = document.getElementById('month-filter');
  f.innerHTML = '<option value="">All months</option>' + months.map(m => `<option value="${m}">${m}</option>`).join('');
}

function updateReportMonths() {
  const months = [...new Set(logs.map(l => l.month))].sort();
  const s = document.getElementById('report-month');
  s.innerHTML = months.length ? months.map(m => `<option value="${m}">${m}</option>`).join('') : '<option value="">No data yet</option>';
}

function generateReport() {
  const month = document.getElementById('report-month').value;
  const filtered = logs.filter(l => l.month === month);
  const grouped = {};
  filtered.forEach(l => {
    if (!grouped[l.weekof]) grouped[l.weekof] = [];
    grouped[l.weekof].push(l);
  });

  let report = `MONTHLY WORK REPORT — ${month.toUpperCase()}\nSalesforce OmniStudio Developer\n${'='.repeat(45)}\n\n`;
  Object.keys(grouped).sort().forEach(week => {
    report += `Week of ${getWeekLabel(week)}\n${'-'.repeat(35)}\n`;
    grouped[week].forEach((l, i) => {
      report += `${i + 1}. [#${l.story}] ${l.component}\n   ${l.desc}\n`;
    });
    report += '\n';
  });

  document.getElementById('report-output').value = report;
}

function copyReport() {
  const text = document.getElementById('report-output').value;
  if (!text) {
    document.getElementById('report-msg').innerHTML = '<div class="msg msg-error">Generate a report first.</div>';
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    document.getElementById('report-msg').innerHTML = '<div class="msg msg-success">Copied to clipboard!</div>';
    setTimeout(() => document.getElementById('report-msg').innerHTML = '', 2000);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  document.getElementById('weekof').value = monday.toISOString().split('T')[0];

  loadLogs(function() {
    updateMonthFilters();
    renderLogs();
  });

  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getPageInfo' }, function(response) {
      if (response && response.componentName) {
        document.getElementById('component-name').textContent = response.componentName;
      } else {
        document.getElementById('component-name').textContent = 'Could not detect — enter manually';
      }
    });
  });
});