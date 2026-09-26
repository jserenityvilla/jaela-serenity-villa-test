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
        console.log(" ACCT-003C BOOKING DATA AVAILABILITY TEST");
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

        await page.waitForTimeout(3000);

        await page.locator("#recordPaymentButton").click();

        await page.waitForTimeout(1000);

        const bookingSelect =
            page.locator("#recordBookingId");

        const options =
            await bookingSelect.locator("option").evaluateAll(
                options => options.map(option => ({
                    value: option.value,
                    text: option.textContent.trim()
                }))
            );

        console.log("");
        console.log("BOOKING OPTIONS:");
        console.log("----------------------------------------------");

        options.forEach((option, index) => {
            console.log(
                `${index + 1}. value=[${option.value}] text=[${option.text}]`
            );
        });

        console.log("----------------------------------------------");

        const bookingCount =
            options.filter(option => option.value !== "").length;

        console.log("");
        console.log("AVAILABLE BOOKINGS:", bookingCount);

        if (bookingCount === 0) {

            console.log("");
            console.log("RESULT: NO BOOKINGS AVAILABLE");
            console.log(
                "The Payment UI is working, but there are no selectable bookings in TEST."
            );

        } else {

            console.log("");
            console.log("RESULT: BOOKINGS AVAILABLE");

            for (const option of options.filter(
                option => option.value !== ""
            )) {

                console.log(
                    `BOOKING: ${option.text} | ID: ${option.value}`
                );

            }

        }

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C BOOKING DATA TEST SUMMARY");
        console.log("==============================================");

        if (bookingCount === 0) {
            console.log("STATUS: BLOCKED - NO TEST BOOKINGS");
        } else {
            console.log("STATUS: PASSED");
        }

        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("FAIL:", error.message);
        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
