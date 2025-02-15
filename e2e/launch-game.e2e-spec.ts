import { AppModule } from '@/app.module';
import { JwtTokenPurpose } from '@/auth/jwt-token-purpose';
import { AuthService } from '@/auth/services/auth.service';
import { configureApplication } from '@/configure-application';
import { PlayersService } from '@/players/services/players.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { isNumber, isUndefined } from 'lodash';
import { io, Socket } from 'socket.io-client';
import * as request from 'supertest';
import { players } from './test-data';
import { waitABit } from './utils/wait-a-bit';
import { waitForTheGameToLaunch } from './utils/wait-for-the-game-to-launch';

const connectSocket = (port: number, token: string) =>
  new Promise<Socket>((resolve, reject) => {
    const socket = io(`http://localhost:${port}`, {
      auth: { token: `Bearer ${token}` },
    });
    socket.on('connect_error', (error) => reject(error));
    socket.on('connect', () => {
      resolve(socket);
    });
  });

interface Client {
  playerId: string;
  socket: Socket;
}

describe('Launch game (e2e)', () => {
  let app: INestApplication;
  let clients: Client[];

  // players[0] is the super-user
  let authToken: string;
  let newGameId: string;
  let activeGameId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.listen(3000);

    clients = [];
    const playersService = app.get(PlayersService);
    const authService = app.get(AuthService);

    for (let i = 0; i < 12; ++i) {
      // skipcq: JS-0032
      const playerId = (await playersService.findBySteamId(players[i])).id;

      // skipcq: JS-0032
      const token = await authService.generateJwtToken(
        JwtTokenPurpose.websocket,
        playerId,
      );

      // skipcq: JS-0032
      const socket = await connectSocket(
        app.getHttpServer().address().port,
        token,
      );
      clients.push({ playerId, socket });
    }

    // skipcq: JS-0032
    authToken = await authService.generateJwtToken(
      JwtTokenPurpose.auth,
      clients[0].playerId,
    );
  });

  beforeAll(() => {
    clients[0].socket.on('game created', (game) => {
      newGameId = game.id;
    });

    clients[0].socket.on('profile update', (profile) => {
      activeGameId = profile.activeGameId;
    });
  });

  afterAll(async () => {
    clients.forEach((player) => player.socket.disconnect());
    clients = [];

    await waitABit(40 * 1000); // wait for the gameserver to cleanup
    await app.close();
  });

  it('should launch the game when 12 players join the game and ready up', async () => {
    await request(app.getHttpServer())
      .get('/queue/config')
      .expect(200)
      .then((response) => {
        const body = response.body;
        expect(body).toEqual({
          teamCount: 2,
          classes: [
            {
              name: 'scout',
              count: 2,
            },
            {
              name: 'soldier',
              count: 2,
            },
            {
              name: 'demoman',
              count: 1,
            },
            {
              name: 'medic',
              count: 1,
              canMakeFriendsWith: ['scout', 'soldier', 'demoman'],
            },
          ],
        });
      });

    // all 12 players join the queue
    let lastSlotId = 0;
    for (let i = 0; i < 12; ++i) {
      clients[i].socket.emit('join queue', { slotId: lastSlotId++ });
      // skipcq: JS-0032
      await waitABit(150);
    }

    await waitABit(100);
    await request(app.getHttpServer())
      .get('/queue')
      .expect(200)
      .then((response) => {
        const body = response.body;
        expect(body.state).toEqual('ready');
        expect(body.slots.every((slot: any) => slot.player !== null)).toBe(
          true,
        );
        expect(
          clients
            .map((p) => p.playerId)
            .every((playerId) =>
              body.slots.find((s: any) => s.player.id === playerId),
            ),
        ).toBe(true);
      });

    // queue is in ready state
    // all 12 players ready up
    for (let i = 0; i < 12; ++i) {
      clients[i].socket.emit('player ready');
      // skipcq: JS-0032
      await waitABit(150);
    }

    await waitABit(500);
    await request(app.getHttpServer())
      .get('/queue')
      .expect(200)
      .then((response) => {
        const body = response.body;
        expect(body.state).toEqual('waiting');
        expect(body.slots.every((slot: any) => isUndefined(slot.player))).toBe(
          true,
        );
      });

    // the new game should be announced to all clients
    expect(newGameId).toBeTruthy();
    // the new game should be assigned to all players
    expect(activeGameId).toEqual(newGameId);

    await request(app.getHttpServer())
      .get(`/games/${newGameId}`)
      .expect(200)
      .then((response) => {
        const body = response.body;
        expect(['created', 'configuring'].includes(body.state)).toBe(true);
        expect(body.launchedAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
        expect(
          clients
            .map((p) => p.playerId)
            .every((playerId) =>
              body.slots.find((s: any) => s.player.id === playerId),
            ),
        ).toBe(true);
      });

    await request(app.getHttpServer())
      .get(`/games/${newGameId}/skills`)
      .set('Cookie', [`auth_token=${authToken}`])
      .expect(200)
      .then((response) => {
        const body = response.body;
        expect(
          clients
            .map((p) => p.playerId)
            .every((playerId) => isNumber(body[playerId])),
        ).toBe(true);
      });

    await waitForTheGameToLaunch(app, newGameId);

    await request(app.getHttpServer())
      .get(`/games/${newGameId}/connect-info`)
      .expect(401);

    await request(app.getHttpServer())
      .get(`/games/${newGameId}/connect-info`)
      .set('Cookie', [`auth_token=${authToken}`])
      .expect(200);

    // kill the game
    await waitABit(500);
    await request(app.getHttpServer())
      .put(`/games/${newGameId}/force-end`)
      .set('Cookie', [`auth_token=${authToken}`])
      .expect(200);

    await request(app.getHttpServer())
      .get(`/games/${newGameId}`)
      .expect(200)
      .then((response) => {
        const body = response.body;
        expect(body.state).toEqual('interrupted');
      });

    // all players should be freed
    expect(activeGameId).toBe(null);
  });
});
