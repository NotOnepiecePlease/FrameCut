// Produces the portable, self-contained application. No dependencies.
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const html = read('index.html')
  .replace('<link rel="stylesheet" href="style.css">', () => '<style>' + read('style.css') + '</style>')
  .replace('<script src="app.js" defer></script>', '')
  .replace('<script src="automation.js" defer></script>', '')
  .replace('<script src="balloon-cleaner.js" defer></script>', '')
  .replace('</body>', () => '<script>' + read('automation.js') + '\n' + read('balloon-cleaner.js') + '\n' + read('app.js') + '</script>\n</body>')
  .replace('href="./index.html"', 'href="#"');
fs.writeFileSync(path.join(__dirname, 'Entrequadros.html'), html);
console.log('Entrequadros.html pronto para abrir ou compartilhar.');
