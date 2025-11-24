import 'zone.js'; // Ensure this line is present and at the top
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZoneChangeDetection } from '@angular/core';

import { AppComponent } from './src/app.component';

bootstrapApplication(AppComponent, {
  providers: [provideZoneChangeDetection()],
}).catch((err) => console.error(err));

// AI Studio always uses an `index.tsx` file for all project types.
