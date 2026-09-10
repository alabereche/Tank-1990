/**
 * Battle City 1990 - Automated Android APK Builder
 * Builds native Android signed release APK using local Java JDK and Android SDK.
 * Copies output to release/Battle City 1990.apk
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android');
const releaseDir = path.join(rootDir, 'release');

// Preferred paths discovered on user's system
const JAVA_HOME = process.env.JAVA_HOME || 'C:\\Program Files\\Android\\Android Studio\\jbr';
const ANDROID_HOME = process.env.ANDROID_HOME || 'C:\\Users\\dhirar\\AppData\\Local\\Android\\Sdk';

console.log('------------------------------------------------------');
console.log('Battle City 1990 - Android APK Build Pipeline');
console.log('------------------------------------------------------');
console.log(`JAVA_HOME:    ${JAVA_HOME}`);
console.log(`ANDROID_HOME: ${ANDROID_HOME}`);

if (!fs.existsSync(JAVA_HOME)) {
  console.error(`ERROR: JAVA_HOME does not exist at: ${JAVA_HOME}`);
  process.exit(1);
}

if (!fs.existsSync(ANDROID_HOME)) {
  console.error(`ERROR: ANDROID_HOME does not exist at: ${ANDROID_HOME}`);
  process.exit(1);
}

// Ensure release directory exists
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

// Configure environment
const env = {
  ...process.env,
  JAVA_HOME,
  ANDROID_HOME,
  ANDROID_SDK_ROOT: ANDROID_HOME,
  PATH: `${path.join(JAVA_HOME, 'bin')};${path.join(ANDROID_HOME, 'platform-tools')};${process.env.PATH}`,
};

const gradlewBat = path.join(androidDir, 'gradlew.bat');
if (!fs.existsSync(gradlewBat)) {
  console.error(`ERROR: gradlew.bat not found at: ${gradlewBat}`);
  process.exit(1);
}

console.log('Executing Gradle build: gradlew.bat assembleRelease...');
const result = spawnSync('cmd.exe', ['/c', 'gradlew.bat', 'assembleRelease', '--no-daemon'], {
  cwd: androidDir,
  env,
  stdio: 'inherit',
});

if (result.status !== 0) {
  console.error(`Gradle build failed with exit code ${result.status}`);
  process.exit(result.status || 1);
}

// Locate generated APK
const apkSource = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!fs.existsSync(apkSource)) {
  console.error(`ERROR: Expected APK not found at: ${apkSource}`);
  process.exit(1);
}

const apkDest = path.join(releaseDir, 'Battle City 1990.apk');
fs.copyFileSync(apkSource, apkDest);

const publicDest = path.join(rootDir, 'public', 'battle-city-1990.apk');
fs.copyFileSync(apkSource, publicDest);

const stats = fs.statSync(apkDest);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log('------------------------------------------------------');
console.log(`APK successfully created!`);
console.log(`Path: ${apkDest}`);
console.log(`Size: ${sizeMB} MB`);
console.log('------------------------------------------------------');
