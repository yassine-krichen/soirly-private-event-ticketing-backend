import { AuthController } from './auth.controller';

describe('AuthController', () => {
  it('should be defined with mock service', () => {
    const service = {
      authenticateWithGoogle: jest.fn(),
      getProfile: jest.fn(),
    } as any;

    const controller = new AuthController(service);
    expect(controller).toBeDefined();
  });
});
