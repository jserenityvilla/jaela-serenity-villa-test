const { chromium } = require("playwright");

const CHROME =
    "C:\\Users\\surek\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";

const BASE =
    "https://ja-ela-serenity-villa-test.web.app";

const LOGIN_URL =
    `${BASE}/admin/login.html?return=%2Fadmin%2Faccounts%2Fpayments.html`;

const EMAIL = process.env.TEST_ADMIN_EMAIL;
const PASSWORD = process.env.TEST_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
    throw new Error("TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set");
}

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

    page.on("request", request => {
        if (
            request.url().includes("firestore.googleapis.com") ||
            request.url().includes("googleapis.com")
        ) {
            console.log(
                "REQUEST:",
                request.method(),
                request.url()
            );
        }
    });

    page.on("response", response => {
        if (
            response.url().includes("firestore.googleapis.com") ||
            response.url().includes("googleapis.com")
        ) {
            console.log(
                "RESPONSE:",
                response.status(),
                response.url()
            );
        }
    });

    try {

        console.log("==============================================");
        console.log(" ACCT-003C ACTUAL SAVE PAYMENT TEST");
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

        console.log("PASS  Login successful");
        console.log("PASS  Payments page reached");

        await page.waitForTimeout(3000);

        // ------------------------------------------------
        // 2. Open Record Payment
        // ------------------------------------------------

        console.log("");
        console.log("2. OPEN RECORD PAYMENT");

        const recordButton =
            page.locator("#recordPaymentButton");

        await recordButton.click();

        const panel =
            page.locator("#recordPaymentPanel");

        await panel.waitFor({
            state: "visible",
            timeout: 5000
        });

        console.log("PASS  Record Payment panel opened");

        // ------------------------------------------------
        // 3. Inspect booking selector
        // ------------------------------------------------

        console.log("");
        console.log("3. SELECT TEST BOOKING");

        const booking =
            page.locator("#recordBookingId");

        const bookingCount =
            await booking.locator("option").count();

        console.log(
            "Booking options:",
            bookingCount
        );

        if (bookingCount < 2) {
            throw new Error(
                "No usable booking options found"
            );
        }

        const options =
            await booking.locator("option").evaluateAll(
                elements =>
                    elements.map(option => ({
                        value: option.value,
                        text: option.textContent.trim()
                    }))
            );

        options.slice(0, 10).forEach((option, index) => {
            console.log(
                `${index}: ${option.value} | ${option.text}`
            );
        });

        // Select the first real booking option.
        await booking.locator("option").nth(1).evaluate(
            option => option.value
        ).then(value => booking.selectOption(value));

        console.log(
            "Selected booking:",
            await booking.inputValue()
        );

        // ------------------------------------------------
        // 4. Fill payment
        // ------------------------------------------------

        console.log("");
        console.log("4. FILL PAYMENT");

        await page.locator("#recordPaymentDate").fill(
            new Date().toISOString().slice(0, 10)
        );

        await page.locator("#recordPaymentType")
            .selectOption("deposit");

        await page.locator("#recordAmount")
            .fill("1.00");

        await page.locator("#recordCurrency")
            .selectOption("AUD");

        await page.locator("#recordPaymentMethod")
            .selectOption("bank_transfer");

        await page.locator("#recordPaymentStatus")
            .selectOption("completed");

        await page.locator("#recordTransactionReference")
            .fill("TEST-ACCT003C-001");

        await page.locator("#recordDescription")
            .fill("ACCT-003C automated TEST payment");

        await page.locator("#recordNotes")
            .fill("Automated TEST transaction");

        console.log("PASS  Payment fields populated");

        // ------------------------------------------------
        // 5. Validate form
        // ------------------------------------------------

        console.log("");
        console.log("5. FORM VALIDATION");

        const validity =
            await page.locator("#recordPaymentForm")
                .evaluate(form => ({
                    valid: form.checkValidity()
                }));

        console.log(
            "Form valid:",
            validity.valid
        );

        if (!validity.valid) {
            throw new Error(
                "Payment form validation failed"
            );
        }

        console.log("PASS  Form validation successful");

        // ------------------------------------------------
        // 6. Save
        // ------------------------------------------------

        console.log("");
        console.log("6. SAVE PAYMENT");

        const saveButton =
            page.getByRole("button", {
                name: "Save Payment",
                exact: true
            });

        await saveButton.click();

        console.log("Save Payment clicked");

        await page.waitForTimeout(5000);

        // ------------------------------------------------
        // 7. Inspect result
        // ------------------------------------------------

        console.log("");
        console.log("==============================================");
        console.log(" SAVE RESULT");
        console.log("==============================================");

        console.log(
            "URL:",
            page.url()
        );

        const bodyText =
            await page.locator("body").innerText();

        console.log(
            bodyText.substring(0, 10000)
        );

        // ------------------------------------------------
        // 8. Search for test transaction
        // ------------------------------------------------

        console.log("");
        console.log("7. VERIFY TRANSACTION");

        const transaction =
            page.getByText(
                "TEST-ACCT003C-001",
                { exact: false }
            );

        const transactionCount =
            await transaction.count();

        console.log(
            "Transaction reference matches:",
            transactionCount
        );

        if (transactionCount === 0) {
            throw new Error(
                "TEST-ACCT003C-001 was not found after saving"
            );
        }

        console.log(
            "PASS  Test payment appears in ledger"
        );

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C SAVE PAYMENT RESULT");
        console.log("==============================================");
        console.log("RESULT: PAYMENT SAVED SUCCESSFULLY");
        console.log("RESULT: PAYMENT FOUND IN LEDGER");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C SAVE PAYMENT TEST FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
