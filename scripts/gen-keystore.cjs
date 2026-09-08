const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const keystorePath = path.join(__dirname, '..', 'android', 'app', 'release.keystore');
if (fs.existsSync(keystorePath)) {
  fs.unlinkSync(keystorePath);
}

const keytool = 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe';
const args = [
  '-genkey', '-v',
  '-keystore', keystorePath,
  '-alias', 'battlecity',
  '-keyalg', 'RSA',
  '-keysize', '2048',
  '-validity', '10000',
  '-storepass', 'battlecity1990',
  '-keypass', 'battlecity1990',
  '-dname', 'CN=BattleCity, OU=Gaming, O=Arcade, L=City, S=State, C=US'
];

const res = spawnSync(keytool, args, { stdio: 'inherit' });
if (res.status === 0 && fs.existsSync(keystorePath)) {
  console.log('SUCCESS: release.keystore created successfully');
} else {
  console.error('FAILED to create keystore');
  process.exit(1);
}
