/**
 * The game screen.
 *
 * The GL canvas fills the screen so the scene has no seams, and the panels float
 * over it. That would hide the near pockets, so each panel measures itself and
 * reports its height to the camera rig, which frames the table into the band
 * left free rather than into the whole viewport. Change the HUD's height and the
 * framing corrects itself.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraControls } from '@/components/game/camera-controls';
import { Celebration } from '@/components/game/celebration';
import { GameControls } from '@/components/game/controls';
import { GameHud, GameOverOverlay } from '@/components/game/hud';
import { MusicHud } from '@/components/game/music-hud';
import { Palette } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { releaseMusic, useMusic } from '@/game/audio/music';
import { initSfx, releaseSfx, setSfxVolume } from '@/game/audio/sfx';
import { useTableGestures } from '@/game/input/gestures';
import { setUiInset } from '@/game/render/camera';
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

  useEffect(
    () => () => {
      setUiInset('top', 0);
      setUiInset('bottom', 0);
    },
    [],
  );

  /**
   * Audio belongs to the room, so it lives and dies with this screen. Settings
   * are pushed into the players here rather than read by them: the settings
   * store must not import the audio modules, or the two end up importing each
   * other.
   */
  useEffect(() => {
    const settings = useSettings.getState();
    setSfxVolume(settings.sfxVolume);
    useMusic.getState().setVolume(settings.musicVolume);

    let cancelled = false;
    void initSfx().then(() => {
      if (!cancelled) useMusic.getState().start();
    });

    return () => {
      cancelled = true;
      useMusic.getState().stop();
      releaseMusic();
      releaseSfx();
    };
  }, []);

  if (!world) return null;

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gestures}>
        <View style={StyleSheet.absoluteFill}>
          <GameScene />
        </View>
      </GestureDetector>

      <View
        style={[styles.hudLayer, { paddingTop: insets.top }]}
        pointerEvents="box-none"
        onLayout={(event) => setUiInset('top', event.nativeEvent.layout.height)}>
        <GameHud />
      </View>

      {/* Vertically centred, which keeps it clear of the HUD above and the
          shooting panel below whatever height either grows to. */}
      <View style={styles.cameraLayer} pointerEvents="box-none">
        <CameraControls />
      </View>

      <View
        style={[styles.controlLayer, { paddingBottom: insets.bottom + Spacing.two }]}
        pointerEvents="box-none"
        onLayout={(event) => setUiInset('bottom', event.nativeEvent.layout.height)}>
        <GameControls />
      </View>

      <Celebration />
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
  hudLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  cameraLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: Spacing.three,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  controlLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
