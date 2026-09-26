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
        console.log(" ACCT-003C-TC15 PAYMENT DATE TEST");
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

        // 3. PAYMENT DATE FIELD
        console.log("");
        console.log("3. PAYMENT DATE FIELD");

        const dateField =
            page.locator("#recordPaymentDate");

        if (await dateField.count() !== 1) {
            throw new Error("#recordPaymentDate not found");
        }

        const dateInfo =
            await dateField.evaluate(el => ({
                tag: el.tagName,
                type: el.getAttribute("type"),
                required: el.hasAttribute("required"),
                value: el.value,
                min: el.getAttribute("min"),
                max: el.getAttribute("max"),
                visible:
                    !!(
                        el.offsetWidth ||
                        el.offsetHeight ||
                        el.getClientRects().length
                    )
            }));

        console.log(
            JSON.stringify(dateInfo, null, 2)
        );

        if (dateInfo.type !== "date") {
            throw new Error(
                `Expected date input, found type=${dateInfo.type}`
            );
        }

        if (!dateInfo.required) {
            throw new Error(
                "Payment Date is not marked required"
            );
        }

        console.log("PASS  Payment Date exists and is required");

        // 4. DEFAULT DATE
        console.log("");
        console.log("4. DEFAULT DATE");

        const defaultDate =
            await dateField.inputValue();

        console.log(
            "Default Payment Date:",
            defaultDate
        );

        if (!defaultDate) {
            throw new Error(
                "Payment Date has no default value"
            );
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(defaultDate)) {
            throw new Error(
                `Invalid date format: ${defaultDate}`
            );
        }

        console.log("PASS  Default date is valid");

        // 5. EMPTY DATE VALIDATION
        console.log("");
        console.log("5. EMPTY DATE VALIDATION");

        await dateField.fill("");

        const emptyState =
            await dateField.evaluate(el => ({
                valid: el.checkValidity(),
                valueMissing: el.validity.valueMissing
            }));

        console.log(
            JSON.stringify(emptyState, null, 2)
        );

        if (!emptyState.valueMissing) {
            throw new Error(
                "Empty Payment Date was not rejected"
            );
        }

        console.log(
            "PASS  Empty Payment Date rejected"
        );

        // 6. VALID DATE
        console.log("");
        console.log("6. VALID DATE");

        await dateField.fill("2026-09-26");

        const enteredDate =
            await dateField.inputValue();

        console.log(
            "Entered Payment Date:",
            enteredDate
        );

        if (enteredDate !== "2026-09-26") {
            throw new Error(
                "Payment Date was not retained"
            );
        }

        const validState =
            await dateField.evaluate(el => ({
                valid: el.checkValidity(),
                valueMissing: el.validity.valueMissing,
                rangeUnderflow: el.validity.rangeUnderflow,
                rangeOverflow: el.validity.rangeOverflow
            }));

        console.log(
            JSON.stringify(validState, null, 2)
        );

        if (!validState.valid) {
            throw new Error(
                "Valid Payment Date was rejected"
            );
        }

        console.log(
            "PASS  Valid Payment Date accepted"
        );

        // 7. RESULT
        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC15 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Payment Date control and validation verified");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC15 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
