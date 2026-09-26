const { chromium } = require("playwright");

const CHROME =
    "C:\\Users\\surek\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";

const BASE =
    "https://ja-ela-serenity-villa-test.web.app";

const LOGIN_URL =
    `${BASE}/admin/login.html?return=%2Fadmin%2Faccounts%2Fpayments.html`;

const PAYMENTS_URL =
    `${BASE}/admin/accounts/payments.html`;

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

    try {

        console.log("==============================================");
        console.log(" ACCT-003C PAYMENTS UI REGRESSION TEST");
        console.log("==============================================");

        // ------------------------------------------------
        // 1. Login
        // ------------------------------------------------

        console.log("");
        console.log("1. Opening admin login...");

        await page.goto(LOGIN_URL, {
            waitUntil: "networkidle",
            timeout: 30000
        });

        console.log("PASS  Login page loaded");

        await page.locator("#adminEmail").fill(EMAIL);
        await page.locator("#adminPassword").fill(PASSWORD);

        console.log("PASS  Credentials entered");

        await page.locator("#adminLoginButton").click();

        await page.waitForURL(
            url => url.pathname.includes("/admin/accounts/payments.html"),
            { timeout: 15000 }
        );

        console.log("PASS  Admin authentication successful");
        console.log("PASS  Redirected to Payments page");

        // ------------------------------------------------
        // 2. Payments page
        // ------------------------------------------------

        await page.waitForTimeout(1000);

        console.log("");
        console.log("2. Payments page");

        console.log("URL:", page.url());

        const title = await page.title();

        console.log("TITLE:", title);

        if (!page.url().includes("/admin/accounts/payments.html")) {
            throw new Error("Payments page URL not reached");
        }

        console.log("PASS  Payments page loaded");

        // ------------------------------------------------
        // 3. Display body text
        // ------------------------------------------------

        const bodyText =
            await page.locator("body").innerText();

        console.log("");
        console.log("PAYMENTS PAGE TEXT:");
        console.log("----------------------------------------------");
        console.log(bodyText.substring(0, 8000));
        console.log("----------------------------------------------");

        // ------------------------------------------------
        // 4. Find Record Payment controls
        // ------------------------------------------------

        console.log("");
        console.log("3. Searching for Record Payment control...");

        const buttons =
            await page.locator("button").allTextContents();

        buttons.forEach((text, index) => {
            console.log(
                `BUTTON ${index + 1}: [${text.trim()}]`
            );
        });

        const recordPaymentButtons =
            page.getByText("Record Payment", {
                exact: true
            });

        console.log(
            "Record Payment matches:",
            await recordPaymentButtons.count()
        );

        if (await recordPaymentButtons.count() === 0) {
            throw new Error(
                "Record Payment button/control not found"
            );
        }

        console.log("PASS  Record Payment control exists");

        // ------------------------------------------------
        // 5. Click Record Payment
        // ------------------------------------------------

        console.log("");
        console.log("4. Opening Record Payment form...");

        await recordPaymentButtons.first().click();

        await page.waitForTimeout(1000);

        console.log("PASS  Record Payment clicked");

        // ------------------------------------------------
        // 6. Inspect form
        // ------------------------------------------------

        const updatedBodyText =
            await page.locator("body").innerText();

        console.log("");
        console.log("PAYMENT FORM TEXT:");
        console.log("----------------------------------------------");
        console.log(updatedBodyText.substring(0, 8000));
        console.log("----------------------------------------------");

        const requiredLabels = [
            "Payment Type",
            "Payment Status",
            "Payment Method"
        ];

        for (const label of requiredLabels) {

            if (!updatedBodyText.includes(label)) {
                throw new Error(
                    `Required payment field not found: ${label}`
                );
            }

            console.log(
                `PASS  ${label} field visible`
            );
        }

        // ------------------------------------------------
        // 7. Amount field
        // ------------------------------------------------

        const amountField = page.locator(
            'input[type="number"], input[name*="amount" i], input[id*="amount" i]'
        ).first();

        if (await amountField.count() === 0) {
            throw new Error(
                "Payment amount field not found"
            );
        }

        console.log("PASS  Payment amount field exists");

        // ------------------------------------------------
        // 8. Reference field
        // ------------------------------------------------

        const referenceField = page.locator(
            'input[name*="reference" i], input[id*="reference" i]'
        ).first();

        if (await referenceField.count() > 0) {
            console.log(
                "PASS  Payment reference field exists"
            );
        } else {
            console.log(
                "INFO  Payment reference field not detected"
            );
        }

        // ------------------------------------------------
        // 9. Payment action
        // ------------------------------------------------

        const allButtons =
            await page.locator("button").allTextContents();

        const hasPaymentSubmit =
            allButtons.some(text =>
                /record payment|save payment|submit/i
                    .test(text.trim())
            );

        if (!hasPaymentSubmit) {
            throw new Error(
                "Payment submit control not found"
            );
        }

        console.log(
            "PASS  Payment submit control exists"
        );

        // ------------------------------------------------
        // SUMMARY
        // ------------------------------------------------

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C UI TEST SUMMARY");
        console.log("==============================================");
        console.log("RESULT: ALL TESTS PASSED");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C UI TEST FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
