let logs = [];
let editingId = null;
let reportMode = 'daily';

function getMonthKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getWeekLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getDayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function showTab(tab) {
  ['log', 'view', 'report', 'settings'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.tab').forEach((el, i) => {
    el.classList.toggle('active', ['log', 'view', 'report', 'settings'][i] === tab);
  });
  if (tab === 'view') renderLogs();
  if (tab === 'report') updateReportFilters();
  if (tab === 'settings') { loadSettings(); updateCleanupMonths(); }
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

function autoFillDesc(componentName) {
  if (!componentName || componentName === 'Could not detect — enter manually') return;
  const desc = document.getElementById('desc');
  if (!desc.value.trim()) {
    desc.value = `Worked on ${componentName}`;
  }
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
    <div class="log-item" data-id="${l.id}">
      <span class="story">#${l.story}</span>
      <div class="component">${l.component}</div>
      <div class="desc">${l.desc}</div>
      <div class="week">Week of ${getWeekLabel(l.weekof)}</div>
      <div class="actions">
        <button class="edit-btn" data-id="${l.id}">✏️ Edit</button>
        <button class="delete-btn" data-id="${l.id}">🗑️ Delete</button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      deleteLog(parseInt(this.dataset.id));
    });
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      startEdit(parseInt(this.dataset.id));
    });
  });
}

function deleteLog(id) {
  if (!confirm('Delete this task?')) return;
  logs = logs.filter(l => l.id !== id);
  saveLogs(() => { renderLogs(); updateMonthFilters(); });
}

function startEdit(id) {
  const log = logs.find(l => l.id === id);
  if (!log) return;
  editingId = id;
  document.getElementById('edit-story').value = log.story;
  document.getElementById('edit-desc').value = log.desc;
  document.getElementById('edit-box').style.display = 'block';
  document.getElementById('edit-box').scrollIntoView();
}

function saveEdit() {
  const story = document.getElementById('edit-story').value.trim();
  const desc = document.getElementById('edit-desc').value.trim();
  if (!story || !desc) return;
  logs = logs.map(l => l.id === editingId ? { ...l, story, desc } : l);
  saveLogs(function() {
    editingId = null;
    document.getElementById('edit-box').style.display = 'none';
    renderLogs();
  });
}

function cancelEdit() {
  editingId = null;
  document.getElementById('edit-box').style.display = 'none';
}

function updateMonthFilters() {
  const months = [...new Set(logs.map(l => l.month))].sort();
  const f = document.getElementById('month-filter');
  f.innerHTML = '<option value="">All months</option>' + months.map(m => `<option value="${m}">${m}</option>`).join('');
}

function updateReportFilters() {
  const months = [...new Set(logs.map(l => l.month))].sort();
  const weeks = [...new Set(logs.map(l => l.weekof))].sort();

  document.getElementById('report-month').innerHTML = months.length
    ? months.map(m => `<option value="${m}">${m}</option>`).join('')
    : '<option value="">No data yet</option>';

  document.getElementById('report-week').innerHTML = weeks.length
    ? weeks.map(w => `<option value="${w}">Week of ${getWeekLabel(w)}</option>`).join('')
    : '<option value="">No data yet</option>';

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('report-date').value = today;
}

function updateCleanupMonths() {
  const months = [...new Set(logs.map(l => l.month))].sort();
  const s = document.getElementById('cleanup-month');
  s.innerHTML = months.length
    ? months.map(m => `<option value="${m}">${m}</option>`).join('')
    : '<option value="">No data yet</option>';
}

function setReportMode(mode) {
  reportMode = mode;
  ['daily', 'weekly', 'monthly'].forEach(m => {
    document.getElementById('toggle-' + m).classList.toggle('active', m === mode);
    document.getElementById('filter-' + m).style.display = m === mode ? 'block' : 'none';
  });
}

function generateReport() {
  const msg = document.getElementById('report-msg');
  let filtered = [];
  let headerDate = '';

  chrome.storage.local.get('userRole', function(data) {
    const role = data.userRole || 'Salesforce OmniStudio Developer';

    if (reportMode === 'daily') {
      const date = document.getElementById('report-date').value;
      filtered = logs.filter(l => l.weekof === date);
      headerDate = getDayLabel(date);
    } else if (reportMode === 'weekly') {
      const week = document.getElementById('report-week').value;
      filtered = logs.filter(l => l.weekof === week);
      headerDate = `Week of ${getWeekLabel(week)}`;
    } else {
      const month = document.getElementById('report-month').value;
      filtered = logs.filter(l => l.month === month);
      headerDate = month;
    }

    if (!filtered.length) {
      msg.innerHTML = '<div class="msg msg-error">No tasks found for the selected period.</div>';
      setTimeout(() => msg.innerHTML = '', 3000);
      return;
    }

    let report = `DAILY WORK REPORT — ${headerDate.toUpperCase()}\n${role}\n${'='.repeat(45)}\n\n`;

    if (reportMode === 'monthly') {
      const grouped = {};
      filtered.forEach(l => {
        if (!grouped[l.weekof]) grouped[l.weekof] = [];
        grouped[l.weekof].push(l);
      });
      Object.keys(grouped).sort().forEach(week => {
        report += `Week of ${getWeekLabel(week)}\n${'-'.repeat(35)}\n`;
        grouped[week].forEach((l, i) => {
          report += `${i + 1}. [#${l.story}] ${l.component}\n   ${l.desc}\n`;
        });
        report += '\n';
      });
    } else {
      filtered.forEach((l, i) => {
        report += `${i + 1}. [#${l.story}] ${l.component}\n   ${l.desc}\n`;
      });
    }

    document.getElementById('report-output').value = report;
    msg.innerHTML = '';
  });
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

function saveSettings() {
  const role = document.getElementById('user-role').value.trim();
  chrome.storage.local.set({ userRole: role }, function() {
    document.getElementById('settings-msg').innerHTML = '<div class="msg msg-success">Settings saved!</div>';
    setTimeout(() => document.getElementById('settings-msg').innerHTML = '', 2000);
  });
}

function loadSettings() {
  chrome.storage.local.get('userRole', function(data) {
    if (data.userRole) {
      document.getElementById('user-role').value = data.userRole;
    }
  });
}

function deleteMonthLogs() {
  const month = document.getElementById('cleanup-month').value;
  if (!month) return;
  if (!confirm(`Delete all logs for ${month}? Make sure you have copied your report first!`)) return;
  logs = logs.filter(l => l.month !== month);
  saveLogs(function() {
    document.getElementById('cleanup-msg').innerHTML = '<div class="msg msg-success">Logs deleted for ' + month + '!</div>';
    setTimeout(() => document.getElementById('cleanup-msg').innerHTML = '', 3000);
    updateCleanupMonths();
    updateMonthFilters();
  });
}

function exportAllData() {
  if (!logs.length) {
    document.getElementById('cleanup-msg').innerHTML = '<div class="msg msg-error">No data to export.</div>';
    return;
  }
  let csv = 'Date,Week Of,Story,Description,Component,Month\n';
  logs.forEach(l => {
    const desc = l.desc.replace(/"/g, '""');
    const comp = l.component.replace(/"/g, '""');
    csv += `${new Date().toLocaleDateString()},"${getWeekLabel(l.weekof)}","${l.story}","${desc}","${comp}","${l.month}"\n`;
  });

  const text = document.getElementById('report-output');
  text.value = csv;
  navigator.clipboard.writeText(csv).then(() => {
    document.getElementById('cleanup-msg').innerHTML = '<div class="msg msg-success">All data copied! Paste into Google Sheets.</div>';
    setTimeout(() => document.getElementById('cleanup-msg').innerHTML = '', 4000);
  });
}

function clearAllLogs() {
  if (!confirm('Are you sure you want to delete ALL logs? This cannot be undone!')) return;
  logs = [];
  saveLogs(function() {
    document.getElementById('cleanup-msg').innerHTML = '<div class="msg msg-success">All logs cleared!</div>';
    setTimeout(() => document.getElementById('cleanup-msg').innerHTML = '', 3000);
    updateCleanupMonths();
    updateMonthFilters();
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

  // Tab buttons
  document.getElementById('tab-btn-log').addEventListener('click', () => showTab('log'));
  document.getElementById('tab-btn-view').addEventListener('click', () => showTab('view'));
  document.getElementById('tab-btn-report').addEventListener('click', () => showTab('report'));
  document.getElementById('tab-btn-settings').addEventListener('click', () => showTab('settings'));

  // Report toggle
  document.getElementById('toggle-daily').addEventListener('click', () => setReportMode('daily'));
  document.getElementById('toggle-weekly').addEventListener('click', () => setReportMode('weekly'));
  document.getElementById('toggle-monthly').addEventListener('click', () => setReportMode('monthly'));

  // Action buttons
  document.getElementById('save-btn').addEventListener('click', saveLog);
  document.getElementById('generate-btn').addEventListener('click', generateReport);
  document.getElementById('copy-btn').addEventListener('click', copyReport);
  document.getElementById('month-filter').addEventListener('change', renderLogs);
  document.getElementById('edit-save-btn').addEventListener('click', saveEdit);
  document.getElementById('edit-cancel-btn').addEventListener('click', cancelEdit);
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
  document.getElementById('delete-month-btn').addEventListener('click', deleteMonthLogs);
  document.getElementById('export-all-btn').addEventListener('click', exportAllData);
  document.getElementById('clear-all-btn').addEventListener('click', clearAllLogs);

  // Detect component
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getPageInfo' }, function(response) {
      if (chrome.runtime.lastError) {
        document.getElementById('component-name').textContent = 'Could not detect — enter manually';
        return;
      }
      if (response && response.componentName) {
        document.getElementById('component-name').textContent = response.componentName;
      } else {
        document.getElementById('component-name').textContent = 'Could not detect — enter manually';
      }
      if (response && response.storyNumber) {
        document.getElementById('story').value = response.storyNumber;
      }
      // Priority: selected text > description > component name
      if (response && response.selectedText) {
        document.getElementById('desc').value = response.selectedText;
      } else if (response && response.description) {
        document.getElementById('desc').value = response.description;
      } else if (response && response.componentName) {
        autoFillDesc(response.componentName);
      }
    });
  });
});