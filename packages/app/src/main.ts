import { bootstrapApplication } from '@angular/platform-browser';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { initRendererLogger } from './app/renderer-logger';

initRendererLogger();
ModuleRegistry.registerModules([AllCommunityModule]);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
