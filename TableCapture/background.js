// ============================================================
// TABLE CAPTURE - BACKGROUND SERVICE WORKER
// ============================================================


// ============================================================
// INSTALL
// ============================================================

chrome.runtime.onInstalled.addListener(
    async () => {

        console.log(
            "Table Capture installed."
        );

    }
);


// ============================================================
// START CAPTURE
// ============================================================

chrome.runtime.onMessage.addListener(
    async (
        message,
        sender,
        sendResponse
    ) => {

        // ----------------------------------------------------
        // START
        // ----------------------------------------------------

        if (
            message.action ===
            "backgroundStartCapture"
        ) {

            const tabId =
                message.tabId;


            const tableIndex =
                Number(
                    message.tableIndex
                );


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
                    tableIndex,

                captureTabId:
                    tabId,

                captureResume:
                    true,

                captureStarted:
                    Date.now()

            });


            sendResponse({
                success: true
            });


            return true;
        }


        // ----------------------------------------------------
        // STOP
        // ----------------------------------------------------

        if (
            message.action ===
            "stopCapture"
        ) {

            await chrome.storage.local.set({

                captureStatus:
                    "stopped",

                captureResume:
                    false

            });


            sendResponse({
                success: true
            });


            return true;
        }


        // ----------------------------------------------------
        // CLEAR
        // ----------------------------------------------------

        if (
            message.action ===
            "clearCapture"
        ) {

            await chrome.storage.local.clear();


            sendResponse({
                success: true
            });


            return true;
        }


        // ----------------------------------------------------
        // GET STATUS
        // ----------------------------------------------------

        if (
            message.action ===
            "getCaptureStatus"
        ) {

            const data =
                await chrome.storage.local.get(
                    null
                );


            sendResponse(
                data
            );


            return true;
        }

    }
);