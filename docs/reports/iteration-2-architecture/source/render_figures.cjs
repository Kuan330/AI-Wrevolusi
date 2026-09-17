// Uses an existing Playwright installation. Does not install browser packages.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
 const root = path.resolve(__dirname, '../figures');
 const browser = await chromium.launch({channel:'chrome',headless:true});
 const page = await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:2});
 await page.route('http**://**/*', route => route.abort());
 for (const file of fs.readdirSync(root).filter(x=>x.endsWith('.html') && (!process.argv[2] || x===process.argv[2]))) {
  await page.goto('file://'+path.join(root,file));
  await page.evaluate(()=>document.fonts.ready);
  const errors=await page.locator('svg text').evaluateAll(nodes=>nodes.filter(n=>{const b=n.getBBox();const s=n.ownerSVGElement.viewBox.baseVal;return b.x<0||b.y<0||b.x+b.width>s.width||b.y+b.height>s.height}).map(n=>n.textContent));
  if(errors.length)throw new Error('Out-of-frame labels '+JSON.stringify(errors));
  await page.locator('svg').screenshot({path:path.join(root,file.replace('.html',file==='ERD.html'?'.PNG':'.png')),omitBackground:true,type:"png"});
 }
 await browser.close();
})();
