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
        console.log(" ACCT-003C-TC13 AMOUNT / CURRENCY TEST");
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

        // 2. OPEN PAYMENT PANEL
        console.log("");
        console.log("2. OPENING RECORD PAYMENT");

        await page.locator("#recordPaymentButton").click();
        await page.waitForTimeout(500);

        console.log("PASS  Record Payment panel opened");

        // 3. AMOUNT FIELD
        console.log("");
        console.log("3. AMOUNT FIELD");

        const amount =
            page.locator("#recordAmount");

        if (await amount.count() !== 1) {
            throw new Error("#recordAmount not found");
        }

        const amountInfo =
            await amount.evaluate(el => ({
                tag: el.tagName,
                type: el.getAttribute("type"),
                required: el.hasAttribute("required"),
                min: el.getAttribute("min"),
                max: el.getAttribute("max"),
                step: el.getAttribute("step"),
                value: el.value
            }));

        console.log(
            JSON.stringify(amountInfo, null, 2)
        );

        if (!amountInfo.required) {
            throw new Error("Amount field is not required");
        }

        console.log("PASS  Amount field exists and is required");

        // 4. CURRENCY
        console.log("");
        console.log("4. CURRENCY");

        const currency =
            page.locator("#recordCurrency");

        if (await currency.count() !== 1) {
            throw new Error("#recordCurrency not found");
        }

        const currencyValue =
            await currency.inputValue();

        console.log(
            "Currency:",
            currencyValue
        );

        if (currencyValue !== "AUD") {
            throw new Error(
                `Expected currency AUD, found ${currencyValue}`
            );
        }

        console.log("PASS  Currency defaults to AUD");

        // 5. EMPTY AMOUNT VALIDATION
        console.log("");
        console.log("5. EMPTY AMOUNT VALIDATION");

        await amount.fill("");

        const emptyValidity =
            await amount.evaluate(el => ({
                valid: el.checkValidity(),
                valueMissing: el.validity.valueMissing,
                badInput: el.validity.badInput
            }));

        console.log(
            JSON.stringify(emptyValidity, null, 2)
        );

        if (!emptyValidity.valueMissing) {
            throw new Error(
                "Empty amount was not detected as required"
            );
        }

        console.log("PASS  Empty amount rejected by validation");

        // 6. VALID AMOUNT
        console.log("");
        console.log("6. VALID AMOUNT");

        await amount.fill("100");

        const validAmount =
            await amount.inputValue();

        console.log(
            "Entered amount:",
            validAmount
        );

        if (validAmount !== "100") {
            throw new Error(
                "Valid amount was not retained"
            );
        }

        const validAmountState =
            await amount.evaluate(el => ({
                valid: el.checkValidity(),
                valueMissing: el.validity.valueMissing,
                rangeUnderflow: el.validity.rangeUnderflow,
                rangeOverflow: el.validity.rangeOverflow,
                stepMismatch: el.validity.stepMismatch
            }));

        console.log(
            JSON.stringify(validAmountState, null, 2)
        );

        if (!validAmountState.valid) {
            throw new Error(
                "AUD 100 was rejected as an invalid amount"
            );
        }

        console.log(
            "PASS  Valid amount accepted"
        );

        // 7. FORM STATE
        console.log("");
        console.log("7. FORM STATE");

        const formState =
            await page.locator("#recordPaymentForm").evaluate(form => ({
                valid: form.checkValidity(),
                amount:
                    document.getElementById("recordAmount")?.value || "",
                currency:
                    document.getElementById("recordCurrency")?.value || "",
                paymentType:
                    document.getElementById("recordPaymentType")?.value || "",
                paymentMethod:
                    document.getElementById("recordPaymentMethod")?.value || "",
                paymentStatus:
                    document.getElementById("recordPaymentStatus")?.value || ""
            }));

        console.log(
            JSON.stringify(formState, null, 2)
        );

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC13 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Amount and Currency controls verified");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC13 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
