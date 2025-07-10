const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());


// New endpoint for POST /fetch-details
app.use(express.json());
app.post('/fetch-details', async (req, res) => {
  const url = req.body.url;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    const pageUrl = await page.url();
    const evalResult = await page.evaluate((pageUrl) => {
      const headingCounts = {};
      for (let i = 1; i <= 6; i++) {
        headingCounts['h' + i] = document.querySelectorAll('h' + i).length;
      }
      let htmlVersion = 'Unknown';
      const doctype = document.doctype;
      if (doctype) {
        const dt = doctype;
        const publicId = dt.publicId ? dt.publicId.trim() : '';
        const systemId = dt.systemId ? dt.systemId.trim() : '';
        const name = dt.name ? dt.name.trim().toLowerCase() : '';
        const doctypeString = `<!DOCTYPE ${name}${publicId ? ' PUBLIC "' + publicId + '"' : ''}${systemId ? ' "' + systemId + '"' : ''}>`;
        if (name === 'html' && !publicId && !systemId) {
          htmlVersion = 'HTML5';
        } else if (publicId === '-//W3C//DTD HTML 4.01//EN' && !systemId) {
          htmlVersion = 'HTML 4.01 Strict';
        } else if (publicId === '-//W3C//DTD HTML 4.01 Transitional//EN') {
          htmlVersion = 'HTML 4.01 Transitional';
        } else if (publicId === '-//W3C//DTD HTML 3.2 Final//EN') {
          htmlVersion = 'HTML 3.2';
        } else if (publicId === '-//W3C//DTD HTML 2.0//EN') {
          htmlVersion = 'HTML 2.0';
        } else if (publicId === '-//W3C//DTD HTML 1.0//EN') {
          htmlVersion = 'HTML 1.0';
        } else if (publicId === '-//W3C//DTD XHTML 1.0 Strict//EN') {
          htmlVersion = 'XHTML 1.0 Strict';
        } else if (publicId === '-//W3C//DTD XHTML 1.0 Transitional//EN') {
          htmlVersion = 'XHTML 1.0 Transitional';
        } else if (publicId === '-//W3C//DTD XHTML 1.0 Frameset//EN') {
          htmlVersion = 'XHTML 1.0 Frameset';
        } else if (publicId === '-//W3C//DTD XHTML 1.1//EN') {
          htmlVersion = 'XHTML 1.1';
        } else {
          htmlVersion = doctypeString;
        }
      }
      // Count internal and external links
      let internalLinks = 0, externalLinks = 0;
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      let pageOrigin = '';
      try {
        pageOrigin = new URL(pageUrl).origin;
      } catch {}
      anchors.forEach(a => {
        try {
          const href = a.getAttribute('href');
          if (!href) return;
          // Ignore anchors, mailto, javascript, etc.
          if (
            href.startsWith('#') ||
            href.startsWith('mailto:') ||
            href.trim().toLowerCase().startsWith('javascript:') ||
            href.trim().toLowerCase().startsWith('data:')
          ) return;
          const url = new URL(href, pageUrl);
          if (url.origin === pageOrigin) internalLinks++;
          else externalLinks++;
        } catch {}
      });
      // Detect login form
      let hasLoginForm = false;
      // Heuristic: form with at least one input[type=password]
      const forms = Array.from(document.querySelectorAll('form'));
      for (const form of forms) {
        if (form.querySelector('input[type="password"]')) {
          hasLoginForm = true;
          break;
        }
      }
      // Return all heading counts as top-level fields
      return {
        htmlVersion,
        internalLinks,
        externalLinks,
        linkHrefs: anchors.map(a => a.getAttribute('href')),
        hasLoginForm,
        h1: headingCounts.h1,
        h2: headingCounts.h2,
        h3: headingCounts.h3,
        h4: headingCounts.h4,
        h5: headingCounts.h5,
        h6: headingCounts.h6
      };
    }, pageUrl);
    const { htmlVersion, internalLinks, externalLinks, linkHrefs, hasLoginForm, h1, h2, h3, h4, h5, h6 } = evalResult;

    // Check for inaccessible links (4xx/5xx)
    let inaccessibleLinks = 0;
    if (Array.isArray(linkHrefs)) {
      const checked = new Set();
      for (const href of linkHrefs) {
        if (!href) continue;
        let absUrl;
        try {
          absUrl = new URL(href, pageUrl).href;
        } catch { continue; }
        if (checked.has(absUrl)) continue;
        checked.add(absUrl);
        try {
          const resp = await page.goto(absUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          const status = resp.status();
          if (status >= 400 && status < 600) inaccessibleLinks++;
        } catch { inaccessibleLinks++; }
      }
      // Return to original page
      await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 120000 });
    }

    const title = await page.title();
    await browser.close();
    res.json({
      title,
      htmlVersion,
      h1: typeof h1 === 'number' ? h1 : 0,
      h2: typeof h2 === 'number' ? h2 : 0,
      h3: typeof h3 === 'number' ? h3 : 0,
      h4: typeof h4 === 'number' ? h4 : 0,
      h5: typeof h5 === 'number' ? h5 : 0,
      h6: typeof h6 === 'number' ? h6 : 0,
      internalLinks: typeof internalLinks === 'number' ? internalLinks : 0,
      externalLinks: typeof externalLinks === 'number' ? externalLinks : 0,
      inaccessibleLinks,
      hasLoginForm: typeof hasLoginForm === 'boolean' ? hasLoginForm : false
    });
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

const PORT = 4000;
app.listen(PORT, () => console.log(`Puppeteer server running on port ${PORT}`));
