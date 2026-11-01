import { TranslateService } from '@ngx-translate/core';

/**
 * The toast shown after deleting servers, tags or categories: the quoted name for a single
 * entity, a count for several, so a bulk delete never produces one toast per entity.
 * `keyPrefix` is the translation group holding `<keyBase>-title`, `<keyBase>-title-plural` and
 * `<keyBase>-count`; `keyBase` is `deleted` unless another action reuses the same toast shape.
 */
export function deletedToast(
  translateService: TranslateService,
  keyPrefix: string,
  names: string[],
  keyBase = 'deleted',
): { message: string; title: string } {
  if (names.length === 1) {
    return {
      message: `"${names[0]}"`,
      title: translateService.instant(`${keyPrefix}.${keyBase}-title`),
    };
  }

  return {
    message: translateService.instant(`${keyPrefix}.${keyBase}-count`, { count: names.length }),
    title: translateService.instant(`${keyPrefix}.${keyBase}-title-plural`),
  };
}
