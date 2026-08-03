import { ConnectionProbe } from './connection-probe.service';
import type {
  TargetConnection,
  TargetConnectionFactory,
} from './target-connection.factory';

const PARAMS = {
  host: 'db.example.com',
  port: 5432,
  database: 'app',
  user: 'rowhouse_ro',
  password: 'pw',
  ssl: true,
};

function fakeFactory(behavior: {
  connectError?: Error;
  rows?: unknown[];
  queryError?: Error;
}) {
  const end = jest.fn().mockResolvedValue(undefined);
  const query = jest.fn(() =>
    behavior.queryError
      ? Promise.reject(behavior.queryError)
      : Promise.resolve({ rows: behavior.rows ?? [] }),
  );
  const factory = {
    connect: jest.fn(() =>
      behavior.connectError
        ? Promise.reject(behavior.connectError)
        : Promise.resolve({ query, end } as TargetConnection),
    ),
  } as unknown as TargetConnectionFactory;
  return { factory, query, end };
}

describe('ConnectionProbe', () => {
  it('reports an unreachable database with the underlying error', async () => {
    const { factory } = fakeFactory({
      connectError: new Error('ECONNREFUSED'),
    });
    const probe = new ConnectionProbe(factory);

    const result = await probe.probe(PARAMS, { checkWriteCapability: false });

    expect(result).toEqual({
      connected: false,
      canWrite: false,
      error: 'ECONNREFUSED',
    });
  });

  it('runs a plain liveness check when write capability is not in question', async () => {
    const { factory, query, end } = fakeFactory({ rows: [] });
    const probe = new ConnectionProbe(factory);

    const result = await probe.probe(PARAMS, { checkWriteCapability: false });

    expect(result).toEqual({ connected: true, canWrite: false });
    expect(query).toHaveBeenCalledWith('SELECT 1');
    expect(end).toHaveBeenCalled();
  });

  it('flags a "read-only" role that holds write grants', async () => {
    const { factory } = fakeFactory({
      rows: [{ can_create: false, can_mutate: true }],
    });
    const probe = new ConnectionProbe(factory);

    const result = await probe.probe(PARAMS, { checkWriteCapability: true });

    expect(result).toEqual({ connected: true, canWrite: true });
  });

  it('passes a genuinely read-only role', async () => {
    const { factory } = fakeFactory({
      rows: [{ can_create: false, can_mutate: false }],
    });
    const probe = new ConnectionProbe(factory);

    const result = await probe.probe(PARAMS, { checkWriteCapability: true });

    expect(result).toEqual({ connected: true, canWrite: false });
  });

  it('closes the connection even when the probe query fails', async () => {
    const { factory, end } = fakeFactory({
      queryError: new Error('permission denied'),
    });
    const probe = new ConnectionProbe(factory);

    const result = await probe.probe(PARAMS, { checkWriteCapability: true });

    expect(result.connected).toBe(true);
    expect(result.error).toBe('permission denied');
    expect(end).toHaveBeenCalled();
  });
});
