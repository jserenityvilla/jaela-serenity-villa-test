const { chromium } = require("playwright");

const CHROME =
    "C:\\Users\\surek\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";

const URL =
    "https://ja-ela-serenity-villa-test.web.app/admin/login.html";

(async () => {

    const browser = await chromium.launch({
        executablePath: CHROME,
        headless: true
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("==============================================");
    console.log(" FIREBASE CONFIG BROWSER RESPONSE TEST");
    console.log("==============================================");

    page.on("response", async response => {

        if (response.url().includes("firebase-config.js")) {

            console.log("");
            console.log("CONFIG RESPONSE");
            console.log("Status:", response.status());
            console.log("URL:", response.url());

            try {
                const body = await response.text();

                console.log("Body length:", body.length);
                console.log("Body preview:");
                console.log(body.substring(0, 500));

            } catch (error) {

                console.log(
                    "Unable to read response body:",
                    error.message
                );

            }
        }

    });

    page.on("requestfailed", request => {

        if (request.url().includes("firebase-config.js")) {

            console.log("");
            console.log("CONFIG REQUEST FAILED");
            console.log("URL:", request.url());
            console.log(
                "Failure:",
                request.failure()?.errorText
            );

        }

    });

    page.on("console", msg => {

        console.log(
            "BROWSER:",
            msg.type(),
            msg.text()
        );

    });

    await page.goto(URL, {
        waitUntil: "networkidle",
        timeout: 30000
    });

    await page.waitForTimeout(2000);

    console.log("");
    console.log("==============================================");
    console.log(" GLOBAL FIREBASE CHECK");
    console.log("==============================================");

    const result = await page.evaluate(() => ({
        firebaseDefined:
            typeof firebase !== "undefined",

        firebaseConfigDefined:
            typeof firebaseConfig !== "undefined",

        firebaseApps:
            typeof firebase !== "undefined"
                ? firebase.apps.length
                : -1,

        firebaseAuthAvailable:
            typeof firebase !== "undefined" &&
            typeof firebase.auth === "function"
    }));

    console.log(JSON.stringify(result, null, 2));

    await browser.close();

})();
