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
        console.log(" ACCT-003C-TC22 PAYMENT STATUS FILTER TEST");
        console.log("==============================================");

        // 1. LOGIN
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

        // 2. VERIFY CONTROLS
        console.log("");
        console.log("2. VERIFYING FILTER CONTROLS");

        const statusFilter = page.locator("#paymentStatus");
        const methodFilter = page.locator("#paymentMethod");
        const typeFilter = page.locator("#paymentType");
        const applyButton = page.locator("#applyButton");
        const clearButton = page.locator("#clearButton");

        if (await statusFilter.count() !== 1) {
            throw new Error("#paymentStatus not found");
        }

        if (await methodFilter.count() !== 1) {
            throw new Error("#paymentMethod not found");
        }

        if (await typeFilter.count() !== 1) {
            throw new Error("#paymentType not found");
        }

        if (await applyButton.count() !== 1) {
            throw new Error("#applyButton not found");
        }

        if (await clearButton.count() !== 1) {
            throw new Error("#clearButton not found");
        }

        console.log("PASS  Payment Status filter exists");
        console.log("PASS  Payment Method filter exists");
        console.log("PASS  Payment Type filter exists");
        console.log("PASS  Apply Filters button exists");
        console.log("PASS  Clear button exists");

        // 3. CLEAR ALL FILTERS
        console.log("");
        console.log("3. CLEARING EXISTING FILTERS");

        await clearButton.click();
        await page.waitForTimeout(1500);

        console.log("PASS  Filters cleared");

        // 4. SELECT COMPLETED
        console.log("");
        console.log("4. SELECTING PAYMENT STATUS = COMPLETED");

        await statusFilter.selectOption("Completed");

        const selectedStatus =
            await statusFilter.inputValue();

        console.log(
            "Selected status:",
            selectedStatus
        );

        if (selectedStatus !== "Completed") {
            throw new Error(
                `Payment Status did not select Completed. Found: ${selectedStatus}`
            );
        }

        console.log("PASS  Completed selected");

        // 5. APPLY FILTER
        console.log("");
        console.log("5. APPLYING FILTER");

        await applyButton.click();
        await page.waitForTimeout(1500);

        console.log(
            "Selected status after Apply:",
            await statusFilter.inputValue()
        );

        if (await statusFilter.inputValue() !== "Completed") {
            throw new Error(
                "Completed filter was not retained after Apply"
            );
        }

        console.log("PASS  Apply Filters executed");

        // 6. VERIFY RESULTS
        console.log("");
        console.log("6. VERIFYING FILTERED RESULTS");

        const rows = page.locator("table tbody tr");
        const rowCount = await rows.count();

        console.log(
            "Rows returned:",
            rowCount
        );

        if (rowCount === 0) {
            throw new Error(
                "Completed filter returned no payment rows"
            );
        }

        for (let i = 0; i < rowCount; i++) {

            const rowText =
                (await rows.nth(i).innerText())
                    .replace(/\s+/g, " ")
                    .trim();

            console.log("");
            console.log(`ROW ${i + 1}:`);
            console.log(rowText);

            if (!rowText.includes("Completed")) {
                throw new Error(
                    `Non-Completed payment returned: ${rowText}`
                );
            }

            if (rowText.includes("Pending")) {
                throw new Error(
                    "Pending payment remains visible"
                );
            }

            if (rowText.includes("Failed")) {
                throw new Error(
                    "Failed payment remains visible"
                );
            }

            if (rowText.includes("Cancelled")) {
                throw new Error(
                    "Cancelled payment remains visible"
                );
            }

            if (rowText.includes("Refunded")) {
                throw new Error(
                    "Refunded payment remains visible"
                );
            }
        }

        console.log("");
        console.log(
            "PASS  All returned rows have Payment Status = Completed"
        );

        // 7. VERIFY SUMMARY
        console.log("");
        console.log("7. VERIFYING PAYMENT SUMMARY");

        const bodyText =
            await page.locator("body").innerText();

        console.log(
            "Completed Payments summary visible:",
            bodyText.includes("Completed Payments")
        );

        if (!bodyText.includes("Completed Payments")) {
            throw new Error(
                "Completed Payments summary is not visible"
            );
        }

        console.log(
            "PASS  Completed Payments summary is visible"
        );

        // 8. RESULT
        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC22 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Payment Status = Completed filter verified");
        console.log("Only Completed payments are displayed");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC22 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);
        console.error("==============================================");

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
