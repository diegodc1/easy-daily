const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const outputPath = path.join(__dirname, '..', 'src', 'assets', 'version.json');

const packageJsonRaw = fs.readFileSync(packageJsonPath, 'utf-8');
const packageJson = JSON.parse(packageJsonRaw);

const versionPayload = {
  version: packageJson.version || ''
};

fs.writeFileSync(outputPath, JSON.stringify(versionPayload, null, 2) + '\n', 'utf-8');
console.log(`Version file generated: ${outputPath} (${versionPayload.version})`);
