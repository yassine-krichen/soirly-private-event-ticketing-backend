import { EventsController } from './events.controller';

describe('EventsController', () => {
  it('should be defined with mocked service', () => {
    const service = {
      create: jest.fn(),
      findOne: jest.fn(),
    } as any;

    const controller = new EventsController(service);
    expect(controller).toBeDefined();
  });
});
