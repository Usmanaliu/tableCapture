// ============================================================
// TABLE CAPTURE - POPUP.JS
// Persistent version
// ============================================================

let tables = [];
let selectedTable = null;
let statusTimer = null;


// ============================================================
// GET CURRENT TAB
// ============================================================

async function getCurrentTab() {

    const tabs =
        await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

    return tabs[0];
}


// ============================================================
// ELEMENT HELPERS
// ============================================================

function setInfo(text) {

    const info =
        document.getElementById("info");

    if (info) {
        info.innerText = text;
    }
}


// ============================================================
// LOAD SAVED CAPTURE
// ============================================================

async function loadSavedCapture() {

    const data =
        await chrome.storage.local.get([
            "captureStatus",
            "captureRows",
            "capturePage",
            "captureTotal",
            "captureExpected",
            "captureError",
            "captureTableIndex",
            "captureResume"
        ]);


    console.log(
        "Saved capture:",
        data
    );


    // --------------------------------------------------------
    // Capture completed
    // --------------------------------------------------------

    if (
        data.captureStatus ===
        "complete"
    ) {

        const rows =
            Array.isArray(
                data.captureRows
            )
                ? data.captureRows
                : [];


        if (rows.length > 0) {

            setInfo(
                `✅ COMPLETE — ${rows.length} records ready`
            );

        } else {

            setInfo(
                "Capture complete — no rows found."
            );
        }


        return;
    }


    // --------------------------------------------------------
    // Capture currently running
    // --------------------------------------------------------

    if (
        data.captureStatus ===
        "capturing"
    ) {

        const total =
            Number(
                data.captureTotal || 0
            );


        const page =
            Number(
                data.capturePage || 0
            );


        const expected =
            data.captureExpected;


        if (
            expected
        ) {

            setInfo(
                `⏳ Page ${page} — ${total} / ${expected} records captured`
            );

        } else {

            setInfo(
                `⏳ Page ${page} — ${total} records captured`
            );
        }


        startStorageMonitor();

        return;
    }


    // --------------------------------------------------------
    // Capture error
    // --------------------------------------------------------

    if (
        data.captureStatus ===
        "error"
    ) {

        setInfo(
            `❌ ${data.captureError || "Capture error"}`
        );

        return;
    }


    // --------------------------------------------------------
    // Nothing captured
    // --------------------------------------------------------

    setInfo(
        "Ready — Detect Tables"
    );
}


// ============================================================
// DETECT TABLES
// ============================================================

async function detectTables() {

    const tab =
        await getCurrentTab();


    if (!tab || !tab.id) {

        setInfo(
            "Unable to access current tab."
        );

        return;
    }


    chrome.tabs.sendMessage(
        tab.id,
        {
            action: "getTables"
        },
        response => {

            if (
                chrome.runtime.lastError
            ) {

                setInfo(
                    "Unable to access this page."
                );

                return;
            }


            if (!response) {

                setInfo(
                    "No response from webpage."
                );

                return;
            }


            tables =
                response.tables || [];


            const select =
                document.getElementById(
                    "tableSelect"
                );


            if (!select) {
                return;
            }


            select.innerHTML =
                '<option value="">Select a table</option>';


            tables.forEach(
                (table, index) => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        index;


                    option.textContent =
                        `Table ${index + 1} — ${table.rowCount} rows × ${table.columnCount} columns`;


                    select.appendChild(
                        option
                    );
                }
            );


            setInfo(
                `${tables.length} table(s) detected.`
            );
        }
    );
}


// ============================================================
// DETECT BUTTON
// ============================================================

const scanBtn =
    document.getElementById(
        "scanBtn"
    );


if (scanBtn) {

    scanBtn.addEventListener(
        "click",
        detectTables
    );
}


// ============================================================
// TABLE SELECTION
// ============================================================

const tableSelect =
    document.getElementById(
        "tableSelect"
    );


if (tableSelect) {

    tableSelect.addEventListener(
        "change",
        function () {

            if (
                this.value === ""
            ) {

                selectedTable =
                    null;

                return;
            }


            selectedTable =
                tables[
                    Number(
                        this.value
                    )
                ];


            if (
                selectedTable
            ) {

                setInfo(
                    `${selectedTable.rowCount} rows × ${selectedTable.columnCount} columns`
                );
            }
        }
    );
}


// ============================================================
// START CAPTURE
// ============================================================

async function startCapture() {

    if (!selectedTable) {

        alert(
            "Please select a table first."
        );

        return;
    }


    const tab =
        await getCurrentTab();


    if (!tab || !tab.id) {

        setInfo(
            "Unable to access current tab."
        );

        return;
    }


    setInfo(
        "⏳ Starting capture..."
    );


    // --------------------------------------------------------
    // Clear old capture ONLY when user explicitly starts
    // --------------------------------------------------------

    await chrome.storage.local.set({

        captureStatus:
            "capturing",

        captureRows:
            [],

        capturePage:
            0,

        captureTotal:
            0,

        captureExpected:
            null,

        captureError:
            "",

        captureTableIndex:
            selectedTable.index,

        captureResume:
            true

    });


    chrome.tabs.sendMessage(
        tab.id,
        {
            action:
                "startCapture",

            tableIndex:
                selectedTable.index

        },
        response => {

            if (
                chrome.runtime.lastError
            ) {

                setInfo(
                    "Could not start capture."
                );

                return;
            }


            setInfo(
                "⏳ Capturing... You can close this popup."
            );


            startStorageMonitor();
        }
    );
}


// ============================================================
// MONITOR STORAGE
// ============================================================

function startStorageMonitor() {

    if (statusTimer) {

        clearInterval(
            statusTimer
        );
    }


    statusTimer =
        setInterval(
            async () => {

                await updateStatus();

            },
            500
        );
}


// ============================================================
// UPDATE STATUS
// ============================================================

async function updateStatus() {

    const data =
        await chrome.storage.local.get([
            "captureStatus",
            "captureRows",
            "capturePage",
            "captureTotal",
            "captureExpected",
            "captureError"
        ]);


    // --------------------------------------------------------
    // CAPTURING
    // --------------------------------------------------------

    if (
        data.captureStatus ===
        "capturing"
    ) {

        const page =
            Number(
                data.capturePage || 0
            );


        const total =
            Number(
                data.captureTotal || 0
            );


        const expected =
            data.captureExpected;


        if (
            expected
        ) {

            setInfo(
                `⏳ Page ${page} — ${total} / ${expected} records captured`
            );

        } else {

            setInfo(
                `⏳ Page ${page} — ${total} records captured`
            );
        }


        return;
    }


    // --------------------------------------------------------
    // COMPLETE
    // --------------------------------------------------------

    if (
        data.captureStatus ===
        "complete"
    ) {

        if (statusTimer) {

            clearInterval(
                statusTimer
            );

            statusTimer =
                null;
        }


        const rows =
            Array.isArray(
                data.captureRows
            )
                ? data.captureRows
                : [];


        setInfo(
            `✅ COMPLETE — ${rows.length} records ready`
        );


        return;
    }


    // --------------------------------------------------------
    // ERROR
    // --------------------------------------------------------

    if (
        data.captureStatus ===
        "error"
    ) {

        if (statusTimer) {

            clearInterval(
                statusTimer
            );

            statusTimer =
                null;
        }


        setInfo(
            `❌ ${data.captureError || "Capture failed"}`
        );
    }
}


// ============================================================
// GET CAPTURED ROWS
// ============================================================

async function getCapturedRows() {

    const data =
        await chrome.storage.local.get(
            "captureRows"
        );


    if (
        !Array.isArray(
            data.captureRows
        )
    ) {

        return [];
    }


    return data.captureRows;
}


// ============================================================
// COPY
// ============================================================

const copyBtn =
    document.getElementById(
        "copyBtn"
    );


if (copyBtn) {

    copyBtn.addEventListener(
        "click",
        async () => {

            const rows =
                await getCapturedRows();


            if (
                rows.length === 0
            ) {

                alert(
                    "No captured data available."
                );

                return;
            }


            const text =
                rows
                    .map(
                        row =>
                            row.join("\t")
                    )
                    .join("\n");


            try {

                await navigator.clipboard.writeText(
                    text
                );


                setInfo(
                    `✅ Copied ${rows.length} records`
                );


                alert(
                    `Copied ${rows.length} records!`
                );

            }
            catch (error) {

                console.error(
                    error
                );


                alert(
                    "Unable to copy data."
                );
            }

        }
    );
}


// ============================================================
// CSV
// ============================================================

const csvBtn =
    document.getElementById(
        "csvBtn"
    );


if (csvBtn) {

    csvBtn.addEventListener(
        "click",
        async () => {

            const rows =
                await getCapturedRows();


            if (
                rows.length === 0
            ) {

                alert(
                    "No captured data available."
                );

                return;
            }


            const csv =
                rows
                    .map(
                        row =>
                            row
                                .map(
                                    cell =>
                                        `"${String(cell)
                                            .replace(
                                                /"/g,
                                                '""'
                                            )}"`
                                )
                                .join(",")
                    )
                    .join("\n");


            downloadFile(
                csv,
                "table-full.csv",
                "text/csv;charset=utf-8"
            );


            setInfo(
                `✅ CSV downloaded — ${rows.length} records`
            );
        }
    );
}


// ============================================================
// JSON
// ============================================================

const jsonBtn =
    document.getElementById(
        "jsonBtn"
    );


if (jsonBtn) {

    jsonBtn.addEventListener(
        "click",
        async () => {

            const rows =
                await getCapturedRows();


            if (
                rows.length === 0
            ) {

                alert(
                    "No captured data available."
                );

                return;
            }


            const json =
                JSON.stringify(
                    rows,
                    null,
                    2
                );


            downloadFile(
                json,
                "table-full.json",
                "application/json"
            );


            setInfo(
                `✅ JSON downloaded — ${rows.length} records`
            );
        }
    );
}


// ============================================================
// DOWNLOAD FILE
// ============================================================

function downloadFile(
    content,
    filename,
    type
) {

    const blob =
        new Blob(
            [content],
            {
                type:
                    type
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const a =
        document.createElement(
            "a"
        );


    a.href =
        url;


    a.download =
        filename;


    document.body.appendChild(
        a
    );


    a.click();


    a.remove();


    setTimeout(
        () => {

            URL.revokeObjectURL(
                url
            );

        },
        1000
    );
}


// ============================================================
// STORAGE CHANGE LISTENER
// ============================================================

chrome.storage.onChanged.addListener(
    (
        changes,
        areaName
    ) => {

        if (
            areaName !==
            "local"
        ) {

            return;
        }


        if (
            changes.captureStatus ||
            changes.captureTotal ||
            changes.capturePage ||
            changes.captureRows
        ) {

            updateStatus();
        }
    }
);


// ============================================================
// POPUP OPEN
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadSavedCapture();

    }
);


// Also load immediately because
// popup.js is normally loaded after DOM.

loadSavedCapture();

// ============================================================
// CLEAR DATA
// ============================================================

const clearBtn =
    document.getElementById(
        "clearBtn"
    );


if (clearBtn) {

    clearBtn.addEventListener(
        "click",
        async () => {

            const confirmClear =
                confirm(
                    "Clear all captured table data?\n\nThis will remove the current capture."
                );


            if (!confirmClear) {
                return;
            }


            await chrome.runtime.sendMessage({

                action:
                    "clearCapture"

            });


            setInfo(
                "🗑 Data cleared. Ready for new capture."
            );


            // Reset selected table

            selectedTable =
                null;


            tables =
                [];


            const select =
                document.getElementById(
                    "tableSelect"
                );


            if (select) {

                select.innerHTML =
                    '<option value="">Select a table</option>';
            }


            console.log(
                "Capture data cleared."
            );

        }
    );
}

// ============================================================
// STOP CAPTURE
// ============================================================

const stopBtn =
    document.getElementById(
        "stopBtn"
    );


if (stopBtn) {

    stopBtn.addEventListener(
        "click",
        async () => {

            await chrome.runtime.sendMessage({

                action:
                    "stopCapture"

            });


            setInfo(
                "⏹ Capture stopped. Data has been preserved."
            );

        }
    );
}


// ======================================================
// CAPTURE FULL TABLE
// ======================================================

async function startCapture() {

    if (!selectedTable) {

        alert(
            "Please select a table first."
        );

        return;
    }


    const tab =
        await getCurrentTab();


    capturedRows = null;


    const info =
        document.getElementById(
            "info"
        );


    const captureButton =
        document.getElementById(
            "captureBtn"
        );


    captureButton.disabled = true;

    captureButton.innerText =
        "⏳ Capturing...";


    info.innerText =
        "⏳ Starting full table capture...";


    // Clear previous capture

    await chrome.storage.local.set({

        captureStatus: "starting",

        captureRows: [],

        capturePage: 0,

        captureTotal: 0,

        captureError: ""

    });


    chrome.tabs.sendMessage(
        tab.id,
        {
            action: "startCapture",

            tableIndex:
                selectedTable.index

        },
        response => {

            if (chrome.runtime.lastError) {

                captureButton.disabled = false;

                captureButton.innerText =
                    "🚀 Capture Full Table";


                info.innerText =
                    "❌ Could not start capture.";

                return;
            }


            monitorCapture();
        }
    );
}


// ======================================================
// MONITOR CAPTURE
// ======================================================

function monitorCapture() {

    if (statusTimer) {

        clearInterval(
            statusTimer
        );
    }


    statusTimer =
        setInterval(
            async () => {

                const data =
                    await chrome.storage.local.get([
                        "captureStatus",
                        "captureRows",
                        "capturePage",
                        "captureTotal",
                        "captureError"
                    ]);


                const info =
                    document.getElementById(
                        "info"
                    );


                const captureButton =
                    document.getElementById(
                        "captureBtn"
                    );


                // -------------------------------
                // CAPTURING
                // -------------------------------

                if (
                    data.captureStatus ===
                    "capturing"
                ) {

                    info.innerText =
                        `⏳ Page ${data.capturePage} — ${data.captureTotal} records captured`;
                }


                // -------------------------------
                // COMPLETE
                // -------------------------------

                if (
                    data.captureStatus ===
                    "complete"
                ) {

                    clearInterval(
                        statusTimer
                    );


                    capturedRows =
                        data.captureRows || [];


                    captureButton.disabled =
                        false;


                    captureButton.innerText =
                        "🚀 Capture Full Table";


                    info.innerText =
                        `✅ COMPLETE — ${capturedRows.length} records captured`;


                    console.log(
                        "FULL TABLE:",
                        capturedRows
                    );
                }


                // -------------------------------
                // ERROR
                // -------------------------------

                if (
                    data.captureStatus ===
                    "error"
                ) {

                    clearInterval(
                        statusTimer
                    );


                    captureButton.disabled =
                        false;


                    captureButton.innerText =
                        "🚀 Capture Full Table";


                    info.innerText =
                        `❌ ${data.captureError}`;
                }

            },
            500
        );
}


// ======================================================
// CAPTURE BUTTON
// ======================================================

document.getElementById(
    "captureBtn"
).addEventListener(
    "click",
    startCapture
);