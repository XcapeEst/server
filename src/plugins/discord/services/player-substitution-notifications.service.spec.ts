import { Environment } from '@/environment/environment';
import { Events } from '@/events/events';
import { Game, GameDocument, gameSchema } from '@/games/models/game';
import { GameState } from '@/games/models/game-state';
import { SlotStatus } from '@/games/models/slot-status';
import { GamesService } from '@/games/services/games.service';
import { Player, playerSchema } from '@/players/models/player';
import { PlayersService } from '@/players/services/players.service';
import { PlayerId } from '@/players/types/player-id';
import { mongooseTestingModule } from '@/utils/testing-mongoose-module';
import { CacheModule } from '@nestjs/cache-manager';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Message } from 'discord.js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { DiscordService } from './discord.service';
import { PlayerSubstitutionNotificationsService } from './player-substitution-notifications.service';
// eslint-disable-next-line jest/no-mocks-import
import { DiscordService as DiscordServiceMock } from './__mocks__/discord.service';

jest.mock('./discord.service');
jest.mock('@/environment/environment');
jest.mock('@/games/services/games.service');
jest.mock('@/players/services/players.service');

describe('PlayerSubstitutionNotificationsService', () => {
  let service: PlayerSubstitutionNotificationsService;
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let gamesService: GamesService;
  let events: Events;
  let discordService: DiscordServiceMock;
  let playersService: PlayersService;
  let environment: jest.Mocked<Environment>;

  beforeAll(async () => (mongod = await MongoMemoryServer.create()));
  afterAll(async () => await mongod.stop());

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        mongooseTestingModule(mongod),
        MongooseModule.forFeature([
          { name: Game.name, schema: gameSchema },
          {
            name: Player.name,
            schema: playerSchema,
          },
        ]),
        CacheModule.register(),
      ],
      providers: [
        PlayerSubstitutionNotificationsService,
        Events,
        DiscordService,
        Environment,
        GamesService,
        PlayersService,
      ],
    }).compile();

    service = module.get<PlayerSubstitutionNotificationsService>(
      PlayerSubstitutionNotificationsService,
    );
    connection = module.get(getConnectionToken());
    gamesService = module.get(GamesService);
    events = module.get(Events);
    discordService = module.get(DiscordService);
    playersService = module.get(PlayersService);
    environment = module.get(Environment);
  });

  beforeEach(() => service.onModuleInit());

  afterEach(async () => {
    // @ts-expect-error
    await gamesService._reset();
    // @ts-expect-error
    await playersService._reset();
    await connection.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('when substituteRequested event is emitted', () => {
    let game: Game;
    let player: Player;

    beforeEach(async () => {
      // @ts-expect-error
      player = await playersService._createOne();
      // @ts-expect-error
      game = await gamesService._createOne([player]);

      Object.defineProperty(
        environment,
        'discordQueueNotificationsMentionRole',
        {
          get: jest.fn().mockReturnValue('TF2 gamers'),
        },
      );

      Object.defineProperty(environment, 'clientUrl', {
        get: jest.fn().mockReturnValue('http://fake.client'),
      });
    });

    it('should notify all players', () =>
      new Promise<void>((resolve) => {
        const channel = discordService.getPlayersChannel();
        channel.send.mockImplementation(() => {
          expect(channel.send).toHaveBeenCalledWith({
            content: '&<TF2 gamers>',
            embeds: [expect.any(Object)],
          });
          setImmediate(() => resolve());
          return {
            id: 'FAKE_MESSAGE_ID',
          };
        });

        events.substituteRequested.next({
          gameId: game._id,
          playerId: player._id,
        });
      }));
  });

  describe('when a notification is already sent', () => {
    let game: GameDocument;
    let player: Player;
    let message: jest.Mocked<Message>;

    beforeEach(async () => {
      // @ts-expect-error
      player = await playersService._createOne();
      // @ts-expect-error
      game = await gamesService._createOne([player]);

      Object.defineProperty(
        environment,
        'discordQueueNotificationsMentionRole',
        {
          get: jest.fn().mockReturnValue('TF2 gamers'),
        },
      );
      Object.defineProperty(environment, 'clientUrl', {
        get: jest.fn().mockReturnValue('http://fake.client'),
      });
    });

    beforeEach(
      () =>
        new Promise<void>((resolve) => {
          const channel = discordService.getPlayersChannel();
          const originalSend = channel.send;
          channel.send.mockImplementationOnce(async (...args) => {
            setImmediate(() => resolve());
            message = await originalSend(channel, ...args);
            return message;
          });

          events.substituteRequested.next({
            gameId: game._id,
            playerId: player._id,
          });
        }),
    );

    describe('when the game ends', () => {
      beforeEach(async () => {
        game.slots[0].status = SlotStatus.waitingForSubstitute;
        await game.save();
        await gamesService.update(game.id, { state: GameState.ended });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      it('should remove the notification', () => {
        expect(message.delete).toHaveBeenCalled();
      });
    });

    describe('when the substitute request is canceled', () => {
      beforeEach(() => {
        events.substituteRequestCanceled.next({
          gameId: game._id,
          playerId: player._id,
        });
      });

      it('should remove the notification', () => {
        expect(message.delete).toHaveBeenCalled();
      });
    });

    describe('when the player is replaced', () => {
      beforeEach(() => {
        events.playerReplaced.next({
          gameId: game.id,
          replaceeId: player._id,
          replacementId: new Types.ObjectId() as PlayerId,
        });
      });

      it('should remove the notification', () => {
        expect(message.delete).toHaveBeenCalled();
      });
    });
  });
});
