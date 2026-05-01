import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SettingsService] });
    service = TestBed.inject(SettingsService);
  });

  it('should call settings.get with the given id', async () => {
    const spy = vi.spyOn(window.bitbutler.settings, 'get').mockResolvedValue({ foo: 'bar' });
    const result = await service.get<{ foo: string }>('my-id');
    expect(spy).toHaveBeenCalledWith({ id: 'my-id' });
    expect(result).toEqual({ foo: 'bar' });
  });

  it('should call settings.upsert with the given id and value', async () => {
    const spy = vi.spyOn(window.bitbutler.settings, 'upsert').mockResolvedValue(undefined as any);
    await service.set('my-id', { value: 123 });
    expect(spy).toHaveBeenCalledWith({ id: 'my-id', value: { value: 123 } });
  });

  it('should call settings.delete with the given id', async () => {
    const spy = vi.spyOn(window.bitbutler.settings, 'delete').mockResolvedValue(undefined as any);
    await service.delete('my-id');
    expect(spy).toHaveBeenCalledWith({ id: 'my-id' });
  });

  it('should return null when settings.get returns null', async () => {
    vi.spyOn(window.bitbutler.settings, 'get').mockResolvedValue(null);
    const result = await service.get('non-existent');
    expect(result).toBeNull();
  });
});
