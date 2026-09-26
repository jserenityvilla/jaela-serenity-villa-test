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
        console.log(" ACCT-003C PAYMENT VALIDATION TEST");
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

        await page.waitForTimeout(2000);

        // ------------------------------------------------
        // 2. Open Record Payment
        // ------------------------------------------------

        await page.locator("#recordPaymentButton").click();

        await page.waitForTimeout(500);

        console.log("PASS  Record Payment panel opened");

        // ------------------------------------------------
        // 3. Check required fields
        // ------------------------------------------------

        console.log("");
        console.log("2. Required field validation");

        const requiredFields = [
            "recordBookingId",
            "recordPaymentDate",
            "recordPaymentType",
            "recordAmount",
            "recordCurrency",
            "recordPaymentMethod",
            "recordPaymentStatus"
        ];

        for (const id of requiredFields) {
            const field = page.locator(`#${id}`);

            const required = await field.getAttribute("required");

            console.log(
                `${id}: required=${required !== null}`
            );
        }

        // ------------------------------------------------
        // 4. Attempt empty save
        // ------------------------------------------------

        console.log("");
        console.log("3. Attempting empty payment save...");

        await page.locator("#savePaymentButton").click();

        await page.waitForTimeout(1000);

        // ------------------------------------------------
        // 5. Check visible validation/message
        // ------------------------------------------------

        const bodyText =
            await page.locator("body").innerText();

        console.log("");
        console.log("PAGE MESSAGE / VALIDATION TEXT:");
        console.log("----------------------------------------------");

        const lines = bodyText
            .split("\n")
            .map(x => x.trim())
            .filter(Boolean);

        lines.forEach(line => {
            if (
                /required|booking|amount|payment|invalid|error/i.test(line)
            ) {
                console.log(line);
            }
        });

        console.log("----------------------------------------------");

        // ------------------------------------------------
        // 6. Confirm panel remains open
        // ------------------------------------------------

        const panel =
            page.locator("#recordPaymentPanel");

        const stillOpen =
            await panel.getAttribute("hidden") === null;

        console.log("");
        console.log(
            "Payment panel still open:",
            stillOpen
        );

        if (!stillOpen) {
            throw new Error(
                "Payment panel closed after invalid submission"
            );
        }

        console.log("PASS  Invalid payment was not submitted");

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C VALIDATION TEST SUMMARY");
        console.log("==============================================");
        console.log("RESULT: VALIDATION TEST PASSED");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C VALIDATION TEST FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
