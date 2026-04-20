#!/usr/bin/env node

async function notarizeApp(options) {
  try {
    console.log("Starting notarization...");

    const { notarize } = await import("@electron/notarize");

    let appPath;
    const { isFromMain } = options;
    if (isFromMain) {
      appPath =
        process.argv.find((a) => a.startsWith("--appPath="))?.split("=")[1] ||
        "release/mac-arm64/Nex Agent.app";
      console.log("Mode: standalone script");
    } else {
      const { electronPlatformName, appOutDir } = options;
      if (electronPlatformName !== "darwin") {
        console.log("Skipping notarization: not macOS");
        return;
      }
      const appName = options.packager.appInfo.productFilename;
      appPath = `${appOutDir}/${appName}.app`;
      console.log("Mode: afterSign hook");
    }

    console.log(`App path: ${appPath}`);

    const args = {
      appPath,
      appleId: process.env.XC_APPLE_ID || process.env.APPLE_ID,
      appleIdPassword:
        process.env.XC_APPLE_APP_SPECIFIC_PASSWORD ||
        process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.XC_APPLE_TEAM_ID || process.env.APPLE_TEAM_ID,
    };

    if (!args.appleId || !args.appleIdPassword || !args.teamId) {
      console.log("Notarization credentials not fully configured, skipping.");
      console.log("Set: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID");
      return;
    }

    console.log("Submitting for notarization (may take 10-30 min)...");

    const progressInterval = setInterval(() => {
      console.log("Still waiting for notarization...");
    }, 60000);

    try {
      await notarize(args);
      clearInterval(progressInterval);
      console.log("Notarization succeeded!");
    } catch (err) {
      clearInterval(progressInterval);
      throw err;
    }
  } catch (error) {
    console.error("Notarization failed:", error.message);
    process.exit(1);
  }
}

exports.default = notarizeApp;

if (require.main === module) {
  (async () => {
    await notarizeApp({ isFromMain: true });
  })();
}
