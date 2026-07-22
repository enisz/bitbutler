import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { inBrowser, useRoute } from 'vitepress';
import { nextTick, watch } from 'vue';
import './style.css';

export default {
  extends: DefaultTheme,
  setup() {
    if (!inBrowser) return;

    const route = useRoute();
    const zoom = async () => {
      const { default: mediumZoom } = await import('medium-zoom');
      mediumZoom('.vp-doc img', { background: 'rgba(0, 0, 0, 0.8)' });
    };

    watch(
      () => route.path,
      () => nextTick(zoom),
      { immediate: true },
    );
  },
} satisfies Theme;
