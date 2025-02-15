import { Test, TestingModule } from '@nestjs/testing';
import { GamesGateway } from './games.gateway';
import { PlayerSubstitutionService } from '../services/player-substitution.service';
import { Events } from '@/events/events';
import { GameDocument } from '../models/game';
import { Socket } from 'socket.io';
import { Player } from '@/players/models/player';
import { Types } from 'mongoose';
import { PlayerId } from '@/players/types/player-id';
import { GameId } from '../game-id';
import { PlayersService } from '@/players/services/players.service';
import { ConfigurationService } from '@/configuration/services/configuration.service';
import { PlayerBansService } from '@/players/services/player-bans.service';

jest.mock('../services/player-substitution.service');
jest.mock('socket.io');
jest.mock('@/players/services/players.service', () => ({
  PlayersService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@/configuration/services/configuration.service');
jest.mock('@/players/services/player-bans.service');

const mockGame = {
  id: 'FAKE_GAME_ID',
  state: 'launching',
} as GameDocument;

describe('GamesGateway', () => {
  let gateway: GamesGateway;
  let playerSubstitutionService: jest.Mocked<PlayerSubstitutionService>;
  let events: Events;
  let socket: jest.Mocked<Socket>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesGateway,
        PlayerSubstitutionService,
        Events,
        PlayersService,
        ConfigurationService,
        PlayerBansService,
      ],
    }).compile();

    gateway = module.get<GamesGateway>(GamesGateway);
    playerSubstitutionService = module.get(PlayerSubstitutionService);
    events = module.get(Events);
  });

  beforeEach(() => {
    playerSubstitutionService.replacePlayer.mockResolvedValue(mockGame);
    socket = {
      emit: jest.fn(),
    } as any;
  });

  beforeEach(() => {
    gateway.onModuleInit();
    gateway.afterInit(socket);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('#replacePlayer()', () => {
    it('should replace the player', async () => {
      const gameId = new Types.ObjectId() as GameId;
      const replaceeId = new Types.ObjectId() as PlayerId;
      const replacementId = new Types.ObjectId() as PlayerId;
      const ret = await gateway.replacePlayer(
        {
          user: { _id: replacementId } as Player,
        } as Socket,
        { gameId: gameId.toString(), replaceeId: replaceeId.toString() },
      );
      expect(playerSubstitutionService.replacePlayer).toHaveBeenCalledWith(
        gameId,
        replaceeId,
        replacementId,
      );
      expect(ret).toEqual(mockGame as any);
    });
  });

  describe('when the gameCreated event is emitted', () => {
    beforeEach(() => {
      events.gameCreated.next({ game: mockGame });
    });

    it('should emit the created game via the socket', () => {
      expect(socket.emit).toHaveBeenCalledWith('game created', mockGame);
    });
  });

  describe('when the gameChanges event is emitted', () => {
    beforeEach(() => {
      events.gameChanges.next({ newGame: mockGame, oldGame: mockGame });
    });

    it('should emit the created game via the socket', () => {
      expect(socket.emit).toHaveBeenCalledWith('game updated', mockGame);
    });
  });
});
