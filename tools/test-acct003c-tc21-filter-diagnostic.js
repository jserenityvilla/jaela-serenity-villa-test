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
        console.log(" ACCT-003C-TC21 FILTER EVENT DIAGNOSTIC");
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

        // 2. INSPECT FILTER
        console.log("");
        console.log("2. INSPECTING PAYMENT METHOD FILTER");

        const filter = page.locator("#paymentMethod");

        if (await filter.count() !== 1) {
            throw new Error("#paymentMethod not found");
        }

        const filterInfo = await filter.evaluate(el => ({
            tag: el.tagName,
            value: el.value,
            onchange: el.getAttribute("onchange"),
            name: el.getAttribute("name"),
            options: Array.from(el.options).map(o => ({
                value: o.value,
                text: o.text,
                selected: o.selected
            }))
        }));

        console.log(
            JSON.stringify(filterInfo, null, 2)
        );

        // 3. CHECK LIST BEFORE FILTER
        console.log("");
        console.log("3. ROWS BEFORE FILTER");

        let rows = page.locator("table tbody tr");

        console.log(
            "Rows before filter:",
            await rows.count()
        );

        for (let i = 0; i < await rows.count(); i++) {
            console.log(
                `ROW ${i + 1}:`,
                (await rows.nth(i).innerText())
                    .replace(/\s+/g, " ")
                    .trim()
            );
        }

        // 4. CHANGE FILTER AND DISPATCH CHANGE EVENT
        console.log("");
        console.log("4. DISPATCHING CHANGE EVENT");

        await filter.selectOption("Other");

        await filter.dispatchEvent("change");

        await page.waitForTimeout(1500);

        console.log(
            "Selected value:",
            await filter.inputValue()
        );

        // 5. CHECK FILTERED ROWS
        console.log("");
        console.log("5. ROWS AFTER FILTER");

        rows = page.locator("table tbody tr");

        const afterCount = await rows.count();

        console.log(
            "Rows after Other filter:",
            afterCount
        );

        for (let i = 0; i < afterCount; i++) {

            const text =
                (await rows.nth(i).innerText())
                    .replace(/\s+/g, " ")
                    .trim();

            console.log(
                `ROW ${i + 1}:`,
                text
            );
        }

        // 6. CHECK WHETHER NON-OTHER ROW IS HIDDEN
        console.log("");
        console.log("6. ROW VISIBILITY");

        const rowDetails = await rows.evaluateAll(rows =>
            rows.map(row => ({
                text: row.innerText.replace(/\s+/g, " ").trim(),
                display: getComputedStyle(row).display,
                visibility: getComputedStyle(row).visibility,
                hidden: row.hidden
            }))
        );

        console.log(
            JSON.stringify(rowDetails, null, 2)
        );

        // 7. RESULT
        console.log("");
        console.log("==============================================");
        console.log(" ACCT-003C-TC21 DIAGNOSTIC RESULT");
        console.log("==============================================");

        const nonOtherVisible =
            rowDetails.some(r =>
                r.text.includes("Bank Transfer") &&
                r.display !== "none" &&
                r.visibility !== "hidden" &&
                !r.hidden
            );

        if (nonOtherVisible) {
            console.log("RESULT: FAIL");
            console.log(
                "Payment Method filter is not filtering the table correctly."
            );
            console.log(
                "Bank Transfer remains visible while Other is selected."
            );
        } else {
            console.log("RESULT: PASS");
            console.log(
                "Payment Method filter correctly hides non-matching rows."
            );
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
