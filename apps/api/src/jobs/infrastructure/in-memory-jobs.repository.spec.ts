import { InMemoryJobsRepository } from './in-memory-jobs.repository.js';

describe('InMemoryJobsRepository', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists the most recently inserted job first when timestamps are equal', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T10:00:00.000Z'));
    const repository = new InMemoryJobsRepository();
    const first = repository.create(['https://first.test']);
    const second = repository.create(['https://second.test']);

    expect(first.createdAt).toBe(second.createdAt);
    expect(repository.list().map((job) => job.id)).toEqual([second.id, first.id]);
  });
});
