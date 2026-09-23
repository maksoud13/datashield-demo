// =========================================================
// DataShield Demo — runs REAL Java SqlModifier via CheerpJ
// =========================================================

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

let SqlModifierClass = null;   // سيتم تحميله من JVM
let cheerpjReady = false;

// =========================================================
// 1. تهيئة CheerpJ وتحميل الـ JARs
// =========================================================
async function initCheerpJ() {
    const output = document.getElementById("output");
    try {
        output.innerHTML = '<span class="loading">Booting CheerpJ JVM...</span>';

        // تهيئة CheerpJ
        await cheerpjInit({
            status: "none"
        });

        output.innerHTML = '<span class="loading">Loading DataShield JARs...</span>';

        // تحميل الـ JARs (SqlModifier + JSqlParser)
        const lib = await cheerpjRunLibrary(
            "/app/libs/datashield-core.jar:/app/libs/jsqlparser-4.9.jar"
        );

        // الوصول لكلاس SqlModifier
        SqlModifierClass = await lib.com.datashield.agent.SqlModifier;

        cheerpjReady = true;
        document.getElementById("run").disabled = false;
        output.innerHTML = '<span class="result">✅ Ready! Click "Process" to try.</span>';

    } catch (err) {
        console.error(err);
        output.innerHTML = `<span class="error">❌ Failed to load: ${err.message}</span>`;
    }
}

// =========================================================
// 2. تنفيذ الفلتر عبر CheerpJ (استدعاء Java مباشر!)
// =========================================================
async function processSql() {
    if (!cheerpjReady) return;

    const sql = document.getElementById("sql").value.trim();
    const col = document.getElementById("col").value.trim();
    const val = document.getElementById("val").value.trim();
    const output = document.getElementById("output");
    const runBtn = document.getElementById("run");

    if (!sql || !col || !val) {
        output.innerHTML = '<span class="error">Fill all fields</span>';
        return;
    }

    runBtn.disabled = true;
    output.innerHTML = '<span class="loading">Processing...</span>';

    try {
        // ⚡ استدعاء Java مباشرة!
        const result = await SqlModifierClass.addFilter(sql, col, val);

        // تظليل الفلتر المضاف
        const escaped = escapeHtml(result);
        const highlighted = escaped.replace(
            new RegExp(`(${escapeRegex(col)}\\s*=\\s*'[^']*')`, "g"),
            '<span class="highlight">$1</span>'
        );

        output.innerHTML = `
            <div style="color:#94a3b8;margin-bottom:6px;">Input:</div>
            <div style="opacity:0.7;">${escapeHtml(sql)}</div>
            <div style="color:#38bdf8;margin:10px 0;">⬇</div>
            <div style="color:#94a3b8;margin-bottom:6px;">Output (via real Java code):</div>
            <div class="result">${highlighted}</div>
        `;
    } catch (err) {
        output.innerHTML = `<span class="error">❌ ${escapeHtml(err.message || err)}</span>`;
    } finally {
        runBtn.disabled = false;
    }
}

// =========================================================
// Helpers
// =========================================================
function escapeHtml(s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// =========================================================
// Init
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
    // تحميل مثال افتراضي
    const firstEx = EXAMPLES.simple;
    document.getElementById("sql").value = firstEx.sql;
    document.getElementById("col").value = firstEx.col;
    document.getElementById("val").value = firstEx.val;

    document.getElementById("run").addEventListener("click", processSql);
    document.getElementById("run").disabled = true;

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

    // بدء تحميل CheerpJ
    initCheerpJ();
});