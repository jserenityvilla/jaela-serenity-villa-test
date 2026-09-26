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

    page.on("response", response => {

        const url = response.url();

        if (
            response.status() >= 400 ||
            url.includes("firestore.googleapis.com")
        ) {
            console.log(
                "HTTP:",
                response.status(),
                response.request().method(),
                url
            );
        }

    });

    try {

        console.log("==============================================");
        console.log(" ACCT-003C PAYMENT SAVE / PERSISTENCE TEST");
        console.log("==============================================");

        // ------------------------------------------------
        // 1. Login
        // ------------------------------------------------

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

        await page.waitForTimeout(3000);

        // ------------------------------------------------
        // 2. Open Record Payment
        // ------------------------------------------------

        console.log("");
        console.log("2. Open Record Payment");

        const recordButton =
            page.locator("#recordPaymentButton");

        if (await recordButton.count() !== 1) {
            throw new Error("#recordPaymentButton not found");
        }

        await recordButton.click();

        const panel =
            page.locator("#recordPaymentPanel");

        await page.waitForTimeout(500);

        if (await panel.getAttribute("hidden") !== null) {
            throw new Error("Record Payment panel did not open");
        }

        console.log("PASS  Record Payment panel opened");

        // ------------------------------------------------
        // 3. Populate test payment
        // ------------------------------------------------

        console.log("");
        console.log("3. Populate test payment");

        const testReference =
            "ACCT003C-TEST-" + Date.now();

        const testDescription =
            "ACCT-003C automated DEV payment test";

        await page.locator("#recordPaymentType")
            .selectOption({ label: "Deposit" });

        await page.locator("#recordPaymentStatus")
            .selectOption({ label: "Completed" });

        await page.locator("#recordCurrency")
            .selectOption({ label: "AUD" });

        await page.locator("#recordAmount")
            .fill("1.00");

        await page.locator("#recordPaymentMethod")
            .selectOption({ label: "Other" })
            .catch(async () => {
                console.log(
                    "INFO  'Other' payment method not available; inspecting options"
                );

                console.log(
                    await page.locator("#recordPaymentMethod option")
                        .allTextContents()
                );
            });

        const transactionReference =
            page.locator("#recordTransactionReference");

        if (await transactionReference.count()) {
            await transactionReference.fill(testReference);
        }

        const description =
            page.locator("#recordDescription");

        if (await description.count()) {
            await description.fill(testDescription);
        }

        const notes =
            page.locator("#recordNotes");

        if (await notes.count()) {
            await notes.fill(
                "Automated ACCT-003C DEV verification"
            );
        }

        console.log("Test reference:", testReference);
        console.log("Amount: AUD 1.00");

        // ------------------------------------------------
        // 4. Validate form
        // ------------------------------------------------

        console.log("");
        console.log("4. Validate payment form");

        const form =
            page.locator("#recordPaymentForm");

        const validity =
            await form.evaluate(form => ({
                valid: form.checkValidity(),
                fields: Array.from(form.elements)
                    .filter(el => el.name || el.id)
                    .map(el => ({
                        id: el.id,
                        name: el.name,
                        value: el.value,
                        required: el.required,
                        valid: el.checkValidity()
                    }))
            }));

        console.log(
            JSON.stringify(validity, null, 2)
        );

        if (!validity.valid) {
            throw new Error(
                "Payment form is invalid"
            );
        }

        console.log("PASS  Payment form valid");

        // ------------------------------------------------
        // 5. Save
        // ------------------------------------------------

        console.log("");
        console.log("5. Save Payment");

        const saveButton =
            page.locator("#savePaymentButton");

        if (await saveButton.count() !== 1) {
            throw new Error("#savePaymentButton not found");
        }

        await saveButton.click();

        console.log("Save Payment clicked");

        // Give Firebase time to complete.
        await page.waitForTimeout(5000);

        // ------------------------------------------------
        // 6. Check page state
        // ------------------------------------------------

        console.log("");
        console.log("6. Check save result");

        const panelHidden =
            await panel.getAttribute("hidden");

        console.log(
            "Panel hidden:",
            panelHidden !== null
        );

        const bodyText =
            await page.locator("body").innerText();

        console.log("");
        console.log("PAGE TEXT AFTER SAVE:");
        console.log("----------------------------------------------");
        console.log(bodyText.substring(0, 10000));
        console.log("----------------------------------------------");

        // ------------------------------------------------
        // 7. Search transaction table
        // ------------------------------------------------

        console.log("");
        console.log("7. Verify transaction ledger");

        const tableBody =
            page.locator("#paymentsBody");

        if (await tableBody.count() !== 1) {
            throw new Error("#paymentsBody not found");
        }

        await page.waitForTimeout(3000);

        const rows =
            await tableBody.locator("tr").allTextContents();

        console.log(
            "Ledger rows:",
            rows.length
        );

        rows.forEach((row, index) => {
            console.log(
                `ROW ${index + 1}:`,
                row.trim()
            );
        });

        const ledgerText =
            await tableBody.innerText();

        if (!ledgerText.includes(testReference)) {

            console.log("");
            console.log(
                "WARNING: Test reference was not found in the ledger."
            );

            console.log(
                "This may mean the save failed, the ledger has not refreshed, or the reference is displayed differently."
            );

            throw new Error(
                "Saved payment could not be verified in payment ledger"
            );
        }

        console.log(
            "PASS  Test payment found in ledger"
        );

        // ------------------------------------------------
        // 8. Final summary
        // ------------------------------------------------

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C SAVE TEST SUMMARY");
        console.log("==============================================");
        console.log("RESULT: ALL TESTS PASSED");
        console.log("Reference:", testReference);
        console.log("Amount: AUD 1.00");
        console.log("Status: Completed");
        console.log("Type: Deposit");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C SAVE TEST FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
