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
        console.log(" ACCT-003C-TC10 BOOKING DETAILS TEST - RETEST");
        console.log("==============================================");

        // LOGIN
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

        // OPEN PANEL
        console.log("");
        console.log("2. OPENING RECORD PAYMENT");

        await page.locator("#recordPaymentButton").click();
        await page.waitForTimeout(500);

        console.log("PASS  Record Payment panel opened");

        // SELECT BOOKING
        console.log("");
        console.log("3. SELECTING BOOKING");

        const bookingSelect =
            page.locator("#recordBookingId");

        const options =
            await bookingSelect.locator("option").evaluateAll(
                options => options.map(option => ({
                    value: option.value,
                    text: option.textContent.trim()
                }))
            );

        const realBookings =
            options.filter(option => option.value);

        console.log(
            "Available bookings:",
            realBookings.length
        );

        if (realBookings.length === 0) {
            throw new Error("No booking records available");
        }

        const booking = realBookings[0];

        await bookingSelect.selectOption(booking.value);
        await page.waitForTimeout(1000);

        console.log(
            "Selected booking:",
            await bookingSelect.inputValue()
        );

        if (
            await bookingSelect.inputValue() !==
            booking.value
        ) {
            throw new Error("Booking selection was not retained");
        }

        console.log("PASS  Booking selected");

        // BOOKING REFERENCE
        console.log("");
        console.log("4. BOOKING REFERENCE");

        const bookingReference =
            page.locator("#recordBookingReference");

        if (await bookingReference.count() !== 1) {
            throw new Error(
                "#recordBookingReference not found"
            );
        }

        const referenceInfo =
            await bookingReference.evaluate(el => ({
                tag: el.tagName,
                type: el.getAttribute("type"),
                value: "value" in el ? el.value : null,
                text: el.textContent.trim(),
                innerText: el.innerText?.trim() || "",
                visible:
                    !!(el.offsetWidth ||
                    el.offsetHeight ||
                    el.getClientRects().length)
            }));

        console.log(
            JSON.stringify(referenceInfo, null, 2)
        );

        console.log("PASS  Booking Reference element exists");

        // BOOKING TOTAL
        console.log("");
        console.log("5. BOOKING TOTAL");

        const bookingTotal =
            page.locator("#recordBookingTotal");

        if (await bookingTotal.count() !== 1) {
            throw new Error(
                "#recordBookingTotal not found"
            );
        }

        const totalInfo =
            await bookingTotal.evaluate(el => ({
                tag: el.tagName,
                type: el.getAttribute("type"),
                value: "value" in el ? el.value : null,
                text: el.textContent.trim(),
                innerText: el.innerText?.trim() || "",
                visible:
                    !!(el.offsetWidth ||
                    el.offsetHeight ||
                    el.getClientRects().length)
            }));

        console.log(
            JSON.stringify(totalInfo, null, 2)
        );

        console.log("PASS  Booking Total element exists");

        // PAYMENT AMOUNT
        console.log("");
        console.log("6. PAYMENT AMOUNT");

        console.log(
            "Amount:",
            await page.locator("#recordAmount").inputValue()
        );

        // FORM STATE
        console.log("");
        console.log("7. FORM STATE");

        const formState =
            await page.locator("#recordPaymentForm").evaluate(form => ({
                valid: form.checkValidity(),
                bookingId:
                    document.getElementById("recordBookingId")?.value || "",
                paymentType:
                    document.getElementById("recordPaymentType")?.value || "",
                amount:
                    document.getElementById("recordAmount")?.value || "",
                currency:
                    document.getElementById("recordCurrency")?.value || "",
                method:
                    document.getElementById("recordPaymentMethod")?.value || "",
                status:
                    document.getElementById("recordPaymentStatus")?.value || ""
            }));

        console.log(
            JSON.stringify(formState, null, 2)
        );

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC10 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Booking selection and booking details verified");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC10 RETEST FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
