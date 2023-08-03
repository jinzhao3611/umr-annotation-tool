const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({
        "headless": false,
        "slowMo":50
    });
    const page = await browser.newPage();
    await page.goto('http://umr-tool.cs.brandeis.edu/upload', {"waitUnitl": "networdidle2"});
    const [fileChooser] = await Promise.all([
        page.waitForeFileChooser(),
        page.click('btn btn-outline-info')
    ])

    await browser.close();
    await fileChooser.accept(['umr_annot_tool/resources/sample_sentences/sample_snts_english.txt']);

})();