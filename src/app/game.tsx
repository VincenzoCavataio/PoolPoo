/**
 * The game screen.
 *
 * The table is a framed panel with the interface stacked around it, rather than
 * a full-bleed canvas with controls floating on top. That is a layout decision,
 * but it settles a rendering one too: the canvas used to run edge to edge and
 * the near pockets ended up behind the panels, so every panel measured itself
 * and the camera skewed its projection to frame the table into whatever band was
 * left. With the canvas occupying only the space it is given, none of that is
 * needed — what you see is the whole viewport, and the framing is honest.
 *
 * The rows, top to bottom: a title bar with the way out and whose turn it is,
 * the table itself, a row of view controls tucked under it, and the shooting
 * panel.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AidToggles } from '@/components/game/aid-toggles';
import { CameraControls } from '@/components/game/camera-controls';
import { Celebration } from '@/components/game/celebration';
import { GameControls } from '@/components/game/controls';
import { CallPicker } from '@/components/game/call-picker';
import { FullBoard, GameHud, GameOverOverlay, ShotNote } from '@/components/game/hud';
import { MusicHud } from '@/components/game/music-hud';
import { TrophyBanner } from '@/components/game/trophy-banner';
import { Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { releaseMusic, useMusic } from '@/game/audio/music';
import { useTableGestures } from '@/game/input/gestures';
import { GameScene } from '@/game/render/scene';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

export default function GameScreen() {
  const router = useRouter();
  const world = useSession((s) => s.world);
  const gestures = useTableGestures();
  const insets = useSafeAreaInsets();

  // Reachable by deep link or a reload with no game in memory.
  useEffect(() => {
    if (!world) router.replace('/menu');
  }, [world, router]);

  /**
   * Audio belongs to the room, so it lives and dies with this screen. Settings
   * are pushed into the players here rather than read by them: the settings
   * store must not import the audio modules, or the two end up importing each
   * other.
   */
  useEffect(() => {
    // Effects are loaded once at the root — the menus use them too — so this
    // only has to start the music, which does belong to a game in progress.
    useMusic.getState().setVolume(useSettings.getState().musicVolume);
    useMusic.getState().start();

    return () => {
      useMusic.getState().stop();
      releaseMusic();
    };
  }, []);

  if (!world) return null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <GameHud />

      {/* The table. `flex: 1` hands it every point the rows above and below do
          not claim, so the board grows on a tall phone instead of the layout
          having to guess a height. */}
      <View style={styles.stage}>
        <GestureDetector gesture={gestures}>
          <View style={styles.canvas}>
            <GameScene />
          </View>
        </GestureDetector>

        {/* Inside the stage so they stay pinned to the table's own edges rather
            than the screen's, and the celebration reads as happening on the
            board. */}
        <ShotNote />
        <AidToggles />
        <CameraControls />
        <Celebration />
      </View>

      <View style={[styles.controlLayer, { paddingBottom: insets.bottom + Spacing.two }]}>
        {/* Above the controls, because it has to be answered before they are any
            use — in the called games a shot taken without a call is a foul. */}
        <CallPicker />
        <GameControls />
      </View>

      {/* At the root, so it covers the table rather than being clipped to the
          header the button lives in. */}
      <FullBoard />

      <TrophyBanner />
      <MusicHud />
      <GameOverOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.background,
  },

  /**
   * The window the table is played through.
   *
   * Clipped, outlined and rounded, so it reads as a board set into the screen.
   * `overflow: 'hidden'` is what does the cutting — without it the GL surface
   * spills past the rounded corners on Android.
   */
  stage: {
    flex: 1,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
    backgroundColor: Palette.background,
  },
  canvas: {
    flex: 1,
  },
  controlLayer: {
    // No longer absolutely positioned: it is a row in the stack now, so the
    // table above it shrinks to make room instead of hiding behind it.
    paddingTop: Spacing.one,
  },
});
