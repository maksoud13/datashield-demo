const EXAMPLES = {
    simple: { sql: "SELECT * FROM users", col: "tenant_id", val: "TENANT_A" },
    "or-leak": { sql: "SELECT * FROM orders WHERE status = 'PENDING' OR status = 'SHIPPED'", col: "tenant_id", val: "TENANT_A" },
    subquery: { sql: "SELECT * FROM orders WHERE total > (SELECT AVG(total) FROM orders)", col: "tenant_id", val: "TENANT_A" },
    union: { sql: "SELECT name FROM users WHERE age > 18 UNION SELECT name FROM users WHERE age < 5", col: "tenant_id", val: "TENANT_A" }
};

let cheerpjReady = false;
let capturedOutput = [];
let outputResolver = null;

// =========================================================
// CheerpJ Init مع stdout callback
// =========================================================
async function initCheerpJ() {
    const output = document.getElementById("output");
    output.innerHTML = '<span class="loading">Booting CheerpJ...</span>';

    try {
        await cheerpjInit({
            status: "none",
            // ⚡ الـ API الصح: stdout و stderr كـ callbacks
            stdout: (text) => {
                console.log("[Java stdout]", JSON.stringify(text));
                capturedOutput.push(text);
                if (outputResolver) {
                    outputResolver();
                    outputResolver = null;
                }
            },
            stderr: (text) => {
                console.log("[Java stderr]", JSON.stringify(text));
                capturedOutput.push("[ERR] " + text);
            }
        });

        console.log("✅ CheerpJ initialized with stdout callback");
        cheerpjReady = true;
        document.getElementById("run").disabled = false;
        output.innerHTML = '<span class="result">✅ Ready! Click "Process".</span>';
    } catch (e) {
        output.innerHTML = `<span class="error">❌ Init failed: ${e}</span>`;
        console.error(e);
    }
}

// =========================================================
// Process SQL
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
    output.innerHTML = '<span class="loading">Processing via Java...</span>';
    capturedOutput = [];

    try {
        // شغل Java
        await cheerpjRunMain(
            "com.datashield.core.Cli",
            "/app/datashield-demo/libs/datashield-core-1.0.0-SNAPSHOT.jar:" +
            "/app/datashield-demo/libs/jsqlparser-4.9.jar",
            sql, col, val
        );

        // استنى شوية لحد ما stdout يوصل
        await new Promise(r => setTimeout(r, 500));

        const fullOutput = capturedOutput.join("");
        console.log("📋 Full output:", JSON.stringify(fullOutput));

        // استخرج النتيجة
        const match = fullOutput.match(/RESULT_START\n([\s\S]*?)\nRESULT_END/);
        if (match) {
            showResult(sql, match[1].trim());
        } else {
            const errMatch = fullOutput.match(/ERROR_START\n([\s\S]*?)\nERROR_END/);
            const errMsg = errMatch ? errMatch[1].trim() : "No result. Output: " + fullOutput;
            output.innerHTML = `<span class="error">❌ ${escapeHtml(errMsg)}</span>`;
        }
    } catch (e) {
        output.innerHTML = `<span class="error">❌ ${e && e.message ? e.message : String(e)}</span>`;
        console.error(e);
    } finally {
        runBtn.disabled = false;
    }
}

// =========================================================
// Helpers
// =========================================================
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
        <div style="color:#94a3b8;margin-bottom:6px;">Output (via real Java):</div>
        <div class="result">${highlighted}</div>
    `;
}

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

    initCheerpJ();
});