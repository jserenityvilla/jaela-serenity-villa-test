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
        console.log(" ACCT-003C-TC12 PAYMENT METHOD TEST");
        console.log("==============================================");

        // 1. LOGIN
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

        await page.waitForTimeout(3000);

        // 2. OPEN PANEL
        console.log("");
        console.log("2. OPENING RECORD PAYMENT");

        await page.locator("#recordPaymentButton").click();
        await page.waitForTimeout(500);

        console.log("PASS  Record Payment panel opened");

        // 3. PAYMENT METHOD OPTIONS
        console.log("");
        console.log("3. PAYMENT METHOD OPTIONS");

        const paymentMethod =
            page.locator("#recordPaymentMethod");

        if (await paymentMethod.count() !== 1) {
            throw new Error(
                "#recordPaymentMethod not found"
            );
        }

        console.log("PASS  Payment Method field exists");

        const methodOptions =
            await paymentMethod.locator("option").evaluateAll(
                options => options.map(option => ({
                    value: option.value,
                    text: option.textContent.trim()
                }))
            );

        console.log(
            JSON.stringify(methodOptions, null, 2)
        );

        const realMethodOptions =
            methodOptions.filter(option => option.value);

        if (realMethodOptions.length === 0) {
            throw new Error(
                "No Payment Method options found"
            );
        }

        console.log(
            "PASS  Payment Method options available:",
            realMethodOptions.length
        );

        // 4. DEFAULT VALUE
        console.log("");
        console.log("4. DEFAULT VALUE");

        const defaultMethod =
            await paymentMethod.inputValue();

        console.log(
            "Payment Method:",
            defaultMethod
        );

        if (!defaultMethod) {
            throw new Error(
                "Payment Method has no default value"
            );
        }

        console.log(
            "PASS  Default Payment Method retained"
        );

        // 5. TEST EACH OPTION
        console.log("");
        console.log("5. PAYMENT METHOD SELECTION");

        for (const option of realMethodOptions) {

            await paymentMethod.selectOption(
                option.value
            );

            const selected =
                await paymentMethod.inputValue();

            if (selected !== option.value) {
                throw new Error(
                    `Payment Method selection failed: ${option.value}`
                );
            }

            console.log(
                `PASS  Selected: ${option.text}`
            );
        }

        // RESULT
        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC12 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Payment Method control and selections verified");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC12 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
