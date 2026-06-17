import { ChangeDetectionStrategy, Component, inject, input, output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ROOM_ID_STORAGE_KEY, TrackerSyncService } from '../../services/tracker-sync.service';

@Component({
  selector: 'app-connection',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './connection.component.html',
  styleUrls: ['./connection.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionComponent implements OnInit {
  private trackerSyncService = inject(TrackerSyncService);

  connectionState = input.required<'disconnected' | 'connecting' | 'connected' | 'error' | 'waiting'>();
  errorMessage = input.required<string | null>();
  connect = output<string>();
  disconnect = output<void>();

  roomId = signal('');

  ngOnInit(): void {
    const roomIdFromUrl = this.trackerSyncService.getRoomIdFromUrl();
    if (roomIdFromUrl) {
      this.roomId.set(roomIdFromUrl);
      return;
    }

    const savedRoomId = localStorage.getItem(ROOM_ID_STORAGE_KEY);
    if (savedRoomId) {
      this.roomId.set(savedRoomId);
    }
  }

  onConnect(): void {
    this.connect.emit(this.roomId().trim());
  }

  onCancel(): void {
    this.disconnect.emit();
  }
}