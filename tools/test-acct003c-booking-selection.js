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
        console.log(" ACCT-003C BOOKING SELECTION TEST");
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

        console.log("PASS  Authentication successful");

        await page.waitForTimeout(2000);

        await page.locator("#recordPaymentButton").click();

        await page.waitForTimeout(500);

        console.log("");
        console.log("BOOKING SELECT:");

        const bookingSelect =
            page.locator("#recordBookingId");

        const options = await bookingSelect.locator("option").evaluateAll(
            options => options.map(option => ({
                value: option.value,
                text: option.textContent.trim()
            }))
        );

        console.log(JSON.stringify(options, null, 2));

        console.log("");
        console.log("Booking count:", options.length);

        console.log("");
        console.log("OTHER DEFAULT VALUES:");

        console.log(
            "Payment Date:",
            await page.locator("#recordPaymentDate").inputValue()
        );

        console.log(
            "Payment Type:",
            await page.locator("#recordPaymentType").inputValue()
        );

        console.log(
            "Amount:",
            await page.locator("#recordAmount").inputValue()
        );

        console.log(
            "Currency:",
            await page.locator("#recordCurrency").inputValue()
        );

        console.log(
            "Payment Method:",
            await page.locator("#recordPaymentMethod").inputValue()
        );

        console.log(
            "Payment Status:",
            await page.locator("#recordPaymentStatus").inputValue()
        );

        console.log("");
        console.log("==============================================");

    } catch (error) {

        console.error("FAIL:", error.message);
        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
