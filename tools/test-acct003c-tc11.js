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
        console.log(" ACCT-003C-TC11 PAYMENT TYPE / STATUS TEST");
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

        // 3. PAYMENT TYPE OPTIONS
        console.log("");
        console.log("3. PAYMENT TYPE OPTIONS");

        const paymentType =
            page.locator("#recordPaymentType");

        const typeOptions =
            await paymentType.locator("option").evaluateAll(
                options => options.map(option => ({
                    value: option.value,
                    text: option.textContent.trim()
                }))
            );

        console.log(
            JSON.stringify(typeOptions, null, 2)
        );

        const realTypeOptions =
            typeOptions.filter(option => option.value);

        if (realTypeOptions.length === 0) {
            throw new Error("No Payment Type options found");
        }

        console.log(
            "PASS  Payment Type options available:",
            realTypeOptions.length
        );

        // 4. PAYMENT STATUS OPTIONS
        console.log("");
        console.log("4. PAYMENT STATUS OPTIONS");

        const paymentStatus =
            page.locator("#recordPaymentStatus");

        const statusOptions =
            await paymentStatus.locator("option").evaluateAll(
                options => options.map(option => ({
                    value: option.value,
                    text: option.textContent.trim()
                }))
            );

        console.log(
            JSON.stringify(statusOptions, null, 2)
        );

        const realStatusOptions =
            statusOptions.filter(option => option.value);

        if (realStatusOptions.length === 0) {
            throw new Error("No Payment Status options found");
        }

        console.log(
            "PASS  Payment Status options available:",
            realStatusOptions.length
        );

        // 5. DEFAULT VALUES
        console.log("");
        console.log("5. DEFAULT VALUES");

        console.log(
            "Payment Type:",
            await paymentType.inputValue()
        );

        console.log(
            "Payment Status:",
            await paymentStatus.inputValue()
        );

        // 6. TEST PAYMENT TYPE SELECTION
        console.log("");
        console.log("6. PAYMENT TYPE SELECTION");

        const firstType =
            realTypeOptions[0].value;

        await paymentType.selectOption(firstType);

        if (await paymentType.inputValue() !== firstType) {
            throw new Error(
                "Payment Type selection was not retained"
            );
        }

        console.log(
            "PASS  Payment Type selection retained:",
            await paymentType.inputValue()
        );

        // 7. TEST PAYMENT STATUS SELECTION
        console.log("");
        console.log("7. PAYMENT STATUS SELECTION");

        const firstStatus =
            realStatusOptions[0].value;

        await paymentStatus.selectOption(firstStatus);

        if (await paymentStatus.inputValue() !== firstStatus) {
            throw new Error(
                "Payment Status selection was not retained"
            );
        }

        console.log(
            "PASS  Payment Status selection retained:",
            await paymentStatus.inputValue()
        );

        // RESULT
        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC11 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Payment Type and Payment Status controls verified");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC11 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
