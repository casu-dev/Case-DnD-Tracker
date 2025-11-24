import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TrackerSyncService } from './services/tracker-sync.service';
import { ConnectionComponent } from './app/connection/connection.component';
import { TrackerComponent } from './app/tracker/tracker.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ConnectionComponent, TrackerComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private trackerSyncService = inject(TrackerSyncService);

  // Expose service signals to the template
  trackerData = this.trackerSyncService.trackerData;
  connectionState = this.trackerSyncService.connectionState;
  errorMessage = this.trackerSyncService.errorMessage;

  connect(roomId: string): void {
    if (roomId) {
      this.trackerSyncService.connect(roomId);
    }
  }

  disconnect(): void {
    this.trackerSyncService.disconnect();
  }
}