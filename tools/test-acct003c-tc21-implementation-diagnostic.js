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
        console.log(" ACCT-003C-TC21 FILTER IMPLEMENTATION DIAGNOSTIC");
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

        await page.waitForTimeout(3000);

        console.log("PASS  Authentication successful");

        console.log("");
        console.log("2. INSPECTING FILTER BUTTON");

        const applyButton = page.locator("#applyButton");

        console.log(
            "Apply button count:",
            await applyButton.count()
        );

        if (await applyButton.count() !== 1) {
            throw new Error("#applyButton not found");
        }

        const buttonInfo = await applyButton.evaluate(el => ({
            id: el.id,
            tag: el.tagName,
            text: el.innerText,
            onclick: el.getAttribute("onclick"),
            type: el.getAttribute("type")
        }));

        console.log(
            JSON.stringify(buttonInfo, null, 2)
        );

        console.log("");
        console.log("3. INSPECTING PAYMENT METHOD SELECT");

        const method = page.locator("#paymentMethod");

        const methodInfo = await method.evaluate(el => ({
            id: el.id,
            value: el.value,
            onchange: el.getAttribute("onchange"),
            outerHTML: el.outerHTML
        }));

        console.log(
            JSON.stringify(methodInfo, null, 2)
        );

        console.log("");
        console.log("4. INSPECTING PAGE JAVASCRIPT");

        const scripts = await page.locator("script").evaluateAll(
            scripts => scripts.map(s => ({
                src: s.src,
                inline: !s.src,
                text: s.src ? "" : s.textContent
            }))
        );

        for (const script of scripts) {

            if (script.src) {
                console.log("SCRIPT:", script.src);
            } else if (
                script.text.includes("paymentMethod") ||
                script.text.includes("applyButton") ||
                script.text.includes("applyFilters") ||
                script.text.includes("filter")
            ) {
                console.log("");
                console.log("INLINE SCRIPT MATCH:");
                console.log(script.text.substring(0, 12000));
            }
        }

        console.log("");
        console.log("5. SELECTING OTHER");

        await method.selectOption("Other");

        console.log(
            "Selected:",
            await method.inputValue()
        );

        console.log("");
        console.log("6. CLICKING APPLY");

        await applyButton.click();

        await page.waitForTimeout(1500);

        console.log(
            "Selected after apply:",
            await method.inputValue()
        );

        console.log("");
        console.log("7. RESULTING ROWS");

        const rows = page.locator("table tbody tr");
        const count = await rows.count();

        console.log("Row count:", count);

        for (let i = 0; i < count; i++) {
            console.log(
                `ROW ${i + 1}:`,
                (await rows.nth(i).innerText())
                    .replace(/\s+/g, " ")
                    .trim()
            );
        }

        console.log("");
        console.log("==============================================");
        console.log(" DIAGNOSTIC COMPLETE");
        console.log("==============================================");

    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error(" DIAGNOSTIC FAILED");
        console.error("==============================================");
        console.error("FAIL:", error.message);
        console.error("==============================================");

        process.exitCode = 1;

    } finally {

        await browser.close();

    }

})();
