// ============================================================
// TABLE CAPTURE - DYNAMIC FULL TABLE CAPTURE
// ============================================================

let captureBusy = false;
let stopRequested = false;


// ============================================================
// BASIC HELPERS
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function cleanText(value) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
}


function rowKey(row) {
    return JSON.stringify(row);
}


// ============================================================
// GET TABLES
// ============================================================

function getTables() {

    const tables =
        Array.from(
            document.querySelectorAll("table")
        );

    return tables.map((table, index) => {

        const rows =
            table.querySelectorAll(
                "tbody tr"
            );

        const firstRow =
            table.querySelector("tbody tr") ||
            table.querySelector("tr");

        const columns =
            firstRow
                ? firstRow.querySelectorAll(
                    "td, th"
                ).length
                : 0;

        return {
            index: index,
            rowCount: rows.length,
            columnCount: columns
        };

    });
}


// ============================================================
// GET TARGET TABLE
// ============================================================

function getTargetTable(index) {

    const tables =
        document.querySelectorAll("table");

    return tables[index] || null;
}


// ============================================================
// READ HEADER
// ============================================================

function readTableHeader(table) {

    if (!table) {
        return [];
    }

    // --------------------------------------------------------
    // Prefer THEAD
    // --------------------------------------------------------

    const thead =
        table.querySelector("thead");

    if (thead) {

        const headerRows =
            thead.querySelectorAll("tr");

        if (headerRows.length) {

            // Use the last header row because many
            // applications have multiple header rows.

            const headerRow =
                headerRows[
                    headerRows.length - 1
                ];

            const cells =
                headerRow.querySelectorAll(
                    "th, td"
                );

            const header =
                Array.from(cells)
                    .map(cell =>
                        cleanText(
                            cell.innerText
                        )
                    );

            if (
                header.some(
                    value => value.length > 0
                )
            ) {
                return header;
            }
        }
    }


    // --------------------------------------------------------
    // Search for TH row
    // --------------------------------------------------------

    const rows =
        table.querySelectorAll("tr");

    for (const row of rows) {

        const ths =
            row.querySelectorAll("th");

        if (ths.length > 0) {

            const header =
                Array.from(ths)
                    .map(cell =>
                        cleanText(
                            cell.innerText
                        )
                    );

            if (
                header.some(
                    value => value.length > 0
                )
            ) {
                return header;
            }
        }
    }


    // --------------------------------------------------------
    // Last fallback
    // --------------------------------------------------------

    const firstRow =
        table.querySelector("tr");

    if (firstRow) {

        return Array.from(
            firstRow.querySelectorAll(
                "th, td"
            )
        ).map(cell =>
            cleanText(
                cell.innerText
            )
        );
    }


    return [];
}


// ============================================================
// READ TABLE DATA
// ============================================================

function readTable(table) {

    if (!table) {
        return [];
    }

    const result = [];

    // --------------------------------------------------------
    // Prefer TBODY
    // --------------------------------------------------------

    let rows =
        Array.from(
            table.querySelectorAll(
                "tbody tr"
            )
        );


    // --------------------------------------------------------
    // Fallback if no TBODY
    // --------------------------------------------------------

    if (rows.length === 0) {

        rows =
            Array.from(
                table.querySelectorAll("tr")
            ).filter(row => {

                return !row.closest("thead");

            });

    }


    for (const row of rows) {

        const cells =
            row.querySelectorAll(
                "th, td"
            );

        if (!cells.length) {
            continue;
        }


        const values =
            Array.from(cells)
                .map(cell =>
                    cleanText(
                        cell.innerText
                    )
                );


        if (
            values.some(
                value =>
                    value.length > 0
            )
        ) {

            result.push(values);

        }

    }


    return result;
}


// ============================================================
// TOTAL RECORD DETECTION
// ============================================================

function detectTotalRecords() {

    const bodyText =
        document.body.innerText || "";


    let match;


    // --------------------------------------------------------
    // DataTables:
    // Showing 1 to 20 of 43 entries
    // --------------------------------------------------------

    match =
        bodyText.match(
            /Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)\s+entries/i
        );

    if (match) {

        return Number(
            match[1].replace(/,/g, "")
        );

    }


    // --------------------------------------------------------
    // Showing 1 to 20 of 43
    // --------------------------------------------------------

    match =
        bodyText.match(
            /Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)/i
        );

    if (match) {

        return Number(
            match[1].replace(/,/g, "")
        );

    }


    // --------------------------------------------------------
    // Search Results (43)
    // Listing (43)
    // Records (43)
    // --------------------------------------------------------

    match =
        bodyText.match(
            /(?:Listing|Results|Records|Search\s+Results)\s*\(\s*([\d,]+)\s*\)/i
        );

    if (match) {

        return Number(
            match[1].replace(/,/g, "")
        );

    }


    // --------------------------------------------------------
    // DataTables information element
    // --------------------------------------------------------

    const info =
        document.querySelector(
            ".dataTables_info"
        );

    if (info) {

        const text =
            info.innerText || "";


        match =
            text.match(
                /of\s+([\d,]+)\s+entries/i
            );

        if (match) {

            return Number(
                match[1].replace(/,/g, "")
            );

        }
    }


    // --------------------------------------------------------
    // Common application counters
    // --------------------------------------------------------

    const selectors = [

        ".total-records",
        ".totalRecords",
        ".total-count",
        ".record-count",
        ".records-count",
        "[data-total-records]",
        "[data-total]",
        "[data-count]"

    ];


    for (const selector of selectors) {

        const element =
            document.querySelector(
                selector
            );

        if (!element) {
            continue;
        }


        const text =
            element.innerText ||
            element.textContent ||
            element.getAttribute(
                "data-total-records"
            ) ||
            element.getAttribute(
                "data-total"
            ) ||
            element.getAttribute(
                "data-count"
            ) ||
            "";


        match =
            String(text).match(
                /[\d,]+/
            );


        if (match) {

            const number =
                Number(
                    match[0].replace(
                        /,/g,
                        ""
                    )
                );


            if (
                number > 0
            ) {

                return number;

            }

        }

    }


    return null;
}


// ============================================================
// CURRENT PAGE RANGE
// ============================================================

function detectCurrentRange() {

    const bodyText =
        document.body.innerText || "";


    let match =
        bodyText.match(
            /Showing\s+(\d+)\s+to\s+(\d+)\s+of\s+([\d,]+)\s+entries/i
        );


    if (match) {

        return {

            start:
                Number(match[1]),

            end:
                Number(match[2]),

            total:
                Number(
                    match[3].replace(
                        /,/g,
                        ""
                    )
                )

        };

    }


    return null;
}


// ============================================================
// PAGINATION ELEMENTS
// ============================================================

function getPaginationButtons() {

    return Array.from(
        document.querySelectorAll(
            "button, a, li"
        )
    );

}


// ============================================================
// DISABLED CHECK
// ============================================================

function isDisabled(element) {

    if (!element) {
        return true;
    }


    if (element.disabled) {
        return true;
    }


    if (
        element.getAttribute(
            "disabled"
        ) !== null
    ) {
        return true;
    }


    if (
        element.getAttribute(
            "aria-disabled"
        ) === "true"
    ) {
        return true;
    }


    if (
        element.classList.contains(
            "disabled"
        )
    ) {
        return true;
    }


    const parent =
        element.parentElement;


    if (
        parent &&
        parent.classList.contains(
            "disabled"
        )
    ) {
        return true;
    }


    return false;
}


// ============================================================
// FIND FIRST BUTTON
// ============================================================

function getFirstButton() {

    const selectors = [

        ".dataTables_paginate .first",

        ".pagination .first",

        "button[aria-label='First']",

        "a[aria-label='First']",

        "button[title='First']",

        "a[title='First']"

    ];


    for (const selector of selectors) {

        const button =
            document.querySelector(
                selector
            );


        if (
            button &&
            !isDisabled(button)
        ) {

            return button;

        }

    }


    const candidates =
        getPaginationButtons();


    for (const element of candidates) {

        const text =
            cleanText(
                element.innerText
            ).toLowerCase();


        if (
            text === "first" ||
            text === "first »" ||
            text === "« first" ||
            text === "«" ||
            text === "««"
        ) {

            if (
                !isDisabled(element)
            ) {

                return element;

            }

        }

    }


    return null;
}


// ============================================================
// FIND NEXT BUTTON
// ============================================================

function getNextButton() {

    const selectors = [

        ".dataTables_paginate .next",

        ".pagination .next",

        "button[aria-label='Next']",

        "a[aria-label='Next']",

        "button[title='Next']",

        "a[title='Next']",

        "[rel='next']"

    ];


    for (const selector of selectors) {

        const button =
            document.querySelector(
                selector
            );


        if (button) {
            return button;
        }

    }


    const candidates =
        getPaginationButtons();


    for (const element of candidates) {

        const text =
            cleanText(
                element.innerText
            ).toLowerCase();


        if (
            text === "next" ||
            text === "next ›" ||
            text === "next »" ||
            text === "›" ||
            text === "»"
        ) {

            return element;

        }

    }


    return null;
}


// ============================================================
// FIRST ROW SIGNATURE
// ============================================================

function getFirstRowSignature(table) {

    const rows =
        readTable(table);


    if (!rows.length) {
        return "";
    }


    return rowKey(
        rows[0]
    );
}


// ============================================================
// WAIT FOR ROWS
// ============================================================

async function waitForRows(
    table,
    timeout = 30000
) {

    const start =
        Date.now();


    while (
        Date.now() - start <
        timeout
    ) {

        if (stopRequested) {
            return [];
        }


        const rows =
            readTable(table);


        if (
            rows.length > 0
        ) {

            return rows;

        }


        await sleep(300);

    }


    return [];
}


// ============================================================
// WAIT FOR PAGE CHANGE
// ============================================================

async function waitForPageChange(
    table,
    oldSignature,
    oldRange,
    timeout = 30000
) {

    const start =
        Date.now();


    while (
        Date.now() - start <
        timeout
    ) {

        if (stopRequested) {
            return false;
        }


        await sleep(400);


        const newRange =
            detectCurrentRange();


        if (
            oldRange &&
            newRange &&
            newRange.start !==
            oldRange.start
        ) {

            return true;

        }


        const newSignature =
            getFirstRowSignature(
                table
            );


        if (
            newSignature &&
            newSignature !==
            oldSignature
        ) {

            return true;

        }

    }


    return false;
}


// ============================================================
// GO TO FIRST PAGE
// ============================================================

async function goToFirstPage(table) {

    const range =
        detectCurrentRange();


    if (
        range &&
        range.start === 1
    ) {

        return;

    }


    const first =
        getFirstButton();


    if (!first) {

        console.log(
            "First button not found. Continuing from current page."
        );

        return;

    }


    const oldSignature =
        getFirstRowSignature(
            table
        );


    first.scrollIntoView({
        block: "center"
    });


    await sleep(300);


    first.click();


    await waitForPageChange(
        table,
        oldSignature,
        range,
        30000
    );


    await sleep(1000);

}


// ============================================================
// SAVE PROGRESS
// ============================================================

async function saveProgress(
    rows,
    page,
    header,
    total
) {

    await chrome.storage.local.set({

        captureStatus:
            "capturing",

        captureRows:
            rows,

        captureHeader:
            header,

        capturePage:
            page,

        captureTotal:
            rows.length,

        captureExpected:
            total,

        captureResume:
            false

    });

}


// ============================================================
// SEND PROGRESS
// ============================================================

function sendProgress(
    page,
    rows,
    total
) {

    try {

        chrome.runtime.sendMessage({

            action:
                "captureProgress",

            page:
                page,

            rows:
                rows,

            total:
                total

        }).catch(
            () => {}
        );

    }
    catch (error) {

        console.log(
            "Progress message ignored."
        );

    }

}


// ============================================================
// MAIN FULL CAPTURE
// ============================================================

async function startFullCapture(
    tableIndex
) {

    if (captureBusy) {

        console.log(
            "Capture already running."
        );

        return;

    }


    captureBusy =
        true;

    stopRequested =
        false;


    try {

        const table =
            getTargetTable(
                tableIndex
            );


        if (!table) {

            throw new Error(
                "Target table not found."
            );

        }


        // ----------------------------------------------------
        // DETECT TOTAL
        // ----------------------------------------------------

        let total =
            detectTotalRecords();


        console.log(
            "EXPECTED TOTAL:",
            total
        );


        // ----------------------------------------------------
        // GO TO FIRST PAGE
        // ----------------------------------------------------

        await goToFirstPage(
            table
        );


        await sleep(1000);


        // ----------------------------------------------------
        // HEADER - CAPTURE ONLY ONCE
        // ----------------------------------------------------

        const capturedHeader =
            readTableHeader(
                table
            );


        console.log(
            "TABLE HEADER:",
            capturedHeader
        );


        // ----------------------------------------------------
        // DATA
        // ----------------------------------------------------

        const capturedRows =
            [];


        const uniqueRows =
            new Set();


        let page =
            0;


        let pagesWithoutNewRows =
            0;


        // ----------------------------------------------------
        // PAGE LOOP
        // ----------------------------------------------------

        while (!stopRequested) {

            // ------------------------------------------------
            // READ CURRENT PAGE
            // ------------------------------------------------

            const rows =
                await waitForRows(
                    table,
                    30000
                );


            if (!rows.length) {

                throw new Error(
                    "No rows found on current page."
                );

            }


            // ------------------------------------------------
            // ADD UNIQUE ROWS
            // ------------------------------------------------

            let newRows =
                0;


            for (const row of rows) {

                const key =
                    rowKey(row);


                if (
                    !uniqueRows.has(
                        key
                    )
                ) {

                    uniqueRows.add(
                        key
                    );


                    capturedRows.push(
                        row
                    );


                    newRows++;

                }

            }


            page++;


            // ------------------------------------------------
            // UPDATE TOTAL
            // ------------------------------------------------

            const detectedTotal =
                detectTotalRecords();


            if (
                detectedTotal &&
                detectedTotal > 0
            ) {

                total =
                    detectedTotal;

            }


            // ------------------------------------------------
            // SAVE
            // ------------------------------------------------

            await saveProgress(
                capturedRows,
                page,
                capturedHeader,
                total
            );


            sendProgress(
                page,
                capturedRows.length,
                total
            );


            console.log(
                `PAGE ${page}: ${rows.length} rows`
            );


            console.log(
                `NEW ROWS: ${newRows}`
            );


            console.log(
                `CAPTURED: ${capturedRows.length} / ${total || "unknown"}`
            );


            // ------------------------------------------------
            // TOTAL REACHED
            // ------------------------------------------------

            if (
                total &&
                capturedRows.length >=
                total
            ) {

                console.log(
                    "TOTAL RECORDS REACHED."
                );

                break;

            }


            // ------------------------------------------------
            // NO NEW DATA PROTECTION
            // ------------------------------------------------

            if (
                newRows === 0
            ) {

                pagesWithoutNewRows++;

            }
            else {

                pagesWithoutNewRows =
                    0;

            }


            if (
                pagesWithoutNewRows >= 2
            ) {

                console.log(
                    "No new rows for two pages. Ending capture."
                );

                break;

            }


            // ------------------------------------------------
            // FIND NEXT
            // ------------------------------------------------

            const next =
                getNextButton();


            if (!next) {

                console.log(
                    "Next button not found. End reached."
                );

                break;

            }


            // ------------------------------------------------
            // NEXT DISABLED
            // ------------------------------------------------

            if (
                isDisabled(next)
            ) {

                console.log(
                    "Next button disabled. End reached."
                );

                break;

            }


            // ------------------------------------------------
            // CURRENT PAGE SIGNATURE
            // ------------------------------------------------

            const oldSignature =
                getFirstRowSignature(
                    table
                );


            const oldRange =
                detectCurrentRange();


            // ------------------------------------------------
            // CLICK NEXT
            // ------------------------------------------------

            next.scrollIntoView({
                block: "center"
            });


            await sleep(300);


            next.click();


            // ------------------------------------------------
            // WAIT FOR PAGE CHANGE
            // ------------------------------------------------

            const changed =
                await waitForPageChange(
                    table,
                    oldSignature,
                    oldRange,
                    30000
                );


            if (!changed) {

                console.log(
                    "Page did not change. Retrying once..."
                );


                await sleep(2000);


                const retryNext =
                    getNextButton();


                if (
                    !retryNext ||
                    isDisabled(
                        retryNext
                    )
                ) {

                    break;

                }


                const retryOldSignature =
                    getFirstRowSignature(
                        table
                    );


                const retryOldRange =
                    detectCurrentRange();


                retryNext.click();


                const retryChanged =
                    await waitForPageChange(
                        table,
                        retryOldSignature,
                        retryOldRange,
                        30000
                    );


                if (!retryChanged) {

                    console.log(
                        "Unable to advance page. Ending capture."
                    );

                    break;

                }

            }


            // ------------------------------------------------
            // WAIT FOR AJAX RENDER
            // ------------------------------------------------

            await sleep(1000);

        }


        // ====================================================
        // COMPLETE
        // ====================================================

        await chrome.storage.local.set({

            captureStatus:
                stopRequested
                    ? "stopped"
                    : "complete",

            captureRows:
                capturedRows,

            captureHeader:
                capturedHeader,

            capturePage:
                page,

            captureTotal:
                capturedRows.length,

            captureExpected:
                total,

            captureResume:
                false,

            captureError:
                ""

        });


        try {

            chrome.runtime.sendMessage({

                action:
                    stopRequested
                        ? "captureStopped"
                        : "captureComplete",

                rowCount:
                    capturedRows.length,

                pages:
                    page,

                total:
                    total

            }).catch(
                () => {}
            );

        }
        catch (error) {

            console.log(
                "Final message ignored."
            );

        }


        console.log(
            "===================================="
        );


        console.log(
            stopRequested
                ? "CAPTURE STOPPED"
                : "CAPTURE COMPLETE"
        );


        console.log(
            "Pages:",
            page
        );


        console.log(
            "Records:",
            capturedRows.length
        );


        console.log(
            "Expected:",
            total
        );


        console.log(
            "===================================="
        );

    }
    catch (error) {

        console.error(
            "CAPTURE ERROR:",
            error
        );


        await chrome.storage.local.set({

            captureStatus:
                "error",

            captureError:
                error.message,

            captureResume:
                false

        });

    }
    finally {

        captureBusy =
            false;

    }

}


// ============================================================
// MESSAGE HANDLER
// ============================================================

chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {


        // ----------------------------------------------------
        // GET TABLES
        // ----------------------------------------------------

        if (
            message.action ===
            "getTables"
        ) {

            sendResponse({

                tables:
                    getTables()

            });


            return true;

        }


        // ----------------------------------------------------
        // START CAPTURE
        // ----------------------------------------------------

        if (
            message.action ===
            "startCapture"
        ) {

            if (captureBusy) {

                sendResponse({

                    started:
                        false,

                    message:
                        "Capture already running."

                });


                return true;

            }


            const tableIndex =
                Number(
                    message.tableIndex
                );


            // ------------------------------------------------
            // CLEAR OLD CAPTURE
            // ------------------------------------------------

            chrome.storage.local.set({

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
                    detectTotalRecords(),

                captureError:
                    "",

                captureTableIndex:
                    tableIndex,

                captureResume:
                    false

            }).then(() => {

                startFullCapture(
                    tableIndex
                );

            });


            sendResponse({

                started:
                    true

            });


            return true;

        }


        // ----------------------------------------------------
        // STOP CAPTURE
        // ----------------------------------------------------

        if (
            message.action ===
            "stopCapture"
        ) {

            stopRequested =
                true;


            sendResponse({

                stopped:
                    true

            });


            return true;

        }


        // ----------------------------------------------------
        // CLEAR CAPTURE
        // ----------------------------------------------------

        if (
            message.action ===
            "clearCapture"
        ) {

            stopRequested =
                true;


            chrome.storage.local.set({

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


            sendResponse({

                cleared:
                    true

            });


            return true;

        }

    }
);


// ============================================================
// PAGE VISIBILITY / FOCUS PROTECTION
// ============================================================

// We deliberately DO NOT stop the capture when:
// - popup closes
// - user clicks somewhere
// - page loses focus
// - another tab becomes active
//
// The capture runs inside the content script and progress
// is continuously stored in chrome.storage.local.
//
// ============================================================

console.log(
    "Table Capture content.js loaded."
);