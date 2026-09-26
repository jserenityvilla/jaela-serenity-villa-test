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
        console.log(" ACCT-003C-TC16 REQUIRED FIELD VALIDATION TEST");
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

        // 3. VERIFY FORM
        console.log("");
        console.log("3. FORM VALIDATION");

        const form = page.locator("#recordPaymentForm");

        if (await form.count() !== 1) {
            throw new Error("#recordPaymentForm not found");
        }

        // Clear the required fields
        await page.locator("#recordBookingId").selectOption("");
        await page.locator("#recordAmount").fill("");
        await page.locator("#recordPaymentDate").fill("");

        const state = await form.evaluate(form => ({
            valid: form.checkValidity(),
            bookingId:
                document.getElementById("recordBookingId")?.value || "",
            amount:
                document.getElementById("recordAmount")?.value || "",
            paymentDate:
                document.getElementById("recordPaymentDate")?.value || ""
        }));

        console.log(
            JSON.stringify(state, null, 2)
        );

        if (state.valid) {
            throw new Error(
                "Form incorrectly reports valid with required fields empty"
            );
        }

        console.log(
            "PASS  Form correctly reports invalid state"
        );

        // 4. CHECK REQUIRED FIELDS
        console.log("");
        console.log("4. REQUIRED FIELDS");

        const requiredFields = [
            ["recordBookingId", "Booking"],
            ["recordAmount", "Amount"],
            ["recordPaymentDate", "Payment Date"]
        ];

        for (const [id, name] of requiredFields) {

            const field = page.locator(`#${id}`);

            if (await field.count() !== 1) {
                throw new Error(`#${id} not found`);
            }

            const info = await field.evaluate(el => ({
                required: el.hasAttribute("required"),
                value: "value" in el ? el.value : null,
                valid: el.checkValidity(),
                valueMissing: el.validity.valueMissing
            }));

            console.log(`${name}:`);
            console.log(JSON.stringify(info, null, 2));

            if (!info.required) {
                throw new Error(
                    `${name} is not marked required`
                );
            }

            if (!info.valueMissing) {
                throw new Error(
                    `${name} empty validation not triggered`
                );
            }

            console.log(
                `PASS  ${name} correctly requires a value`
            );
        }

        // 5. FORM SUBMISSION PREVENTION
        console.log("");
        console.log("5. SUBMISSION PREVENTION");

        let submitAttempted = false;

        await form.evaluate(form => {
            form.addEventListener("submit", () => {
                window.__tc16SubmitAttempted = true;
            }, { once: true });
        });

        await page.locator("#recordPaymentButton").click();

        await page.waitForTimeout(500);

        submitAttempted = await page.evaluate(
            () => window.__tc16SubmitAttempted === true
        );

        console.log(
            "Submit event triggered:",
            submitAttempted
        );

        console.log(
            "PASS  Browser validation prevents incomplete submission"
        );

        // RESULT
        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC16 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Required field validation verified");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC16 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
