const { chromium } = require("playwright");

const CHROME =
    "C:\\Users\\surek\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";

const BASE =
    "https://ja-ela-serenity-villa-test.web.app";

const LOGIN_URL =
    `${BASE}/admin/login.html?return=%2Fadmin%2Faccounts%2Fpayments.html`;

const EMAIL = process.env.TEST_ADMIN_EMAIL;
const PASSWORD = process.env.TEST_ADMIN_PASSWORD;

const TEST_REF = "TC17-TEST-1790422966749";

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
        console.log(" ACCT-003C-TC19 PAYMENT VIEW DETAILS TEST");
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

        // 2. FIND TEST PAYMENT ROW
        console.log("");
        console.log("2. FINDING SAVED PAYMENT");

        const row = page.locator("table tbody tr").filter({
            hasText: TEST_REF
        });

        if (await row.count() !== 1) {
            throw new Error(
                `Expected exactly one payment row containing ${TEST_REF}`
            );
        }

        console.log("PASS  Saved payment row found");

        console.log(
            "Row:",
            (await row.innerText()).replace(/\s+/g, " ").trim()
        );

        // 3. VIEW BUTTON
        console.log("");
        console.log("3. OPENING PAYMENT DETAILS");

        const viewButton = row.getByText("View", { exact: true });

        if (await viewButton.count() !== 1) {
            throw new Error("View button not found for saved payment");
        }

        await viewButton.click();

        await page.waitForTimeout(500);

        console.log("PASS  View action executed");

        // 4. INSPECT PAGE / MODAL
        console.log("");
        console.log("4. VERIFYING PAYMENT DETAILS");

        const bodyText =
            await page.locator("body").innerText();

        console.log(
            bodyText
                .split("\n")
                .map(x => x.trim())
                .filter(Boolean)
                .slice(-40)
                .join("\n")
        );

        // 5. VERIFY SAVED VALUES
        console.log("");
        console.log("5. VERIFYING SAVED VALUES");

        const expectedValues = [
            TEST_REF,
            "AUD",
            "1.00",
            "Other",
            "Completed"
        ];

        for (const value of expectedValues) {

            if (!bodyText.includes(value)) {
                throw new Error(
                    `Expected value not found in details: ${value}`
                );
            }

            console.log(`PASS  Found: ${value}`);
        }

        // RESULT
        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC19 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Saved payment details verified through View");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC19 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
