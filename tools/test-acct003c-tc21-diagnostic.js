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
        console.log(" ACCT-003C-TC21 OTHER METHOD DIAGNOSTIC");
        console.log("==============================================");

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

        console.log("");
        console.log("2. APPLYING PAYMENT METHOD = OTHER");

        await page.locator("#paymentMethod")
            .selectOption("Other");

        await page.waitForTimeout(1000);

        const rows =
            page.locator("table tbody tr");

        const rowCount =
            await rows.count();

        console.log("Rows returned:", rowCount);

        console.log("");
        console.log("3. INSPECTING ALL OTHER PAYMENT ROWS");

        for (let i = 0; i < rowCount; i++) {

            const rowText =
                (await rows.nth(i).innerText())
                    .replace(/\s+/g, " ")
                    .trim();

            console.log("");
            console.log(`ROW ${i + 1}:`);
            console.log(rowText);

            const cells =
                await rows.nth(i)
                    .locator("td")
                    .allTextContents();

            console.log(
                "CELLS:",
                JSON.stringify(
                    cells.map(x => x.trim()),
                    null,
                    2
                )
            );
        }

        console.log("");
        console.log("4. FILTER VALUE");

        console.log(
            "Selected method:",
            await page.locator("#paymentMethod").inputValue()
        );

        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC21 DIAGNOSTIC RESULT");
        console.log("==============================================");

        if (rowCount >= 1) {
            console.log("RESULT: REVIEW");
            console.log(
                `Other filter returned ${rowCount} rows.`
            );
            console.log(
                "Inspect the rows above before changing application code."
            );
        } else {
            console.log("RESULT: FAIL");
            console.log("Other filter returned no rows.");
        }

        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" ACCT-003C-TC21 DIAGNOSTIC FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
