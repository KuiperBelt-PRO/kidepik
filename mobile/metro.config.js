const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// OneDrive en Windows: el watcher nativo provoca caidas ENOENT/EBUSY en node_modules.
config.watchFolders = [__dirname];
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
