import { STEP_M } from '../navigation/distance'
import type { Hazard } from '../navigation/hazards'
import { turnBetween, turnPhrase } from './pdr'
import type { HomeRoute } from './routes'

/**
 * Following a taught route, the route knows what's coming (a turn, a wall, the door of the room)
 * and the camera knows what's actually there. This joins the two.
 */

/** Turns at least this sharp usually happen because a wall or a door is in the way. */
const WALL_TURN_DEG = 60

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** What comes after the current leg: ", then turn right", or ", and you'll reach the bathroom". */
export function thenPhrase(route: HomeRoute, leg: number): string {
  const next = route.legs[leg + 1]
  if (!next) return `, and you will reach the ${route.to}`
  const turn = turnPhrase(turnBetween(route.legs[leg].heading, next.heading))
  return turn ? `, then ${lowerFirst(turn)}` : ', then keep going straight'
}

/** Whether this leg was taught (or looks) like it ends facing a wall. */
function legEndsAtWall(route: HomeRoute, leg: number): boolean {
  const current = route.legs[leg]
  if (current.endsAtWall !== undefined) return current.endsAtWall
  const next = route.legs[leg + 1]
  return next !== undefined && Math.abs(turnBetween(current.heading, next.heading)) >= WALL_TURN_DEG
}

export type WallAdvice =
  /** The wall the route expects: the step count had drifted, so trust the wall instead. */
  | { kind: 'resync'; stepsLeft: number; text: string }
  /** Something is in the way that the route didn't have. */
  | { kind: 'blocked'; text: string }
  /** The expected wall, right where the route said: a confirmation. */
  | { kind: 'confirm'; text: string }

/**
 * What to say about a wall ahead while walking a leg. You can't walk through a wall, so a wall
 * closer than the steps left means either the step count drifted (the leg ends at a wall: trust
 * the wall) or something new is in the way (the leg goes on: say so).
 */
export function adviseWall(route: HomeRoute, leg: number, stepsLeft: number, wall: Hazard): WallAdvice | null {
  if (!wall.barrier || wall.side !== 'ahead' || wall.distance == null || !wall.near) return null
  const wallSteps = Math.max(1, Math.round(wall.distance / STEP_M))
  const then = thenPhrase(route, leg)
  const stepsText = `about ${wallSteps} step${wallSteps === 1 ? '' : 's'}`
  if (legEndsAtWall(route, leg)) {
    if (stepsLeft > wallSteps + 1) {
      return { kind: 'resync', stepsLeft: wallSteps, text: `Wall ahead, ${stepsText}. Walk to it${then}.` }
    }
    return { kind: 'confirm', text: `Wall ahead, ${stepsText}${then}.` }
  }
  if (stepsLeft > wallSteps + 1) {
    const gap = wall.open === 'left' || wall.open === 'right' ? ` There's space on your ${wall.open} to get around it.` : ' Feel for a way past with your hand.'
    const thing = wall.name === 'wall' ? 'a wall' : `a ${wall.name}`
    return {
      kind: 'blocked',
      text: `Stop. There is ${thing} in the way, ${stepsText} ahead, but your route goes straight on for ${stepsLeft} more steps.${gap}`,
    }
  }
  return null
}

/** For teaching: a leg ends at a wall when one was this close in its last steps. */
export const WALL_AT_END_M = 2.8
