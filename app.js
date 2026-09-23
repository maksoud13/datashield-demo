const API_URL = "https://datashield-demo-api.fly.dev";

const EXAMPLES = {
    simple: {
        sql: "SELECT * FROM users",
        col: "tenant_id",
        val: "TENANT_A"
    },
    "or-leak": {
        sql: "SELECT * FROM orders WHERE status = 'PENDING' OR status = 'SHIPPED'",
        col: "tenant_id",
        val: "TENANT_A"
    },
    join: {
        sql: "SELECT o.* FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.total > 100",
        col: "tenant_id",
        val: "TENANT_A"
    },
    subquery: {
        sql: "SELECT * FROM orders WHERE total > (SELECT AVG(total) FROM orders)",
        col: "tenant_id",
        val: "TENANT_A"
    },
    union: {
        sql: "SELECT name FROM users WHERE age > 18 UNION SELECT name FROM users WHERE age < 5",
        col: "tenant_id",
        val: "TENANT_A"
    }
};

async function processSql() {
    const sql = document.getElementById("sql").value.trim();
    const col = document.getElementById("col").value.trim();
    const val = document.getElementById("val").value.trim();
    const output = document.getElementById("output");
    const runBtn = document.getElementById("run");

    if (!sql || !col || !val) {
        output.innerHTML = '<span class="error">Please fill all fields</span>';
        return;
    }

    runBtn.disabled = true;
    runBtn.textContent = "⏳ Processing...";
    output.innerHTML = '<span class="loading">Sending to Java backend...</span>';

    try {
        const response = await fetch(`${API_URL}/api/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sql, column: col, value: val })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
            showResult(sql, data.result);
        } else {
            output.innerHTML = `<span class="error">❌ ${escapeHtml(data.error || "Unknown error")}</span>`;
        }
    } catch (e) {
        output.innerHTML = `
            <span class="error">❌ Network error: ${escapeHtml(e.message)}</span>
            <div style="margin-top:8px;font-size:12px;color:#94a3b8;">
                The backend may be starting up. Please try again in a few seconds.
            </div>
        `;
    } finally {
        runBtn.disabled = false;
        runBtn.textContent = "🔄 Process";
    }
}

function showResult(original, modified) {
    const escaped = escapeHtml(modified);
    const col = document.getElementById("col").value;
    const highlighted = escaped.replace(
        new RegExp(`(${escapeRegex(col)}\\s*=\\s*'[^']*')`, "g"),
        '<span class="highlight">$1</span>'
    );

    document.getElementById("output").innerHTML = `
        <div style="color:#94a3b8;margin-bottom:6px;">Input:</div>
        <div style="opacity:0.7;">${escapeHtml(original)}</div>
        <div style="color:#38bdf8;margin:10px 0;">⬇</div>
        <div style="color:#94a3b8;margin-bottom:6px;">Output (via real Java code):</div>
        <div class="result">${highlighted}</div>
    `;
}

function escapeHtml(s) {
    if (!s) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

document.addEventListener("DOMContentLoaded", () => {
    const firstEx = EXAMPLES.simple;
    document.getElementById("sql").value = firstEx.sql;
    document.getElementById("col").value = firstEx.col;
    document.getElementById("val").value = firstEx.val;

    document.getElementById("run").addEventListener("click", processSql);
    document.getElementById("run").disabled = false;

    document.querySelectorAll(".examples button").forEach(btn => {
        btn.addEventListener("click", () => {
            const ex = EXAMPLES[btn.dataset.example];
            if (!ex) return;
            document.getElementById("sql").value = ex.sql;
            document.getElementById("col").value = ex.col;
            document.getElementById("val").value = ex.val;
            processSql();
        });
    });
});