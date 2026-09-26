const { chromium } = require("playwright");

const CHROME =
    "C:\\Users\\surek\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";

const URL =
    "https://ja-ela-serenity-villa-test.web.app/admin/login.html";

const EMAIL = process.env.TEST_ADMIN_EMAIL;
const PASSWORD = process.env.TEST_ADMIN_PASSWORD;

(async () => {

    const browser = await chromium.launch({
        executablePath: CHROME,
        headless: true
    });

    const page = await browser.newPage();

    console.log("==============================================");
    console.log(" ADMIN LOGIN FIELD / SUBMIT TEST");
    console.log("==============================================");

    page.on("console", msg => {
        console.log("BROWSER:", msg.type(), msg.text());
    });

    page.on("pageerror", error => {
        console.log("PAGE ERROR:", error.message);
    });

    page.on("request", request => {

        if (
            request.url().includes("identitytoolkit") ||
            request.url().includes("securetoken")
        ) {
            console.log(
                "AUTH REQUEST:",
                request.method(),
                request.url()
            );
        }

    });

    page.on("response", response => {

        if (
            response.url().includes("identitytoolkit") ||
            response.url().includes("securetoken")
        ) {
            console.log(
                "AUTH RESPONSE:",
                response.status(),
                response.url()
            );
        }

    });

    await page.goto(URL, {
        waitUntil: "networkidle",
        timeout: 30000
    });

    await page.waitForTimeout(1000);

    console.log("");
    console.log("ENVIRONMENT:");
    console.log("Email available:", !!EMAIL);
    console.log("Password available:", !!PASSWORD);

    await page.locator("#adminEmail").fill(EMAIL);
    await page.locator("#adminPassword").fill(PASSWORD);

    console.log("");
    console.log("FIELD VALUES:");

    console.log(
        "Email:",
        JSON.stringify(
            await page.locator("#adminEmail").inputValue()
        )
    );

    console.log(
        "Password length:",
        (await page.locator("#adminPassword").inputValue()).length
    );

    console.log("");
    console.log("FORM CHECK:");

    const formCheck = await page.locator("#adminLoginForm").evaluate(form => {

        const email =
            document.getElementById("adminEmail");

        const password =
            document.getElementById("adminPassword");

        return {
            checkValidity: form.checkValidity(),
            emailValue: email.value,
            passwordLength: password.value.length,
            emailRequired: email.required,
            passwordRequired: password.required
        };

    });

    console.log(JSON.stringify(formCheck, null, 2));

    console.log("");
    console.log("CLICKING SIGN IN...");

    await page.locator("#adminLoginButton").click();

    await page.waitForTimeout(8000);

    console.log("");
    console.log("==============================================");
    console.log("RESULT");
    console.log("==============================================");

    console.log("URL:", page.url());

    console.log(
        "Email after click:",
        JSON.stringify(
            await page.locator("#adminEmail").inputValue()
        )
    );

    console.log(
        "Password length after click:",
        (await page.locator("#adminPassword").inputValue()).length
    );

    console.log(
        "Message:",
        JSON.stringify(
            await page.locator("#adminLoginMessage").innerText()
        )
    );

    console.log(
        "Button:",
        await page.locator("#adminLoginButton").innerText()
    );

    await browser.close();

})();
