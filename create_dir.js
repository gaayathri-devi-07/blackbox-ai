const fs = require('fs');
const path = require('path');

const dirPath = path.join('C:', 'Users', 'gaaya', 'blackbox-ai', 'frontend', 'app', 'journey', 'improvement');

if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log('Directory created:', dirPath);
} else {
    console.log('Directory already exists:', dirPath);
}
