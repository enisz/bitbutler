import { bootstrapApplication } from '@angular/platform-browser';
import 'zone.js';
import { AppComponent } from './app/app';
import { appConfig } from './app/app.config';
import './styles.scss';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
