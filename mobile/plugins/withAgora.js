/**
 * Custom Expo Config Plugin for react-native-agora
 * Configures iOS and Android native projects for Agora SDK
 */

const { withInfoPlist, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withAgoraIOS(config) {
  // Add required iOS permissions to Info.plist
  config = withInfoPlist(config, (config) => {
    config.modResults.NSMicrophoneUsageDescription = 
      config.modResults.NSMicrophoneUsageDescription || 
      'Shield needs microphone access for voice calls.';
    
    // Add background modes for audio
    const existingModes = config.modResults.UIBackgroundModes || [];
    const newModes = [...existingModes];
    
    if (!newModes.includes('audio')) {
      newModes.push('audio');
    }
    if (!newModes.includes('voip')) {
      newModes.push('voip');
    }
    
    config.modResults.UIBackgroundModes = newModes;
    
    return config;
  });

  // Modify Podfile for Agora compatibility
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      
      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');
        
        // Add post_install hook to fix Agora linking issues
        const postInstallHook = `
  # Fix for react-native-agora
  post_install do |installer|
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.4'
      end
    end
    
    # React Native post install
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => podfile_properties['apple.ccacheEnabled'] == 'true',
    )
  end
`;
        
        // Check if post_install already exists
        if (!podfileContent.includes('post_install do |installer|')) {
          // Add before the last 'end'
          const lastEndIndex = podfileContent.lastIndexOf('end');
          if (lastEndIndex !== -1) {
            podfileContent = 
              podfileContent.slice(0, lastEndIndex) + 
              postInstallHook + '\n' +
              podfileContent.slice(lastEndIndex);
          }
        }
        
        fs.writeFileSync(podfilePath, podfileContent);
      }
      
      return config;
    },
  ]);

  return config;
}

function withAgoraAndroid(config) {
  // Add required Android permissions
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Add permissions if not present
    const permissions = manifest['uses-permission'] || [];
    const requiredPermissions = [
      'android.permission.RECORD_AUDIO',
      'android.permission.INTERNET',
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.ACCESS_WIFI_STATE',
    ];

    requiredPermissions.forEach((permission) => {
      const exists = permissions.some(
        (p) => p.$?.['android:name'] === permission
      );
      if (!exists) {
        permissions.push({
          $: { 'android:name': permission },
        });
      }
    });

    manifest['uses-permission'] = permissions;

    return config;
  });

  return config;
}

module.exports = function withAgora(config) {
  config = withAgoraIOS(config);
  config = withAgoraAndroid(config);
  return config;
};
