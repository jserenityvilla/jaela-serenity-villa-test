const { chromium } = require("playwright");

const CHROME =
    "C:\\Users\\surek\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";

const BASE =
    "https://ja-ela-serenity-villa-test.web.app";

const LOGIN_URL =
    `${BASE}/admin/login.html?return=%2Fadmin%2Faccounts%2Fpayments.html`;

const EMAIL = process.env.TEST_ADMIN_EMAIL;
const PASSWORD = process.env.TEST_ADMIN_PASSWORD;

const TEST_REF = "TC17-TEST-1790422966749";

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
        console.log(" ACCT-003C-TC23 PAYMENT TYPE FILTER TEST");
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

        const options = await typeFilter.locator("option").allTextContents();

        console.log(
            "Payment Type:",
            options.join(" | ")
        );

        console.log("PASS  Payment Type filter exists");
        console.log("PASS  Apply Filters button exists");
        console.log("PASS  Clear button exists");

        // 3. CLEAR FILTERS
        console.log("");
        console.log("3. CLEARING EXISTING FILTERS");

        await clearButton.click();
        await page.waitForTimeout(1500);

        console.log("PASS  Filters cleared");

        // 4. SELECT DEPOSIT
        console.log("");
        console.log("4. SELECTING PAYMENT TYPE = DEPOSIT");

        await typeFilter.selectOption("Deposit");

        const selectedType =
            await typeFilter.inputValue();

        console.log(
            "Selected type:",
            selectedType
        );

        if (selectedType !== "Deposit") {
            throw new Error(
                `Payment Type did not select Deposit. Found: ${selectedType}`
            );
        }

        console.log("PASS  Deposit selected");

        // 5. APPLY FILTER
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

        if (selectedAfterApply !== "Deposit") {
            throw new Error(
                "Deposit filter was not retained after Apply"
            );
        }

        console.log("PASS  Apply Filters executed");

        // 6. VERIFY RESULTS
        console.log("");
        console.log("6. VERIFYING FILTERED RESULTS");

        const rows =
            page.locator("table tbody tr");

        const rowCount =
            await rows.count();

        console.log(
            "Rows returned:",
            rowCount
        );

        if (rowCount === 0) {
            throw new Error(
                "Deposit filter returned no payment rows"
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

            if (!rowText.includes("Deposit")) {
                throw new Error(
                    `Non-Deposit payment returned: ${rowText}`
                );
            }

            if (rowText.includes("Balance")) {
                throw new Error(
                    "Balance payment remains visible after Deposit filter"
                );
            }

            if (rowText.includes("Full Payment")) {
                throw new Error(
                    "Full Payment remains visible after Deposit filter"
                );
            }

            if (rowText.includes("Refund")) {
                throw new Error(
                    "Refund payment remains visible after Deposit filter"
                );
            }
        }

        console.log("");
        console.log(
            "PASS  All returned rows have Payment Type = Deposit"
        );

        // 7. VERIFY TC17 PAYMENT
        console.log("");
        console.log("7. VERIFYING TC17 PAYMENT");

        const testRow =
            page.locator("table tbody tr").filter({
                hasText: TEST_REF
            });

        if (await testRow.count() !== 1) {
            throw new Error(
                `Expected TC17 Deposit payment ${TEST_REF} was not returned`
            );
        }

        console.log(
            "PASS  TC17 Deposit payment is visible"
        );

        // 8. RESULT
        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC23 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Payment Type = Deposit filter verified");
        console.log("Only Deposit payments are displayed");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC23 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);
        console.error("==============================================");

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
