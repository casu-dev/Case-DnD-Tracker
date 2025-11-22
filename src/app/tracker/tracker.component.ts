import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TrackerData } from '../../models/tracker.model';

@Component({
  selector: 'app-tracker',
  imports: [],
  templateUrl: './tracker.component.html',
  styleUrls: ['./tracker.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackerComponent {
  trackerData = input.required<TrackerData>();
  disconnect = output<void>();

  onDisconnect(): void {
    this.disconnect.emit();
  }
}
