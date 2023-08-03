const puppeteer = require('puppeteer');

(async () =>{
    const browser = await puppeteer.launch({
        "headless": false,
        "slowMo": 35
    });
    const page = await browser.newPage();
    // await page.goto('http://umr-tool.cs.brandeis.edu/login');
    await page.goto('http://127.0.0.1:5000/login');
    // await page.goto('https://glacial-shelf-55504.herokuapp.com/login');


    //login
    await page.click("#email");
    await page.type("#email", 'jinzhao@brandeis.edu');
    await page.click('input#password');
    await page.type('input#password', 'password');
    await Promise.all([
        page.waitForNavigation(),
        page.click('input#submit')
    ])

    //goes to upload
    const elementHandle = await page.$("input#file");
    await elementHandle.uploadFile('/Users/jinzhao/schoolwork/lab-work/umr-annotation-tool/umr_annot_tool/resources/sample_sentences/sample_snts_english.txt');

    await page.click('#language_mode-1');
    await page.click('#btnSubmit')

    //double click (flaky)
    const tasted_selector = '#sentence > table > tbody > tr > td:nth-child(3)'
    const rect = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const { x, y } = element.getBoundingClientRect();
        return { x, y };
    }, tasted_selector);
    await page.mouse.click(rect.x, rect.y, { clickCount: 2 });


    // await page.click('#selected_tokens');
    // await page.hover("#find_lemma");
    // await page.click("#xx");

    // await browser.close();
})();




// (async () =>{
//     const browser = await puppeteer.launch({
//         "headless": false
//     });
//     const page = await browser.newPage();
//     await page.goto('http://umr-tool.cs.brandeis.edu/');
//     const input = await page.waitForSelector('[type=search]');
//     await input.type('things you want to type in');
//     await page.keyboard.press('Enter');
//     expect(await page.title()).toInclude('javascriptenabledenabled');
//     await browser.close();
// })();



        // waitForResponse don't work here because annotate is always 200 for now? can be used to test getsenses
        // page.waitForResponse('http://127.0.0.1:5000/upload'),
        // page.waitForRequest(request => request.url() === 'http://umr-tool.cs.brandeis.edu/upload' && request.method() === 'POST'),
        // page.waitForResponse(response => response.url() === 'http://umr-tool.cs.brandeis.edu/annotate' && response.status() === 200),
        // page.waitForRequest('http://umr-tool.cs.brandeis.edu/upload'),
