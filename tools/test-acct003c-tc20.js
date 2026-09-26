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
        console.log(" ACCT-003C-TC20 PAYMENT SEARCH / FILTER TEST");
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

        // 2. VERIFY SEARCH CONTROL
        console.log("");
        console.log("2. SEARCH CONTROL");

        const search = page.locator("#searchText");

        if (await search.count() !== 1) {
            throw new Error("#searchText not found");
        }

        console.log("PASS  Search field exists");

        // 3. SEARCH BY TRANSACTION REFERENCE
        console.log("");
        console.log("3. SEARCH BY TRANSACTION REFERENCE");

        await search.fill(TEST_REF);

        // Trigger the same events a real user would
        await search.press("Enter").catch(() => {});

        await page.waitForTimeout(1000);

        let bodyText = await page.locator("body").innerText();

        console.log(
            "Transaction reference visible:",
            bodyText.includes(TEST_REF)
        );

        if (!bodyText.includes(TEST_REF)) {
            throw new Error(
                `Saved transaction ${TEST_REF} was not found after search`
            );
        }

        console.log(
            "PASS  Transaction reference found by search"
        );

        // 4. VERIFY RESULT ROW
        console.log("");
        console.log("4. VERIFY SEARCH RESULT");

        const matchingRows =
            page.locator("table tbody tr").filter({
                hasText: TEST_REF
            });

        const rowCount = await matchingRows.count();

        console.log(
            "Matching payment rows:",
            rowCount
        );

        if (rowCount !== 1) {
            throw new Error(
                `Expected 1 matching payment row, found ${rowCount}`
            );
        }

        console.log(
            "PASS  Exactly one matching payment returned"
        );

        console.log(
            "Row:",
            (await matchingRows.first().innerText())
                .replace(/\s+/g, " ")
                .trim()
        );

        // 5. CLEAR SEARCH
        console.log("");
        console.log("5. CLEAR SEARCH");

        await search.fill("");

        await page.waitForTimeout(500);

        bodyText = await page.locator("body").innerText();

        if (!bodyText.includes("Payment Transactions")) {
            throw new Error(
                "Payments list did not return after clearing search"
            );
        }

        console.log(
            "PASS  Search cleared successfully"
        );

        // RESULT
        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC20 RESULT");
        console.log("==============================================");
        console.log("RESULT: PASS");
        console.log("Payment search and filter verification completed");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC20 FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
