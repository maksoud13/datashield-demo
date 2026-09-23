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
// CheerpJ Init مع Console Capture
// =========================================================
async function initCheerpJ() {
    const output = document.getElementById("output");
    output.innerHTML = '<span class="loading">Testing JVM...</span>';

    try {
        await cheerpjInit({ status: "none" });
        console.log("✅ CheerpJ initialized");

        // capture output
        capturedOutput = [];
        if (typeof cheerpjSetConsole === "function") {
            cheerpjSetConsole((text) => {
                capturedOutput.push(text);
                console.log("[Java stdout]", JSON.stringify(text));
            });
            console.log("✅ Console capture set up");
        } else {
            console.warn("⚠️ cheerpjSetConsole not available");
        }

        // نادي على Hello
        console.log("🔵 Calling Hello.main...");
        const lib = await cheerpjRunLibrary(
            "/app/datashield-demo/libs/datashield-core-1.0.0-SNAPSHOT.jar:" +
            "/app/datashield-demo/libs/jsqlparser-4.9.jar"
        );
        console.log("🔵 Hello.main finished");

        // انتظر شوية
        await new Promise(r => setTimeout(r, 1000));

        console.log("📋 Captured output:", capturedOutput);
        output.innerHTML = `
            <div style="color:#94a3b8;">Captured:</div>
            <pre>${escapeHtml(capturedOutput.join(""))}</pre>
            <div style="color:#94a3b8;margin-top:10px;">Count: ${capturedOutput.length}</div>
        `;

    } catch (e) {
        console.error("❌ Init error:", e);
        output.innerHTML = `<span class="error">❌ ${e && e.message ? e.message : String(e)}</span>`;
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
        // نشغل الـ Java main
        await cheerpjRunMain(
            "com.datashield.core.Cli",
            "/app/libs/datashield-core-1.0.0-SNAPSHOT.jar:/app/libs/jsqlparser-4.9.jar",
            sql, col, val
        );

        // نستنى شوية لحد ما الـ console يطبع كل حاجة
        await new Promise(r => setTimeout(r, 500));

        const fullOutput = capturedOutput.join("");
        console.log("Full output:", fullOutput);

        // نستخرج النتيجة من بين RESULT_START و RESULT_END
        const match = fullOutput.match(/RESULT_START\n([\s\S]*?)\nRESULT_END/);
        if (match) {
            const result = match[1].trim();
            showResult(sql, result);
        } else {
            const errMatch = fullOutput.match(/ERROR_START\n([\s\S]*?)\nERROR_END/);
            const errMsg = errMatch ? errMatch[1].trim() : "Unknown error";
            output.innerHTML = `<span class="error">❌ ${escapeHtml(errMsg)}</span>
                <div style="margin-top:10px;font-size:11px;color:#94a3b8;">Raw: ${escapeHtml(fullOutput)}</div>`;
        }

    } catch (e) {
        output.innerHTML = `<span class="error">❌ Error: ${e}</span>`;
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