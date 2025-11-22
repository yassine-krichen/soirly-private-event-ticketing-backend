import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  it('should be defined with mocked dependencies', () => {
    const prisma = {
      payment: {},
      $transaction: jest.fn(),
    } as any;
    const eventsService = { findOne: jest.fn(), incrementInviteeCount: jest.fn() } as any;
    const konnectService = { createSession: jest.fn() } as any;
    const configService = { get: jest.fn().mockReturnValue('mock') } as any;

    const service = new PaymentsService(prisma, eventsService, konnectService, configService);
    expect(service).toBeDefined();
  });
});
