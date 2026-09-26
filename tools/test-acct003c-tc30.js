const { chromium } = require("playwright");

const CHROME =
    "C:\\Users\\surek\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";

const BASE =
    "https://ja-ela-serenity-villa-test.web.app";

const LOGIN_URL =
    `${BASE}/admin/login.html?return=%2Fadmin%2Faccounts%2Fpayments.html`;

const EMAIL = process.env.TEST_ADMIN_EMAIL;
const PASSWORD = process.env.TEST_ADMIN_PASSWORD;

(async () => {

    const browser = await chromium.launch({
        executablePath: CHROME,
        headless: true
    });

    const page = await browser.newPage();

    page.on("console", msg => {
        if (msg.type() === "error") {
            console.log("BROWSER ERROR:", msg.text());
        }
    });

    page.on("pageerror", error => {
        console.log("PAGE ERROR:", error.message);
    });

    try {

        console.log("==============================================");
        console.log(" ACCT-003C-TC30 PAYMENT STATUS CANCELLED TEST");
        console.log("==============================================");

        console.log("");
        console.log("1. LOGIN");

        await page.goto(LOGIN_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        await page.locator("#adminEmail").fill(EMAIL);
        await page.locator("#adminPassword").fill(PASSWORD);
        await page.locator("#adminLoginButton").click();

        await page.waitForURL(
            url => url.pathname.includes("/admin/accounts/payments.html"),
            { timeout: 15000 }
        );

        await page.waitForTimeout(3000);

        console.log("PASS  Authentication successful");

        console.log("");
        console.log("2. VERIFYING PAYMENT STATUS FILTER");

        const statusFilter = page.locator("#paymentStatus");
        const applyButton = page.locator("#applyButton");
        const clearButton = page.locator("#clearButton");

        if (await statusFilter.count() !== 1) {
            throw new Error("#paymentStatus not found");
        }

        if (await applyButton.count() !== 1) {
            throw new Error("#applyButton not found");
        }

        if (await clearButton.count() !== 1) {
            throw new Error("#clearButton not found");
        }

        console.log("PASS  Payment Status filter exists");
        console.log("PASS  Apply Filters button exists");
        console.log("PASS  Clear button exists");

        console.log("");
        console.log("3. CLEARING EXISTING FILTERS");

        await clearButton.click();
        await page.waitForTimeout(1500);

        console.log("PASS  Filters cleared");

        console.log("");
        console.log("4. SELECTING PAYMENT STATUS = CANCELLED");

        await statusFilter.selectOption("Cancelled");

        const selectedStatus =
            await statusFilter.inputValue();

        console.log(
            "Selected status:",
            selectedStatus
        );

        if (selectedStatus !== "Cancelled") {
            throw new Error(
                `Payment Status did not select Cancelled. Found: ${selectedStatus}`
            );
        }

        console.log("PASS  Cancelled selected");

        console.log("");
        console.log("5. APPLYING FILTER");

        await applyButton.click();
        await page.waitForTimeout(1500);

        const selectedAfterApply =
            await statusFilter.inputValue();

        console.log(
            "Selected status after Apply:",
            selectedAfterApply
        );

        if (selectedAfterApply !== "Cancelled") {
            throw new Error(
                "Cancelled filter was not retained after Apply"
            );
        }

        console.log("PASS  Apply Filters executed");

        console.log("");
        console.log("6. VERIFYING FILTERED RESULTS");

        const rows = page.locator("table tbody tr");
        const rowCount = await rows.count();

        console.log(
            "Rows returned:",
            rowCount
        );

        if (rowCount === 1) {

            const firstRowText =
                (await rows.first().innerText())
                    .replace(/\s+/g, " ")
                    .trim();

            if (
                firstRowText.includes(
                    "No payment transactions match the current filters"
                )
            ) {
                console.log(
                    "INFO  No Cancelled transactions currently exist in TEST data"
                );
                console.log(
                    "RESULT: BLOCKED - TEST DATA REQUIRED"
                );
                return;
            }
        }

        if (rowCount === 0) {
            console.log(
                "RESULT: BLOCKED - No Cancelled test data available"
            );
            return;
        }

        for (let i = 0; i < rowCount; i++) {

            const rowText =
                (await rows.nth(i).innerText())
                    .replace(/\s+/g, " ")
                    .trim();

            console.log("");
            console.log(`ROW ${i + 1}:`);
            console.log(rowText);

            if (!rowText.includes("Cancelled")) {
                throw new Error(
                    `Non-Cancelled payment returned: ${rowText}`
                );
            }

            if (rowText.includes("Completed")) {
                throw new Error(
                    "Completed payment remains visible after Cancelled filter"
                );
            }

            if (rowText.includes("Pending")) {
                throw new Error(
                    "Pending payment remains visible after Cancelled filter"
                );
            }

            if (rowText.includes("Failed")) {
                throw new Error(
                    "Failed payment remains visible after Cancelled filter"
                );
            }

            if (rowText.includes("Refunded")) {
                throw new Error(
                    "Refunded payment remains visible after Cancelled filter"
                );
            }
        }

        console.log("");
        console.log(
            "PASS  All returned rows have Payment Status = Cancelled"
        );

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC30 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Payment Status = Cancelled filter verified");
        console.log("Only Cancelled payments are displayed");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC30 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);
        console.error("==============================================");

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
