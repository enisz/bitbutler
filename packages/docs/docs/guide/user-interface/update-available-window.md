---
title: Update Available Window
description: Details about the Update Available modal, its release notes accordion, downloads, and the in-app silent update flow.
---

# Update Available Window

![Update Available modal listing two newer releases and Linux downloads](/screenshots/update-available/update-available.png)

Whenever a check for updates finds a newer BitButler release than the one you're running, this modal opens over the main window. It happens automatically on startup if "Automatic updates" is enabled under [BitButler Settings > Startup](./settings/bitbutler-settings#startup), or any time you trigger it manually via **Help > Check for Updates** in the [application menu](./application-menu#help). If no newer release is found, no modal appears - a toast reports that you're already up to date instead.

The subtitle summarizes how far behind you are, e.g. "You're on v2.0.1, 2 versions behind the latest (v2.0.3)".

## Release Notes

Every release between your current version and the latest is listed in an accordion, newest first, each showing its version, publish date, and relative time. Only one entry is expanded at a time; expanding one collapses whichever was open. Each entry's body renders the release's Markdown changelog.

## Downloads

The **Download for `<OS>`** section lists that release's assets, filtered to the ones relevant to your platform (installer and zip on Windows, AppImage/deb/rpm/snap/tar.gz on Linux) - if none match, every asset is shown instead. Clicking an asset opens its download URL in your default browser; nothing downloads inside the app from this list. Below the list, a callout warns about code signing, with wording tailored to your platform - see [Code Signing Warnings](#code-signing-warnings).

## Code Signing Warnings

BitButler doesn't have a code-signing certificate, so none of its builds are code-signed. What that means depends on your platform:

- **Windows** - Windows SmartScreen doesn't recognize BitButler as a trusted publisher and may flag it. Downloading manually, your browser or Windows may show a "Windows protected your PC" warning before the installer runs - choose **More info > Run anyway** to continue. Updating via **Update Now** launches the downloaded installer without a wizard, so there's no dialog for you to click through if SmartScreen intervenes; it can stall or fail the automatic install, which is a known limitation of running unsigned, not a bug.
- **Linux** - installing an AppImage update needs no elevation, so it applies silently. Updating a deb or rpm install prompts for your password (via `pkexec` or a similar tool), since installing into system directories always needs elevation regardless of signing - if no such tool is available, the automatic install fails and you'll need to download and install the package manually instead.

If the automatic install stalls or fails, download and run one of the assets from the [Downloads](#downloads) list manually instead.

## Footer

![Update Available modal mid-download, showing byte counts and a progress bar](/screenshots/update-available/download-in-progress.png)

What the footer shows depends on the update state:

- **Idle** - **Update Now**, **Skip these versions**, **View Releases**, and **Close**.
- **Checking / Downloading** - a progress row replaces the buttons above, plus a **Cancel** button.
- **Downloaded** - just a "Restarting to install..." label while the app relaunches into the installer.

The modal can't be dismissed (via Close, Escape, or clicking the backdrop) while it's checking, downloading, or about to restart.

### Update Now

Only shown when BitButler can update itself in place - currently a Windows install via the NSIS installer, or a Linux AppImage, deb, or rpm install. Other builds (portable/zip on Windows, snap/tar.gz on Linux, macOS) don't show this button; use the download links instead.

Clicking it starts the in-app flow: the footer switches to a progress row showing the asset name, bytes transferred versus total, and a percentage bar while the latest release downloads. **Cancel** stops the download and returns to the idle footer. Once the download completes, the app quits and reinstalls itself and relaunches automatically - on Windows and AppImage this happens silently with no wizard; on deb/rpm you'll see a password prompt first, since installing into system directories always requires it. No further action is needed from you beyond that, unless the install is interrupted; see [Code Signing Warnings](#code-signing-warnings).

### Skip These Versions

Records the latest listed version so future **automatic** checks (on startup) won't reopen this modal until a version newer than that one is released. It has no effect on manual checks from the application menu, which always show an available update.

### View Releases

Opens the project's GitHub releases page in your default browser.
