import type { Theme } from 'vitepress';
import { inBrowser, useData, useRoute } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { nextTick, watch } from 'vue';
import { formatLastUpdated } from './lastUpdated';
import './style.css';

export default {
  extends: DefaultTheme,
  setup() {
    if (!inBrowser) return;

    const route = useRoute();
    const { lang } = useData();
    const zoom = async () => {
      const { default: mediumZoom } = await import('medium-zoom');
      mediumZoom('.vp-doc img', { background: 'rgba(0, 0, 0, 0.8)' });
    };

    // VPDocFooterLastUpdated only supports Intl.DateTimeFormat options and has no
    // relative-time support (see node_modules/vitepress/dist/client/theme-default/
    // components/VPDocFooterLastUpdated.vue). Rewrite its rendered <time> markup in
    // place instead of replacing the component, so its layout/CSS stay untouched.
    const applyLastUpdatedFormat = () => {
      document
        .querySelectorAll<HTMLTimeElement>('.VPLastUpdated time[datetime]')
        .forEach((time) => {
          const date = new Date(time.getAttribute('datetime')!);
          if (Number.isNaN(date.getTime())) return;

          const formatted = formatLastUpdated(date, lang.value);
          if (time.innerHTML !== formatted) time.innerHTML = formatted;
        });
    };

    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(applyLastUpdatedFormat).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    watch(
      () => route.path,
      () =>
        nextTick(() => {
          zoom();
          applyLastUpdatedFormat();
        }),
      { immediate: true },
    );
  },
} satisfies Theme;
