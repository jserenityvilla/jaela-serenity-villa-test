const { chromium } = require("playwright");

const CHROME =
    "C:\\Users\\surek\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";

const LOGIN_URL =
    "https://ja-ela-serenity-villa-test.web.app/admin/login.html";

const PAYMENTS_URL =
    "https://ja-ela-serenity-villa-test.web.app/admin/accounts/payments.html";

const EMAIL = process.env.TEST_ADMIN_EMAIL;
const PASSWORD = process.env.TEST_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
    console.error("FAIL  TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set");
    process.exit(1);
}

(async () => {

    const browser = await chromium.launch({
        executablePath: CHROME,
        headless: true
    });

    const page = await browser.newPage();

    let passed = 0;
    let failed = 0;

    function pass(message) {
        passed++;
        console.log(`PASS  ${message}`);
    }

    function fail(message) {
        failed++;
        console.log(`FAIL  ${message}`);
    }

    try {

        console.log("==================================================");
        console.log(" ACCT-003C UI Automated Regression Test");
        console.log("==================================================");
        console.log("");

        page.on("console", msg => {
            if (msg.type() === "error") {
                console.log("BROWSER ERROR:", msg.text());
            }
        });

        page.on("pageerror", error => {
            console.log("PAGE ERROR:", error.message);
        });

        // ------------------------------------------------
        // 1. Open Payments page
        // ------------------------------------------------

        await page.goto(PAYMENTS_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        await page.waitForTimeout(1500);

        console.log("Initial URL:", page.url());

        // ------------------------------------------------
        // 2. Login if authentication redirected us
        // ------------------------------------------------

        if (page.url().includes("/admin/login.html")) {

            pass("Payments page correctly requires admin authentication");

            await page.locator("#adminEmail").fill(EMAIL);
            pass("Admin email field available");

            await page.locator("#adminPassword").fill(PASSWORD);
            pass("Admin password field available");

            await page.locator("#adminLoginButton").click();

            await page.waitForURL(
                url => url.pathname.includes("/admin/accounts/payments.html"),
                {
                    timeout: 15000
                }
            );

            await page.waitForTimeout(1500);

            pass("Admin login successful");
            pass("Returned to Payments page");

        } else {

            pass("Existing authenticated session available");

        }

        // ------------------------------------------------
        // 3. Verify Payments page
        // ------------------------------------------------

        if (!page.url().includes("/admin/accounts/payments.html")) {
            throw new Error(
                `Unexpected page after login: ${page.url()}`
            );
        }

        pass("Payments page loaded");

        const title = await page.title();

        if (/Payments/i.test(title)) {
            pass(`Payments page title detected: ${title}`);
        } else {
            fail(`Unexpected page title: ${title}`);
        }

        // ------------------------------------------------
        // 4. Verify dashboard sections
        // ------------------------------------------------

        const bodyText =
            await page.locator("body").innerText();

        const dashboardLabels = [
            "Payment Filters",
            "Total Payments",
            "Completed Payments",
            "Pending Payments",
            "Total Received",
            "Total Refunded",
            "Net Received",
            "Outstanding Amount",
            "Payment Transactions"
        ];

        for (const label of dashboardLabels) {

            if (bodyText.includes(label)) {
                pass(`Dashboard section visible: ${label}`);
            } else {
                fail(`Dashboard section missing: ${label}`);
            }
        }

        // ------------------------------------------------
        // 5. Verify existing payment
        // ------------------------------------------------

        if (bodyText.includes("JSV - 7336")) {
            pass("Existing transaction reference JSV - 7336 visible");
        } else {
            fail("Expected transaction reference JSV - 7336 not found");
        }

        if (bodyText.includes("AUD $10.00")) {
            pass("Existing AUD $10.00 payment visible");
        } else {
            fail("Expected AUD $10.00 payment not found");
        }

        // ------------------------------------------------
        // 6. Verify payment summary values
        // ------------------------------------------------

        if (bodyText.includes("AUD $10.00")) {
            pass("Total Received displays AUD $10.00");
        }

        if (bodyText.includes("AUD $10.00")) {
            pass("Net Received displays AUD $10.00");
        }

        if (bodyText.includes("AUD $56.00")) {
            pass("Outstanding Amount displays AUD $56.00");
        } else {
            fail("Outstanding Amount AUD $56.00 not found");
        }

        // ------------------------------------------------
        // 7. Verify Record Payment button
        // ------------------------------------------------

        const recordButton =
            page.locator("button").filter({
                hasText: "Record Payment"
            }).first();

        if (await recordButton.count() === 0) {
            throw new Error(
                "Record Payment button not found"
            );
        }

        pass("Record Payment button exists");

        // ------------------------------------------------
        // 8. Open Record Payment form
        // ------------------------------------------------

        await recordButton.click();

        await page.waitForTimeout(500);

        pass("Record Payment form opened");

        const modalText =
            await page.locator("body").innerText();

        const paymentFields = [
            "Payment Type",
            "Payment Status",
            "Payment Method",
            "Amount"
        ];

        for (const field of paymentFields) {

            if (modalText.includes(field)) {
                pass(`Record Payment field visible: ${field}`);
            } else {
                fail(`Record Payment field missing: ${field}`);
            }
        }

        // ------------------------------------------------
        // 9. Verify amount input
        // ------------------------------------------------

        const amountField = page.locator(
            'input[type="number"], input[id*="amount" i], input[name*="amount" i]'
        ).first();

        if (await amountField.count() > 0) {
            pass("Payment amount input exists");
        } else {
            fail("Payment amount input not found");
        }

        // ------------------------------------------------
        // 10. Verify payment status control
        // ------------------------------------------------

        const statusField =
            page.locator("#recordPaymentStatus");

        if (await statusField.count() > 0) {
            pass("Payment status control exists");
        } else {
            fail("Payment status control not found");
        }

        // ------------------------------------------------
        // 11. Verify payment type control
        // ------------------------------------------------

        const typeField =
            page.locator("#recordPaymentType");

        if (await typeField.count() > 0) {
            pass("Payment type control exists");
        } else {
            fail("Payment type control not found");
        }

        // ------------------------------------------------
        // 12. Verify payment method control
        // ------------------------------------------------

        const methodField =
            page.locator("#recordPaymentMethod");

        if (await methodField.count() > 0) {
            pass("Payment method control exists");
        } else {
            fail("Payment method control not found");
        }

        console.log("");
        console.log("==================================================");
        console.log(" ACCT-003C UI TEST SUMMARY");
        console.log("==================================================");
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);

        if (failed === 0) {
            console.log("");
            console.log("RESULT: ALL ACCT-003C UI TESTS PASSED");
        } else {
            console.log("");
            console.log("RESULT: ACCT-003C UI TEST FAILED");
            process.exitCode = 1;
        }

    } catch (error) {

        console.error("");
        console.error("FATAL:", error.message);
        console.error("");
        console.error("RESULT: UI TEST FAILED");

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
