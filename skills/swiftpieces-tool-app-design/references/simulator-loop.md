# The simulator loop and final checklist

## Build, install, launch

Run from the folder with the `.xcodeproj`. Use the scheme the user builds with.

```bash
SIM="iPhone 17 Pro"   # pick an installed one: xcrun simctl list devices available
xcodebuild -scheme Harbor -destination "platform=iOS Simulator,name=$SIM" -derivedDataPath build build
xcrun simctl boot "$SIM" 2>/dev/null; open -a Simulator
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/Harbor.app
xcrun simctl launch booted com.example.harbor
```

If it does not build, that is the first finding. Fix the build before judging anything.

## Conditions to capture

```bash
xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4
xcrun simctl ui booted appearance light;  xcrun simctl io booted screenshot light.png
xcrun simctl ui booted appearance dark;   xcrun simctl io booted screenshot dark.png
xcrun simctl ui booted content_size accessibility-extra-extra-extra-large; xcrun simctl io booted screenshot ax5.png
xcrun simctl ui booted content_size large   # back to default
```

Reduce Motion and Reduce Transparency: toggle in the simulator's Settings, Accessibility, Motion (or the Accessibility Inspector) and repeat the flow.

Read every screenshot at 100% zoom. Look for alignment, optical centring, rhythm, truncation, contrast and the scrolled-under-the-status-bar state.

## Recording the full-motion pass

```bash
xcrun simctl io booted recordVideo --codec h264 --force flow.mov &   # stop with Ctrl-C or kill -INT
# drive the flow: a UI test (xcodebuild test -only-testing:HarborUITests/FlowTests/testOnboarding) or by hand
kill -INT %1

mkdir -p frames && ffmpeg -loglevel error -i flow.mov -vf fps=30 frames/%04d.png
ffmpeg -loglevel error -i flow.mov -vf "fps=10,scale=300:-1,tile=8x6" sheet_%02d.png   # contact sheets to scan
```

A UI test that walks the flow is worth writing for any flow you will revisit: it makes the recording repeatable and doubles as a regression test. Give custom controls `accessibilityIdentifier`s so the test can find them.

What to hunt frame by frame: a frame in the wrong theme or unstyled, a colour pop as a surface appears, layout that jumps after first paint, a spring overshooting into neighbouring content, a keyboard jump-cut, a sheet that snaps instead of following the finger. Frame rate is measured on a device in Release (see performance.md), not judged from the simulator recording.

## Anti-slop pre-flight greps

Run over the files you wrote, excluding theme definitions (`SwiftPieces/DesignSystem/`, your `Theme.swift`):

```bash
F=$(git diff --name-only --diff-filter=AM -- '*.swift' | grep -v DesignSystem)
grep -nE 'Color\((red|hue|white):|Color\(hex|0x[0-9A-Fa-f]{6}|Color\.(blue|purple|indigo|pink|teal|cyan)' $F   # literal colours
grep -nE '\.font\(\.system\(size:' $F                                       # sizes that break Dynamic Type
grep -nE 'cornerRadius: [0-9]|RoundedRectangle\(cornerRadius: [0-9]' $F      # radii outside the scale
grep -nE '(Linear|Radial|Angular|Mesh)Gradient' $F                          # gradients: each needs a brand reason
grep -nE 'colorScheme ==' $F                                                # colour picked by scheme
rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' $F                             # emoji in UI strings (rg: macOS grep has no -P)
grep -nE 'onTapGesture' $F                                                  # should most of these be Buttons?
grep -rhoE 'Button\("[^"]+"' $F | sort | uniq -c | sort -rn                 # labels: one per intent
```

Every hit is either fixed or has a written reason.

## Device matrix

| Check | Devices |
| --- | --- |
| Layout | Smallest supported (iPhone SE 3rd gen or iPhone 16e), a standard 6.1", the largest Pro Max |
| Dynamic Island and notch | One of each if the deployment target allows |
| Text size | Default, xSmall, AX5 |
| Appearance | Light, dark, Increase Contrast |
| Accessibility | Reduce Motion, Reduce Transparency, VoiceOver pass over the flow |
| Performance | Oldest supported physical device, Release build |
| iPad | Only if the target supports it: split view and both orientations |

## Final checklist

- [ ] Builds clean with no new warnings
- [ ] Light, dark and AX5 screenshots read at 100%, with no clipping or truncation of meaning
- [ ] Content scrolled under the status bar and Dynamic Island looks deliberate
- [ ] Bottom actions clear the home indicator and ride the keyboard
- [ ] Full flow recorded and scrubbed, every back path tried, every one-way door holds
- [ ] Empty, loading, error and long-content states seen running, not just written
- [ ] Pre-flight greps clean or justified
- [ ] VoiceOver reads every control with a label, value and trait, in a sensible order
- [ ] Reduce Motion turns spatial motion into fades and stops ambient loops
- [ ] Release build on the oldest supported device holds 60 fps through the hero flow
