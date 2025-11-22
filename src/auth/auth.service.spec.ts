import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('should be defined with mocked dependencies', () => {
    const usersService = {
      upsertGoogleUser: jest.fn(),
      findById: jest.fn(),
    } as any;
    const jwtService = { sign: jest.fn() } as any;
    const configService = { get: jest.fn().mockReturnValue('test-google-client') } as any;

    const service = new AuthService(usersService, jwtService, configService);

    expect(service).toBeDefined();
  });
});
