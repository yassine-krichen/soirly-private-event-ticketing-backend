import { EventsService } from './events.service';

describe('EventsService', () => {
  it('should be defined with mocked Prisma service', () => {
    const prismaMock = {
      event: {},
    } as any;

    const service = new EventsService(prismaMock);
    expect(service).toBeDefined();
  });
});
