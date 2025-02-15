import { AppModule } from '@/app.module';
import { JwtTokenPurpose } from '@/auth/jwt-token-purpose';
import { AuthService } from '@/auth/services/auth.service';
import { configureApplication } from '@/configure-application';
import { GameId } from '@/games/game-id';
import { GamesService } from '@/games/services/games.service';
import { PlayersService } from '@/players/services/players.service';
import { Tf2ClassName } from '@/shared/models/tf2-class-name';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import * as request from 'supertest';
import { players } from './test-data';
import { waitABit } from './utils/wait-a-bit';
import { waitForTheGameToLaunch } from './utils/wait-for-the-game-to-launch';

describe('Player substitutes another player (e2e)', () => {
  let app: INestApplication;
  let playersService: PlayersService;
  let adminToken: string;
  let gameId: GameId;
  let playerSocket: Socket;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    app.enableShutdownHooks();
    await app.listen(3000);

    playersService = app.get(PlayersService);
    const authService = app.get(AuthService);
    adminToken = await authService.generateJwtToken(
      JwtTokenPurpose.auth,
      (
        await playersService.findBySteamId(players[0])
      ).id,
    );

    const playerToken = await authService.generateJwtToken(
      JwtTokenPurpose.websocket,
      (
        await playersService.findBySteamId(players[12])
      ).id,
    );

    playerSocket = io(
      `http://localhost:${app.getHttpServer().address().port}`,
      {
        auth: { token: `Bearer ${playerToken}` },
      },
    );
  });

  beforeAll(async () => {
    const gamesService = app.get(GamesService);
    const game = await gamesService.create(
      [
        {
          id: 0,
          gameClass: Tf2ClassName.scout,
          playerId: (await playersService.findBySteamId(players[0]))._id,
          ready: true,
        },
        {
          id: 1,
          gameClass: Tf2ClassName.scout,
          playerId: (await playersService.findBySteamId(players[1]))._id,
          ready: true,
        },
        {
          id: 2,
          gameClass: Tf2ClassName.scout,
          playerId: (await playersService.findBySteamId(players[2]))._id,
          ready: true,
        },
        {
          id: 3,
          gameClass: Tf2ClassName.scout,
          playerId: (await playersService.findBySteamId(players[3]))._id,
          ready: true,
        },
        {
          id: 4,
          gameClass: Tf2ClassName.soldier,
          playerId: (await playersService.findBySteamId(players[4]))._id,
          ready: true,
        },
        {
          id: 5,
          gameClass: Tf2ClassName.soldier,
          playerId: (await playersService.findBySteamId(players[5]))._id,
          ready: true,
        },
        {
          id: 6,
          gameClass: Tf2ClassName.soldier,
          playerId: (await playersService.findBySteamId(players[6]))._id,
          ready: true,
        },
        {
          id: 7,
          gameClass: Tf2ClassName.soldier,
          playerId: (await playersService.findBySteamId(players[7]))._id,
          ready: true,
        },
        {
          id: 8,
          gameClass: Tf2ClassName.demoman,
          playerId: (await playersService.findBySteamId(players[8]))._id,
          ready: true,
        },
        {
          id: 9,
          gameClass: Tf2ClassName.demoman,
          playerId: (await playersService.findBySteamId(players[9]))._id,
          ready: true,
        },
        {
          id: 10,
          gameClass: Tf2ClassName.medic,
          playerId: (await playersService.findBySteamId(players[10]))._id,
          ready: true,
          canMakeFriendsWith: [
            Tf2ClassName.scout,
            Tf2ClassName.soldier,
            Tf2ClassName.demoman,
          ],
        },
        {
          id: 11,
          gameClass: Tf2ClassName.medic,
          playerId: (await playersService.findBySteamId(players[11]))._id,
          ready: true,
          canMakeFriendsWith: [
            Tf2ClassName.scout,
            Tf2ClassName.soldier,
            Tf2ClassName.demoman,
          ],
        },
      ],
      'cp_badlands',
    );
    gameId = game._id;
    await waitABit(1000);
    await waitForTheGameToLaunch(app, gameId.toString());
  });

  afterAll(async () => {
    await waitABit(1000);

    const gamesService = app.get(GamesService);
    await gamesService.forceEnd(gameId);

    playerSocket.disconnect();
    await waitABit(1000);
    await app.close();
  });

  it('should substitute a player', async () => {
    const replacee = await playersService.findBySteamId(players[1]);
    const replacement = await playersService.findBySteamId(players[12]);

    // admin requests substitute
    await request(app.getHttpServer())
      .put(`/games/${gameId}/substitute-player?player=${replacee.id}`)
      .set('Cookie', [`auth_token=${adminToken}`])
      .expect(200);

    await request(app.getHttpServer())
      .get(`/games/${gameId}`)
      .expect(200)
      .then((response) => {
        const body = response.body;
        const slot = body.slots.find((s: any) => s.player.id === replacee.id);
        expect(slot.status).toEqual('waiting for substitute');
      });

    // player takes the substitute spot
    await new Promise<void>((resolve) => {
      playerSocket.emit(
        'replace player',
        { gameId, replaceeId: replacee.id },
        () => {
          resolve();
        },
      );
    });

    await request(app.getHttpServer())
      .get(`/games/${gameId}`)
      .expect(200)
      .then((response) => {
        const body = response.body;
        expect(
          body.slots.find((s: any) => s.player.id === replacement.id).status,
        ).toBe('active');
        expect(
          body.slots.find((s: any) => s.player.id === replacee.id).status,
        ).toBe('replaced');
      });
  });
});
