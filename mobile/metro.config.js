// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for react-native-agora compatibility with Expo SDK 54+
// Ensures TypeScript files in node_modules are properly parsed
config.resolver.sourceExts.push('tsx');
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'tsx');

module.exports = config;
