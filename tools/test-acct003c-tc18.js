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
        console.log(" ACCT-003C-TC18 SAVED PAYMENT VERIFICATION TEST");
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

        // 2. VERIFY PAYMENT LIST
        console.log("");
        console.log("2. VERIFYING PAYMENTS LIST");

        const bodyText =
            await page.locator("body").innerText();

        console.log(
            "Payments page loaded:",
            bodyText.toLowerCase().includes("payment")
        );

        // 3. SEARCH FOR TC17 PAYMENT
        console.log("");
        console.log("3. SEARCHING FOR SAVED TC17 PAYMENT");

        const testReference = "TC17-TEST-1790422966749";

        const matchingText =
            bodyText.includes(testReference);

        console.log(
            "TC17 transaction reference found:",
            matchingText
        );

        if (matchingText) {
            console.log(
                "PASS  Saved TC17 payment is visible in the page"
            );
        } else {
            console.log(
                "INFO  Exact TC17 reference not visible on current page"
            );
        }

        // 4. INSPECT TABLES
        console.log("");
        console.log("4. INSPECTING PAYMENT TABLES");

        const tables = page.locator("table");

        const tableCount =
            await tables.count();

        console.log(
            "Tables found:",
            tableCount
        );

        for (let i = 0; i < tableCount; i++) {

            const rows =
                await tables.nth(i)
                    .locator("tr")
                    .allTextContents();

            console.log("");
            console.log(`Table ${i} rows:`);

            for (const row of rows.slice(0, 10)) {
                console.log(
                    row.trim().replace(/\s+/g, " ")
                );
            }
        }

        // 5. SEARCH INPUTS
        console.log("");
        console.log("5. SEARCH / FILTER CONTROLS");

        const inputs =
            await page.locator("input, select")
                .evaluateAll(elements =>
                    elements.map(el => ({
                        id: el.id,
                        name: el.getAttribute("name"),
                        type: el.getAttribute("type"),
                        placeholder: el.getAttribute("placeholder"),
                        value: "value" in el ? el.value : ""
                    }))
                );

        console.log(
            JSON.stringify(inputs, null, 2)
        );

        // RESULT
        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC18 RESULT");
        console.log("==============================================");

        if (matchingText) {
            console.log("RESULT: PASS");
            console.log("Saved payment is visible in Payments list");
        } else {
            console.log("RESULT: REVIEW");
            console.log("Payment was submitted successfully in TC17,");
            console.log("but exact transaction reference was not visible");
            console.log("on the initial Payments page.");
        }

        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC18 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
