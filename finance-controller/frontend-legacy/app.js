const API_BASE_URL = 'http://localhost:8000';

let rawExceptionsData = [];

document.addEventListener('DOMContentLoaded', () => {
    // Event listeners
    document.getElementById('run-batch-btn').addEventListener('click', handleRunBatch);
    document.getElementById('qa-submit-btn').addEventListener('click', handleAskQuestion);
    document.getElementById('priority-sort').addEventListener('change', renderExceptionsTable);
    
    // Initial fetch of existing matches & exceptions
    fetchMatches();
    fetchExceptions();
});

async function handleRunBatch() {
    const btn = document.getElementById('run-batch-btn');
    const loader = document.getElementById('batch-loader');
    const summaryGrid = document.getElementById('summary-grid');
    
    btn.disabled = true;
    loader.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_BASE_URL}/run-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        
        const data = await response.json();
        
        // Display summary
        document.getElementById('stat-match-rate').textContent = `${data.match_rate_percent}%`;
        document.getElementById('stat-total').textContent = data.total_bank_settlements;
        document.getElementById('stat-matched').textContent = data.matched_count;
        document.getElementById('stat-exceptions').textContent = data.exception_count;
        document.getElementById('stat-review').textContent = data.needs_review_count;
        document.getElementById('stat-time').textContent = `${data.execution_time_seconds}s`;
        
        summaryGrid.classList.remove('hidden');
        
        // Refresh tables
        await fetchMatches();
        await fetchExceptions();
        
    } catch (err) {
        alert(`Error running batch reconciliation: ${err.message}`);
    } finally {
        btn.disabled = false;
        loader.classList.add('hidden');
    }
}

async function fetchMatches() {
    const tbody = document.getElementById('matches-tbody');
    try {
        const res = await fetch(`${API_BASE_URL}/matches`);
        if (!res.ok) return;
        const matches = await res.json();
        
        if (!matches || matches.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No matched records found. Click "Run Batch Reconciliation" to process.</td></tr>';
            return;
        }
        
        tbody.innerHTML = matches.map(m => `
            <tr>
                <td><strong>${escapeHtml(m.settlement_id)}</strong></td>
                <td>${escapeHtml(m.order_id)}</td>
                <td>${escapeHtml(m.rule_applied)}</td>
                <td>${(m.confidence * 100).toFixed(0)}%</td>
                <td>${escapeHtml(m.timestamp)}</td>
            </tr>
        `).join('');
        
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5">Failed to load matches. Is the FastAPI backend running at localhost:8000?</td></tr>';
    }
}

async function fetchExceptions() {
    const tbody = document.getElementById('exceptions-tbody');
    try {
        const res = await fetch(`${API_BASE_URL}/exceptions`);
        if (!res.ok) return;
        rawExceptionsData = await res.json();
        renderExceptionsTable();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6">Failed to load exceptions. Is the FastAPI backend running at localhost:8000?</td></tr>';
    }
}

function renderExceptionsTable() {
    const tbody = document.getElementById('exceptions-tbody');
    const sortVal = document.getElementById('priority-sort').value;
    
    if (!rawExceptionsData || rawExceptionsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No exceptions found. All records resolved cleanly!</td></tr>';
        return;
    }
    
    let sortedList = [...rawExceptionsData];
    
    const priorityWeight = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    
    if (sortVal === 'HIGH_FIRST') {
        sortedList.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));
    } else if (sortVal === 'LOW_FIRST') {
        sortedList.sort((a, b) => (priorityWeight[a.priority] || 0) - (priorityWeight[b.priority] || 0));
    }
    
    tbody.innerHTML = sortedList.map(e => `
        <tr>
            <td><strong>${escapeHtml(e.record_id)}</strong></td>
            <td>${escapeHtml(e.source)}</td>
            <td>${escapeHtml(e.category)}</td>
            <td class="priority-${escapeHtml(e.priority)}">${escapeHtml(e.priority)}</td>
            <td>${escapeHtml(e.reason)}</td>
            <td>${escapeHtml(e.suggested_action)}</td>
        </tr>
    `).join('');
}

async function handleAskQuestion() {
    const input = document.getElementById('qa-input');
    const btn = document.getElementById('qa-submit-btn');
    const responseBox = document.getElementById('qa-response-box');
    const answerText = document.getElementById('qa-answer-text');
    const sqlBox = document.getElementById('qa-sql-box');
    const sqlCode = document.getElementById('qa-sql-code');
    
    const q = input.value.trim();
    if (!q) return;
    
    btn.disabled = true;
    answerText.textContent = "Querying reconciliation data...";
    responseBox.classList.remove('hidden');
    sqlBox.classList.add('hidden');
    
    try {
        const res = await fetch(`${API_BASE_URL}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: q })
        });
        
        if (!res.ok) {
            throw new Error(`Server returned ${res.status}`);
        }
        
        const data = await res.json();
        answerText.innerHTML = renderMarkdown(data.answer);
        
        let metaText = "";
        if (data.extracted_entity) {
            metaText += `[Extracted Entity]: ${JSON.stringify(data.extracted_entity)}\n`;
        }
        if (data.sql_query) {
            metaText += `[Parameterized SQL]: ${data.sql_query}`;
        }
        
        if (metaText) {
            sqlCode.textContent = metaText;
            sqlBox.classList.remove('hidden');
        }
        
    } catch (err) {
        answerText.textContent = `Error asking Q&A Agent: ${err.message}`;
    } finally {
        btn.disabled = false;
    }
}

function renderMarkdown(md) {
    if (!md) return '';
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        return marked.parse(md);
    }
    // Fallback markdown renderer if CDN script is offline
    let html = escapeHtml(md);
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    const lines = html.split('\n');
    let inList = false;
    let result = [];
    for (let line of lines) {
        let trimmed = line.trim();
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            if (!inList) {
                inList = true;
                result.push('<ul style="margin: 8px 0; padding-left: 20px;">');
            }
            result.push(`<li>${trimmed.substring(2)}</li>`);
        } else {
            if (inList) {
                inList = false;
                result.push('</ul>');
            }
            result.push(line);
        }
    }
    if (inList) result.push('</ul>');
    return result.join('<br>').replace(/<br><ul/g, '<ul').replace(/<\/ul><br>/g, '</ul>');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
