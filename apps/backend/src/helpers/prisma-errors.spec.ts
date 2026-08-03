import { isPrismaError } from './prisma-errors';

describe('isPrismaError', () => {
  it('matches an object carrying the expected Prisma code', () => {
    expect(isPrismaError({ code: 'P2002' }, 'P2002')).toBe(true);
    expect(isPrismaError({ code: 'P2003' }, 'P2003')).toBe(true);
  });

  it('rejects a different code', () => {
    expect(isPrismaError({ code: 'P2002' }, 'P2003')).toBe(false);
  });

  it('rejects non-error values', () => {
    expect(isPrismaError(null, 'P2002')).toBe(false);
    expect(isPrismaError(undefined, 'P2002')).toBe(false);
    expect(isPrismaError('P2002', 'P2002')).toBe(false);
    expect(isPrismaError({}, 'P2002')).toBe(false);
  });
});
