let logs = [];
let editingId = null;

function getMonthKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getWeekLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function showTab(tab) {
  ['log', 'view', 'report', 'settings'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.tab').forEach((el, i) => {
    el.classList.toggle('active', ['log', 'view', 'report', 'settings'][i] === tab);
  });
  if (tab === 'view') renderLogs();
  if (tab === 'report') updateReportMonths();
  if (tab === 'settings') loadSettings();
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
  saveLogs(() => renderLogs());
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

  chrome.storage.local.get('userRole', function(data) {
    const role = data.userRole || 'Salesforce OmniStudio Developer';
    let report = `MONTHLY WORK REPORT — ${month.toUpperCase()}\n${role}\n${'='.repeat(45)}\n\n`;
    Object.keys(grouped).sort().forEach(week => {
      report += `Week of ${getWeekLabel(week)}\n${'-'.repeat(35)}\n`;
      grouped[week].forEach((l, i) => {
        report += `${i + 1}. [#${l.story}] ${l.component}\n   ${l.desc}\n`;
      });
      report += '\n';
    });
    document.getElementById('report-output').value = report;
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

document.addEventListener('DOMContentLoaded', function() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  document.getElementById('weekof').value = monday.toISOString().split('T')[0];

  loadLogs(function() {
    updateMonthFilters();
    renderLogs();
  });

  document.getElementById('tab-btn-log').addEventListener('click', () => showTab('log'));
  document.getElementById('tab-btn-view').addEventListener('click', () => showTab('view'));
  document.getElementById('tab-btn-report').addEventListener('click', () => showTab('report'));
  document.getElementById('tab-btn-settings').addEventListener('click', () => showTab('settings'));

  document.getElementById('save-btn').addEventListener('click', saveLog);
  document.getElementById('generate-btn').addEventListener('click', generateReport);
  document.getElementById('copy-btn').addEventListener('click', copyReport);
  document.getElementById('month-filter').addEventListener('change', renderLogs);
  document.getElementById('edit-save-btn').addEventListener('click', saveEdit);
  document.getElementById('edit-cancel-btn').addEventListener('click', cancelEdit);
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);

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
      // If text is highlighted, use it as description
      // Otherwise auto-fill from component name
      if (response && response.selectedText) {
        document.getElementById('desc').value = response.selectedText;
        document.getElementById('component-name').textContent = 
          response.componentName || document.title || 'Google Docs / Web page';
      } else if (response && response.componentName) {
        autoFillDesc(response.componentName);
      }
    });
  });
});