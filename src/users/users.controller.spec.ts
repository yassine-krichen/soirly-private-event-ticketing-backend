import { UsersController } from './users.controller';

describe('UsersController', () => {
  it('should be defined with mocked service', () => {
    const service = {
      findEventsByInviter: jest.fn(),
    } as any;

    const controller = new UsersController(service);
    expect(controller).toBeDefined();
  });
});
