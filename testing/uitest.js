const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
      "headless": false,
      "slowMo": 50
  })
  const page = await browser.newPage()

  const navigationPromise = page.waitForNavigation()

  // await page.goto('http://umr-tool.cs.brandeis.edu/')
  await page.goto('http://127.0.0.1:5000/')

  // await page.setViewport({ width: 1920, height: 1001 })

  //login
  await page.waitForSelector('.navbar > .container > #navbarToggle > .navbar-nav:nth-child(2) > .nav-item:nth-child(1)')
  await page.click('.navbar > .container > #navbarToggle > .navbar-nav:nth-child(2) > .nav-item:nth-child(1)')

  await navigationPromise

  await page.waitForSelector('.content-section #email')
  await page.click('.content-section #email')
  await page.type("#email", 'jinzhao3611@gmail.com');
  // await page.type("#email", 'ldenk@unm.edu');


  await page.waitForSelector('.content-section #password')
  await page.click('.content-section #password')
  await page.type('input#password', 'password');
  // await page.type('input#password', 'tegaleyn');


  await page.waitForSelector('#content #submit')
  await page.click('#content #submit')

  await navigationPromise
  // account
  await page.waitForSelector('.navbar > .container > #navbarToggle > .navbar-nav > .nav-item:nth-child(3)')
  await page.click('.navbar > .container > #navbarToggle > .navbar-nav > .nav-item:nth-child(3)')

  await navigationPromise

  await page.waitForSelector('#content > .content-section > .list-group > #docIdInDb-22 > a')
  await page.click('#content > .content-section > .list-group > #docIdInDb-22 > a')

  await navigationPromise
  // annotate
  // await page.waitForSelector('.navbar > .container > #navbarToggle > .navbar-nav:nth-child(2) > .nav-item:nth-child(1)')
  // await page.click('.navbar > .container > #navbarToggle > .navbar-nav:nth-child(2) > .nav-item:nth-child(1)')
  //
  // await navigationPromise
  //
  // await page.waitForSelector('form #file')
  // await page.click('form #file')
  //
  // const inputUploadHandle = await page.$('form #file');
  // let fileToUpload = '/Users/jinzhao/eb-umr/umr_annot_tool/resources/sample_sentences/Sanapana_1.xml';
  //
  // // Sets the value of the file input to fileToUpload
  // inputUploadHandle.uploadFile(fileToUpload);
  //
  // await page.waitForSelector('.content-section #file_format')
  // await page.click('.content-section #file_format')
  //
  // await page.select('.content-section #file_format', 'flex2')
  //
  // await page.waitForSelector('.content-section #language_mode')
  // await page.click('.content-section #language_mode')
  //
  // await page.select('.content-section #language_mode', 'sanapana')
  //
  // await page.waitForSelector('#content #btnSubmit')
  // await page.click('#content #btnSubmit')
  // await navigationPromise

  await page.waitForSelector('#sentence > .dataframe > tbody > #current-words > td:nth-child(3)')
    //double click (flaky)
  const tasted_selector = '#sentence > .dataframe > tbody > #current-words > td:nth-child(3)'
  const rect = await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const { x, y } = element.getBoundingClientRect();
      return { x, y };
  }, tasted_selector);
  await page.mouse.click(rect.x, rect.y, { clickCount: 2 });

  await page.waitForSelector('tbody #selected_tokens')
  await page.click('tbody #selected_tokens')

  await page.waitForSelector('td #sense')
  await page.click('td #sense')

  await page.waitForSelector('.row #umr2db')
  await page.click('.row #umr2db')

  await page.waitForSelector('.row > #content #set_sentence')
  await page.click('.row > #content #set_sentence')

  await navigationPromise

  // await browser.close()
})()
