import { PaymentsController } from './payments.controller';

describe('PaymentsController', () => {
  it('should be defined with mocked service', () => {
    const service = {
      createPayment: jest.fn(),
      getStatus: jest.fn(),
      processWebhook: jest.fn(),
    } as any;

    const controller = new PaymentsController(service);
    expect(controller).toBeDefined();
  });
});
