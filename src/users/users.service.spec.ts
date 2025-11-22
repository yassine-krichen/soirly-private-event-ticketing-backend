import { UsersService } from './users.service';

describe('UsersService', () => {
  it('should be defined with mocked Prisma service', () => {
    const prismaMock = {
      user: {},
      event: {},
    } as any;

    const service = new UsersService(prismaMock);
    expect(service).toBeDefined();
  });
});
