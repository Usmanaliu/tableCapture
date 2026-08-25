// ============================================================
// TABLE CAPTURE - POPUP.JS
// CLEAN / UPDATED VERSION
// ============================================================

let tables = [];
let selectedTable = null;

let capturedRows = [];
let capturedHeader = [];

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
// SET INFO
// ============================================================

function setInfo(text) {

    const info =
        document.getElementById("info");

    if (info) {
        info.innerText = text;
    }
}


// ============================================================
// GET ELEMENT
// ============================================================

function getElement(id) {

    return document.getElementById(id);

}


// ============================================================
// LOAD SAVED CAPTURE
// ============================================================

async function loadSavedCapture() {

    try {

        const data =
            await chrome.storage.local.get([
                "captureStatus",
                "captureRows",
                "captureHeader",
                "capturePage",
                "captureTotal",
                "captureExpected",
                "captureError"
            ]);


        capturedRows =
            Array.isArray(data.captureRows)
                ? data.captureRows
                : [];


        capturedHeader =
            Array.isArray(data.captureHeader)
                ? data.captureHeader
                : [];


        // ----------------------------------------------------
        // COMPLETE
        // ----------------------------------------------------

        if (
            data.captureStatus ===
            "complete"
        ) {

            setInfo(
                `✅ COMPLETE — ${capturedRows.length} records ready`
            );

            return;
        }


        // ----------------------------------------------------
        // CURRENTLY CAPTURING
        // ----------------------------------------------------

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
                Number(
                    data.captureExpected || 0
                );


            if (expected > 0) {

                setInfo(
                    `⏳ Page ${page} — ${total} / ${expected} records captured`
                );

            } else {

                setInfo(
                    `⏳ Page ${page} — ${total} records captured`
                );

            }


            // IMPORTANT:
            // This only monitors an existing capture.
            // It does NOT start a new capture.

            startStorageMonitor();

            return;
        }


        // ----------------------------------------------------
        // STARTING
        // ----------------------------------------------------

        if (
            data.captureStatus ===
            "starting"
        ) {

            setInfo(
                "⏳ Starting capture..."
            );

            startStorageMonitor();

            return;
        }


        // ----------------------------------------------------
        // ERROR
        // ----------------------------------------------------

        if (
            data.captureStatus ===
            "error"
        ) {

            setInfo(
                `❌ ${data.captureError || "Capture failed"}`
            );

            return;
        }


        // ----------------------------------------------------
        // NOTHING
        // ----------------------------------------------------

        setInfo(
            "Ready — Detect Tables"
        );

    }
    catch (error) {

        console.error(
            "loadSavedCapture error:",
            error
        );

        setInfo(
            "Ready — Detect Tables"
        );

    }

}


// ============================================================
// DETECT TABLES
// ============================================================

async function detectTables() {

    const tab =
        await getCurrentTab();


    if (
        !tab ||
        !tab.id
    ) {

        setInfo(
            "Unable to access current tab."
        );

        return;
    }


    setInfo(
        "🔍 Detecting tables..."
    );


    chrome.tabs.sendMessage(
        tab.id,
        {
            action: "getTables"
        },
        response => {

            if (
                chrome.runtime.lastError
            ) {

                console.error(
                    chrome.runtime.lastError
                );

                setInfo(
                    "❌ Unable to access this page."
                );

                return;
            }


            if (!response) {

                setInfo(
                    "❌ No response from webpage."
                );

                return;
            }


            tables =
                response.tables || [];


            const select =
                getElement(
                    "tableSelect"
                );


            if (!select) {
                return;
            }


            select.innerHTML =
                '<option value="">Select a table</option>';


            tables.forEach(
                (
                    table,
                    index
                ) => {

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


            if (
                tables.length === 0
            ) {

                setInfo(
                    "❌ No tables detected."
                );

                return;
            }


            setInfo(
                `✅ ${tables.length} table(s) detected.`
            );

        }
    );

}


// ============================================================
// DETECT BUTTON
// ============================================================

const scanBtn =
    getElement(
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
    getElement(
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
                    `${selectedTable.rowCount} rows × ${selectedTable.columnCount} columns — Ready to capture`
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


    if (
        !tab ||
        !tab.id
    ) {

        setInfo(
            "❌ Unable to access current tab."
        );

        return;
    }


    const captureButton =
        getElement(
            "captureBtn"
        );


    if (
        captureButton
    ) {

        captureButton.disabled =
            true;

        captureButton.innerText =
            "⏳ Capturing...";

    }


    setInfo(
        "⏳ Starting full table capture..."
    );


    // --------------------------------------------------------
    // CLEAR OLD DATA
    // --------------------------------------------------------
    // This happens ONLY because the user clicked Capture.

    capturedRows = [];

    capturedHeader = [];


    await chrome.storage.local.set({

        captureStatus:
            "starting",

        captureRows:
            [],

        captureHeader:
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

        // Do NOT automatically resume from page load.
        captureResume:
            false

    });


    // --------------------------------------------------------
    // SEND START COMMAND TO CONTENT SCRIPT
    // --------------------------------------------------------

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

                console.error(
                    chrome.runtime.lastError
                );


                if (
                    captureButton
                ) {

                    captureButton.disabled =
                        false;

                    captureButton.innerText =
                        "🚀 Capture Table";

                }


                setInfo(
                    "❌ Could not start capture. Refresh the webpage and try again."
                );

                return;
            }


            setInfo(
                "⏳ Capturing... You can close this popup."
            );


            // Monitor background capture

            startStorageMonitor();

        }
    );

}


// ============================================================
// CAPTURE BUTTON
// ============================================================

const captureBtn =
    getElement(
        "captureBtn"
    );


if (captureBtn) {

    captureBtn.addEventListener(
        "click",
        startCapture
    );

}


// ============================================================
// START STORAGE MONITOR
// ============================================================

function startStorageMonitor() {

    if (
        statusTimer
    ) {

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

    try {

        const data =
            await chrome.storage.local.get([
                "captureStatus",
                "captureRows",
                "captureHeader",
                "capturePage",
                "captureTotal",
                "captureExpected",
                "captureError"
            ]);


        // ----------------------------------------------------
        // CAPTURING
        // ----------------------------------------------------

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
                Number(
                    data.captureExpected || 0
                );


            if (
                expected > 0
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


        // ----------------------------------------------------
        // STARTING
        // ----------------------------------------------------

        if (
            data.captureStatus ===
            "starting"
        ) {

            setInfo(
                "⏳ Starting capture..."
            );

            return;
        }


        // ----------------------------------------------------
        // COMPLETE
        // ----------------------------------------------------

        if (
            data.captureStatus ===
            "complete"
        ) {

            if (
                statusTimer
            ) {

                clearInterval(
                    statusTimer
                );

                statusTimer =
                    null;

            }


            capturedRows =
                Array.isArray(
                    data.captureRows
                )
                    ? data.captureRows
                    : [];


            capturedHeader =
                Array.isArray(
                    data.captureHeader
                )
                    ? data.captureHeader
                    : [];


            const captureButton =
                getElement(
                    "captureBtn"
                );


            if (
                captureButton
            ) {

                captureButton.disabled =
                    false;

                captureButton.innerText =
                    "🚀 Capture Table";

            }


            setInfo(
                `✅ COMPLETE — ${capturedRows.length} records + header ready`
            );


            console.log(
                "HEADER:",
                capturedHeader
            );


            console.log(
                "ROWS:",
                capturedRows
            );


            return;
        }


        // ----------------------------------------------------
        // ERROR
        // ----------------------------------------------------

        if (
            data.captureStatus ===
            "error"
        ) {

            if (
                statusTimer
            ) {

                clearInterval(
                    statusTimer
                );

                statusTimer =
                    null;

            }


            const captureButton =
                getElement(
                    "captureBtn"
                );


            if (
                captureButton
            ) {

                captureButton.disabled =
                    false;

                captureButton.innerText =
                    "🚀 Capture Table";

            }


            setInfo(
                `❌ ${data.captureError || "Capture failed"}`
            );

        }

    }
    catch (error) {

        console.error(
            "updateStatus error:",
            error
        );

    }

}


// ============================================================
// GET CAPTURED DATA
// ============================================================

async function getCapturedData() {

    const data =
        await chrome.storage.local.get([
            "captureRows",
            "captureHeader"
        ]);


    const rows =
        Array.isArray(
            data.captureRows
        )
            ? data.captureRows
            : [];


    const header =
        Array.isArray(
            data.captureHeader
        )
            ? data.captureHeader
            : [];


    return {
        header,
        rows
    };

}


// ============================================================
// COPY
// ============================================================

const copyBtn =
    getElement(
        "copyBtn"
    );


if (copyBtn) {

    copyBtn.addEventListener(
        "click",
        async () => {

            const data =
                await getCapturedData();


            const header =
                data.header;

            const rows =
                data.rows;


            if (
                rows.length === 0
            ) {

                alert(
                    "No captured data available. Click Capture Table first."
                );

                return;
            }


            // ------------------------------------------------
            // HEADER FIRST
            // ------------------------------------------------

            const allRows = [

                ...(header.length > 0
                    ? [header]
                    : []),

                ...rows

            ];


            const text =
                allRows
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
                    `✅ Copied header + ${rows.length} records`
                );


                alert(
                    `Copied header + ${rows.length} records!`
                );

            }
            catch (error) {

                console.error(
                    "Copy error:",
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
    getElement(
        "csvBtn"
    );


if (csvBtn) {

    csvBtn.addEventListener(
        "click",
        async () => {

            const data =
                await getCapturedData();


            const header =
                data.header;

            const rows =
                data.rows;


            if (
                rows.length === 0
            ) {

                alert(
                    "No captured data available. Click Capture Table first."
                );

                return;
            }


            // ------------------------------------------------
            // HEADER FIRST
            // ------------------------------------------------

            const allRows = [

                ...(header.length > 0
                    ? [header]
                    : []),

                ...rows

            ];


            const csv =
                allRows
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
                "\uFEFF" + csv,
                "table-full.csv",
                "text/csv;charset=utf-8"
            );


            setInfo(
                `✅ CSV downloaded — header + ${rows.length} records`
            );

        }
    );

}


// ============================================================
// JSON
// ============================================================

const jsonBtn =
    getElement(
        "jsonBtn"
    );


if (jsonBtn) {

    jsonBtn.addEventListener(
        "click",
        async () => {

            const data =
                await getCapturedData();


            const header =
                data.header;

            const rows =
                data.rows;


            if (
                rows.length === 0
            ) {

                alert(
                    "No captured data available. Click Capture Table first."
                );

                return;
            }


            // ------------------------------------------------
            // JSON STRUCTURE
            // ------------------------------------------------

            const jsonData = {

                headers:
                    header,

                rows:
                    rows

            };


            const json =
                JSON.stringify(
                    jsonData,
                    null,
                    2
                );


            downloadFile(
                json,
                "table-full.json",
                "application/json;charset=utf-8"
            );


            setInfo(
                `✅ JSON downloaded — header + ${rows.length} records`
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
// CLEAR DATA
// ============================================================

const clearBtn =
    getElement(
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


            if (
                !confirmClear
            ) {

                return;

            }


            // Stop local monitor

            if (
                statusTimer
            ) {

                clearInterval(
                    statusTimer
                );

                statusTimer =
                    null;

            }


            // Tell background service

            try {

                await chrome.runtime.sendMessage({

                    action:
                        "clearCapture"

                });

            }
            catch (error) {

                console.log(
                    "Background clear message:",
                    error
                );

            }


            // Clear storage

            await chrome.storage.local.set({

                captureStatus:
                    "idle",

                captureRows:
                    [],

                captureHeader:
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
                    null,

                captureResume:
                    false

            });


            // Reset local variables

            capturedRows =
                [];

            capturedHeader =
                [];


            selectedTable =
                null;

            tables =
                [];


            const select =
                getElement(
                    "tableSelect"
                );


            if (
                select
            ) {

                select.innerHTML =
                    '<option value="">Select a table</option>';

            }


            const captureButton =
                getElement(
                    "captureBtn"
                );


            if (
                captureButton
            ) {

                captureButton.disabled =
                    false;

                captureButton.innerText =
                    "🚀 Capture Table";

            }


            setInfo(
                "🗑 Data cleared. Ready for new capture."
            );

        }
    );

}


// ============================================================
// STOP CAPTURE
// ============================================================

const stopBtn =
    getElement(
        "stopBtn"
    );


if (stopBtn) {

    stopBtn.addEventListener(
        "click",
        async () => {

            try {

                await chrome.runtime.sendMessage({

                    action:
                        "stopCapture"

                });

            }
            catch (error) {

                console.error(
                    "Stop error:",
                    error
                );

            }


            setInfo(
                "⏹ Capture stopped. Captured data has been preserved."
            );


            const captureButton =
                getElement(
                    "captureBtn"
                );


            if (
                captureButton
            ) {

                captureButton.disabled =
                    false;

                captureButton.innerText =
                    "🚀 Capture Table";

            }

        }
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
            changes.captureExpected ||
            changes.capturePage ||
            changes.captureRows ||
            changes.captureHeader
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


// Also load immediately

loadSavedCapture();