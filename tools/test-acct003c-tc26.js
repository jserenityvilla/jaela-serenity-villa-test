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
        console.log(" ACCT-003C-TC26 REFUND PAYMENT TYPE FILTER TEST");
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
        console.log("2. VERIFYING PAYMENT TYPE FILTER");

        const typeFilter = page.locator("#paymentType");
        const applyButton = page.locator("#applyButton");
        const clearButton = page.locator("#clearButton");

        if (await typeFilter.count() !== 1) {
            throw new Error("#paymentType not found");
        }

        if (await applyButton.count() !== 1) {
            throw new Error("#applyButton not found");
        }

        if (await clearButton.count() !== 1) {
            throw new Error("#clearButton not found");
        }

        console.log("PASS  Payment Type filter exists");
        console.log("PASS  Apply Filters button exists");
        console.log("PASS  Clear button exists");

        console.log("");
        console.log("3. CLEARING EXISTING FILTERS");

        await clearButton.click();
        await page.waitForTimeout(1500);

        console.log("PASS  Filters cleared");

        console.log("");
        console.log("4. SELECTING PAYMENT TYPE = REFUND");

        await typeFilter.selectOption("Refund");

        const selectedType =
            await typeFilter.inputValue();

        console.log("Selected type:", selectedType);

        if (selectedType !== "Refund") {
            throw new Error(
                `Payment Type did not select Refund. Found: ${selectedType}`
            );
        }

        console.log("PASS  Refund selected");

        console.log("");
        console.log("5. APPLYING FILTER");

        await applyButton.click();
        await page.waitForTimeout(1500);

        const selectedAfterApply =
            await typeFilter.inputValue();

        console.log(
            "Selected type after Apply:",
            selectedAfterApply
        );

        if (selectedAfterApply !== "Refund") {
            throw new Error(
                "Refund filter was not retained after Apply"
            );
        }

        console.log("PASS  Apply Filters executed");

        console.log("");
        console.log("6. VERIFYING FILTERED RESULTS");

        const rows = page.locator("table tbody tr");

        const rowCount = await rows.count();

        console.log("Rows returned:", rowCount);

        // Handle no-result row correctly
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
                    "INFO  No Refund transactions currently exist in TEST data"
                );
                console.log(
                    "RESULT: BLOCKED - TEST DATA REQUIRED"
                );
                return;
            }
        }

        if (rowCount === 0) {
            console.log(
                "RESULT: BLOCKED - No Refund test data available"
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

            if (!rowText.includes("Refund")) {
                throw new Error(
                    `Non-Refund payment returned: ${rowText}`
                );
            }

            if (rowText.includes("Deposit")) {
                throw new Error(
                    "Deposit payment remains visible after Refund filter"
                );
            }

            if (rowText.includes("Balance")) {
                throw new Error(
                    "Balance payment remains visible after Refund filter"
                );
            }

            if (rowText.includes("Full Payment")) {
                throw new Error(
                    "Full Payment remains visible after Refund filter"
                );
            }
        }

        console.log("");
        console.log(
            "PASS  All returned rows have Payment Type = Refund"
        );

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC26 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Payment Type = Refund filter verified");
        console.log("Only Refund transactions are displayed");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC26 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);
        console.error("==============================================");

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
