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
        console.log(" ACCT-003C-TC08 PAYMENT FORM FIELD TEST");
        console.log("==============================================");

        // ------------------------------------------------
        // 1. Login
        // ------------------------------------------------

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

        console.log("PASS  Authentication successful");

        await page.waitForTimeout(2000);

        // ------------------------------------------------
        // 2. Open Record Payment
        // ------------------------------------------------

        console.log("");
        console.log("2. RECORD PAYMENT PANEL");

        await page.locator("#recordPaymentButton").click();
        await page.waitForTimeout(500);

        const panel = page.locator("#recordPaymentPanel");

        if (await panel.getAttribute("hidden") !== null) {
            throw new Error("Record Payment panel did not open");
        }

        console.log("PASS  Record Payment panel opened");

        // ------------------------------------------------
        // 3. Payment Type options
        // ------------------------------------------------

        console.log("");
        console.log("3. PAYMENT TYPE OPTIONS");

        const paymentTypes =
            await page.locator("#recordPaymentType option").evaluateAll(
                options => options.map(o => ({
                    value: o.value,
                    text: o.textContent.trim()
                }))
            );

        console.log(JSON.stringify(paymentTypes, null, 2));

        if (paymentTypes.length < 2) {
            throw new Error("Payment Type does not contain selectable options");
        }

        console.log("PASS  Payment Type options available");

        // ------------------------------------------------
        // 4. Payment Method options
        // ------------------------------------------------

        console.log("");
        console.log("4. PAYMENT METHOD OPTIONS");

        const paymentMethods =
            await page.locator("#recordPaymentMethod option").evaluateAll(
                options => options.map(o => ({
                    value: o.value,
                    text: o.textContent.trim()
                }))
            );

        console.log(JSON.stringify(paymentMethods, null, 2));

        if (paymentMethods.length < 2) {
            throw new Error("Payment Method does not contain selectable options");
        }

        console.log("PASS  Payment Method options available");

        // ------------------------------------------------
        // 5. Payment Status options
        // ------------------------------------------------

        console.log("");
        console.log("5. PAYMENT STATUS OPTIONS");

        const paymentStatuses =
            await page.locator("#recordPaymentStatus option").evaluateAll(
                options => options.map(o => ({
                    value: o.value,
                    text: o.textContent.trim()
                }))
            );

        console.log(JSON.stringify(paymentStatuses, null, 2));

        if (paymentStatuses.length < 2) {
            throw new Error("Payment Status does not contain selectable options");
        }

        console.log("PASS  Payment Status options available");

        // ------------------------------------------------
        // 6. Amount field
        // ------------------------------------------------

        console.log("");
        console.log("6. AMOUNT FIELD");

        const amount = page.locator("#recordAmount");

        await amount.fill("100");

        const amountValue = await amount.inputValue();

        console.log("Amount entered:", amountValue);

        if (amountValue !== "100") {
            throw new Error("Amount field did not retain entered value");
        }

        console.log("PASS  Amount accepts numeric value");

        // ------------------------------------------------
        // 7. Transaction Reference
        // ------------------------------------------------

        console.log("");
        console.log("7. TRANSACTION REFERENCE");

        const reference =
            page.locator("#recordTransactionReference");

        await reference.fill("TEST-TC08-001");

        if (
            await reference.inputValue() !==
            "TEST-TC08-001"
        ) {
            throw new Error(
                "Transaction Reference did not retain value"
            );
        }

        console.log("PASS  Transaction Reference accepts text");

        // ------------------------------------------------
        // 8. Description
        // ------------------------------------------------

        console.log("");
        console.log("8. DESCRIPTION");

        const description =
            page.locator("#recordDescription");

        await description.fill("TC08 payment field test");

        if (
            await description.inputValue() !==
            "TC08 payment field test"
        ) {
            throw new Error(
                "Description did not retain value"
            );
        }

        console.log("PASS  Description accepts text");

        // ------------------------------------------------
        // 9. Notes
        // ------------------------------------------------

        console.log("");
        console.log("9. NOTES");

        const notes =
            page.locator("#recordNotes");

        await notes.fill("Test note for ACCT-003C-TC08");

        if (
            await notes.inputValue() !==
            "Test note for ACCT-003C-TC08"
        ) {
            throw new Error(
                "Notes did not retain value"
            );
        }

        console.log("PASS  Notes accepts text");

        // ------------------------------------------------
        // 10. Summary
        // ------------------------------------------------

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC08 SUMMARY");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC08 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
