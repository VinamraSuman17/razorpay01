const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1100 });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));

  const inputs = await page.$$('input[type="file"]');
  if (inputs.length >= 2) {
    const bankPath = path.resolve(__dirname, '../scratch/synthetic_live_bank.csv');
    const ledgerPath = path.resolve(__dirname, '../scratch/synthetic_live_ledger.csv');
    
    await inputs[0].uploadFile(bankPath);
    await inputs[1].uploadFile(ledgerPath);
    await new Promise(r => setTimeout(r, 500));

    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 4000));
  }

  await page.screenshot({
    path: 'C:/Users/User/.gemini/antigravity/brain/adf265a4-593c-487c-b848-db79348ccb64/synthetic_live_upload.png',
    fullPage: true
  });
  await browser.close();
  console.log('Live synthetic batch uploaded and screenshot saved successfully!');
})();
