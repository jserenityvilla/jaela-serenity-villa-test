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
        console.log(" ACCT-003C RECORD PAYMENT PANEL TEST");
        console.log("==============================================");

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

        console.log("");
        console.log("CHECKING RECORD PAYMENT ELEMENTS...");

        const button = page.locator("#recordPaymentButton");
        const panel = page.locator("#recordPaymentPanel");
        const form = page.locator("#recordPaymentForm");

        console.log(
            "recordPaymentButton count:",
            await button.count()
        );

        console.log(
            "recordPaymentPanel count:",
            await panel.count()
        );

        console.log(
            "recordPaymentForm count:",
            await form.count()
        );

        if (await button.count() !== 1) {
            throw new Error("recordPaymentButton not found exactly once");
        }

        if (await panel.count() !== 1) {
            throw new Error("recordPaymentPanel not found exactly once");
        }

        if (await form.count() !== 1) {
            throw new Error("recordPaymentForm not found exactly once");
        }

        console.log("");
        console.log("PANEL BEFORE CLICK:");

        console.log(
            await panel.evaluate(el => ({
                hidden: el.hidden,
                display: getComputedStyle(el).display,
                visibility: getComputedStyle(el).visibility,
                className: el.className
            }))
        );

        console.log("");
        console.log("CLICKING #recordPaymentButton...");

        await button.click();

        await page.waitForTimeout(1000);

        console.log("");
        console.log("PANEL AFTER CLICK:");

        console.log(
            await panel.evaluate(el => ({
                hidden: el.hidden,
                display: getComputedStyle(el).display,
                visibility: getComputedStyle(el).visibility,
                className: el.className
            }))
        );

        console.log("");
        console.log("FORM VISIBILITY:");

        console.log(
            await form.evaluate(el => ({
                hidden: el.hidden,
                display: getComputedStyle(el).display,
                visibility: getComputedStyle(el).visibility
            }))
        );

        console.log("");
        console.log("PAYMENT FIELDS:");

        for (const id of [
            "recordBookingId",
            "recordPaymentDate",
            "recordPaymentType",
            "recordAmount",
            "recordCurrency",
            "recordPaymentMethod",
            "recordPaymentStatus",
            "recordTransactionReference",
            "recordDescription",
            "recordNotes"
        ]) {

            const field = page.locator(`#${id}`);

            console.log(
                id,
                "count=",
                await field.count(),
                "visible=",
                await field.count()
                    ? await field.isVisible()
                    : false
            );

        }

        console.log("");
        console.log("VISIBLE FORM TEXT:");

        console.log(
            (await form.innerText()).substring(0, 5000)
        );

        console.log("");
        console.log("==============================================");
        console.log(" RESULT");
        console.log("==============================================");

        if (!(await panel.isVisible())) {
            throw new Error(
                "Record Payment panel is still not visible after clicking #recordPaymentButton"
            );
        }

        if (!(await page.locator("#recordPaymentType").isVisible())) {
            throw new Error(
                "recordPaymentType exists but is not visible"
            );
        }

        console.log("RESULT: RECORD PAYMENT PANEL WORKS");
        console.log("RESULT: PAYMENT FIELDS ARE VISIBLE");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" TEST FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
