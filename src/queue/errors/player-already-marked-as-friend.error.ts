import { PlayerId } from '@/players/types/player-id';

export class PlayerAlreadyMarkedAsFriendError extends Error {
  constructor(public playerId: PlayerId) {
    super(`player ${playerId} is already marked as friend by another player`);
  }
}
