import { TranslateService } from '@ngx-translate/core';

/**
 * The toast shown after deleting servers, tags or categories: the quoted name for a single
 * entity, a count for several, so a bulk delete never produces one toast per entity.
 * `keyPrefix` is the translation group holding `deleted-title`, `deleted-title-plural` and
 * `deleted-count`.
 */
export function deletedToast(
  translateService: TranslateService,
  keyPrefix: string,
  names: string[],
): { message: string; title: string } {
  if (names.length === 1) {
    return {
      message: `"${names[0]}"`,
      title: translateService.instant(`${keyPrefix}.deleted-title`),
    };
  }

  return {
    message: translateService.instant(`${keyPrefix}.deleted-count`, { count: names.length }),
    title: translateService.instant(`${keyPrefix}.deleted-title-plural`),
  };
}
