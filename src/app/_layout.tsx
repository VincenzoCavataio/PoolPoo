import { Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TableBackdrop } from '@/components/ui/table-backdrop';
import {
  releaseMenuMusic,
  setMenuMusicVolume,
  startMenuMusic,
  stopMenuMusic,
} from '@/game/audio/menu-music';
import { initSfx, releaseSfx, setSfxVolume } from '@/game/audio/sfx';
import { useSettings } from '@/store/settings';
import { Palette } from '@/constants/game-theme';

// The splash stays up until the title screen has mounted and hides it, so the
// player never sees a blank frame while the GL context warms up.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  /**
   * Sound effects belong to the app, not to a game.
   *
   * They used to be loaded and released by the game screen, which meant the
   * menus had nothing to play — `playEffect` returns quietly when the pools are
   * empty, so the taps were simply silent. Loading here costs one set of buffers
   * for the lifetime of the app and makes the same sounds available everywhere.
   *
   * Music stays with the game screen: that genuinely is per-session.
   */
  useEffect(() => {
    setSfxVolume(useSettings.getState().sfxVolume);
    void initSfx();
    return releaseSfx;
  }, []);

  /**
   * The menu theme plays everywhere except at the table.
   *
   * Driven from the route rather than started and stopped by each screen: there
   * are four screens that want it and one that does not, and a rule reading
   * "not the game" cannot fall out of step the way four matching pairs of calls
   * would.
   */
  const pathname = usePathname();
  const inGame = pathname === '/game';

  useEffect(() => {
    setMenuMusicVolume(useSettings.getState().musicVolume);
    if (inGame) stopMenuMusic();
    else startMenuMusic();
  }, [inGame]);

  useEffect(() => releaseMenuMusic, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Palette.background }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {/*
          One backdrop for the whole app, behind the navigator.

          It has to live here rather than on each screen. Expo Router's stack
          keeps the screens beneath the current one mounted, so a canvas per
          screen would mean up to four GL contexts alive at once by the time the
          player reaches the table — each with its own drawing buffer, and each
          still rendering thirty times a second underneath the one on top.

          Mounted once, it costs a single context that is created when the app
          starts and never rebuilt. Screens are drawn transparent over it, and
          the game screen paints its own background across the top.
        */}
        <TableBackdrop />

        <Stack
          screenOptions={{
            headerShown: false,
            /**
             * No screen transition of its own.
             *
             * The screens are transparent over a shared 3D backdrop, so a cross
             * fade shows both of them at once — the outgoing menu at 60% and the
             * incoming one at 40%, stacked, with the table visible through both.
             * For a few frames it reads as a glitch.
             *
             * The motion between screens is the camera move behind them and each
             * screen's own entry animation. Those are enough, and they do not
             * overlap: the swap is instant, the content eases in.
             */
            animation: 'none',
            // Transparent, so the shared backdrop shows through. The game screen
            // sets its own opaque background.
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
