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
        console.log(" ACCT-003C PAYMENTS MODAL TEST");
        console.log("==============================================");

        // 1. Login
        console.log("");
        console.log("1. Login");

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
        console.log("PASS  Payments page reached");

        // Do NOT use networkidle because Firebase can keep
        // network activity alive.
        await page.waitForTimeout(3000);

        // 2. Verify exact Record Payment button
        console.log("");
        console.log("2. Record Payment button");

        const recordButton =
            page.locator("#recordPaymentButton");

        if (await recordButton.count() !== 1) {
            throw new Error(
                `Expected exactly 1 #recordPaymentButton, found ${await recordButton.count()}`
            );
        }

        console.log("PASS  #recordPaymentButton exists");

        // 3. Verify panel before click
        const panel =
            page.locator("#recordPaymentPanel");

        if (await panel.count() !== 1) {
            throw new Error(
                "recordPaymentPanel not found"
            );
        }

        console.log(
            "Panel hidden before click:",
            await panel.getAttribute("hidden") !== null
        );

        // 4. Click exact button
        console.log("");
        console.log("3. Opening Record Payment panel...");

        await recordButton.click();

        await page.waitForTimeout(500);

        // 5. Verify panel opened
        const panelHidden =
            await panel.getAttribute("hidden");

        console.log(
            "Panel hidden after click:",
            panelHidden !== null
        );

        if (panelHidden !== null) {
            throw new Error(
                "Record Payment panel did not open"
            );
        }

        console.log("PASS  Record Payment panel opened");

        // 6. Verify fields using exact IDs
        console.log("");
        console.log("4. Payment fields");

        const fields = [
            ["recordBookingId", "Booking"],
            ["recordPaymentDate", "Payment Date"],
            ["recordPaymentType", "Payment Type"],
            ["recordAmount", "Amount"],
            ["recordCurrency", "Currency"],
            ["recordPaymentMethod", "Payment Method"],
            ["recordPaymentStatus", "Payment Status"],
            ["recordTransactionReference", "Transaction Reference"],
            ["recordDescription", "Description"],
            ["recordNotes", "Notes"]
        ];

        for (const [id, name] of fields) {

            const locator = page.locator(`#${id}`);

            if (await locator.count() !== 1) {
                throw new Error(
                    `${name} field #${id} not found`
                );
            }

            console.log(`PASS  ${name}`);
        }

        // 7. Verify Save Payment
        console.log("");
        console.log("5. Save Payment");

        const saveButton =
            page.locator("#savePaymentButton");

        if (await saveButton.count() !== 1) {
            throw new Error(
                "#savePaymentButton not found"
            );
        }

        console.log("PASS  Save Payment button");

        // 8. Verify default values
        console.log("");
        console.log("6. Default values");

        console.log(
            "Payment Type:",
            await page.locator("#recordPaymentType").inputValue()
        );

        console.log(
            "Payment Status:",
            await page.locator("#recordPaymentStatus").inputValue()
        );

        console.log(
            "Currency:",
            await page.locator("#recordCurrency").inputValue()
        );

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C MODAL TEST SUMMARY");
        console.log("==============================================");
        console.log("RESULT: ALL TESTS PASSED");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C MODAL TEST FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
