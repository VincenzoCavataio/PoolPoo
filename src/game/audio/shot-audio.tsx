/**
 * Turns the solver's event log into sound.
 *
 * Nothing new has to be tracked: the solver already records every ball contact,
 * every cushion and every pot, each with the speed it happened at, so the audio
 * layer just walks the log and plays what it finds. Impact speed maps straight
 * onto loudness, which is why a delicate safety whispers and a break cracks.
 *
 * The cursor is reset to the log's **current length**, not to zero, whenever the
 * array is replaced. A replay is fast-forwarded headlessly to just before the
 * pot, so its log arrives already full of events that were never heard — reset
 * to zero and the replay would open with the entire shot fired off at once.
 */

import { useFrame } from '@react-three/fiber/native';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';

import type { ShotEvent } from '@/game/core/events';
import { Phase } from '@/game/rules/types';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

import { gainForImpact, playEffect } from './sfx';

export function ShotAudio() {
  const cursor = useRef(0);
  const tracked = useRef<ShotEvent[] | null>(null);
  const lastPhase = useRef<Phase>(Phase.AIMING);
  const lastBuzz = useRef(0);

  useFrame(() => {
    const { world, replay, phase, power } = useSession.getState();
    const { haptics, collisionHaptics } = useSettings.getState();

    // The cue itself: there is no solver event for it, it is the shot starting.
    if (phase === Phase.SIMULATING && lastPhase.current === Phase.AIMING) {
      playEffect('cue', 0.35 + power * 0.6);
      if (haptics) {
        void Haptics.impactAsync(
          power > 0.66
            ? Haptics.ImpactFeedbackStyle.Heavy
            : power > 0.33
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light,
        ).catch(() => undefined);
      }
    }
    lastPhase.current = phase;

    const active = replay?.world ?? world;
    if (!active) return;

    if (active.events !== tracked.current) {
      tracked.current = active.events;
      cursor.current = active.events.length;
      return;
    }

    for (let i = cursor.current; i < active.events.length; i++) {
      const event = active.events[i];

      switch (event.kind) {
        case 'ball-hit':
          playEffect('ball-hit', gainForImpact(event.speed));
          // Rate-limited hard: a break fires thirty contacts inside a couple of
          // hundred milliseconds, and thirty vibrations is a buzz, not feedback.
          if (collisionHaptics && event.speed > 0.35 && Date.now() - lastBuzz.current > 90) {
            lastBuzz.current = Date.now();
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          }
          break;

        case 'cushion-hit':
          // Rails are duller and further away; they should never dominate.
          playEffect('cushion', gainForImpact(event.speed, 2) * 0.7);
          break;

        case 'pocketed':
          playEffect('pocket', 0.85);
          if (haptics && event.ball !== 0) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
          }
          break;
      }
    }

    cursor.current = active.events.length;
  });

  return null;
}
