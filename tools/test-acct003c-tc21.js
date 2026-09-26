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
        console.log(" ACCT-003C-TC21 PAYMENT METHOD FILTER TEST");
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

        // 2. VERIFY FILTERS
        console.log("");
        console.log("2. VERIFYING FILTER CONTROLS");

        const methodFilter = page.locator("#paymentMethod");
        const statusFilter = page.locator("#paymentStatus");
        const applyButton = page.locator("#applyButton");
        const clearButton = page.locator("#clearButton");

        if (await methodFilter.count() !== 1) {
            throw new Error("#paymentMethod not found");
        }

        if (await statusFilter.count() !== 1) {
            throw new Error("#paymentStatus not found");
        }

        if (await applyButton.count() !== 1) {
            throw new Error("#applyButton not found");
        }

        if (await clearButton.count() !== 1) {
            throw new Error("#clearButton not found");
        }

        console.log("PASS  Payment Method filter exists");
        console.log("PASS  Payment Status filter exists");
        console.log("PASS  Apply Filters button exists");
        console.log("PASS  Clear button exists");

        // 3. CLEAR ALL FILTERS
        console.log("");
        console.log("3. CLEARING EXISTING FILTERS");

        await clearButton.click();

        await page.waitForTimeout(1500);

        console.log("PASS  Filters cleared");

        // 4. SELECT OTHER
        console.log("");
        console.log("4. SELECTING PAYMENT METHOD = OTHER");

        await methodFilter.selectOption("Other");

        if (await methodFilter.inputValue() !== "Other") {
            throw new Error("Payment Method did not select Other");
        }

        console.log("PASS  Other selected");

        // 5. APPLY FILTER
        console.log("");
        console.log("5. APPLYING FILTER");

        await applyButton.click();

        // Allow async Firestore/rendering to complete
        await page.waitForTimeout(1500);

        // Confirm the selected filter is still active
        const selectedMethod =
            await methodFilter.inputValue();

        console.log(
            "Selected method after Apply:",
            selectedMethod
        );

        if (selectedMethod !== "Other") {
            throw new Error(
                `Expected Other filter, found ${selectedMethod}`
            );
        }

        // 6. VERIFY RESULTS
        console.log("");
        console.log("6. VERIFYING FILTERED RESULTS");

        const rows = page.locator("table tbody tr");

        const rowCount = await rows.count();

        console.log(
            "Rows returned:",
            rowCount
        );

        if (rowCount !== 1) {
            throw new Error(
                `Expected 1 Other payment, found ${rowCount}`
            );
        }

        const rowText =
            (await rows.first().innerText())
                .replace(/\s+/g, " ")
                .trim();

        console.log("Row:");
        console.log(rowText);

        if (!rowText.includes("Other")) {
            throw new Error(
                "Returned payment does not have Payment Method = Other"
            );
        }

        if (rowText.includes("Bank Transfer")) {
            throw new Error(
                "Bank Transfer payment remains visible after Other filter"
            );
        }

        if (rowText.includes("Stripe")) {
            throw new Error(
                "Stripe payment remains visible after Other filter"
            );
        }

        if (rowText.includes("Cash")) {
            throw new Error(
                "Cash payment remains visible after Other filter"
            );
        }

        if (rowText.includes("Credit/Debit Card")) {
            throw new Error(
                "Credit/Debit Card payment remains visible after Other filter"
            );
        }

        console.log(
            "PASS  Only Other payment is displayed"
        );

        // 7. VERIFY TC17 PAYMENT
        console.log("");
        console.log("7. VERIFYING TC17 PAYMENT");

        if (!rowText.includes(TEST_REF)) {
            throw new Error(
                `Expected TC17 payment ${TEST_REF} was not returned`
            );
        }

        console.log(
            "PASS  TC17 Other payment is visible"
        );

        // 8. RESULT
        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC21 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Payment Method = Other filter verified");
        console.log("Only matching Other payment is displayed");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC21 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);
        console.error("==============================================");

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
