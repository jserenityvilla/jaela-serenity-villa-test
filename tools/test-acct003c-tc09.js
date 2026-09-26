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
        console.log(" ACCT-003C-TC09 BOOKING AVAILABILITY TEST");
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

        // ------------------------------------------------
        // 2. Wait for page initialization
        // ------------------------------------------------

        await page.waitForTimeout(3000);

        console.log("");
        console.log("2. OPENING RECORD PAYMENT");

        await page.locator("#recordPaymentButton").click();

        await page.waitForTimeout(1000);

        console.log("PASS  Record Payment panel opened");

        // ------------------------------------------------
        // 3. Inspect booking dropdown
        // ------------------------------------------------

        console.log("");
        console.log("3. BOOKING OPTIONS");

        const bookingSelect =
            page.locator("#recordBookingId");

        const options =
            await bookingSelect.locator("option").evaluateAll(
                options => options.map(option => ({
                    value: option.value,
                    text: option.textContent.trim()
                }))
            );

        console.log(
            JSON.stringify(options, null, 2)
        );

        const realBookings =
            options.filter(option => option.value);

        console.log("");
        console.log("Total options:", options.length);
        console.log("Actual bookings:", realBookings.length);

        // ------------------------------------------------
        // 4. Result
        // ------------------------------------------------

        if (realBookings.length === 0) {

            console.log("");
            console.log("==============================================");
            console.log(" ACCT-003C-TC09 RESULT");
            console.log("==============================================");
            console.log("RESULT: BLOCKED");
            console.log("Reason: No booking records are available");
            console.log("==============================================");

        } else {

            console.log("");
            console.log("PASS  Booking records are available");

            console.log("");
            console.log("FIRST BOOKING:");
            console.log(
                JSON.stringify(realBookings[0], null, 2)
            );

            // Select first booking
            await bookingSelect.selectOption(
                realBookings[0].value
            );

            await page.waitForTimeout(500);

            console.log("");
            console.log(
                "Selected booking:",
                await bookingSelect.inputValue()
            );

            console.log("");
            console.log("==============================================");
            console.log(" ACCT-003C-TC09 RESULT");
            console.log("==============================================");
            console.log("RESULT: PASS");
            console.log("==============================================");
        }

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC09 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
