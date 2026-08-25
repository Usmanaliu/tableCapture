// ============================================================
// TABLE CAPTURE - RESUMABLE CONTENT SCRIPT
// ============================================================

let captureRunning = false;


// ============================================================
// SLEEP
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================================
// VISIBILITY
// ============================================================

function isVisible(element) {

    if (!element) {
        return false;
    }

    const rect =
        element.getBoundingClientRect();

    return (
        rect.width > 0 &&
        rect.height > 0 &&
        getComputedStyle(element).visibility !== "hidden"
    );
}


// ============================================================
// DISABLED
// ============================================================

function isDisabled(element) {

    if (!element) {
        return true;
    }

    if (element.disabled) {
        return true;
    }

    if (
        element.hasAttribute("disabled")
    ) {
        return true;
    }

    if (
        element.getAttribute("aria-disabled") === "true"
    ) {
        return true;
    }

    if (
        element.classList.contains("disabled")
    ) {
        return true;
    }

    const parent =
        element.parentElement;

    if (
        parent &&
        parent.classList.contains("disabled")
    ) {
        return true;
    }

    return false;
}


// ============================================================
// EXTRACT TABLE DATA
// ============================================================

function extractTable(table) {

    let rows = [];

    // --------------------------------------------------------
    // Prefer tbody
    // --------------------------------------------------------

    const tbodyRows =
        table.querySelectorAll(
            "tbody tr"
        );


    if (tbodyRows.length > 0) {

        rows =
            Array.from(
                tbodyRows
            );

    } else {

        // ----------------------------------------------------
        // Fallback
        // ----------------------------------------------------

        rows =
            Array.from(
                table.querySelectorAll("tr")
            );
    }


    const result = [];


    for (const row of rows) {

        const cells =
            Array.from(
                row.querySelectorAll("td, th")
            );


        const values =
            cells.map(
                cell =>
                    cell.innerText
                        .replace(/\s+/g, " ")
                        .trim()
            );


        if (
            values.length > 0
        ) {

            result.push(values);
        }
    }


    return result;
}


// ============================================================
// TABLE DETECTION
// ============================================================

function getTables() {

    const tables =
        document.querySelectorAll("table");


    return Array.from(
        tables
    ).map(
        (table, index) => {

            const rows =
                extractTable(table);


            let columns = 0;


            if (
                rows.length > 0
            ) {

                columns =
                    Math.max(
                        ...rows.map(
                            row =>
                                row.length
                        )
                    );
            }


            return {

                index: index,

                rowCount:
                    rows.length,

                columnCount:
                    columns

            };
        }
    );
}


// ============================================================
// TOTAL RECORDS
// ============================================================

function getTotalRecords() {

    const text =
        document.body.innerText || "";


    // Example:
    // Showing 1 to 100 of 2723 entries

    let match =
        text.match(
            /Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)\s+entries/i
        );


    if (match) {

        return parseInt(
            match[1].replace(/,/g, ""),
            10
        );
    }


    // Example:
    // Search Results (2723)

    match =
        text.match(
            /Search Results\s*\(\s*([\d,]+)\s*\)/i
        );


    if (match) {

        return parseInt(
            match[1].replace(/,/g, ""),
            10
        );
    }


    return null;
}


// ============================================================
// FIND NEXT BUTTON
// ============================================================

function findNextButton(table) {

    // --------------------------------------------------------
    // Common pagination selectors
    // --------------------------------------------------------

    const selectors = [

        ".dataTables_paginate .next",

        ".dataTables_paginate .paginate_button.next",

        ".dataTables_paginate a.next",

        ".dataTables_paginate button.next",

        ".pagination .next",

        ".pagination li.next",

        ".pagination li.next a",

        ".pagination .next a",

        "a.paginate_button.next",

        "[aria-label='Next']",

        "[aria-label='Next page']",

        "[title='Next']",

        "[title='Next page']"

    ];


    for (
        const selector of selectors
    ) {

        const elements =
            document.querySelectorAll(
                selector
            );


        for (
            const element of elements
        ) {

            if (
                !isVisible(element)
            ) {
                continue;
            }


            if (
                isDisabled(element)
            ) {
                continue;
            }


            return element;
        }
    }


    // --------------------------------------------------------
    // Search around table
    // --------------------------------------------------------

    let container =
        table.parentElement;


    for (
        let level = 0;
        level < 10;
        level++
    ) {

        if (!container) {
            break;
        }


        const elements =
            container.querySelectorAll(
                "button, a, [role='button'], li"
            );


        for (
            const element of elements
        ) {

            if (
                !isVisible(element)
            ) {
                continue;
            }


            if (
                isDisabled(element)
            ) {
                continue;
            }


            const text =
                element.innerText
                    .trim()
                    .replace(/\s+/g, " ");


            const aria =
                element.getAttribute(
                    "aria-label"
                ) || "";


            const title =
                element.getAttribute(
                    "title"
                ) || "";


            if (
                /^Next$/i.test(text) ||
                /^Next Page$/i.test(text) ||
                /next page/i.test(aria) ||
                /^Next$/i.test(aria) ||
                /^Next$/i.test(title)
            ) {

                return element;
            }
        }


        container =
            container.parentElement;
    }


    // --------------------------------------------------------
    // Final fallback
    // --------------------------------------------------------

    const all =
        document.querySelectorAll(
            "button, a, [role='button'], li"
        );


    for (
        const element of all
    ) {

        if (
            !isVisible(element)
        ) {
            continue;
        }


        if (
            isDisabled(element)
        ) {
            continue;
        }


        const text =
            element.innerText
                .trim()
                .replace(/\s+/g, " ");


        if (
            /^Next$/i.test(text) ||
            /^Next Page$/i.test(text)
        ) {

            return element;
        }
    }


    return null;
}


// ============================================================
// CAPTURE PAGE
// ============================================================

async function captureCurrentPage(
    tableIndex
) {

    const tables =
        document.querySelectorAll(
            "table"
        );


    const table =
        tables[tableIndex];


    if (!table) {

        console.log(
            "Table not found."
        );

        return null;
    }


    const rows =
        extractTable(table);


    console.log(
        "Current page rows:",
        rows.length
    );


    return rows;
}


// ============================================================
// SAVE CAPTURE STATE
// ============================================================

async function saveCaptureState(
    rows,
    page
) {

    const expected =
        getTotalRecords();


    await chrome.storage.local.set({

        captureStatus:
            "capturing",

        captureRows:
            rows,

        capturePage:
            page,

        captureTotal:
            rows.length,

        captureExpected:
            expected,

        captureError:
            ""

    });
}


// ============================================================
// START CAPTURE
// ============================================================

async function startCapture(
    tableIndex,
    isResume = false
) {

    if (captureRunning) {

        console.log(
            "Capture already running."
        );

        return;
    }


    captureRunning = true;


    console.log(
        "================================"
    );

    console.log(
        isResume
            ? "RESUMING CAPTURE"
            : "STARTING CAPTURE"
    );

    console.log(
        "================================"
    );


    try {

        // ----------------------------------------------------
        // Read existing capture
        // ----------------------------------------------------

        const stored =
            await chrome.storage.local.get([
                "captureRows",
                "capturePage",
                "captureExpected",
                "captureStatus"
            ]);


        let allRows =
            Array.isArray(
                stored.captureRows
            )
                ? stored.captureRows
                : [];


        let page =
            Number(
                stored.capturePage || 0
            );


        const seen =
            new Set();


        // ----------------------------------------------------
        // Put existing rows into Set
        // ----------------------------------------------------

        for (
            const row of allRows
        ) {

            seen.add(
                JSON.stringify(row)
            );
        }


        // ----------------------------------------------------
        // Capture current page
        // ----------------------------------------------------

        const currentRows =
            await captureCurrentPage(
                tableIndex
            );


        if (
            !currentRows ||
            currentRows.length === 0
        ) {

            throw new Error(
                "No table rows found."
            );
        }


        // ----------------------------------------------------
        // Add current page rows
        // ----------------------------------------------------

        for (
            const row of currentRows
        ) {

            const key =
                JSON.stringify(row);


            if (
                !seen.has(key)
            ) {

                seen.add(key);

                allRows.push(row);
            }
        }


        // ----------------------------------------------------
        // Current page number
        // ----------------------------------------------------

        page++;


        // ----------------------------------------------------
        // Get expected records
        // ----------------------------------------------------

        const expected =
            getTotalRecords();


        // ----------------------------------------------------
        // Save immediately
        // ----------------------------------------------------

        await saveCaptureState(
            allRows,
            page
        );


        console.log(
            "Page:",
            page
        );

        console.log(
            "Rows captured:",
            allRows.length
        );

        console.log(
            "Expected:",
            expected
        );


        // ----------------------------------------------------
        // Check complete
        // ----------------------------------------------------

        if (
            expected !== null &&
            allRows.length >= expected
        ) {

            await chrome.storage.local.set({

                captureStatus:
                    "complete",

                captureRows:
                    allRows,

                capturePage:
                    page,

                captureTotal:
                    allRows.length,

                captureExpected:
                    expected

            });


            console.log(
                "CAPTURE COMPLETE"
            );


            captureRunning = false;

            return;
        }


        // ----------------------------------------------------
        // Find Next
        // ----------------------------------------------------

        const table =
            document.querySelectorAll(
                "table"
            )[tableIndex];


        const nextButton =
            findNextButton(table);


        if (!nextButton) {

            console.log(
                "Next button not found."
            );


            await chrome.storage.local.set({

                captureStatus:
                    "complete",

                captureRows:
                    allRows,

                capturePage:
                    page,

                captureTotal:
                    allRows.length,

                captureExpected:
                    expected

            });


            captureRunning = false;

            return;
        }


        if (
            isDisabled(nextButton)
        ) {

            console.log(
                "Next button disabled."
            );


            await chrome.storage.local.set({

                captureStatus:
                    "complete",

                captureRows:
                    allRows,

                capturePage:
                    page,

                captureTotal:
                    allRows.length,

                captureExpected:
                    expected

            });


            captureRunning = false;

            return;
        }


        // ----------------------------------------------------
        // IMPORTANT
        //
        // Save state BEFORE clicking Next.
        //
        // If the website reloads, the new content.js
        // will read this state and continue automatically.
        // ----------------------------------------------------

        await chrome.storage.local.set({

            captureStatus:
                "capturing",

            captureRows:
                allRows,

            capturePage:
                page,

            captureTotal:
                allRows.length,

            captureExpected:
                expected,

            captureTableIndex:
                tableIndex,

            captureResume:
                true

        });


        console.log(
            "State saved."
        );

        console.log(
            "Clicking Next..."
        );


        // ----------------------------------------------------
        // Click Next
        // ----------------------------------------------------

        nextButton.click();


        // ----------------------------------------------------
        // DO NOT CONTINUE HERE.
        //
        // The page may reload.
        // The new content.js will resume.
        // ----------------------------------------------------

        captureRunning = false;

    }

    catch (error) {

        console.error(
            "Capture error:",
            error
        );


        await chrome.storage.local.set({

            captureStatus:
                "error",

            captureError:
                error.message || String(error)

        });


        captureRunning = false;
    }
}


// ============================================================
// AUTO RESUME AFTER PAGE LOAD
// ============================================================

async function checkForResume() {

    // Wait for page/table to load
    await sleep(1200);


    const data =
        await chrome.storage.local.get([
            "captureStatus",
            "captureResume",
            "captureTableIndex",
            "captureRows",
            "capturePage"
        ]);


    console.log(
        "Resume check:",
        data
    );


    if (
        data.captureStatus !==
        "capturing"
    ) {

        return;
    }


    if (
        data.captureResume !== true
    ) {

        return;
    }


    const tableIndex =
        Number(
            data.captureTableIndex
        );


    if (
        isNaN(tableIndex)
    ) {

        return;
    }


    // --------------------------------------------------------
    // Make sure the table exists
    // --------------------------------------------------------

    const tables =
        document.querySelectorAll(
            "table"
        );


    if (
        !tables[tableIndex]
    ) {

        console.log(
            "Waiting for table..."
        );


        await sleep(1500);


        checkForResume();

        return;
    }


    console.log(
        "================================"
    );

    console.log(
        "RESUMING AUTOMATICALLY"
    );

    console.log(
        "Existing rows:",
        Array.isArray(data.captureRows)
            ? data.captureRows.length
            : 0
    );

    console.log(
        "Previous page:",
        data.capturePage
    );

    console.log(
        "================================"
    );


    await startCapture(
        tableIndex,
        true
    );
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
        // DETECT TABLES
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

            const tableIndex =
                Number(
                    message.tableIndex
                );


            chrome.storage.local.set({

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
                    tableIndex,

                captureResume:
                    true

            }).then(
                () => {

                    startCapture(
                        tableIndex,
                        false
                    );

                }
            );


            sendResponse({

                started:
                    true

            });


            return true;
        }

    }
);


// ============================================================
// PAGE LOAD
// ============================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            checkForResume();

        }
    );

} else {

    checkForResume();

}

async function checkForResume() {

    await sleep(1200);


    const data =
        await chrome.storage.local.get([
            "captureStatus",
            "captureResume",
            "captureTableIndex"
        ]);


    if (
        data.captureStatus !==
        "capturing"
    ) {

        return;
    }


    if (
        data.captureResume !== true
    ) {

        return;
    }


    const tableIndex =
        Number(
            data.captureTableIndex
        );


    if (
        Number.isNaN(
            tableIndex
        )
    ) {

        return;
    }


    console.log(
        "Background capture detected."
    );


    console.log(
        "Resuming table:",
        tableIndex
    );


    await startCapture(
        tableIndex,
        true
    );
}