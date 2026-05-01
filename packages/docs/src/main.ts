import { bootstrapApplication } from '@angular/platform-browser';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'zone.js';
import { AppComponent } from './app/app';
import { appConfig } from './app/app.config';
import './styles.scss';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
