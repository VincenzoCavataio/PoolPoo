/**
 * Trophy detection. `npm run test:trophies`
 *
 * The detector is where a trophy feature goes wrong quietly. A missed unlock is
 * a disappointment; a false one is worse, because it devalues every other trophy
 * and cannot be taken back once somebody has it. Both are hard to find by
 * playing — you would have to reach the exact shot — and easy to state here.
 *
 * The catalogue is checked too. An id that two trophies share, or a translation
 * key with nothing behind it, is a trophy that can never be displayed properly,
 * and neither shows up until somebody earns the thing.
 */

import { assert, report, suite, test } from '../../core/tests/harness';

import type { ShotEvent } from '../../core/events';
import { NO_SPIN } from '../../core/world';
import { emptyOutcome, GameModeKind, type ShotOutcome } from '../../rules/types';
import { TROPHIES } from '../catalogue';
import { detectShot, emptyRunState, type ShotFacts } from '../detect';
import { it } from '../../../i18n/it';
import { en } from '../../../i18n/en';

/** A shot that did nothing at all, for tests to change one thing about. */
function shot(over: Partial<ShotFacts> = {}): ShotFacts {
  return {
    events: [],
    outcome: emptyOutcome(),
    spin: NO_SPIN,
    power: 0.6,
    isBreak: false,
    wonGame: false,
    players: 2,
    winnerScore: 0,
    runnerUpScore: 0,
    mode: GameModeKind.FREE,
    call: null,
    contactDistance: null,
    cpus: [],
    // A person unless a test says otherwise: the computer's own visits earn
    // nothing, and defaulting the other way would make every test assert that.
    shooterIsHuman: true,
    hasPartner: false,
    ownTeamSize: 1,
    otherTeamSize: 1,
    clearedGroup: false,
    reracked: false,
    target: 0,
  ...over,
  };
}

function potting(balls: number[], over: Partial<ShotOutcome> = {}): ShotOutcome {
  return { ...emptyOutcome(), pocketed: balls, ...over };
}

/** Runs one shot against a fresh game and returns what it awarded. */
function awardsFor(facts: ShotFacts): string[] {
  return detectShot(facts, emptyRunState()).awards.award;
}

suite('the trophy catalogue', () => {
  test('every id is unique', () => {
    const seen = new Set<string>();
    for (const trophy of TROPHIES) {
      assert(!seen.has(trophy.id), `two trophies share the id ${trophy.id}`);
      seen.add(trophy.id);
    }
  });

  test('every trophy has both of its strings, in both languages', () => {
    for (const trophy of TROPHIES) {
      for (const key of [trophy.labelKey, trophy.hintKey]) {
        assert(key in it, `${trophy.id}: ${key} is missing from Italian`);
        assert(key in en, `${trophy.id}: ${key} is missing from English`);
      }
    }
  });

  test('a counted trophy asks for more than one', () => {
    for (const trophy of TROPHIES) {
      if (trophy.target === undefined) continue;
      assert(trophy.target > 1, `${trophy.id} is counted but its target is ${trophy.target}`);
    }
  });
});

suite('what a shot earns', () => {
  test('playing at all earns the first shot', () => {
    assert(awardsFor(shot()).includes('first-shot'), 'a shot is a shot');
  });

  test('a miss earns nothing else', () => {
    const awards = awardsFor(shot());
    assert(!awards.includes('first-pot'), 'nothing was potted');
    assert(!awards.includes('double-pot'), 'nothing was potted');
  });

  test('one ball is a pot, two is a double, three is a treble', () => {
    const one = awardsFor(shot({ outcome: potting([3]) }));
    assert(one.includes('first-pot'), 'one ball should be a first pot');
    assert(!one.includes('double-pot'), 'one ball is not a double');

    const two = awardsFor(shot({ outcome: potting([3, 5]) }));
    assert(two.includes('double-pot'), 'two balls should be a double');
    assert(!two.includes('triple-pot'), 'two balls is not a treble');

    const three = awardsFor(shot({ outcome: potting([3, 5, 7]) }));
    assert(three.includes('double-pot'), 'a treble is also a double');
    assert(three.includes('triple-pot'), 'three balls should be a treble');
  });

  /**
   * Side has to be deliberate.
   *
   * The trophy is for meaning to use spin, so the threshold sits well past
   * anything a thumb reaches by accident on the way to a straight shot.
   */
  test('a trace of side is not a spin shot', () => {
    const awards = awardsFor(
      shot({ outcome: potting([3]), spin: { side: 0.2, vertical: 0 } }),
    );
    assert(!awards.includes('spin-pot'), 'a fifth of a radius is a wobble, not side');
  });

  test('heavy side, either way, is', () => {
    for (const side of [0.8, -0.8]) {
      const awards = awardsFor(shot({ outcome: potting([3]), spin: { side, vertical: 0 } }));
      assert(awards.includes('spin-pot'), `side of ${side} should count`);
    }
  });

  test('side without a pot earns nothing', () => {
    const awards = awardsFor(shot({ spin: { side: 0.9, vertical: 0 } }));
    assert(!awards.includes('spin-pot'), 'the shot has to go in');
  });

  /**
   * The cushion has to come before the pot.
   *
   * Judged on order, not on presence: a ball that rattles the jaws on its way
   * down produces a cushion event too, and counting that would hand the trophy
   * out for every scrappy pot.
   */
  test('a cushion after the pot does not count', () => {
    const events: ShotEvent[] = [
      { kind: 'pocketed', t: 1.0, ball: 3, pocket: 'corner-nw' },
      { kind: 'cushion-hit', t: 1.4, ball: 0, cushion: 0, speed: 1 },
    ];
    const awards = awardsFor(shot({ events, outcome: potting([3]) }));
    assert(!awards.includes('cushion-pot'), 'the cushion came afterwards');
  });

  test('a cushion before the pot does', () => {
    const events: ShotEvent[] = [
      { kind: 'cushion-hit', t: 0.4, ball: 0, cushion: 0, speed: 3 },
      { kind: 'pocketed', t: 1.0, ball: 3, pocket: 'corner-nw' },
    ];
    const awards = awardsFor(shot({ events, outcome: potting([3]) }));
    assert(awards.includes('cushion-pot'), 'the cue ball found a cushion first');
  });

  test('an object ball finding a cushion is not the player doing it', () => {
    const events: ShotEvent[] = [
      { kind: 'cushion-hit', t: 0.4, ball: 3, cushion: 0, speed: 3 },
      { kind: 'pocketed', t: 1.0, ball: 3, pocket: 'corner-nw' },
    ];
    const awards = awardsFor(shot({ events, outcome: potting([3]) }));
    assert(!awards.includes('cushion-pot'), 'only the cue ball counts');
  });

  test('a ball off the table is a hidden trophy', () => {
    const outcome = { ...emptyOutcome(), ballsLeftTable: [7] };
    assert(awardsFor(shot({ outcome })).includes('off-the-table'), 'that is the secret');
  });
});

suite('what a game earns', () => {
  test('a win with no fouls is a clean game', () => {
    const awards = awardsFor(shot({ wonGame: true, outcome: potting([8]) }));
    assert(awards.includes('first-win'), 'winning is winning');
    assert(awards.includes('clean-game'), 'no foul was committed');
  });

  test('a foul anywhere in the game costs the clean sheet', () => {
    const run = emptyRunState();
    const fouled = detectShot(shot({ outcome: { ...emptyOutcome(), foul: true } }), run).run;

    const awards = detectShot(shot({ wonGame: true }), fouled).awards.award;
    assert(!awards.includes('clean-game'), 'a foul earlier in the game still counts');
    assert(awards.includes('first-win'), 'the win itself still stands');
  });

  test('potting the cue ball costs the no-scratch, even much earlier', () => {
    const run = emptyRunState();
    const scratched = detectShot(
      shot({ outcome: { ...emptyOutcome(), cueBallNeedsRespot: true } }),
      run,
    ).run;

    const awards = detectShot(shot({ wonGame: true }), scratched).awards.award;
    assert(!awards.includes('no-scratch'), 'the cue ball went down at some point');
  });

  test('a shutout needs somebody to shut out', () => {
    const solo = awardsFor(
      shot({ wonGame: true, players: 1, winnerScore: 5, runnerUpScore: 0 }),
    );
    assert(!solo.includes('shutout'), 'there was nobody else playing');

    const real = awardsFor(
      shot({ wonGame: true, players: 2, winnerScore: 5, runnerUpScore: 0 }),
    );
    assert(real.includes('shutout'), 'the other player never scored');

    const close = awardsFor(
      shot({ wonGame: true, players: 2, winnerScore: 5, runnerUpScore: 1 }),
    );
    assert(!close.includes('shutout'), 'they scored once');
  });
});

suite('a run of scoring shots', () => {
  /** Plays a sequence, returning everything awarded along the way. */
  function play(scoring: boolean[]): string[] {
    let run = emptyRunState();
    const all: string[] = [];

    for (const scored of scoring) {
      const result = detectShot(
        shot({ outcome: scored ? potting([3]) : emptyOutcome() }),
        run,
      );
      run = result.run;
      all.push(...result.awards.award);
    }

    return all;
  }

  test('three in a row is a run', () => {
    assert(!play([true, true]).includes('run-of-three'), 'two is not three');
    assert(play([true, true, true]).includes('run-of-three'), 'three in a row');
  });

  test('a miss breaks it', () => {
    const awards = play([true, true, false, true, true]);
    assert(!awards.includes('run-of-three'), 'the miss started the count again');
  });

  test('six in a row is the hidden one', () => {
    assert(!play([true, true, true, true, true]).includes('long-run'), 'five is not six');
    assert(play([true, true, true, true, true, true]).includes('long-run'), 'six in a row');
  });
});


// -------------------------------------------------------------- new ground

/**
 * The trophies that came with the four disciplines.
 *
 * These are the ones most likely to fire when they should not, because each
 * depends on state the detector is *told* about rather than state it can read
 * off the event log: which mode, whose turn, whether a rack went up. A fact
 * wired to the wrong place is invisible until somebody earns a trophy they did
 * not deserve.
 */
suite('what the disciplines earn', () => {
  const pot = (ball: number, pocket = 'corner-ne'): ShotEvent => ({
    kind: 'pocketed',
    t: 0.5,
    ball,
    pocket: pocket as never,
  });

  test('a computer earns nothing on its own visit', () => {
    const earned = awardsFor(
      shot({
        shooterIsHuman: false,
        outcome: potting([1, 2, 3]),
        wonGame: true,
        events: [pot(1), pot(2), pot(3)],
      }),
    );
    assert(earned.length === 0, `a machine earned ${earned.join(', ')}`);
  });

  test('four balls at once is its own trophy', () => {
    const earned = awardsFor(shot({ outcome: potting([1, 2, 3, 4]) }));
    assert(earned.includes('quad-pot'), 'quad-pot');
    assert(earned.includes('triple-pot'), 'and the ones below it');
  });

  test('three on the break is a big break', () => {
    const earned = awardsFor(shot({ isBreak: true, outcome: potting([1, 2, 3]) }));
    assert(earned.includes('big-break'), 'big-break');
  });

  test('two on the break is not', () => {
    const earned = awardsFor(shot({ isBreak: true, outcome: potting([1, 2]) }));
    assert(!earned.includes('big-break'), 'big-break should need three');
    assert(earned.includes('break-pot'), 'but it is still a pot on the break');
  });

  test('a long pot needs the distance, a short one does not qualify', () => {
    const near = awardsFor(shot({ outcome: potting([1]), contactDistance: 0.4 }));
    assert(!near.includes('long-pot'), 'a short pot is not a long one');

    const far = awardsFor(shot({ outcome: potting([1]), contactDistance: 1.5 }));
    assert(far.includes('long-pot'), 'long-pot');
  });

  test('a gentle pot is a touch shot, a firm one is not', () => {
    const soft = awardsFor(shot({ outcome: potting([1]), power: 0.15 }));
    assert(soft.includes('soft-touch'), 'soft-touch');

    const firm = awardsFor(shot({ outcome: potting([1]), power: 0.8 }));
    assert(!firm.includes('soft-touch'), 'a firm shot is not a touch shot');
  });

  test('draw counts, follow does not', () => {
    const drawn = awardsFor(
      shot({ outcome: potting([1]), spin: { side: 0, vertical: -0.8 } }),
    );
    assert(drawn.includes('draw-pot'), 'draw-pot');

    const followed = awardsFor(
      shot({ outcome: potting([1]), spin: { side: 0, vertical: 0.8 } }),
    );
    assert(!followed.includes('draw-pot'), 'follow is not draw');
  });

  test('the called trophies need the pocket to match, not just the ball', () => {
    const wrong = awardsFor(
      shot({
        mode: GameModeKind.EIGHT_CALLED,
        call: { ball: 3, pocket: 'side-n' as never },
        outcome: potting([3]),
        events: [pot(3, 'corner-sw')],
      }),
    );
    assert(!wrong.includes('called-side-pocket'), 'the wrong pocket earns nothing');

    const right = awardsFor(
      shot({
        mode: GameModeKind.EIGHT_CALLED,
        call: { ball: 3, pocket: 'side-n' as never },
        outcome: potting([3]),
        events: [pot(3, 'side-n')],
      }),
    );
    assert(right.includes('called-side-pocket'), 'called-side-pocket');
  });

  test('a re-rack is only claimed when one happened', () => {
    const without = awardsFor(shot({ mode: GameModeKind.STRAIGHT, outcome: potting([1]) }));
    assert(!without.includes('straight-rerack'), 'no rack, no trophy');

    const with_ = awardsFor(
      shot({ mode: GameModeKind.STRAIGHT, outcome: potting([1]), reracked: true }),
    );
    assert(with_.includes('straight-rerack'), 'straight-rerack');
  });

  test('a run across the rack needs both the run and the rack', () => {
    let run = emptyRunState();
    // First pot, and the rack goes up with it.
    run = detectShot(
      shot({ mode: GameModeKind.STRAIGHT, outcome: potting([1]), reracked: true }),
      run,
    ).run;
    // Second pot, carrying the run on into the new rack.
    const second = detectShot(
      shot({ mode: GameModeKind.STRAIGHT, outcome: potting([2]) }),
      run,
    );
    assert(
      second.awards.award.includes('straight-across-racks'),
      'straight-across-racks',
    );
  });

  test('a miss ends the run and the rack it crossed', () => {
    let run = emptyRunState();
    run = detectShot(
      shot({ mode: GameModeKind.STRAIGHT, outcome: potting([1]), reracked: true }),
      run,
    ).run;
    // A miss.
    run = detectShot(shot({ mode: GameModeKind.STRAIGHT }), run).run;
    const after = detectShot(shot({ mode: GameModeKind.STRAIGHT, outcome: potting([2]) }), run);
    assert(
      !after.awards.award.includes('straight-across-racks'),
      'a broken run does not cross anything',
    );
  });

  test('beating a mixed table credits only the hardest machine', () => {
    const earned = awardsFor(
      shot({ wonGame: true, cpus: ['easy', 'easy', 'hard'], outcome: potting([1]) }),
    );
    assert(earned.includes('beat-hard'), 'beat-hard');
    assert(!earned.includes('beat-easy'), 'the easy ones do not also count');
    assert(!earned.includes('beat-medium'), 'nor a medium that was not there');
    assert(earned.includes('beat-three-cpus'), 'three machines at the table');
  });

  test('a win between people credits no computer at all', () => {
    const earned = awardsFor(shot({ wonGame: true, cpus: [], outcome: potting([1]) }));
    assert(!earned.includes('beat-easy'), 'nobody to beat');
    assert(!earned.includes('beat-hard'), 'nobody to beat');
  });

  test('the outnumbered win needs to actually be outnumbered', () => {
    const even = awardsFor(
      shot({
        mode: GameModeKind.EIGHT,
        wonGame: true,
        ownTeamSize: 2,
        otherTeamSize: 2,
        outcome: potting([8]),
      }),
    );
    assert(!even.includes('eight-outnumbered'), 'two against two is not outnumbered');

    const alone = awardsFor(
      shot({
        mode: GameModeKind.EIGHT,
        wonGame: true,
        ownTeamSize: 1,
        otherTeamSize: 2,
        outcome: potting([8]),
      }),
    );
    assert(alone.includes('eight-outnumbered'), 'eight-outnumbered');
  });

  test('potting the black early is the hidden mistake, not the win', () => {
    const earned = awardsFor(
      shot({
        mode: GameModeKind.EIGHT,
        outcome: { ...potting([8]), gameOver: true },
        wonGame: false,
      }),
    );
    assert(earned.includes('own-goal'), 'own-goal');
    assert(!earned.includes('eight-on-the-black'), 'losing is not winning on the black');
  });

  test('mode trophies do not leak between disciplines', () => {
    const free = awardsFor(shot({ mode: GameModeKind.FREE, wonGame: true, outcome: potting([1]) }));
    assert(!free.includes('eight-first-win'), 'free play is not eight-ball');
    assert(!free.includes('straight-first-win'), 'free play is not straight pool');
    assert(!free.includes('called-first-win'), 'free play is not the called game');
  });

  test('both ends needs pockets at opposite ends', () => {
    const sameEnd = awardsFor(
      shot({ outcome: potting([1, 2]), events: [pot(1, 'corner-ne'), pot(2, 'corner-se')] }),
    );
    assert(!sameEnd.includes('both-ends'), 'both pockets were at the same end');

    const opposite = awardsFor(
      shot({ outcome: potting([1, 2]), events: [pot(1, 'corner-ne'), pot(2, 'corner-sw')] }),
    );
    assert(opposite.includes('both-ends'), 'both-ends');
  });
});

report();
