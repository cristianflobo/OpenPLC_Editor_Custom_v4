#!/bin/bash
create-dmg --volname "RSwitch" --volicon "./assets/icon.icns" --background "./assets/dmg_background.png" --window-pos 200 120 --window-size 771 395 --icon-size 160 --icon "RSwitch.app" 200 170 --app-drop-link 580 170 "RSwitch_1.0.0.dmg" "./release/build/mac/RSwitch.app"
create-dmg --volname "RSwitch" --volicon "./assets/icon.icns" --background "./assets/dmg_background.png" --window-pos 200 120 --window-size 771 395 --icon-size 160 --icon "RSwitch.app" 200 170 --app-drop-link 580 170 "RSwitch_1.0.0-ARM.dmg" "./release/build/mac-arm64/RSwitch.app"

