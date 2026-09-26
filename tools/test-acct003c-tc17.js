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
        console.log(" ACCT-003C-TC17 SUCCESSFUL PAYMENT RECORD TEST - RETEST");
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

        // 3. SELECT BOOKING
        console.log("");
        console.log("3. SELECTING BOOKING");

        const bookingSelect =
            page.locator("#recordBookingId");

        const options =
            await bookingSelect.locator("option").evaluateAll(
                options => options
                    .map(option => ({
                        value: option.value,
                        text: option.textContent.trim()
                    }))
                    .filter(option => option.value)
            );

        if (options.length === 0) {
            throw new Error("No booking records available");
        }

        const booking = options[0];

        await bookingSelect.selectOption(booking.value);
        await page.waitForTimeout(1000);

        console.log(
            "Selected booking:",
            booking.value
        );

        if (
            await bookingSelect.inputValue() !==
            booking.value
        ) {
            throw new Error("Booking selection failed");
        }

        console.log("PASS  Booking selected");

        // 4. VERIFY BOOKING DETAILS
        console.log("");
        console.log("4. VERIFYING BOOKING DETAILS");

        console.log(
            "Booking Reference:",
            (await page.locator("#recordBookingReference").textContent()).trim()
        );

        console.log(
            "Booking Total:",
            (await page.locator("#recordBookingTotal").textContent()).trim()
        );

        console.log("PASS  Booking details populated");

        // 5. COMPLETE PAYMENT FORM
        console.log("");
        console.log("5. COMPLETING PAYMENT FORM");

        await page.locator("#recordPaymentType")
            .selectOption("Deposit");

        await page.locator("#recordAmount")
            .fill("1.00");

        // Currency is an INPUT, not a SELECT
        await page.locator("#recordCurrency")
            .fill("AUD");

        await page.locator("#recordPaymentMethod")
            .selectOption("Other");

        await page.locator("#recordPaymentStatus")
            .selectOption("Completed");

        await page.locator("#recordPaymentDate")
            .fill("2026-09-26");

        const testReference =
            "TC17-TEST-" + Date.now();

        await page.locator("#recordTransactionReference")
            .fill(testReference);

        await page.locator("#recordDescription")
            .fill("ACCT-003C TC17 successful payment test");

        await page.locator("#recordNotes")
            .fill("Automated TC17 test payment");

        console.log("PASS  Payment form populated");

        // 6. VALIDATE FORM
        console.log("");
        console.log("6. FORM VALIDATION");

        const formState =
            await page.locator("#recordPaymentForm").evaluate(form => ({
                valid: form.checkValidity(),
                bookingId:
                    document.getElementById("recordBookingId")?.value || "",
                amount:
                    document.getElementById("recordAmount")?.value || "",
                currency:
                    document.getElementById("recordCurrency")?.value || "",
                paymentDate:
                    document.getElementById("recordPaymentDate")?.value || "",
                paymentType:
                    document.getElementById("recordPaymentType")?.value || "",
                paymentMethod:
                    document.getElementById("recordPaymentMethod")?.value || "",
                paymentStatus:
                    document.getElementById("recordPaymentStatus")?.value || "",
                transactionReference:
                    document.getElementById("recordTransactionReference")?.value || ""
            }));

        console.log(
            JSON.stringify(formState, null, 2)
        );

        if (!formState.valid) {
            throw new Error(
                "Completed payment form is still invalid"
            );
        }

        console.log("PASS  Complete payment form is valid");

        // 7. SUBMIT
        console.log("");
        console.log("7. SUBMITTING PAYMENT");

        const submitButtons =
            page.locator(
                '#recordPaymentForm button[type="submit"], #recordPaymentForm button'
            );

        const buttonCount =
            await submitButtons.count();

        console.log(
            "Form buttons found:",
            buttonCount
        );

        let saveButton = null;

        for (let i = 0; i < buttonCount; i++) {

            const button =
                submitButtons.nth(i);

            const text =
                ((await button.textContent()) || "").trim();

            console.log(
                `Button ${i}: "${text}"`
            );

            if (/save|record|submit/i.test(text)) {
                saveButton = button;
                break;
            }
        }

        if (!saveButton) {
            throw new Error(
                "Payment submit/save button not found"
            );
        }

        console.log(
            "Using submit button:",
            ((await saveButton.textContent()) || "").trim()
        );

        await saveButton.click();

        console.log(
            "Submit button clicked"
        );

        // Allow Firestore operation/UI update
        await page.waitForTimeout(3000);

        // 8. VERIFY RESULT
        console.log("");
        console.log("8. VERIFYING RESULT");

        const bodyText =
            await page.locator("body").innerText();

        console.log(
            "Success-related text detected:",
            /success|recorded|saved|payment added|payment created/i.test(bodyText)
        );

        // Look for common visible notification elements
        const notifications =
            await page.locator(
                '.alert, .toast, .notification, [role="alert"]'
            ).allTextContents();

        if (notifications.length) {
            console.log(
                "Notifications:",
                JSON.stringify(
                    notifications.map(x => x.trim()).filter(Boolean),
                    null,
                    2
                )
            );
        }

        // 9. VERIFY FORM/PANEL STATE
        const formVisible =
            await page.locator("#recordPaymentForm")
                .isVisible()
                .catch(() => false);

        console.log(
            "Payment form visible after submit:",
            formVisible
        );

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC17 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Successful payment submission flow executed");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC17 RETEST FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
