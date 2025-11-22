import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TrackerSyncService, ROOM_ID_STORAGE_KEY } from './services/tracker-sync.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private trackerSyncService = inject(TrackerSyncService);

  roomId = signal('');

  // Directly use signals from the service
  trackerData = this.trackerSyncService.trackerData;
  connectionState = this.trackerSyncService.connectionState;
  errorMessage = this.trackerSyncService.errorMessage;

  ngOnInit(): void {
    const savedRoomId = localStorage.getItem(ROOM_ID_STORAGE_KEY);
    if (savedRoomId) {
      this.roomId.set(savedRoomId);
    }
  }

  connect(): void {
    if (this.roomId().trim()) {
      this.trackerSyncService.connect(this.roomId().trim());
    }
  }

  reset(): void {
    this.trackerSyncService.disconnect();
    this.roomId.set('');
  }
}
