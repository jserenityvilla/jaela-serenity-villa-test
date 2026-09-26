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
        console.log(" ACCT-003C-TC14 TEXT FIELDS TEST - RETEST");
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

        // 3. FIND ACTUAL TEXT FIELDS
        console.log("");
        console.log("3. TEXT FIELDS");

        const fields = [
            ["recordTransactionReference", "Transaction Reference"],
            ["recordDescription", "Description"],
            ["recordNotes", "Notes"]
        ];

        for (const [id, name] of fields) {

            const field = page.locator(`#${id}`);

            if (await field.count() !== 1) {
                throw new Error(`#${id} not found`);
            }

            const info = await field.evaluate(el => ({
                tag: el.tagName,
                type: el.getAttribute("type"),
                required: el.hasAttribute("required"),
                value: "value" in el ? el.value : null,
                visible:
                    !!(
                        el.offsetWidth ||
                        el.offsetHeight ||
                        el.getClientRects().length
                    )
            }));

            console.log(`${name}:`);
            console.log(JSON.stringify(info, null, 2));

            console.log(`PASS  ${name} field exists`);
        }

        // 4. ENTER TEST VALUES
        console.log("");
        console.log("4. ENTERING TEST VALUES");

        const testValues = {
            recordTransactionReference: "TEST-TC14-REF-001",
            recordDescription: "ACCT-003C TC14 test payment",
            recordNotes: "TC14 automated text field verification"
        };

        for (const [id, value] of Object.entries(testValues)) {

            const field = page.locator(`#${id}`);

            await field.fill(value);

            const actual = await field.inputValue();

            console.log(`${id}: ${actual}`);

            if (actual !== value) {
                throw new Error(
                    `${id} did not retain entered value`
                );
            }

            console.log(`PASS  ${id} retained value`);
        }

        // 5. VERIFY OPTIONAL STATUS
        console.log("");
        console.log("5. REQUIRED STATUS");

        for (const [id, name] of fields) {

            const required =
                await page.locator(`#${id}`).evaluate(
                    el => el.hasAttribute("required")
                );

            console.log(
                `${name}: required=${required}`
            );

            if (required) {
                throw new Error(
                    `${name} is unexpectedly marked required`
                );
            }

            console.log(`PASS  ${name} is optional`);
        }

        // 6. RESULT
        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC14 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Transaction Reference, Description and Notes verified");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC14 RETEST FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
